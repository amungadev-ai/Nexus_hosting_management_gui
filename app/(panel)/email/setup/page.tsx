"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { useCapability, useOperationStream, useToast } from "@/components/providers";
import { mailDomains, deliverabilityRecords } from "@/lib/mock/mail";
import { sendTestEmail } from "@/lib/api/mail";
import { CopyButton } from "@/components/ui/code";

type Goal = "send" | "receive" | "diagnose";
const stages = ["Choose goal", "Domain & delivery", "Configure", "Review & next steps"];
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GuidedEmailSetup() {
  const params = useSearchParams();
  const initial = params.get("goal");
  const [goal,setGoal] = useState<Goal>(initial==="receive"||initial==="diagnose"?initial:"send");
  const [step,setStep] = useState(0);
  const [domain,setDomain] = useState(mailDomains[0]?.domain ?? "");
  const [provider,setProvider] = useState("resend");
  const [recipient,setRecipient] = useState("");
  const [attempted,setAttempted] = useState(false);
  const [queued,setQueued] = useState(false);
  const {push} = useToast();
  const {setFocusedId,setTrayOpen} = useOperationStream();
  const relay = useCapability("mail.external_smtp");
  const hosted = useCapability("mail.mailboxes");
  const validDomain = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(domain.trim());
  const canContinue = step===0 || (step===1 && validDomain) || step===2;
  const runTest = () => {
    setAttempted(true);
    if (!emailRe.test(recipient.trim())) return;
    try {
      const op=sendTestEmail(recipient.trim());
      setFocusedId(op.id);setTrayOpen(true);setQueued(true);
      push("info","Demo test queued","Check the operation tray. Queued is not the same as delivered.");
    } catch(e) {push("error","Test could not start",e instanceof Error?e.message:"Check the recipient address.");}
  };
  return <Screen id="UX-MAIL-014" breadcrumbs={[{label:"Email",href:"/email"},{label:"Guided setup"}]} description="A connected journey for outbound SMTP, mailbox providers and delivery troubleshooting.">
    <div className="mx-auto max-w-4xl space-y-5">
      <Callout tone="info" title="Interactive prototype — no live mail changes">All domain, provider and DNS data are illustrative. Only the existing mock operation adapter is called when you queue a test message.</Callout>
      <nav aria-label="Email setup steps" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{stages.map((name,i)=><button key={name} type="button" disabled={i>step} onClick={()=>setStep(i)} aria-current={step===i?"step":undefined} className={`rounded-xl border p-3 text-left text-xs transition ${i===step?"border-accent bg-accent-soft text-accent":"border-line bg-surface text-ink-2"} disabled:opacity-50`}><span className="mb-1 block text-[11px]">{i+1} / 4</span><strong>{name}</strong></button>)}</nav>
      {step===0&&<Card title="What do you want to do?" description="Choose one job. Email sending and mailbox hosting are deliberately separate."><div className="mt-4 grid gap-3 sm:grid-cols-3">{[
        {id:"send" as Goal,title:"Send from a website",desc:"SMTP relay for apps, forms and notifications"},
        {id:"receive" as Goal,title:"Receive at my domain",desc:"Mailbox provider or supported self-hosted mail"},
        {id:"diagnose" as Goal,title:"Troubleshoot delivery",desc:"DNS authentication, queue and bounce checks"}
      ].map(x=><button type="button" key={x.id} onClick={()=>{setGoal(x.id);setQueued(false);}} aria-pressed={goal===x.id} className={`rounded-xl border p-4 text-left ${goal===x.id?"border-accent bg-accent-soft":"border-line hover:bg-surface-2"}`}><strong className="block text-sm text-ink">{x.title}</strong><span className="mt-2 block text-xs text-ink-2">{x.desc}</span></button>)}</div><div className="mt-5"><Button onClick={()=>setStep(1)}>Continue</Button></div></Card>}
      {step===1&&<Card title="Which domain is this for?" description="Choose an existing example or type a domain to preview the setup path."><div className="mt-4 max-w-lg space-y-4"><Field label="Email domain" htmlFor="email-setup-domain" required hint="Example: example.co.ke"><Input id="email-setup-domain" value={domain} onChange={e=>setDomain(e.target.value)} aria-invalid={!!domain&&!validDomain}/></Field>{!validDomain&&<p role="alert" className="text-xs text-danger">Enter a valid domain name before continuing.</p>}<div className="flex flex-wrap gap-2">{mailDomains.map(d=><button key={d.id} type="button" className="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-accent" onClick={()=>setDomain(d.domain)}>{d.domain}</button>)}</div></div><div className="mt-5 flex gap-2"><Button onClick={()=>setStep(2)} disabled={!canContinue}>Continue</Button><Button variant="secondary" onClick={()=>setStep(0)}>Back</Button></div></Card>}
      {step===2&&<Card title={goal==="send"?"Set up outbound sending":goal==="receive"?"Choose where mailboxes live":"Inspect delivery configuration"} description={`Guidance for ${domain}. No provider or DNS changes are made in this step.`}>
        {goal==="send"&&<div className="mt-4 space-y-4"><Field label="SMTP relay provider" htmlFor="email-provider"><Select id="email-provider" value={provider} onChange={e=>setProvider(e.target.value)}><option value="resend">Resend</option><option value="postmark">Postmark</option><option value="mailgun">Mailgun</option><option value="ses">Amazon SES</option></Select></Field><Callout tone={relay.state==="unavailable"?"warning":"info"} title={relay.state==="unavailable"?"Relay not available on this host":"External relay is the v1 sending path"}>Configure credentials in the dedicated SMTP screen, then send a test message. Provider account and domain verification happen outside this prototype.</Callout><ButtonLink href="/email/external-smtp" variant="secondary">Open SMTP settings</ButtonLink></div>}
        {goal==="receive"&&<div className="mt-4 space-y-4"><Callout tone="info" title="Mailbox hosting is not the same as SMTP">For v1, keep inbound mail with an external provider such as Zoho or Google Workspace. Self-hosted mailboxes are a v2+ feature and require a supported host and release.</Callout><p className="text-sm text-ink-2">Self-hosted capability: <strong>{hosted.state==="unavailable"?"Unavailable on this host":"Detected, but release-gated"}</strong></p><div className="flex flex-wrap gap-2"><ButtonLink href="/email/recommendation" variant="secondary">Mailbox provider guidance</ButtonLink><ButtonLink href="/email/mailboxes" variant="ghost">Explore self-hosted mailboxes</ButtonLink></div></div>}
        {goal==="diagnose"&&<div className="mt-4 space-y-3"><p className="text-sm text-ink-2">Illustrative DNS records. Copy the values for review; this is not a live lookup.</p>{deliverabilityRecords.map(r=><div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3"><span className="w-14 text-xs font-bold text-ink">{r.role}</span><span className="flex-1 text-xs text-ink-2">{r.status.replaceAll("_"," ")}</span><CopyButton text={r.value} label={`Copy ${r.role} value`}/></div>)}<div className="flex flex-wrap gap-2"><ButtonLink href="/email/deliverability" variant="secondary">DNS diagnostics</ButtonLink><ButtonLink href="/email/queue" variant="ghost">Mail queue & logs</ButtonLink></div></div>}
        <div className="mt-5 flex gap-2"><Button onClick={()=>setStep(3)}>Review next steps</Button><Button variant="secondary" onClick={()=>setStep(1)}>Back</Button></div>
      </Card>}
      {step===3&&<Card title="Your email setup plan" description="A checklist of next actions — not a claim of completed configuration."><div className="mt-4 space-y-3 text-sm"><p><strong>Goal:</strong> {goal==="send"?"Send outbound messages":goal==="receive"?"Receive mail":"Troubleshoot delivery"}</p><p><strong>Domain:</strong> {domain}</p><p><strong>Next action:</strong> {goal==="send"?`Configure ${provider} credentials and verify the sending domain`:goal==="receive"?"Choose a mailbox provider and verify its MX records":"Review SPF, DKIM, DMARC and mail delivery logs"}</p></div>
        {goal==="send"&&<div className="mt-5 rounded-xl border border-line bg-surface-2 p-4"><h3 className="text-sm font-semibold">Try a simulated test send</h3><p className="mt-1 text-xs text-ink-2">This queues a mock operation; it does not send an actual message.</p><div className="mt-3 flex flex-wrap items-end gap-2"><div className="min-w-[200px] flex-1"><Field label="Recipient" htmlFor="email-test-recipient"><Input id="email-test-recipient" type="email" value={recipient} onChange={e=>{setRecipient(e.target.value);setQueued(false);}} placeholder="you@example.com" aria-invalid={attempted&&!emailRe.test(recipient)}/></Field></div><Button onClick={runTest} disabled={relay.state==="unavailable"}>Queue demo test</Button></div>{attempted&&!emailRe.test(recipient)&&<p role="alert" className="mt-2 text-xs text-danger">Enter a valid recipient email address.</p>}{queued&&<p role="status" className="mt-2 text-xs text-accent">Demo operation queued. Inspect its result in the operation tray.</p>}</div>}
        <div className="mt-5 flex flex-wrap gap-2"><ButtonLink href={goal==="send"?"/email/external-smtp":goal==="receive"?"/email/recommendation":"/email/deliverability"}>Open recommended tool</ButtonLink><Button variant="secondary" onClick={()=>setStep(2)}>Back</Button><ButtonLink href="/email" variant="ghost">Email workspace</ButtonLink></div>
      </Card>}
      <p className="text-xs text-ink-3">Advanced tools: <Link className="text-accent hover:underline" href="/email/domains">Email domains</Link> · <Link className="text-accent hover:underline" href="/email/aliases">Aliases</Link> · <Link className="text-accent hover:underline" href="/email/queue">Queue</Link> · <Link className="text-accent hover:underline" href="/email/webmail">Webmail</Link></p>
    </div>
  </Screen>;
}
export default function EmailSetupPage() { return <React.Suspense fallback={<p role="status" className="p-6 text-sm text-ink-2">Loading email setup…</p>}><GuidedEmailSetup/></React.Suspense>; }
