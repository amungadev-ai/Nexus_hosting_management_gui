"use client";
import { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Callout } from "@/components/ui/feedback";
import { useSession } from "@/components/providers";
import { PERSONAS } from "@/lib/personas";
import { agentStatus, diagnosticChecks, maintenanceWindows, serviceRoles, placementRequests } from "@/lib/mock/infrastructure";

type Step = { name:string; detail:string; href:string; risk?:"read"|"change"|"disruptive" };
type Journey = { id:string; icon:string; title:string; description:string; steps:Step[] };
const journeys:Journey[] = [
 {id:"enroll",icon:"🖥️",title:"Connect or inspect a server",description:"Inventory → agent trust → capabilities → diagnostics",steps:[
  {name:"Review the server inventory",detail:"Identify the node and check its current inventory and ownership.",href:"/infrastructure/servers",risk:"read"},
  {name:"Verify agent connectivity and trust",detail:"Review heartbeat freshness, version and trust before issuing privileged actions.",href:"/infrastructure/agents",risk:"read"},
  {name:"Review detected capabilities",detail:"Compare server capabilities against the workloads you intend to host.",href:"/infrastructure/capabilities",risk:"read"},
  {name:"Inspect diagnostic evidence",detail:"Use read-only checks before attempting repairs.",href:"/infrastructure/servers/srv_01JNAI01/diagnostics",risk:"read"}]},
 {id:"roles",icon:"🧩",title:"Plan infrastructure services",description:"Topology → service roles → capacity → placement",steps:[
  {name:"Inspect infrastructure topology",detail:"Understand which nodes and zones serve each platform component.",href:"/infrastructure/topology",risk:"read"},
  {name:"Review service roles",detail:"Separate mail, DNS, database and workload responsibilities.",href:"/infrastructure/roles",risk:"change"},
  {name:"Check capacity and placement",detail:"Review candidate hosts and constraints before making a placement decision.",href:"/infrastructure/placement",risk:"change"},
  {name:"Review module availability",detail:"Confirm the target node supports required platform modules.",href:"/infrastructure/modules",risk:"read"}]},
 {id:"maintain",icon:"🛠️",title:"Maintain or update a node",description:"Preflight → backup → maintenance → verify",steps:[
  {name:"Inspect health and warnings",detail:"Check the agent, pressure and known diagnostic warnings.",href:"/infrastructure/agents",risk:"read"},
  {name:"Confirm recovery readiness",detail:"Verify a usable backup and restoration path before disruptive work.",href:"/backups",risk:"read"},
  {name:"Plan maintenance and draining",detail:"Review affected workloads, customer impact and a rollback plan.",href:"/infrastructure/maintenance",risk:"disruptive"},
  {name:"Review updates and follow-up checks",detail:"Apply updates only in the authorized destination workflow, then verify services.",href:"/system/updates",risk:"disruptive"}]},
 {id:"diagnose",icon:"🔎",title:"Troubleshoot a fleet issue",description:"Evidence → isolation → remediation → audit",steps:[
  {name:"Check agent and node health",detail:"Distinguish stale telemetry from actual server failure.",href:"/infrastructure/agents",risk:"read"},
  {name:"Inspect workload resource usage",detail:"Use cgroup metrics to locate pressure and throttling.",href:"/infrastructure/servers/srv_01JNAI01/cgroups",risk:"read"},
  {name:"Run safe diagnostic checks",detail:"Read diagnostics and review warnings without changing configuration.",href:"/infrastructure/servers/srv_01JNAI01/diagnostics",risk:"read"},
  {name:"Review operations and audit trail",detail:"Check the outcome of any separately approved remediation.",href:"/activity",risk:"read"}]},
 {id:"upgrade",icon:"📈",title:"Re-evaluate a VPS after an upgrade",description:"Inventory → rescan → capacity → placement",steps:[
  {name:"Inspect the current hardware profile",detail:"Review the selected demo profile; do not infer real VPS specifications from it.",href:"/infrastructure/servers",risk:"read"},
  {name:"Review capability re-detection",detail:"Use the rescan workflow only when an authorized backend is available.",href:"/infrastructure/rescan",risk:"change"},
  {name:"Inspect workload ceilings",detail:"Compare current, typical and peak resource demand.",href:"/infrastructure/servers/srv_01JNAI01/cgroups",risk:"read"},
  {name:"Revisit placement decisions",detail:"Assess whether additional roles or workloads can safely fit.",href:"/infrastructure/placement",risk:"change"}]}
];
const roleJourneys:Record<string,string[]> = {
 provider_admin:["enroll","roles","maintain","diagnose","upgrade"],infrastructure_user:["enroll","roles","maintain","diagnose","upgrade"],
 self_hoster:["enroll","maintain","diagnose","upgrade"],website_owner:["diagnose"],explorer:["diagnose"],
 reseller:[],storage_user:[],app_developer:[]
};
export default function InfrastructureCenter(){
 const {persona,profile}=useSession();const allowed=roleJourneys[persona]??[];
 const [chosen,setChosen]=useState<string|null>(null);const [reviewed,setReviewed]=useState<Record<string,boolean>>({});
 const active=journeys.find(j=>j.id===(chosen&&allowed.includes(chosen)?chosen:allowed[0]));
 const done=active?.steps.filter((_,i)=>reviewed[`${active.id}:${i}`]).length??0;
 const role=PERSONAS.find(p=>p.id===persona);
 const warnings=diagnosticChecks.filter(c=>c.result!=="pass").length;
 const stats=[
  {label:"Agent connection",value:agentStatus.connected?"Connected (fixture)":"Disconnected (fixture)",href:"/infrastructure/agents"},
  {label:"Diagnostic warnings",value:String(warnings),href:"/infrastructure/servers/srv_01JNAI01/diagnostics"},
  {label:"Service roles",value:String(serviceRoles.length),href:"/infrastructure/roles"},
  {label:"Placement requests",value:String(placementRequests.length),href:"/infrastructure/placement"},
  {label:"Maintenance windows",value:String(maintenanceWindows.length),href:"/infrastructure/maintenance"}
 ];
 return <Screen id="UX-INF-019" breadcrumbs={[{label:"Overview",href:"/overview"},{label:"Infrastructure center"}]} description="Task-first fleet and provider workflows, linked to detailed infrastructure tools.">
  <div className="mx-auto max-w-6xl space-y-5">
   <Callout tone="info" title="Design preview — no server access">Agent health, topology, capacity, and maintenance are fixture data, not live readings. Reviewing a step changes only this page. No commands, deployments, drains, upgrades or hardware rescans are executed.</Callout>
   <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm"><strong>Viewing as:</strong> {role?.bucket??persona} <span className="text-ink-3">· {profile} demo profile · Role-based presentation only</span></div>
   {allowed.length===0?<section className="rounded-xl border border-line bg-surface p-6"><h2 className="font-semibold">Fleet administration is not part of this persona's workspace</h2><p className="mt-2 text-sm text-ink-2">Use your application, customer, or account management tools. Real access is enforced by the backend, not this demo persona switcher.</p><Link href="/overview" className="mt-3 inline-block text-sm font-semibold text-accent">Return to overview →</Link></section>:<>
    <section aria-label="Infrastructure overview" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{stats.map(s=><Link key={s.label} href={s.href} className="rounded-xl border border-line bg-surface p-4 hover:border-accent"><span className="block text-xs text-ink-2">{s.label}</span><strong className="mt-2 block text-lg">{s.value}</strong><span className="mt-3 block text-xs font-semibold text-accent">Inspect →</span></Link>)}</section>
    <section aria-labelledby="fleet-task"><h2 id="fleet-task" className="text-lg font-semibold">What do you need to do?</h2><p className="mt-1 text-sm text-ink-2">Select a journey. Each detailed infrastructure tool remains independently accessible.</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{journeys.filter(j=>allowed.includes(j.id)).map(j=><button type="button" key={j.id} onClick={()=>setChosen(j.id)} aria-pressed={active?.id===j.id} className={`rounded-xl border p-4 text-left transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent ${active?.id===j.id?"border-accent bg-accent-soft":"border-line bg-surface"}`}><span className="text-xl" aria-hidden="true">{j.icon}</span><strong className="mt-2 block text-sm">{j.title}</strong><span className="mt-1 block text-xs text-ink-2">{j.description}</span></button>)}</div></section>
    {active&&<section className="rounded-xl border border-line bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{active.title} — review workflow</h2><button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={()=>setReviewed(old=>Object.fromEntries(Object.entries(old).filter(([k])=>!k.startsWith(active.id+":"))))}>Reset review</button></div><p className="mt-2 text-xs text-ink-2">{done} of {active.steps.length} steps reviewed. Progress does not certify readiness or operation success.</p><div role="progressbar" aria-label="Infrastructure review progress" aria-valuemin={0} aria-valuemax={active.steps.length} aria-valuenow={done} className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent transition-all" style={{width:`${done/active.steps.length*100}%`}}/></div><ol className="mt-4 space-y-3">{active.steps.map((s,i)=>{const k=`${active.id}:${i}`;return <li key={k} className="flex items-start gap-3 rounded-lg border border-line p-4"><input type="checkbox" aria-label={`Mark ${s.name} reviewed`} checked={!!reviewed[k]} onChange={e=>setReviewed(old=>({...old,[k]:e.target.checked}))} className="mt-1 h-4 w-4"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{i+1}. {s.name}</h3><span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${s.risk==="disruptive"?"bg-red-500/10 text-red-600":s.risk==="change"?"bg-amber-500/10 text-amber-700":"bg-surface-2 text-ink-2"}`}>{s.risk==="disruptive"?"Potential downtime":s.risk==="change"?"Configuration change":"Read-only review"}</span></div><p className="mt-1 text-xs text-ink-2">{s.detail}</p><Link href={s.href} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">Open detailed tool →</Link></div></li>})}</ol></section>}
    <section className="rounded-xl border border-line bg-surface-2 p-4"><h2 className="text-sm font-semibold">Fleet tools stay separate</h2><div className="mt-3 flex flex-wrap gap-3">{[["Servers","/infrastructure/servers"],["Agent health","/infrastructure/agents"],["Topology","/infrastructure/topology"],["Service roles","/infrastructure/roles"],["Maintenance","/infrastructure/maintenance"],["Operations","/operations/center"]].map(([name,href])=><Link key={href} href={href} className="text-xs font-semibold text-accent hover:underline">{name} →</Link>)}</div></section>
   </>}
  </div>
 </Screen>;
}
