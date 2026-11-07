"use client";
import { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Callout } from "@/components/ui/feedback";
import { useSession } from "@/components/providers";

type Step = { label: string; note: string; href: string };
type Flow = { id: string; title: string; subtitle: string; emoji: string; steps: Step[] };
const flows: Flow[] = [
  {id:"assistant",title:"Get help from Nexus AI",subtitle:"Consent, diagnostic evidence and reviewable proposals",emoji:"🤖",steps:[
    {label:"Review AI consent and provider",note:"Confirm data scopes and the configured provider before asking for diagnostics.",href:"/settings/ai"},
    {label:"Open the assistant",note:"Ask a scoped question; an unavailable AI provider must be reported, not simulated as a real answer.",href:"/assistant"},
    {label:"Inspect evidence and uncertainty",note:"Read the diagnostic report before trusting a suggested root cause.",href:"/assistant"},
    {label:"Review changes before approval",note:"AI proposals are not executable permission; policy and human approval are separate.",href:"/activity"}]},
  {id:"audit",title:"Review changes and access",subtitle:"Activity, audit evidence and access boundaries",emoji:"🔎",steps:[
    {label:"Inspect recent activity",note:"Look for unexpected operations and failures.",href:"/activity"},
    {label:"Review audit entries",note:"Audit fixtures use shortened hashes and cannot be cryptographically verified in this demo.",href:"/audit"},
    {label:"Inspect access roles",note:"Confirm least privilege and organization membership.",href:"/settings/access"},
    {label:"Review support access",note:"Check active grants, scope, expiry and revocation.",href:"/settings/support-access"}]},
  {id:"support",title:"Solve a support issue",subtitle:"Guides, safe diagnostics, tickets and migration",emoji:"🛟",steps:[
    {label:"Search the help center",note:"Try a guided resolution before sharing diagnostics.",href:"/help"},
    {label:"Review system activity",note:"Gather relevant evidence; avoid sharing credentials or secret values.",href:"/activity"},
    {label:"Create or inspect a support ticket",note:"Choose the diagnostic information you consent to share.",href:"/support"},
    {label:"Review recovery and migration",note:"Use documented migration or recovery workflows when needed.",href:"/migrations"}]},
  {id:"settings",title:"Personalize my workspace",subtitle:"Appearance, account security, organization and API",emoji:"⚙️",steps:[
    {label:"Choose display preferences",note:"Theme, density and presentation mode change the UI, not permissions.",href:"/settings/profile"},
    {label:"Inspect active sessions",note:"Review session history and account access.",href:"/settings/sessions"},
    {label:"Review organization settings",note:"Check team membership and boundaries.",href:"/settings/organizations"},
    {label:"Inspect API token permissions",note:"Limit token scope and avoid exposing secrets.",href:"/settings/api-tokens"}]},
];
export default function FinalWorkspace(){
  const {persona,profile}=useSession();
  const [selected,setSelected]=useState("assistant");
  const [reviewed,setReviewed]=useState<Record<string,boolean>>({});
  const [filter,setFilter]=useState("");
  const visible=flows.filter(f=>`${f.title} ${f.subtitle} ${f.steps.map(s=>s.label).join(" ")}`.toLowerCase().includes(filter.toLowerCase()));
  const active=visible.find(f=>f.id===selected)??visible[0];
  const count=active?.steps.filter((_,i)=>reviewed[`${active.id}:${i}`]).length??0;
  return <Screen id="UX-SUP-012" breadcrumbs={[{label:"Overview",href:"/overview"},{label:"Workspace guide"}]} description="Connected AI, support, audit and settings journeys without merging their detailed tools.">
    <div className="mx-auto max-w-6xl space-y-5">
      <Callout tone="info" title="Interactive GUI prototype">All examples use mock data. This guide tracks only which links you have reviewed in this browser session; it does not verify actions, change permissions or run server commands. AI requires a configured provider and explicit consent.</Callout>
      <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm"><strong>Current preview:</strong> {persona} · {profile} profile <span className="text-ink-3">· UI persona selection is not authorization</span></div>
      <section aria-labelledby="guide-heading"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="guide-heading" className="text-lg font-semibold">What would you like to do next?</h2><p className="mt-1 text-sm text-ink-2">Choose a goal and follow the connected tools.</p></div><label className="text-xs text-ink-2">Filter journeys <input aria-label="Filter journeys" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search a task" className="ml-2 w-44 max-w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink"/></label></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{visible.map(f=><button type="button" key={f.id} onClick={()=>setSelected(f.id)} aria-pressed={active?.id===f.id} className={`rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-accent ${active?.id===f.id?"border-accent bg-accent-soft":"border-line bg-surface hover:border-accent"}`}><span aria-hidden="true" className="text-xl">{f.emoji}</span><strong className="mt-2 block text-sm">{f.title}</strong><span className="mt-1 block text-xs text-ink-2">{f.subtitle}</span></button>)}</div>
        {visible.length===0&&<p className="mt-4 rounded-xl border border-line p-4 text-sm text-ink-2">No matching journey. Try “support”, “audit”, “AI” or “settings”.</p>}
      </section>
      {active&&<section className="rounded-xl border border-line bg-surface p-5" aria-label={`${active.title} steps`}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{active.title} — review checklist</h2><button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={()=>setReviewed(old=>Object.fromEntries(Object.entries(old).filter(([k])=>!k.startsWith(active.id+":"))))}>Reset review</button></div><p className="mt-2 text-xs text-ink-2">{count} of {active.steps.length} links reviewed. This is not a verification of system state.</p><div role="progressbar" aria-label="Guide review progress" aria-valuemin={0} aria-valuemax={active.steps.length} aria-valuenow={count} className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent transition-all" style={{width:`${count/active.steps.length*100}%`}}/></div><ol className="mt-4 space-y-3">{active.steps.map((s,i)=>{const key=`${active.id}:${i}`;return <li key={key} className="flex items-start gap-3 rounded-lg border border-line p-4"><input type="checkbox" aria-label={`Mark ${s.label} reviewed`} checked={!!reviewed[key]} onChange={e=>setReviewed(old=>({...old,[key]:e.target.checked}))} className="mt-1 h-4 w-4"/><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{i+1}. {s.label}</h3><p className="mt-1 text-xs text-ink-2">{s.note}</p><Link href={s.href} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">Open detailed tool →</Link></div></li>})}</ol></section>}
      <section className="rounded-xl border border-line bg-surface-2 p-4"><h2 className="text-sm font-semibold">Your workspace, not a stack of unrelated tools</h2><p className="mt-1 text-xs text-ink-2">Each destination remains a dedicated screen. The guide only provides connected navigation; use the advanced tools menu for the full screen catalog.</p><div className="mt-3 flex flex-wrap gap-4">{[["AI assistant","/assistant"],["Audit","/audit"],["Support","/support"],["Profile","/settings/profile"],["Operations","/operations/center"]].map(([name,href])=><Link key={href} href={href} className="text-xs font-semibold text-accent hover:underline">{name} →</Link>)}</div></section>
    </div>
  </Screen>;
}
