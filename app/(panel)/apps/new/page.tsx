"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { UnavailableState } from "@/components/common/states";
import { useCapability, useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Stepper } from "@/components/ui/nav";
import { Callout } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { provisionApp } from "@/lib/api/web";
import { RUNTIME_CATALOG } from "@/lib/mock/web";

const STEPS = ["Project", "Source", "Runtime", "Domain", "Review"];
const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validDomain = /^(?=.{4,253}$)(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

/** UX-WEB-008: guided Node.js deployment. Domain is a recorded prototype intent,
 * not a fabricated DNS or certificate mutation. The operation API stays unchanged. */
export default function NewAppWizardPage() {
  const cap = useCapability("app.node");
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [source, setSource] = useState<"git" | "upload">("git");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [runtimeVersion, setRuntimeVersion] = useState("22 LTS");
  const [buildCommand, setBuildCommand] = useState("npm ci && npm run build");
  const [startCommand, setStartCommand] = useState("npm start");
  const [envText, setEnvText] = useState("");
  const [domainMode, setDomainMode] = useState<"preview" | "existing">("preview");
  const [domain, setDomain] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const envLines = envText.split("\n").map((line) => line.trim()).filter(Boolean);
  const envCount = envLines.filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).length;
  const versions = RUNTIME_CATALOG.filter((runtime) => runtime.runtime_kind === "node");
  const runtimeFound = versions.some((runtime) => runtime.version === runtimeVersion);
  const preview = name && validSlug.test(name) ? `${name}.preview.nexuspanel.app` : "Available after naming your app";

  const validate = (target: number) => {
    const next: Record<string, string> = {};
    if (target === 0 && !validSlug.test(name)) next.name = "Use lowercase letters, numbers and single hyphens; no spaces.";
    if (target === 1 && source === "git" && !/^https:\/\/[^\s/]+\/[^\s]+/.test(repoUrl.trim())) next.repo = "Enter a valid HTTPS repository URL.";
    if (target === 2) {
      if (!runtimeFound) next.runtime = "Choose an available Node.js runtime.";
      if (!buildCommand.trim()) next.build = "Provide a build command (use 'true' if none).";
      if (!startCommand.trim()) next.start = "Provide a start command.";
      if (envLines.length !== envCount) next.env = "Each nonempty line must be KEY=value.";
    }
    if (target === 3 && domainMode === "existing" && !validDomain.test(domain.trim())) next.domain = "Enter a valid hostname, e.g. api.example.co.ke.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const next = () => { if (validate(step)) { setChecked(false); setStep((s) => Math.min(s + 1, STEPS.length - 1)); } };
  const submit = async () => {
    for (let s = 0; s < 4; s++) if (!validate(s)) { setStep(s); return; }
    if (cap.state === "unavailable") return;
    setSubmitting(true);
    try {
      const result = await provisionApp({ name, runtime: "node", runtime_version: runtimeVersion, source, repo_url: source === "git" ? repoUrl : undefined, branch, build_command: buildCommand, start_command: startCommand, env_count: envCount });
      setFocusedId(result.operation.id); setTrayOpen(true); setAccepted(result.operation.id);
      push("success", "Deployment queued", "A tracked operation was accepted. Wait for a verified health check before treating it as live.");
    } catch { push("error", "Request not accepted", "Check your project settings and retry."); }
    finally { setSubmitting(false); }
  };

  return <Screen id="UX-WEB-008" breadcrumbs={[{label:"Create something",href:"/launch/web"},{label:"Applications",href:"/apps"},{label:"New Node.js app"}]} description="A connected journey from source code to a running application, with domain guidance and verified deployment status.">
    {cap.state === "unavailable" ? <UnavailableState capabilityKey="app.node" title="Node.js applications are unavailable on this VPS"><Callout tone="info">You can still <Link className="text-accent underline" href="/websites/new">publish a static or PHP website</Link>.</Callout></UnavailableState> :
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="rounded-2xl border border-line bg-surface p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-accent">Guided deployment</p><h2 className="mt-1 text-xl font-semibold text-ink">Publish a Node.js app</h2></div><Link className="text-xs text-accent hover:underline" href="/launch/web">Choose another project type</Link></div><Stepper steps={STEPS} current={step}/></div>
      {accepted !== null ? <Card title="Your deployment request is queued" description="This is a simulated API operation, not confirmation of a live application."><div className="space-y-3"><Callout tone="info" title="Track verification">Follow the operation tray for provisioning, build, release and health-check stages. Do not treat an accepted request as a successful deployment.</Callout><p className="text-sm text-ink-2">Operation: <code className="text-ink">{accepted}</code></p><p className="text-sm text-ink-2">Domain choice: {domainMode === "preview" ? preview : domain}. Connecting an external domain and issuing HTTPS remain separate operations in this prototype.</p><div className="flex flex-wrap gap-3"><Link className="text-sm text-accent underline" href="/apps">Browse applications</Link><Link className="text-sm text-accent underline" href="/domains">Manage DNS</Link></div></div></Card> : <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]"><section className="min-w-0 space-y-4">
        {step === 0 && <Card title="Tell us about your app" description="A short name identifies your application in deployments, logs and domains."><Field label="Application name" htmlFor="app-name" required error={errors.name} hint="Example: orders-api"><Input id="app-name" value={name} onChange={(e)=>setName(e.target.value.toLowerCase())} placeholder="orders-api" spellCheck={false}/></Field><div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm text-ink-2">NexusPanel will provision an isolated serving process after checking the selected VPS capabilities. Build jobs use batch priority.</div></Card>}
        {step === 1 && <Card title="Connect your code" description="Choose a Git repository or stage an archive after creating the application."><div className="mb-4 grid gap-3 sm:grid-cols-2">{(["git","upload"] as const).map((s)=><button key={s} type="button" aria-pressed={source===s} onClick={()=>setSource(s)} className={`rounded-xl border p-4 text-left text-sm ${source===s?"border-accent bg-accent-soft":"border-line bg-surface"}`}><strong className="block text-ink">{s==="git"?"Git repository":"Upload archive"}</strong><span className="mt-1 block text-xs text-ink-2">{s==="git"?"Connect your repository and branch":"Upload source after app creation"}</span></button>)}</div>{source==="git"?<div className="space-y-4"><Field label="Repository HTTPS URL" htmlFor="app-repo" required error={errors.repo}><Input id="app-repo" value={repoUrl} onChange={(e)=>setRepoUrl(e.target.value)} placeholder="https://github.com/organization/project.git"/></Field><Field label="Branch" htmlFor="app-branch"><Input id="app-branch" value={branch} onChange={(e)=>setBranch(e.target.value)} /></Field></div>:<Callout tone="info">This prototype queues an app record; archive upload is performed on the application detail page. No file is uploaded in this step.</Callout>}</Card>}
        {step === 2 && <Card title="Runtime & deployment" description="Advanced options are separate from the simple publishing journey."><div className="space-y-4"><Field label="Node.js version" htmlFor="app-runtime" error={errors.runtime}><Select id="app-runtime" value={runtimeVersion} onChange={(e)=>setRuntimeVersion(e.target.value)}>{versions.map((v)=><option key={v.version} value={v.version}>Node {v.version}</option>)}</Select></Field><Field label="Build command" htmlFor="app-build" error={errors.build}><Input id="app-build" className="font-mono" value={buildCommand} onChange={(e)=>setBuildCommand(e.target.value)}/></Field><Field label="Start command" htmlFor="app-start" error={errors.start}><Input id="app-start" className="font-mono" value={startCommand} onChange={(e)=>setStartCommand(e.target.value)}/></Field><details className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-medium text-ink">Environment variables (advanced) · {envCount} detected</summary><div className="mt-4"><Field label="KEY=value, one per line" htmlFor="app-env" error={errors.env} hint="Prototype only: do not enter real secrets. Values are not sent to a live backend."><Textarea id="app-env" rows={5} className="font-mono text-xs" value={envText} onChange={(e)=>setEnvText(e.target.value)} placeholder="NODE_ENV=production"/></Field></div></details></div></Card>}
        {step === 3 && <Card title="Where should people find your app?" description="Start with a preview address or record an existing domain to connect later."><div className="space-y-3">{(["preview","existing"] as const).map((mode)=><label key={mode} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${domainMode===mode?"border-accent bg-accent-soft":"border-line"}`}><input type="radio" checked={domainMode===mode} onChange={()=>setDomainMode(mode)}/><span><strong className="block text-sm text-ink">{mode==="preview"?"Use a preview hostname":"I have a domain"}</strong><span className="text-xs text-ink-2">{mode==="preview"?preview:"We'll guide you through DNS and HTTPS after provisioning"}</span></span></label>)}{domainMode==="existing"&&<Field label="Domain hostname" htmlFor="app-domain" required error={errors.domain}><Input id="app-domain" value={domain} onChange={(e)=>setDomain(e.target.value)} placeholder="api.example.co.ke"/></Field>}<Callout tone="info">Domain verification, DNS changes and certificate issuance are not automatically performed by this mock app-provisioning API. You can manage these under <Link className="text-accent underline" href="/domains">Domains & DNS</Link>.</Callout></div></Card>}
        {step === 4 && <Card title="Review before deployment" description="Verify the configuration before submitting a simulated asynchronous operation."><KeyValue items={[{label:"Application",value:name},{label:"Source",value:source==="git"?`${repoUrl} (${branch})`:"Upload after creation"},{label:"Runtime",value:`Node ${runtimeVersion}`},{label:"Build",value:buildCommand},{label:"Start",value:startCommand},{label:"Environment keys",value:`${envCount} (values hidden)`},{label:"Hostname intent",value:domainMode==="preview"?preview:domain},{label:"Capability",value:cap.state}]}/><div className="mt-5"><Callout tone="info" title="What happens next">The mock API queues provisioning, build, release and health verification. Domain attachment and HTTPS are separate follow-up actions; they are not falsely marked complete.</Callout></div><label className="mt-4 flex items-start gap-2 text-sm text-ink-2"><input type="checkbox" checked={checked} onChange={(e)=>setChecked(e.target.checked)} className="mt-1"/>I have reviewed the deployment configuration and understand this is a simulated operation.</label></Card>}
      </section><aside className="space-y-4"><Card title="Your project"><div className="space-y-3 text-xs text-ink-2"><p><strong className="block text-ink">App</strong>{name||"Not named yet"}</p><p><strong className="block text-ink">Source</strong>{source==="git"?"Git repository":"Upload archive"}</p><p><strong className="block text-ink">Runtime</strong>Node {runtimeVersion}</p><p><strong className="block text-ink">Address</strong>{domainMode==="preview"?preview:domain||"Not entered"}</p></div></Card><Card title="Capability preflight"><p className="text-xs text-ink-2">{cap.reason || "Node.js support is available for this selected VPS profile."}</p><p className="mt-2 text-xs font-medium text-ink">Status: {cap.state}</p></Card><Card title="Next after deploy"><ol className="list-decimal space-y-2 pl-4 text-xs text-ink-2"><li>Wait for verified health check</li><li>Connect DNS and HTTPS</li><li>View processes and logs</li><li>Configure deployment updates</li></ol></Card></aside></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5"><Button variant="secondary" onClick={()=>setStep((s)=>Math.max(0,s-1))} disabled={step===0}>Back</Button>{step<4?<Button onClick={next}>Continue: {STEPS[step+1]}</Button>:<Button loading={submitting} disabled={!checked} onClick={submit}>Queue deployment</Button>}</div></>}
    </div>}
  </Screen>;
}
