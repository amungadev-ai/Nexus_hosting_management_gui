"use client";
import { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Callout } from "@/components/ui/feedback";
import { useSession, useCapability } from "@/components/providers";
import { PERSONAS } from "@/lib/personas";
import { hostingAccounts, hostingPackages, customers, resellers, subscriptions } from "@/lib/mock/commercial";
import { db } from "@/lib/mock/data";

type Step = { name: string; detail: string; url: string; sensitive?: boolean };
type Flow = { key: string; icon: string; name: string; subtitle: string; steps: Step[] };
const flows: Flow[] = [
 {key:"accounts",icon:"📦",name:"Sell a hosting package",subtitle:"Package → customer → account → verification",steps:[
  {name:"Set up a package",detail:"Choose resource quotas, features and pricing.",url:"/commercial/packages"},
  {name:"Choose a customer",detail:"Confirm the owner of the hosting account.",url:"/commercial/customers"},
  {name:"Provision an account",detail:"Review limits before submitting the asynchronous request.",url:"/commercial/accounts/new"},
  {name:"Check provisioning",detail:"Accepted is not the same as active. Inspect the account status.",url:"/commercial/accounts"}]},
 {key:"customers",icon:"👥",name:"Manage customers",subtitle:"Organizations, accounts, limits and subscriptions",steps:[
  {name:"Review customer organizations",detail:"Inspect account ownership and contacts.",url:"/commercial/customers"},
  {name:"Review hosting accounts",detail:"Confirm customer-to-account relationships.",url:"/commercial/accounts"},
  {name:"Check usage",detail:"Compare resource allocation and usage.",url:"/commercial/usage"},
  {name:"Inspect subscriptions",detail:"Check renewals and grace periods.",url:"/commercial/subscriptions"}]},
 {key:"resellers",icon:"🏷️",name:"Run a reseller workspace",subtitle:"Delegation, packages, branding and accounts",steps:[
  {name:"Review reseller grants",detail:"Inspect delegated scope and account limits.",url:"/commercial/resellers"},
  {name:"Define packages",detail:"Configure products for customers.",url:"/commercial/packages"},
  {name:"Preview branding",detail:"Set portal appearance and verify branded domain.",url:"/commercial/branding"},
  {name:"Inspect customer accounts",detail:"Verify account boundaries and service status.",url:"/commercial/accounts"}]},
 {key:"billing",icon:"💳",name:"Review billing and payments",subtitle:"Invoices, M-Pesa, pending states and reconciliation",steps:[
  {name:"Review invoices",detail:"Check open, paid and overdue invoice states.",url:"/commercial/invoices"},
  {name:"Inspect payment history",detail:"Pending and confirmed are separate gateway states.",url:"/commercial/payments"},
  {name:"Reconcile exceptions",detail:"Only authorized finance staff should match unmatched callbacks.",url:"/commercial/payments/reconcile",sensitive:true},
  {name:"Configure M-Pesa",detail:"Daraja sandbox, callback verification and credential security.",url:"/commercial/integrations/mpesa",sensitive:true}]},
 {key:"license",icon:"🔑",name:"Manage licensing",subtitle:"Activation, entitlements and continuity",steps:[
  {name:"Review license",detail:"Inspect tier, expiry and grace period.",url:"/commercial/licenses"},
  {name:"Check resource allocations",detail:"Compare entitlements against usage.",url:"/commercial/usage"},
  {name:"Review payments",detail:"Check renewal settlement status.",url:"/commercial/payments"},
  {name:"Inspect audit history",detail:"Review license and payment-related events.",url:"/activity"}]}
];
const allowed: Record<string,string[]> = {
 provider_admin:["accounts","customers","resellers","billing","license"],
 reseller:["accounts","customers","resellers","billing"],
 infrastructure_user:["billing","license"],
 storage_user:["billing"],
 self_hoster:["license"],website_owner:["license"],explorer:["license"],app_developer:[]
};
export default function BusinessCenter(){
 const {persona,profile}=useSession();
 const cap=useCapability("commercial.surface");
 const permitted=allowed[persona]??[];
 const [active,setActive]=useState<string | null>(null);
 const [reviewed,setReviewed]=useState<Record<string,boolean>>({});
 const selected=flows.find(f=>f.key===(active&&permitted.includes(active)?active:permitted[0]));
 const completed=selected?.steps.filter((_,i)=>reviewed[`${selected.key}:${i}`]).length??0;
 const customer=persona==="storage_user";
 const owner=["self_hoster","website_owner","explorer"].includes(persona);
 const stats=owner?[{label:"Panel license",value:"Preview",url:"/commercial/licenses"}]:customer?[
  {label:"Demo invoices",value:db.invoices.length,url:"/commercial/invoices"},
  {label:"Subscriptions",value:subscriptions.length,url:"/commercial/subscriptions"},
  {label:"Payment status",value:"Preview",url:"/commercial/payments"}]:[
  {label:"Hosting accounts",value:hostingAccounts.length,url:"/commercial/accounts"},
  {label:"Customers",value:customers.length,url:"/commercial/customers"},
  {label:"Packages",value:hostingPackages.length,url:"/commercial/packages"},
  {label:"Resellers",value:resellers.length,url:"/commercial/resellers"}
 ];
 const role=PERSONAS.find(p=>p.id===persona);
 return <Screen id="UX-COM-019" breadcrumbs={[{label:"Overview",href:"/overview"},{label:"Business center"}]} description="Connected commercial workflows without mixing the underlying tools.">
  <div className="mx-auto max-w-6xl space-y-5">
   <Callout tone="info" title="Demo workspace — no live payments or provisioning">All totals, accounts and payment states are simulated. Checking a step only records local review progress. This hub never charges money, provisions accounts or changes licensing. Persona is not authorization.</Callout>
   <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm"><strong>Viewing as:</strong> {role?.bucket??persona} <span className="text-ink-3">· {profile} profile · Commercial: {cap.state==="unavailable"?"unavailable on this profile":"demo preview"}</span></div>
   {cap.state==="unavailable"&&<Callout tone="warning" title="Capability unavailable">Provider and reseller operations require a supported server profile. This page remains available as a design preview; licensing is separate.</Callout>}
   {permitted.length===0?<div className="rounded-xl border border-line bg-surface p-6"><h2 className="font-semibold">No commercial tasks for this persona</h2><p className="mt-2 text-sm text-ink-2">Developer workflows live under Websites & Applications.</p><Link href="/apps" className="mt-3 inline-block text-sm font-semibold text-accent">Go to applications →</Link></div>:<>
    <section aria-label="Commercial summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map(s=><Link href={s.url} key={s.label} className="rounded-xl border border-line bg-surface p-4 hover:border-accent"><span className="block text-xs text-ink-2">{s.label}</span><strong className="mt-1 block text-2xl">{s.value}</strong><span className="mt-2 block text-xs text-accent">View tool →</span></Link>)}</section>
    <section aria-labelledby="business-goal"><h2 id="business-goal" className="text-lg font-semibold">What would you like to do?</h2><p className="mt-1 text-sm text-ink-2">Select a guided journey. Every detailed management screen remains accessible separately.</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{flows.filter(f=>permitted.includes(f.key)).map(f=><button type="button" key={f.key} onClick={()=>setActive(f.key)} aria-pressed={selected?.key===f.key} className={`rounded-xl border p-4 text-left transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent ${selected?.key===f.key?"border-accent bg-accent-soft":"border-line bg-surface"}`}><span className="text-xl" aria-hidden="true">{f.icon}</span><strong className="mt-2 block text-sm">{f.name}</strong><span className="mt-1 block text-xs text-ink-2">{f.subtitle}</span></button>)}</div></section>
    {selected&&<section className="rounded-xl border border-line bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{selected.name} — workflow</h2><button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={()=>setReviewed(old=>Object.fromEntries(Object.entries(old).filter(([k])=>!k.startsWith(selected.key+":"))))}>Reset review</button></div><p className="mt-2 text-xs text-ink-2">{completed} / {selected.steps.length} reviewed — does not verify any real operation.</p><div role="progressbar" aria-label="Workflow review progress" aria-valuemin={0} aria-valuemax={selected.steps.length} aria-valuenow={completed} className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent transition-all" style={{width:`${completed/selected.steps.length*100}%`}}/></div><ol className="mt-4 space-y-3">{selected.steps.map((s,i)=>{const key=`${selected.key}:${i}`;const restricted=s.sensitive&&persona!=="provider_admin";return <li key={key} className="flex items-start gap-3 rounded-lg border border-line p-4"><input type="checkbox" aria-label={`Mark ${s.name} reviewed`} checked={!!reviewed[key]} onChange={e=>setReviewed(old=>({...old,[key]:e.target.checked}))} className="mt-1 h-4 w-4"/><div><h3 className="text-sm font-semibold">{i+1}. {s.name}</h3><p className="mt-1 text-xs text-ink-2">{s.detail}</p>{restricted?<p className="mt-2 text-xs text-ink-3">Provider/admin approval required — no direct shortcut for this persona.</p>:<Link href={s.url} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">Open {s.name.toLowerCase()} →</Link>}</div></li>})}</ol></section>}
    <section className="rounded-xl border border-line bg-surface-2 p-4"><h2 className="text-sm font-semibold">Quick access to separate tools</h2><div className="mt-3 flex flex-wrap gap-2">{(owner?[["Licensing","/commercial/licenses"],["Audit","/activity"]]:customer?[["Invoices","/commercial/invoices"],["Payments","/commercial/payments"],["Payment methods","/commercial/payment-methods"]]:[["Accounts","/commercial/accounts"],["Customers","/commercial/customers"],["Packages","/commercial/packages"],["Billing","/commercial/invoices"],["Licenses","/commercial/licenses"]]).map(([name,url])=><Link key={url} href={url} className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-accent hover:border-accent">{name} ↗</Link>)}</div></section>
   </>}
  </div>
 </Screen>;
}
