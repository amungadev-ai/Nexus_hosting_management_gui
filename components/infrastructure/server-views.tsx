"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { ImpactReview, Modal } from "@/components/ui/overlay";
import { DataTable } from "@/components/ui/table";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { LogViewer } from "@/components/ui/code";
import { KeyValue, ProgressBar } from "@/components/ui/misc";
import { LiveStatusLine, NotFoundInline, PendingState, UnsupportedState } from "@/components/common/states";
import { useNow, useOperationStream, useSession, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import {
  agentStatus,
  cgroupWorkloads,
  diagnosticChecks,
  diagnosticLogLines,
  diagnosticRunbooks,
  hostKernel,
  topologyZones,
  type CgroupWorkload,
} from "@/lib/mock/infrastructure";
import {
  listCgroupWorkloads,
  runDiagnostics,
  updateResourceLimit,
} from "@/lib/api/infrastructure";
import { ApiError } from "@/lib/api/core";
import { PROFILES } from "@/lib/profiles";
import { formatDuration, formatMb, formatMillicores, formatRelative } from "@/lib/format";
import { MiniAllocation, composeWorkloads, useFixtureLoad, type WorkloadRow } from "./shared";

/* ------------------------------------------------------------------ */
/* UX-INF-001 — Server inventory                                       */
/* ------------------------------------------------------------------ */

export function ServerInventoryView() {
  const { profile } = useSession();
  const now = useNow();
  const { loading, data } = useFixtureLoad(() => composeWorkloads());
  const [roleFilter, setRoleFilter] = useState("all");
  const p = PROFILES[profile];
  const nodeRoles = topologyZones[0]?.nodes[0]?.roles ?? [];
  const roleOptions = ["all", ...nodeRoles];
  const serverMatches = roleFilter === "all" || nodeRoles.includes(roleFilter);

  return (
    <Screen
      id="UX-INF-001"
      breadcrumbs={[{ label: "Infrastructure" }]}
      actions={
        <>
          <label htmlFor="inv-role-filter" className="sr-only">Filter servers by role</label>
          <Select id="inv-role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-44">
            {roleOptions.map((r) => (
              <option key={r} value={r}>{r === "all" ? "All roles" : `Role: ${r}`}</option>
            ))}
          </Select>
          <ButtonLink href="/infrastructure/servers/new" icon="plus">Enroll server</ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!serverMatches ? (
          <Callout tone="info" title={`No servers carry the “${roleFilter}” role`}>
            This installation runs a single server and it does not carry that role. Clear the filter to see it again.
          </Callout>
        ) : (
          <Card
            title={db.server.name}
            description={db.server.provider_label}
            actions={<ButtonLink href={`/infrastructure/servers/${db.server.id}`} size="sm">Manage</ButtonLink>}
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={db.server.state === "active" ? "active" : "unknown"} at={db.server.last_seen_at} />
              <Chip tone={db.server.agent_connected ? "success" : "warning"}>
                Agent {db.server.agent_version}{db.server.agent_connected ? " · connected" : " · unreachable"}
              </Chip>
              <Chip tone="neutral">{p.label} profile</Chip>
            </div>
            <div className="mt-3">
              <LiveStatusLine at={db.server.last_seen_at} label="Heartbeat" />
            </div>
            <KeyValue
              className="mt-4"
              columns={2}
              items={[
                { label: "Specs (detected)", value: `${p.specs.vcpu} vCPU · ${formatMb(p.specs.ram_mb)} RAM · ${p.specs.disk_gb} GB disk` },
                { label: "Roles", value: <span className="flex flex-wrap gap-1">{nodeRoles.map((r) => <Chip key={r}>{r}</Chip>)}</span> },
                { label: "Workloads placed", value: `${(data ?? []).filter((w) => w.category === "serving").length} serving · ${(data ?? []).filter((w) => w.category === "batch").length} batch` },
                { label: "Region", value: topologyZones[0]?.region_label ?? "—" },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={`/infrastructure/servers/${db.server.id}/diagnostics`} variant="secondary" size="sm" icon="activity">Diagnostics</ButtonLink>
              <ButtonLink href={`/infrastructure/servers/${db.server.id}/cgroups`} variant="secondary" size="sm">cgroup metrics</ButtonLink>
              <ButtonLink href="/infrastructure/maintenance" variant="secondary" size="sm" icon="calendar">Maintenance</ButtonLink>
            </div>
            <p className="mt-3 text-xs text-ink-3">Heartbeat checked {formatRelative(db.server.last_seen_at, now)}.</p>
          </Card>
        )}

        {loading && <SkeletonTable rows={3} cols={4} />}
        {!loading && data !== null && (
          <Card title="Workloads on this server" description="Serving workloads always get priority; batch jobs queue and yield under site traffic.">
            <DataTable
              caption="Workloads placed on this server"
              rows={data}
              rowKey={(w: WorkloadRow) => w.id}
              columns={[
                {
                  key: "name",
                  header: "Workload",
                  render: (w: WorkloadRow) => (
                    <Link href={w.href} className="font-medium text-accent hover:underline">{w.name}</Link>
                  ),
                },
                { key: "kindChip", header: "Type", render: (w: WorkloadRow) => <Chip>{w.kindLabel}</Chip> },
                { key: "category", header: "Category", render: (w: WorkloadRow) => <Chip tone={w.category === "batch" ? "info" : "neutral"}>{w.category}</Chip> },
                { key: "health", header: "Health", render: (w: WorkloadRow) => <StatusPill status={w.health} at={w.verifiedAt} /> },
                { key: "usage", header: "RAM / CPU", render: (w: WorkloadRow) => <MiniAllocation usage={w.usage} /> },
              ]}
            />
          </Card>
        )}

        {/* Multi-server fleet is a v2 surface — honest gate, never a hidden menu. */}
        <UnsupportedState
          title="Fleet management arrives in v2"
          body="This installation runs one server. Enrolling additional nodes into a managed fleet — cross-zone placement, per-node roles and fleet-wide upgrade planning — is planned for v2. Capacity planning today happens on this single node."
          action={{ label: "Inspect the single-node topology", href: "/infrastructure/topology" }}
        />
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-002 — Server detail                                          */
/* ------------------------------------------------------------------ */

export function ServerDetailView({ serverId }: { serverId: string }) {
  const { profile } = useSession();
  const now = useNow();
  const workloads = composeWorkloads();
  const p = PROFILES[profile];
  const server = db.server;
  if (serverId !== server.id) {
    return (
      <Screen id="UX-INF-002" breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Not found" }]}>
        <NotFoundInline what="server" />
      </Screen>
    );
  }
  const openIncidents = db.incidents.filter((i) => i.state !== "resolved");

  return (
    <Screen
      id="UX-INF-002"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: server.name }]}
      actions={
        <>
          <ButtonLink href={`/infrastructure/servers/${server.id}/diagnostics`} icon="activity">Diagnose</ButtonLink>
          <ButtonLink href={`/infrastructure/servers/${server.id}/cgroups`} variant="secondary">cgroup metrics</ButtonLink>
          <ButtonLink href="/infrastructure/maintenance" variant="secondary">Maintenance</ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Hardware and host" description={`Specs follow the demo profile switcher — this VPS is presented as a ${p.label} (${p.tagline}).`}>
            <KeyValue
              columns={2}
              items={[
                { label: "vCPU", value: String(p.specs.vcpu) },
                { label: "RAM", value: formatMb(p.specs.ram_mb) },
                { label: "Disk", value: `${p.specs.disk_gb} GB` },
                { label: "State", value: <StatusPill status={server.state === "active" ? "active" : "unknown"} /> },
                { label: "Public IP", value: server.ip, mono: true },
                { label: "Operating system", value: server.os },
                { label: "Kernel", value: hostKernel, mono: true },
                { label: "cgroup", value: `v${server.cgroup_version.replace("v", "")}` },
                { label: "Provider", value: server.provider_label },
                { label: "Region", value: topologyZones[0]?.region_label ?? "—" },
              ]}
            />
            <div className="mt-4 border-t border-line pt-3">
              <LiveStatusLine at={server.last_seen_at} label="Heartbeat" />
            </div>
          </Card>

          <Card title="Agent" description="The panel agent reads hardware counters and cgroup telemetry; trust is verified per check-in." actions={<ButtonLink href="/infrastructure/agents" variant="secondary" size="sm">Agent health</ButtonLink>}>
            <KeyValue
              items={[
                { label: "Version", value: `${agentStatus.version}${agentStatus.version !== agentStatus.latest_version ? ` (latest ${agentStatus.latest_version})` : " — latest"}` },
                { label: "Trust", value: <Chip tone={agentStatus.trust === "verified" ? "success" : "warning"}>{agentStatus.trust}</Chip> },
                { label: "Socket", value: agentStatus.socket, mono: true },
                { label: "Configuration drift", value: agentStatus.drift === null ? "None detected" : `${agentStatus.drift.kind}: ${agentStatus.drift.detail}` },
              ]}
            />
            <div className="mt-4 border-t border-line pt-3">
              <LiveStatusLine at={agentStatus.last_checkin_at} label="Agent check-in" />
            </div>
          </Card>
        </div>

        <Card
          title={`Workloads (${workloads.length})`}
          description="Observed usage per workload; the ceilings behind these numbers are on the cgroup page."
          actions={<ButtonLink href={`/infrastructure/servers/${server.id}/cgroups`} variant="secondary" size="sm">cgroup ceilings</ButtonLink>}
        >
          <DataTable
            caption="Workloads placed on this server"
            rows={workloads}
            rowKey={(w: WorkloadRow) => w.id}
            columns={[
              { key: "name", header: "Workload", render: (w: WorkloadRow) => <Link href={w.href} className="font-medium text-accent hover:underline">{w.name}</Link> },
              { key: "kindChip", header: "Type", render: (w: WorkloadRow) => <Chip>{w.kindLabel}</Chip> },
              { key: "category", header: "Category", render: (w: WorkloadRow) => <Chip tone={w.category === "batch" ? "info" : "neutral"}>{w.category}</Chip> },
              { key: "health", header: "Health", render: (w: WorkloadRow) => <StatusPill status={w.health} at={w.verifiedAt} /> },
              { key: "usage", header: "RAM / CPU", render: (w: WorkloadRow) => <MiniAllocation usage={w.usage} /> },
            ]}
          />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Modules" description="What is installed on this server." actions={<ButtonLink href="/infrastructure/modules" variant="secondary" size="sm">Manage modules</ButtonLink>}>
            <p className="text-sm text-ink-2">
              The module inventory (adapters, runtimes, dependencies) lives under{" "}
              <Link href="/infrastructure/modules" className="text-accent hover:underline">Installed modules</Link>.
            </p>
          </Card>
          <Card title="Open incidents" actions={<ButtonLink href="/incidents" variant="secondary" size="sm">All incidents</ButtonLink>}>
            {openIncidents.length === 0 ? (
              <p className="text-sm text-ink-2">No open incidents on this server.</p>
            ) : (
              <ul className="flex list-none flex-col gap-2 p-0">
                {openIncidents.map((i) => (
                  <li key={i.id}>
                    <Link href={`/incidents/${i.id}`} className="text-sm font-medium text-accent hover:underline">{i.title}</Link>
                    <span className="ml-2"><Chip tone={i.severity === "major" ? "warning" : "neutral"}>{i.severity}</Chip></span>
                    <p className="text-xs text-ink-3">Started {formatRelative(i.started_at, now)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-003 — Enroll server wizard (v2 gate)                         */
/* ------------------------------------------------------------------ */

export function AddServerGateView() {
  return (
    <Screen
      id="UX-INF-003"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Enroll server" }]}
      actions={<ButtonLink href="/infrastructure/servers" variant="secondary">Back to inventory</ButtonLink>}
    >
      <div className="flex flex-col gap-4">
        <UnsupportedState
          title="Enrolling more servers is coming in v2"
          body="This prototype installation runs a single server, so the enrollment wizard is not offered yet — showing a token flow that cannot complete would be dishonest. The multi-server fleet (enrollment, trust verification, per-node placement) is planned for v2."
          action={{ label: "Back to server inventory", href: "/infrastructure/servers" }}
        />
        <Card title="What the wizard will include (roadmap)">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-2">
            <li>
              <strong className="text-ink">Generate a one-time enrollment token</strong> — short-lived, single-use,
              scoped to one node.
            </li>
            <li>
              <strong className="text-ink">Prerequisites check on the new node</strong> — supported OS, cgroup v2,
              outbound connectivity, clock sync.
            </li>
            <li>
              <strong className="text-ink">Trust verification</strong> — the node presents itself, the operator
              approves the fingerprint, then the agent joins with least-privilege scopes.
            </li>
            <li>
              <strong className="text-ink">Role and placement planning</strong> — which roles the node carries and
              which workloads may be placed there.
            </li>
          </ol>
        </Card>
        <Callout tone="info" title="What you can do today">
          Grow the single node with the{" "}
          <Link href="/system/upgrade" className="text-accent hover:underline">VPS upgrade ladder</Link> — rescan
          hardware after the plan change and apply the new capability set — or review how capacity is allocated on{" "}
          <Link href="/infrastructure/topology" className="text-accent hover:underline">the topology view</Link>.
        </Callout>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-010 — Server diagnostics                                     */
/* ------------------------------------------------------------------ */

export function DiagnosticsView({ serverId }: { serverId: string }) {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const now = useNow();
  const [opId, setOpId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const server = db.server;

  if (serverId !== server.id) {
    return (
      <Screen id="UX-INF-010" breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Not found" }]}>
        <NotFoundInline what="server" />
      </Screen>
    );
  }

  const op = opId !== null ? list.find((o) => o.id === opId) ?? null : null;

  const run = () => {
    setBusy(true);
    runDiagnostics()
      .then((operation) => {
        setOpId(operation.id);
        setFocusedId(operation.id);
        setTrayOpen(true);
        push("success", "Diagnostics submitted", "Safe, read-only checks run as a batch job — evidence lands here when verified.");
      })
      .catch(() => push("error", "Diagnostics failed", "Could not queue the safe checks run."))
      .finally(() => setBusy(false));
  };

  return (
    <Screen
      id="UX-INF-010"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: server.name, href: `/infrastructure/servers/${server.id}` }, { label: "Diagnostics" }]}
      actions={<Button icon="play" loading={busy} onClick={run}>Run diagnostics</Button>}
    >
      <div className="flex flex-col gap-4">
        {op !== null && (
          <PendingState operation={op}>
            <p className="text-sm text-ink-2">
              {op.status === "succeeded"
                ? "The safe checks finished — the evidence below is the verified result."
                : "The checks are read-only; nothing on the server changes while they run."}
            </p>
          </PendingState>
        )}

        <Card title="Evidence from the last safe-check run" description="Each check reports what was observed — never a bare green tick.">
          <DataTable
            caption="Diagnostic checks"
            rows={diagnosticChecks}
            rowKey={(c) => c.name}
            columns={[
              { key: "name", header: "Check", render: (c) => <span className="font-medium">{c.name}</span> },
              {
                key: "result",
                header: "Result",
                render: (c) =>
                  c.result === "pass" ? <StatusPill status="succeeded" /> : c.result === "warn" ? <StatusPill status="degraded" /> : <StatusPill status="failed" />,
              },
              { key: "detail", header: "What was observed", render: (c) => <span className="text-xs text-ink-2">{c.detail}</span> },
              { key: "ran_at", header: "Ran", render: (c) => formatRelative(c.ran_at, now) },
            ]}
          />
          <Callout tone="info" className="mt-4" title="Port 25 is expected to fail here">
            The VPS provider blocks outbound port 25, so the self-hosted mail role is honestly unavailable — external
            SMTP relay is unaffected. Blockers like this are recorded in the signed capability file (
            <Link href="/infrastructure/capabilities" className="text-accent hover:underline">capability detection</Link>).
          </Callout>
        </Card>

        <Card title="Diagnostics log" description="Read-only probe output from the last run (already redacted — no secrets, no SQL).">
          <LogViewer lines={diagnosticLogLines} />
        </Card>

        <Card title="Runbooks — what to do next">
          <ul className="flex list-none flex-col gap-3 p-0">
            {diagnosticRunbooks.map((r) => (
              <li key={r.title} className="rounded-card border border-line bg-surface-2 p-4">
                <Link href={r.href} className="text-sm font-medium text-accent hover:underline">{r.title}</Link>
                <p className="mt-1 text-xs text-ink-2">{r.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-013 — cgroup metrics and ceilings                            */
/* ------------------------------------------------------------------ */

interface CgroupEdit {
  workload: CgroupWorkload;
  memValue: string;
  cpuValue: string;
}

export function CgroupsView({ serverId }: { serverId: string }) {
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const now = useNow();
  const { loading, data } = useFixtureLoad(() => listCgroupWorkloads());
  const [edit, setEdit] = useState<CgroupEdit | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const server = db.server;

  if (serverId !== server.id) {
    return (
      <Screen id="UX-INF-013" breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Not found" }]}>
        <NotFoundInline what="server" />
      </Screen>
    );
  }

  const p = PROFILES[profile];
  const hardMaxMb = Math.round(p.specs.ram_mb * 1.2);
  const rows = data ?? [];
  const totalCeiling = rows.reduce((sum, w) => sum + w.memory.ceiling_mb, 0);

  const openEdit = (w: CgroupWorkload) => {
    setEdit({
      workload: w,
      memValue: String(w.memory.ceiling_mb),
      cpuValue: w.cpu.cpu_max_mc !== null ? String(w.cpu.cpu_max_mc) : "",
    });
    setModalError(null);
    setImpactError(null);
    setReviewOpen(false);
  };

  const memAfter = edit !== null ? Number(edit.memValue) : 0;
  const cpuAfter = edit !== null ? Number(edit.cpuValue) : 0;
  const memChanged = edit !== null && memAfter !== edit.workload.memory.ceiling_mb;
  const cpuChanged =
    edit !== null && edit.workload.workload_category === "batch" && cpuAfter !== edit.workload.cpu.cpu_max_mc;

  const reviewFromModal = () => {
    if (edit === null) return;
    if (!Number.isFinite(memAfter) || memAfter <= 0) {
      setModalError("Enter a memory ceiling in MB (a positive number).");
      return;
    }
    if (memAfter > hardMaxMb) {
      setModalError(`A ceiling above ${hardMaxMb} MB (physical RAM × 1.2) would overcommit the server and is refused.`);
      return;
    }
    if (edit.workload.workload_category === "batch" && (!Number.isFinite(cpuAfter) || cpuAfter <= 0)) {
      setModalError("Batch workloads keep a cpu.max — enter it in millicores (e.g. 500 = 0.5 vCPU).");
      return;
    }
    if (!memChanged && !cpuChanged) {
      setModalError("Nothing to change — the values match the current ceilings.");
      return;
    }
    setModalError(null);
    setImpactError(null);
    setReviewOpen(true);
  };

  const submitReview = () => {
    if (edit === null) return;
    setBusy(true);
    setImpactError(null);
    const changes: Promise<{ id: string }>[] = [];
    if (memChanged) {
      changes.push(
        updateResourceLimit({
          workload: edit.workload,
          field: "memory_ceiling_mb",
          before: edit.workload.memory.ceiling_mb,
          after: memAfter,
          physical_ram_mb: p.specs.ram_mb,
        })
      );
    }
    if (cpuChanged) {
      changes.push(
        updateResourceLimit({
          workload: edit.workload,
          field: "cpu_max_mc",
          before: edit.workload.cpu.cpu_max_mc,
          after: cpuAfter,
          physical_ram_mb: p.specs.ram_mb,
        })
      );
    }
    Promise.all(changes)
      .then((ops) => {
        setBusy(false);
        setReviewOpen(false);
        setEdit(null);
        push("success", "Ceiling change submitted", "The panel writes memory.max / cpu.max and re-reads the value to verify it applied.");
        setFocusedId(ops[0]?.id ?? null);
        setTrayOpen(true);
      })
      .catch((e: unknown) => {
        setBusy(false);
        setImpactError(e instanceof ApiError ? `${e.problem.title}: ${e.problem.detail}` : "Unexpected error.");
      });
  };

  return (
    <Screen
      id="UX-INF-013"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: server.name, href: `/infrastructure/servers/${server.id}` }, { label: "cgroup metrics" }]}
      actions={<ButtonLink href="/overview/usage" variant="secondary" icon="trending-up">Server-level usage</ButtonLink>}
    >
      <div className="flex flex-col gap-4">
        {loading && <SkeletonTable rows={4} cols={6} />}
        {!loading && data !== null && (
          <>
            <Card title="Ceilings vs the hard limit" description={`Sum of memory.max across workloads against physical ${formatMb(p.specs.ram_mb)} × 1.2 = ${formatMb(hardMaxMb)}.`}>
              <ProgressBar
                value={totalCeiling}
                max={hardMaxMb}
                tone={totalCeiling > hardMaxMb ? "danger" : "accent"}
                label={`Allocated ceilings: ${formatMb(totalCeiling)} of ${formatMb(hardMaxMb)}`}
                showValue
              />
              <p className="mt-2 text-xs text-ink-2">
                Counters come straight from cgroup v2 (memory.current, memory.peak, memory.events, cpu.stat, io.stat,
                pids.current). Current/typical/peak are measured, ceilings are caps — never reservations.
              </p>
            </Card>

            <DataTable
              caption="Per-workload cgroup metrics"
              rows={rows}
              rowKey={(w: CgroupWorkload) => w.resource_ref.id}
              columns={[
                {
                  key: "name",
                  header: "Workload",
                  render: (w: CgroupWorkload) => (
                    <span className="flex flex-col">
                      <span className="font-medium">{w.resource_ref.name}</span>
                      <span className="font-mono text-[11px] text-ink-3">{w.resource_ref.type}</span>
                    </span>
                  ),
                },
                { key: "category", header: "Category", render: (w: CgroupWorkload) => <Chip tone={w.workload_category === "batch" ? "info" : "neutral"}>{w.workload_category}</Chip> },
                {
                  key: "memory",
                  header: "RAM current / ceiling",
                  render: (w: CgroupWorkload) => {
                    const ratio = w.memory.current_mb / w.memory.ceiling_mb;
                    return (
                      <div className="min-w-40">
                        <ProgressBar
                          value={w.memory.current_mb}
                          max={w.memory.ceiling_mb}
                          tone={ratio >= 0.95 ? "danger" : ratio > 0.8 ? "warning" : "accent"}
                          label={`${formatMb(w.memory.current_mb)} / ${formatMb(w.memory.ceiling_mb)}`}
                          showValue
                        />
                        <p className="mt-1 text-[11px] text-ink-3">
                          peak {formatMb(w.memory.peak_mb)}
                          {w.memory.oom_events_7d > 0 ? ` · ${w.memory.oom_events_7d} OOM (7d)` : ""}
                        </p>
                      </div>
                    );
                  },
                },
                {
                  key: "cpu",
                  header: "CPU",
                  render: (w: CgroupWorkload) => (
                    <div className="text-xs text-ink-2">
                      <p>now {formatMillicores(w.cpu.current_mc)} · peak {formatMillicores(w.cpu.peak_mc)}</p>
                      <p className="text-ink-3">
                        weight {w.cpu.cpu_weight}
                        {w.cpu.cpu_max_mc !== null ? ` · cpu.max ${formatMillicores(w.cpu.cpu_max_mc)}` : " · no cpu.max (serving)"}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "io",
                  header: "I/O",
                  render: (w: CgroupWorkload) => (
                    <span className="text-xs text-ink-2">r {w.io.read_mb_s} MB/s · w {w.io.write_mb_s} MB/s</span>
                  ),
                },
                { key: "pids_current", header: "PIDs", render: (w: CgroupWorkload) => <span className="tabular-nums">{w.pids_current}</span> },
                {
                  key: "throttled_seconds_24h",
                  header: "Throttled 24h",
                  render: (w: CgroupWorkload) =>
                    w.throttled_seconds_24h > 0 ? (
                      <Chip tone="info">{formatDuration(w.throttled_seconds_24h)} — yielding</Chip>
                    ) : (
                      <span className="text-ink-3">—</span>
                    ),
                },
                { key: "updated_at", header: "Updated", render: (w: CgroupWorkload) => formatRelative(w.updated_at, now) },
                {
                  key: "actions",
                  header: "Actions",
                  render: (w: CgroupWorkload) => (
                    <Button variant="secondary" size="sm" onClick={() => openEdit(w)}>
                      Adjust ceilings
                    </Button>
                  ),
                },
              ]}
            />
          </>
        )}

        {edit !== null && !reviewOpen && (
          <Modal
            open
            onClose={() => setEdit(null)}
            title={`Adjust ceilings — ${edit.workload.resource_ref.name}`}
            description={`Category: ${edit.workload.workload_category}. Counters updated ${formatRelative(edit.workload.updated_at, now)}.`}
            footer={
              <>
                <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
                <Button onClick={reviewFromModal}>Review impact</Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <Field
                label="Memory ceiling (memory.max, MB)"
                htmlFor="cg-mem"
                required
                hint={`Current ${edit.workload.memory.current_mb} MB · 24h peak ${edit.workload.memory.peak_mb} MB · hard limit ${hardMaxMb} MB (physical × 1.2).`}
              >
                <Input id="cg-mem" type="number" min="1" value={edit.memValue} onChange={(e) => setEdit({ ...edit, memValue: e.target.value })} />
              </Field>
              {edit.workload.workload_category === "batch" ? (
                <Field
                  label="cpu.max (millicores)"
                  htmlFor="cg-cpu"
                  required
                  hint={`Batch workloads keep a hard cpu.max so they yield to site traffic. Current ${edit.workload.cpu.cpu_max_mc ?? 0} m.`}
                >
                  <Input id="cg-cpu" type="number" min="1" value={edit.cpuValue} onChange={(e) => setEdit({ ...edit, cpuValue: e.target.value })} />
                </Field>
              ) : (
                <Callout tone="info" title="Serving workloads have no cpu.max">
                  They share CPU fairly via cpu.weight ({edit.workload.cpu.cpu_weight}); a hard cap would starve them
                  under load, so the control plane refuses cpu.max for serving.
                </Callout>
              )}
              {modalError !== null && <Callout tone="danger">{modalError}</Callout>}
            </div>
          </Modal>
        )}

        {edit !== null && reviewOpen && (
          <ImpactReview
            open
            onClose={() => {
              setReviewOpen(false);
              setImpactError(null);
            }}
            onSubmit={submitReview}
            title={`Adjust ${edit.workload.resource_ref.name} ceilings`}
            submitLabel="Submit ceiling change"
            impact={{
              before: `memory.max ${formatMb(edit.workload.memory.ceiling_mb)}${edit.workload.cpu.cpu_max_mc !== null ? ` · cpu.max ${formatMillicores(edit.workload.cpu.cpu_max_mc)}` : ""}`,
              after: `${memChanged ? `memory.max ${formatMb(memAfter)}` : "memory.max unchanged"}${cpuChanged ? ` · cpu.max ${formatMillicores(cpuAfter)}` : ""}`,
              affectedResources: [edit.workload.resource_ref.name],
              downtimeEstimate: "None — cgroup limits apply live, no restart",
              reversibility: "Set the previous value back at any time; the current value stays visible on this page",
            }}
          >
            <div className="flex flex-col gap-3">
              <p>
                {edit.workload.workload_category === "batch"
                  ? "Raising a batch cpu.max lets the job run faster but it still yields to serving traffic under load."
                  : "Raising the memory ceiling gives the workload more headroom before memory.max events; it is a cap, not a reservation."}
              </p>
              {impactError !== null && <Callout tone="danger" title="The control plane refused this change">{impactError}</Callout>}
            </div>
          </ImpactReview>
        )}

        <Callout tone="info" title="Why ceilings, not reservations">
          Allocation is a ceiling, not a reservation (DS-022): workloads share the physical RAM fairly, and the × 1.2
          overcommit guard (validated as CGROUP_CONFIG_INVALID above {formatMb(hardMaxMb)}) keeps the server honest.
          When a workload keeps hitting its ceiling, the honest fixes are an adjustment here or the{" "}
          <Link href="/system/upgrade" className="text-accent hover:underline">VPS upgrade ladder</Link>.
        </Callout>
      </div>
    </Screen>
  );
}
