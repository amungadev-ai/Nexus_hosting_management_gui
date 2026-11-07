"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { useSession, useOperationStream } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { backupPolicies, backupDestinations, serviceHealth } from "@/lib/mock/ops";
import { scheduledJobs, webhookDeliveries } from "@/lib/mock/automation";

/** UX-OPS-019: A guided triage surface; no privileged actions originate here. */
type Goal = "protect" | "recover" | "diagnose" | "secure" | "automate";
type Risk = "read" | "write" | "critical";
interface Action { label: string; href: string; note: string; risk: Risk }
interface Playbook { id: Goal; icon: string; title: string; subtitle: string; outcome: string; steps: Action[] }
const PLAYBOOKS: Playbook[] = [
  { id: "protect", icon: "🛡️", title: "Protect my data", subtitle: "Create a backup policy and verify recovery", outcome: "A scheduled, offsite backup with evidence of a tested restore", steps: [
    { label: "Review backup coverage", href: "/backups", note: "Check which websites, apps and services are covered", risk: "read" },
    { label: "Choose a destination", href: "/backups/destinations", note: "Prefer encrypted offsite storage; local storage is profile-gated", risk: "write" },
    { label: "Set a schedule", href: "/backups/policies", note: "Choose retention, timing and consistency level", risk: "write" },
    { label: "Verify a restore", href: "/backups/verify", note: "A completed backup is not proof of recoverability", risk: "critical" },
  ] },
  { id: "recover", icon: "↩️", title: "Recover a service", subtitle: "Investigate failure before a restore", outcome: "A verified recovery plan with a clear impact assessment", steps: [
    { label: "Check active incidents", href: "/incidents", note: "Identify current service impact and incident ownership", risk: "read" },
    { label: "Inspect service logs", href: "/monitoring/logs", note: "Confirm the failure and affected resources", risk: "read" },
    { label: "Inspect available backups", href: "/backups/sets", note: "Check timestamps, encryption and verification status", risk: "read" },
    { label: "Plan a restore", href: "/backups/restore", note: "Restores can overwrite data; use preview and approval", risk: "critical" },
  ] },
  { id: "diagnose", icon: "📈", title: "Fix performance or downtime", subtitle: "Understand pressure, health and alerts", outcome: "An evidence-based diagnosis and a tracked remediation", steps: [
    { label: "Inspect server health", href: "/monitoring", note: "CPU, RAM, disk and service health at a glance", risk: "read" },
    { label: "Check resource pressure", href: "/monitoring/pressure", note: "Look for OOM events, disk exhaustion and cgroup pressure", risk: "read" },
    { label: "Review alerts and incidents", href: "/monitoring/alerts", note: "Correlate symptoms with incident timelines", risk: "read" },
    { label: "Review operation history", href: "/activity", note: "Find deployments, failed jobs and recent changes", risk: "read" },
  ] },
  { id: "secure", icon: "🔐", title: "Secure my server", subtitle: "Review access and exposed services", outcome: "Reviewed firewall, SSH access, isolation and audit evidence", steps: [
    { label: "Review security findings", href: "/security", note: "Start with access risks and outstanding changes", risk: "read" },
    { label: "Inspect firewall rules", href: "/security/firewall", note: "Avoid locking yourself out; changes require confirmation", risk: "critical" },
    { label: "Review SSH access", href: "/security/ssh", note: "Revoke stale keys and check authorized principals", risk: "critical" },
    { label: "Inspect isolation and audit", href: "/security/isolation", note: "Review tenant boundaries, then open the audit trail", risk: "read" },
  ] },
  { id: "automate", icon: "⚙️", title: "Automate maintenance", subtitle: "Schedule tasks and track their outcomes", outcome: "A monitored schedule or workflow with failure visibility", steps: [
    { label: "Review existing automation", href: "/automation", note: "Inspect schedules, integrations and recent failures", risk: "read" },
    { label: "Configure scheduled jobs", href: "/automation/schedules", note: "Set time zone, concurrency and retry policy", risk: "write" },
    { label: "Create a workflow", href: "/automation/workflows/new", note: "Review triggers, secrets and side effects", risk: "write" },
    { label: "Check webhook deliveries", href: "/automation/webhooks", note: "Inspect failed attempts and retry behavior", risk: "read" },
  ] },
];
const RISK_LABEL: Record<Risk,string> = {read:"Inspect",write:"Configure",critical:"High impact"};

export default function OperationsCenterPage() {
  const { profile } = useSession();
  const { list } = useOperationStream();
  const [goal, setGoal] = useState<Goal>("protect");
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const selected = PLAYBOOKS.find((p) => p.id === goal)!;
  const failures = list.filter((op) => op.status === "failed").length;
  const unhealthy = serviceHealth.filter((s) => s.state !== "healthy").length;
  const unverified = backupPolicies.filter((p) => !p.last_verified_restore_at).length;
  const remote = backupDestinations.filter((d) => d.kind === "remote" && d.status === "healthy").length;
  const automations = scheduledJobs.filter((j) => j.last_outcome === "failed" || j.last_outcome === "missed").length + webhookDeliveries.filter((d) => d.status === "failed").length;
  const count = useMemo(() => selected.steps.filter((_,i) => completed[`${goal}:${i}`]).length, [selected, completed, goal]);
  const choose = (next:Goal) => { setGoal(next); setShowAll(false); };

  return <Screen id="UX-OPS-019" breadcrumbs={[{label:"Operations",href:"/monitoring"},{label:"Operations center"}]} description="A guided home for keeping your services healthy, secure and recoverable.">
    <div className="mx-auto max-w-6xl space-y-5">
      <Callout tone="info" title="Interactive prototype — simulated operational data">The status counts below come from demo fixtures and local mock operations. This page does not execute firewall changes, restores or maintenance jobs. Opening a tool does not mean an operation succeeded.</Callout>
      <section aria-label="Operational status" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {label:"Services needing review",value:unhealthy,href:"/monitoring",detail:"Demo service health"},
          {label:"Backup policies unverified",value:unverified,href:"/backups/verify",detail:"No recorded restore verification"},
          {label:"Failed operations",value:failures,href:"/activity",detail:"Current session's operation history"},
          {label:"Automation failures",value:automations,href:"/automation",detail:"Schedules and webhooks"},
        ].map((m)=><Link key={m.label} href={m.href} className="rounded-xl border border-line bg-surface p-4 transition hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><span className="block text-xs text-ink-2">{m.label}</span><strong className="mt-1 block text-2xl tabular-nums text-ink">{m.value}</strong><span className="mt-2 block text-xs text-ink-3">{m.detail} ↗</span></Link>)}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm"><span><strong>Selected profile:</strong> {profile} <span className="text-ink-3">· Capability and permission checks still apply in each tool</span></span><span className="text-xs text-ink-2">{remote} healthy remote backup destination(s) in demo</span></div>
      <section aria-labelledby="ops-goal-heading" className="space-y-3"><div><h2 id="ops-goal-heading" className="text-lg font-semibold">What do you need to do?</h2><p className="mt-1 text-sm text-ink-2">Choose an outcome. NexusPanel will guide you through the relevant tools in the right order.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{PLAYBOOKS.map((p)=><button key={p.id} type="button" onClick={()=>choose(p.id)} aria-pressed={goal===p.id} className={`rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${goal===p.id?"border-accent bg-accent-soft":"border-line bg-surface hover:border-accent"}`}><span aria-hidden="true" className="text-xl">{p.icon}</span><strong className="mt-2 block text-sm text-ink">{p.title}</strong><span className="mt-1 block text-xs text-ink-2">{p.subtitle}</span></button>)}</div>
      </section>
      <section aria-labelledby="playbook-title"><Card title={<span id="playbook-title">{selected.title}: recommended workflow</span>} description={selected.outcome}>
        <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-ink-2">Your checklist (local to this page): {count} of {selected.steps.length} reviewed</p><button type="button" className="text-xs font-medium text-accent hover:underline" onClick={()=>setCompleted((prev)=>Object.fromEntries(Object.entries(prev).filter(([key])=>!key.startsWith(`${goal}:`))))}>Reset checklist</button></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Review progress" aria-valuenow={count} aria-valuemin={0} aria-valuemax={selected.steps.length}><div className="h-full rounded-full bg-accent transition-all" style={{width:`${count/selected.steps.length*100}%`}}/></div>
        <ol className="mt-4 space-y-3">{selected.steps.map((s,i)=><li key={s.href} className="rounded-xl border border-line bg-surface p-4"><div className="flex flex-wrap items-start gap-3"><label className="mt-0.5 flex cursor-pointer items-center gap-2"><input type="checkbox" checked={!!completed[`${goal}:${i}`]} onChange={e=>setCompleted(prev=>({...prev,[`${goal}:${i}`]:e.target.checked}))} aria-label={`Mark step ${i+1} reviewed`} className="h-4 w-4 accent-accent"/><span className="text-xs text-ink-3">{i+1}</span></label><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{s.label}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.risk==="critical"?"bg-warning-soft text-warning":"bg-surface-2 text-ink-2"}`}>{RISK_LABEL[s.risk]}</span></div><p className="mt-1 text-xs text-ink-2">{s.note}</p></div><ButtonLink href={s.href} variant="secondary" size="sm">Open tool</ButtonLink></div></li>)}</ol>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-ink-3">Checking a step means reviewed, not executed or verified.</p><Button variant="secondary" onClick={()=>setShowAll(!showAll)}>{showAll?"Hide":"Show"} all operations tools</Button></div>
      </Card></section>
      {showAll&&<section aria-label="All operations tools" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
        ["Backups & restore","/backups"],["Monitoring & metrics","/monitoring"],["Logs","/monitoring/logs"],["Alerts","/monitoring/alerts"],["Incidents","/incidents"],["Security","/security"],["Firewall","/security/firewall"],["SSH access","/security/ssh"],["Isolation","/security/isolation"],["Schedules","/automation/schedules"],["Webhooks","/automation/webhooks"],["Audit trail","/audit"],
      ].map(([label,href])=><Link key={href} href={href} className="rounded-lg border border-line bg-surface p-3 text-sm text-ink hover:border-accent">{label} <span aria-hidden="true" className="float-right text-accent">↗</span></Link>)}</section>}
      <p className="text-xs text-ink-3">This page is a navigation and planning layer. Existing screens remain distinct; privileged actions are governed by their own capability, authorization and confirmation contracts.</p>
    </div>
  </Screen>;
}
