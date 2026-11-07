"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { useSession, useCapability } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { PROFILES } from "@/lib/profiles";
import { allocatedRamMb } from "@/lib/mock/overview";
import { allServiceInstances } from "@/lib/mock/services";

type Goal = "website" | "storage" | "media" | "delivery" | "performance" | "automation" | "selfhost";
const GOALS: { id: Goal; title: string; desc: string; icon: string }[] = [
  {id:"website",title:"Publish a website",desc:"WordPress or a web app — choose a publishing path",icon:"🌐"},
  {id:"storage",title:"Store files and backups",desc:"S3-compatible buckets and access credentials",icon:"🗂️"},
  {id:"media",title:"Optimize images",desc:"Resize, convert and deliver images efficiently",icon:"🖼️"},
  {id:"delivery",title:"Speed up asset delivery",desc:"Cache assets and configure delivery endpoints",icon:"⚡"},
  {id:"performance",title:"Add cache or search",desc:"Redis-style caching, search and queue workers",icon:"🔎"},
  {id:"automation",title:"Automate a workflow",desc:"n8n and background services",icon:"🔁"},
  {id:"selfhost",title:"Install a self-hosted app",desc:"Nextcloud, Gitea, Ghost, Uptime Kuma and more",icon:"📦"},
];
const CATEGORIES: Record<Goal,string[]> = {
 website:["self_hosted_app"],storage:["storage"],media:["transform"],delivery:["delivery"],
 performance:["cache","search","queue"],automation:["self_hosted_app"],selfhost:["self_hosted_app"]
};
const STEPS = ["Choose your goal","Pick a service","Check resources","Continue to setup"];
export default function GuidedServiceSetup() {
  const {profile}=useSession();
  const docker=useCapability("service.docker");
  const storage=useCapability("service.storage");
  const [step,setStep]=useState(0);
  const [goal,setGoal]=useState<Goal>("selfhost");
  const [query,setQuery]=useState("");
  const [templateKey,setTemplateKey]=useState("");
  const [ack,setAck]=useState(false);
  const options=useMemo(()=>db.templates.filter(t=>t.published && CATEGORIES[goal].includes(t.category) && `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase()) && (goal!=="automation" || /n8n/i.test(t.name))),[goal,query]);
  const chosen=db.templates.find(t=>t.key===templateKey);
  const required=chosen?.ram_ceiling_mb ?? 0;
  const available=Math.max(0,PROFILES[profile].specs.ram_mb-allocatedRamMb());
  const unavailable=chosen ? (chosen.docker_required && docker.state==="unavailable") || (chosen.category==="storage" && storage.state==="unavailable") : false;
  const fits=chosen ? required<=available : false;
  const installed=allServiceInstances().filter(s=>s.template_key===templateKey).length;
  const deployUrl=chosen ? `/templates/${chosen.key}/deploy` : "/templates";
  return <Screen id="UX-SVC-009" breadcrumbs={[{label:"Platform services",href:"/services"},{label:"Guided setup"}]} description="Choose a task first; NexusPanel will connect it to the right service and explain the host requirements.">
    <div className="mx-auto max-w-5xl space-y-5">
      <Callout tone="info" title="Interactive design prototype">No service is installed by this wizard. Resource figures and service inventory are simulated. Deployment continues through the existing template workflow.</Callout>
      <nav aria-label="Service setup progress" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{STEPS.map((s,i)=><button type="button" key={s} disabled={i>step} onClick={()=>setStep(i)} aria-current={i===step?"step":undefined} className={`rounded-xl border p-3 text-left text-xs transition ${i===step?"border-accent bg-accent-soft text-accent":"border-line bg-surface text-ink-2"} disabled:cursor-not-allowed disabled:opacity-50`}><span className="block text-[11px] opacity-75">Step {i+1} of 4</span><strong>{s}</strong></button>)}</nav>
      {step===0&&<Card title="What would you like to run?" description="Start with the outcome you want, not the underlying technology."><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{GOALS.map(g=><button type="button" key={g.id} onClick={()=>{setGoal(g.id);setTemplateKey("");setQuery("");setAck(false);}} aria-pressed={goal===g.id} className={`rounded-xl border p-4 text-left transition hover:border-accent ${goal===g.id?"border-accent bg-accent-soft":"border-line bg-surface"}`}><span aria-hidden="true" className="text-2xl">{g.icon}</span><strong className="mt-2 block text-sm text-ink">{g.title}</strong><span className="mt-1 block text-xs text-ink-2">{g.desc}</span></button>)}</div><div className="mt-5 flex flex-wrap gap-2"><Button onClick={()=>setStep(1)}>Browse matching services</Button><ButtonLink href="/services" variant="secondary">My services</ButtonLink></div></Card>}
      {step===1&&<Card title="Choose a service" description={`Matching templates for “${GOALS.find(g=>g.id===goal)?.title}”. All catalog entries remain accessible in the full catalog.`}><div className="mt-4"><label htmlFor="service-search" className="block text-xs font-medium text-ink-2">Filter matching services</label><input id="service-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search services…" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink sm:max-w-sm"/></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{options.map(t=><button type="button" key={t.key} onClick={()=>{setTemplateKey(t.key);setAck(false);}} aria-pressed={templateKey===t.key} className={`rounded-xl border p-4 text-left ${templateKey===t.key?"border-accent bg-accent-soft":"border-line hover:border-accent"}`}><strong className="block text-sm">{t.name}</strong><span className="mt-1 block text-xs text-ink-2">{t.description}</span><span className="mt-2 block text-xs text-ink-2">{t.docker_required?"Docker required":"Native / no Docker required"}</span></button>)}{options.length===0&&<p className="text-sm text-ink-2">No matching template in this demo catalog. Browse the full catalog for more options.</p>}</div><div className="mt-5 flex flex-wrap gap-2"><Button disabled={!chosen} onClick={()=>setStep(2)}>Check compatibility</Button><Button variant="secondary" onClick={()=>setStep(0)}>Back</Button><ButtonLink href="/templates" variant="ghost">Full catalog</ButtonLink></div></Card>}
      {step===2&&<Card title="Will this run on your VPS?" description="A transparent preflight before requesting any deployment.">{chosen&&<div className="mt-4 space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[{label:"Current profile",value:PROFILES[profile].label},{label:"Estimated free RAM",value:`${available} MB`},{label:"Template RAM ceiling",value:`${required} MB`}].map(x=><div key={x.label} className="rounded-xl border border-line bg-surface-2 p-4"><span className="block text-xs text-ink-2">{x.label}</span><strong className="mt-1 block text-lg">{x.value}</strong></div>)}</div><Callout tone={unavailable||!fits?"warning":"info"} title={unavailable?"Capability unavailable on this profile":!fits?"Resource preflight requires attention":"No immediate demo preflight blocker"}>{unavailable?"This template needs a capability that this VPS profile does not provide. Review the upgrade path or choose another service.":!fits?"The template RAM ceiling exceeds the estimated headroom. Select a larger profile or a lighter service.":"This is a simulated resource check, not a guarantee of successful installation. The deployment workflow performs its own checks."}</Callout><p className="text-sm text-ink-2">Existing demo instances of this template: <strong>{installed}</strong>. Public exposure, credentials, backups and actual provisioning are configured in the dedicated deploy wizard.</p><div className="flex flex-wrap gap-2"><Button disabled={unavailable||!fits} onClick={()=>setStep(3)}>Continue to setup</Button><Button variant="secondary" onClick={()=>setStep(1)}>Choose another</Button><ButtonLink href={`/templates/${chosen.key}`} variant="ghost">Template details</ButtonLink></div></div>}</Card>}
      {step===3&&<Card title="Your installation plan" description="Review what happens next; this screen does not claim anything has been deployed.">{chosen&&<div className="mt-4 space-y-4"><div className="rounded-xl border border-line bg-surface-2 p-4 text-sm"><p><strong>Service:</strong> {chosen.name}</p><p className="mt-2"><strong>Profile:</strong> {PROFILES[profile].label}</p><p className="mt-2"><strong>Deployment:</strong> Choose name, exposure and backup policy in the next wizard</p><p className="mt-2"><strong>After installation:</strong> Verify health, connect a domain if needed, configure credentials and backups</p></div><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} className="mt-1"/><span>I understand this is a prototype and the next screen uses simulated deployment operations.</span></label><div className="flex flex-wrap gap-2">{ack?<ButtonLink href={deployUrl}>Open deployment wizard</ButtonLink>:<Button disabled>Open deployment wizard</Button>}<Button variant="secondary" onClick={()=>setStep(2)}>Back</Button><ButtonLink href="/services" variant="ghost">My services</ButtonLink></div></div>}</Card>}
      <p className="text-xs text-ink-3">Detailed tools: <Link href="/services" className="text-accent hover:underline">Platform services</Link> · <Link href="/templates" className="text-accent hover:underline">Template catalog</Link> · <Link href="/services/storage/new" className="text-accent hover:underline">Storage bucket setup</Link></p>
    </div>
  </Screen>;
}
