"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { ConfirmDialog, ImpactReview, Modal } from "@/components/ui/overlay";
import { DataTable } from "@/components/ui/table";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { LogViewer } from "@/components/ui/code";
import { KeyValue } from "@/components/ui/misc";
import { LiveStatusLine } from "@/components/common/states";
import { useNow, useOperationStream, useSession, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { databases } from "@/lib/mock/databases";
import {
  agentLogLines,
  agentStatus,
  cgroupWorkloads,
  maintenanceWindows,
  placementRequests,
  topologyZones,
  type MaintenanceWindow,
  type PanelModule,
  type PlacementRequest,
  type ServiceRole,
} from "@/lib/mock/infrastructure";
import {
  assignServiceRole,
  disableModule,
  drainServer,
  enterMaintenance,
  exitMaintenance,
  installModule,
  listMaintenanceWindows,
  listModules,
  listServiceRoles,
  planAgentUpgrade,
  recoverAgent,
  reservePlacement,
  scheduleMaintenance,
} from "@/lib/api/infrastructure";
import { PROFILES } from "@/lib/profiles";
import { formatDateTime, formatMb, formatRelative } from "@/lib/format";
import { composeWorkloads, useFixtureLoad } from "./shared";

/* ------------------------------------------------------------------ */
/* UX-INF-004 — Service roles                                          */
/* ------------------------------------------------------------------ */

const ROLE_LABEL: Record<ServiceRole["role"], string> = {
  panel: "Panel (control plane)",
  web: "Web (sites & apps)",
  database: "Database",
  queue: "Queue",
  backup: "Backup",
};

export function RolesView() {
  const { push } = useToast();
  const [, setTick] = useState(0);
  const { loading, data } = useFixtureLoad(() => listServiceRoles());
  const roles = data ?? [];
  const serving = cgroupWorkloads.filter((w) => w.workload_category === "serving");
  const batch = cgroupWorkloads.filter((w) => w.workload_category === "batch");

  const toggle = (role: ServiceRole["role"], assign: boolean) => {
    assignServiceRole(role, assign)
      .then((updated) => {
        setTick((t) => t + 1);
        push(
          "success",
          assign ? `${ROLE_LABEL[updated.role]} assigned` : `${ROLE_LABEL[updated.role]} unassigned`,
          "Role labels are a server metadata change (PATCH) — placement reads them on the next decision."
        );
      })
      .catch(() => push("error", "Role change failed", "Could not update the service role label."));
  };

  return (
    <Screen
      id="UX-INF-004"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Service roles" }]}
    >
      <div className="flex flex-col gap-4">
        <Card title="What runs here, by workload type" description="Serving workloads get CPU priority; batch jobs run with cpu.weight 10, a hard cpu.max, and yield under site traffic.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-line bg-surface-2 p-4">
              <p className="text-sm font-semibold text-ink">Serving ({serving.length})</p>
              <p className="mt-1 text-xs text-ink-2">{serving.map((w) => w.resource_ref.name).join(", ") || "none"}</p>
              <p className="mt-2 text-xs text-ink-3">Always-on; CPU shared fairly via cpu.weight 100.</p>
            </div>
            <div className="rounded-card border border-line bg-surface-2 p-4">
              <p className="text-sm font-semibold text-ink">Batch ({batch.length})</p>
              <p className="mt-1 text-xs text-ink-2">{batch.map((w) => w.resource_ref.name).join(", ") || "none"}</p>
              <p className="mt-2 text-xs text-ink-3">
                Queued when the server is busy; capped at cpu.max {batch[0]?.cpu.cpu_max_mc ?? "—"} m so sites stay responsive.
              </p>
            </div>
          </div>
        </Card>

        {loading && <SkeletonTable rows={3} cols={4} />}
        {!loading && data !== null && (
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((r) => (
              <Card
                key={r.id}
                title={ROLE_LABEL[r.role]}
                description={r.detail}
                actions={
                  r.state === "recommended" ? (
                    <Button size="sm" onClick={() => toggle(r.role, true)}>Assign role</Button>
                  ) : r.role === "queue" ? (
                    <Button size="sm" variant="secondary" onClick={() => toggle(r.role, false)}>Unassign</Button>
                  ) : undefined
                }
                footer={
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={r.state === "assigned" ? "success" : r.state === "recommended" ? "info" : "danger"}>{r.state}</Chip>
                    <span className="text-xs text-ink-2">{r.capacity_note}</span>
                  </div>
                }
              >
                <p className="text-xs text-ink-3">Server: {r.server_id === db.server.id ? `${db.server.name} (this node)` : r.server_id}</p>
              </Card>
            ))}
          </div>
        )}

        <Callout tone="info" title="Reviewing capacity">
          Role capacity notes are advisory; the hard numbers (current/typical/peak vs ceilings) live on the{" "}
          <Link href={`/infrastructure/servers/${db.server.id}/cgroups`} className="text-accent hover:underline">cgroup metrics page</Link>.
          Structural roles (panel, web, database, backup) are assigned by the installer — they are shown, not toggled.
        </Callout>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-005 — Fleet topology (honest schematic)                      */
/* ------------------------------------------------------------------ */

export function TopologyView() {
  const workloads = composeWorkloads();
  const zone = topologyZones[0];
  const node = zone?.nodes[0];
  const serving = workloads.filter((w) => w.category === "serving");
  const batch = workloads.filter((w) => w.category === "batch");

  return (
    <Screen
      id="UX-INF-005"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Fleet topology" }]}
      actions={
        <>
          <ButtonLink href={`/infrastructure/servers/${db.server.id}`} variant="secondary">Inspect node</ButtonLink>
          <ButtonLink href="/infrastructure/placement" icon="layers">Plan placement</ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {zone !== undefined && node !== undefined && (
          <div className="rounded-card border-2 border-dashed border-line bg-surface p-4 sm:p-6" aria-label={`Zone ${zone.zone} schematic`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">Zone: {zone.zone}</p>
                <p className="text-xs text-ink-2">{zone.region_label}</p>
              </div>
              <Chip tone="info">1 failure domain — the whole zone is this node</Chip>
            </div>

            {/* Node box */}
            <div className="mt-4 rounded-card border border-line bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{node.name}</p>
                  <StatusPill status={node.state === "active" ? "active" : "unknown"} at={db.server.last_seen_at} />
                  <Chip tone="neutral">{db.server.provider_label}</Chip>
                </div>
                <div className="flex flex-wrap gap-1">
                  {node.roles.map((r) => (
                    <Chip key={r} tone="accent">{r}</Chip>
                  ))}
                </div>
              </div>

              {/* Serving workloads */}
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Serving ({serving.length})</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {serving.map((w) => (
                    <Link
                      key={w.id}
                      href={w.href}
                      className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink hover:border-accent"
                    >
                      {w.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Batch workloads */}
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Batch ({batch.length}) — yields to serving</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {batch.map((w) => (
                    <Link
                      key={w.id}
                      href={w.href}
                      className="rounded-control border border-dashed border-line bg-surface px-2.5 py-1.5 text-xs text-ink hover:border-accent"
                    >
                      {w.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-ink-3">
              Schematic drawn from live placement data (not an image) — every box links to the workload it represents.
            </p>
          </div>
        )}

        <Callout tone="warning" title="Single node, single failure domain">
          Everything above stops together if the node stops. The honest mitigations today are verified off-site backups
          and the <Link href="/system/recovery" className="text-accent hover:underline">recovery center</Link>; spreading
          roles across zones arrives with the v2 fleet.
        </Callout>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-006 — Placement planner                                      */
/* ------------------------------------------------------------------ */

export function PlacementView() {
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const { loading, data } = useFixtureLoad(() => placementRequests);
  const [reserved, setReserved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const requests = data ?? [];

  const p = PROFILES[profile];
  const hardMaxMb = Math.round(p.specs.ram_mb * 1.2);
  // Workload ceilings + the database containers' ceilings (the database pool
  // is part of the same × 1.2 guard — see UX-DB-008).
  const poolMb =
    cgroupWorkloads.reduce((sum, w) => sum + w.memory.ceiling_mb, 0) +
    databases.reduce((sum, d) => sum + d.ram_ceiling_mb, 0);
  const freeMb = hardMaxMb - poolMb;

  const approve = (r: PlacementRequest) => {
    if (r.workload_category === "infrastructure") {
      push("error", "Placement not applicable", "Infrastructure workloads are not placed through the planner.");
      return;
    }
    setBusy(r.workload_name);
    reservePlacement({
      workload_name: r.workload_name,
      workload_category: r.workload_category,
      ram_ceiling_mb: r.ram_ceiling_mb,
      cpu_weight: r.cpu_weight,
    })
      .then((op) => {
        setReserved((prev) => [...prev, r.workload_name]);
        setBusy(null);
        push("success", "Capacity reserved", `Operation ${op.id} — the placement is confirmed once the capability fit re-verifies.`);
        setFocusedId(op.id);
        setTrayOpen(true);
      })
      .catch(() => {
        setBusy(null);
        push("error", "Placement failed", "Could not reserve capacity for this workload.");
      });
  };

  return (
    <Screen
      id="UX-INF-006"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Placement planner" }]}
    >
      <div className="flex flex-col gap-4">
        <Card title="Fit preview" description={`Hard limit ${formatMb(hardMaxMb)} (physical × 1.2) — workloads + database pool currently hold ${formatMb(poolMb)} of ceilings, leaving ${formatMb(Math.max(0, freeMb))} free.`}>
          {freeMb < 0 && (
            <Callout tone="danger" title="The pool is overcommitted">
              Allocated ceilings exceed the × 1.2 hard limit. Shrink ceilings on the{" "}
              <Link href={`/infrastructure/servers/${db.server.id}/cgroups`} className="text-accent hover:underline">cgroup page</Link> before
              reserving more capacity.
            </Callout>
          )}
          {loading && <SkeletonTable rows={2} cols={5} />}
          {!loading && data !== null && (
            <DataTable
              caption="Placement requests"
              rows={requests}
              rowKey={(r: PlacementRequest) => r.workload_name}
              columns={[
                { key: "workload_name", header: "Requested workload", render: (r: PlacementRequest) => <span className="font-medium">{r.workload_name}</span> },
                { key: "workload_category", header: "Category", render: (r: PlacementRequest) => <Chip tone={r.workload_category === "batch" ? "info" : "neutral"}>{r.workload_category}</Chip> },
                {
                  key: "ram_ceiling_mb",
                  header: "RAM floor / typical / ceiling",
                  render: (r: PlacementRequest) => `${formatMb(r.ram_floor_mb)} / ${formatMb(r.ram_typical_mb)} / ${formatMb(r.ram_ceiling_mb)}`,
                },
                { key: "cpu_weight", header: "CPU weight", render: (r: PlacementRequest) => String(r.cpu_weight) },
                {
                  key: "fit",
                  header: "Fit on this node",
                  render: (r: PlacementRequest) => {
                    if (reserved.includes(r.workload_name)) return <Chip tone="success">reserved</Chip>;
                    if (r.ram_ceiling_mb > freeMb) {
                      return (
                        <span className="text-xs text-danger">
                          Refused — needs {formatMb(r.ram_ceiling_mb - Math.max(0, freeMb))} more headroom
                        </span>
                      );
                    }
                    return <span className="text-xs text-success">Eligible — leaves {formatMb(freeMb - r.ram_ceiling_mb)} free</span>;
                  },
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (r: PlacementRequest) => {
                    if (reserved.includes(r.workload_name)) return <span className="text-xs text-ink-3">capacity reserved</span>;
                    if (r.ram_ceiling_mb > freeMb) {
                      return <ButtonLink href="/system/upgrade" size="sm" variant="secondary">Upgrade path</ButtonLink>;
                    }
                    return (
                      <Button size="sm" loading={busy === r.workload_name} onClick={() => approve(r)}>
                        Approve
                      </Button>
                    );
                  },
                },
              ]}
            />
          )}
        </Card>
        <Callout tone="info" title="How placement decides">
          A request is eligible when its RAM ceiling fits inside the free headroom under the × 1.2 hard limit — the same
          guard the installer enforces. Serving requests get priority; batch requests additionally carry cpu.weight 10 so
          they yield to site traffic.
        </Callout>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-007 — Maintenance and drain                                  */
/* ------------------------------------------------------------------ */

const MAINT_REASONS = [
  "Panel upgrade (agent + control plane)",
  "Kernel security patch + reboot",
  "Hardware change on the VPS plan",
  "Storage volume maintenance",
];

export function MaintenanceView() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [, setTick] = useState(0);
  const { loading, data } = useFixtureLoad(() => listMaintenanceWindows());
  const windows = data ?? [];
  const now = useNow();
  const active = windows.find((w) => w.state === "active") ?? null;

  const [enterOpen, setEnterOpen] = useState(false);
  const [enterReason, setEnterReason] = useState(MAINT_REASONS[0]);
  const [enterMinutes, setEnterMinutes] = useState("60");
  const [enterReview, setEnterReview] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedReason, setSchedReason] = useState(MAINT_REASONS[0]);
  const [schedFrom, setSchedFrom] = useState("2026-11-16T01:00");
  const [schedMinutes, setSchedMinutes] = useState("120");
  const [schedError, setSchedError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MaintenanceWindow | null>(null);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [drainConfirm, setDrainConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const affected = db.websites.length + db.applications.length + db.serviceInstances.length;

  const submitEnter = () => {
    setBusy(true);
    enterMaintenance(enterReason, Number(enterMinutes))
      .then((op) => {
        setBusy(false);
        setEnterReview(false);
        setEnterOpen(false);
        setTick((t) => t + 1);
        push("success", "Maintenance entered", `Operation ${op.id} — serving workloads are paused and placements are closed.`);
        setFocusedId(op.id);
        setTrayOpen(true);
      })
      .catch(() => {
        setBusy(false);
        push("error", "Could not enter maintenance", "Try again — the server state was not changed.");
      });
  };

  const submitSchedule = () => {
    if (schedFrom === "") {
      setSchedError("Pick a window start date and time.");
      return;
    }
    const from = new Date(schedFrom);
    if (Number.isNaN(from.getTime())) {
      setSchedError("That date could not be parsed — use the date picker.");
      return;
    }
    setBusy(true);
    scheduleMaintenance(schedReason, from, Number(schedMinutes))
      .then((op) => {
        setBusy(false);
        setScheduleOpen(false);
        setTick((t) => t + 1);
        push("success", "Window scheduled", `Operation ${op.id} — subscribed owners are notified before the window opens.`);
        setFocusedId(op.id);
        setTrayOpen(true);
      })
      .catch(() => {
        setBusy(false);
        push("error", "Could not schedule", "The window was not created.");
      });
  };

  const cancelWindow = () => {
    if (cancelTarget === null) return;
    const idx = maintenanceWindows.findIndex((w) => w.id === cancelTarget.id);
    if (idx >= 0) maintenanceWindows.splice(idx, 1);
    setTick((t) => t + 1);
    push("info", "Window cancelled", `${cancelTarget.reason} — no workloads were affected (the window had not started).`);
  };

  return (
    <Screen
      id="UX-INF-007"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Maintenance and drain" }]}
      actions={
        active === null ? (
          <>
            <Button icon="pause" onClick={() => setEnterOpen(true)}>Enter maintenance</Button>
            <Button variant="secondary" icon="calendar" onClick={() => setScheduleOpen(true)}>Schedule window</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" icon="calendar" onClick={() => setScheduleOpen(true)}>Schedule window</Button>
            <Button icon="play" onClick={() => setExitConfirm(true)}>Exit maintenance</Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {active !== null ? (
          <Callout tone="warning" title={`Maintenance is active — ${active.reason}`}>
            Serving workloads are paused and no new placements are accepted until you exit maintenance. Exit only after
            the underlying work is done — this window opened {formatRelative(active.window_from, now)}.
          </Callout>
        ) : (
          <Callout tone="info" title="Entering maintenance pauses serving workloads">
            Websites, apps and services stop responding while the server is in maintenance — that is the point: run
            risky work with no traffic. The impact review before entering names exactly what will pause.
          </Callout>
        )}

        {loading && <SkeletonTable rows={2} cols={5} />}
        {!loading && data !== null && (
          <DataTable
            caption="Maintenance windows"
            rows={windows}
            rowKey={(w: MaintenanceWindow) => w.id}
            columns={[
              { key: "reason", header: "Reason", render: (w: MaintenanceWindow) => <span className="font-medium">{w.reason}</span> },
              {
                key: "state",
                header: "State",
                render: (w: MaintenanceWindow) => (
                  <Chip tone={w.state === "active" ? "warning" : w.state === "scheduled" ? "info" : "neutral"}>{w.state}</Chip>
                ),
              },
              { key: "window_from", header: "From", render: (w: MaintenanceWindow) => formatDateTime(w.window_from) },
              { key: "window_to", header: "To", render: (w: MaintenanceWindow) => formatDateTime(w.window_to) },
              { key: "affected_workloads", header: "Affected workloads", render: (w: MaintenanceWindow) => String(w.affected_workloads) },
              {
                key: "actions",
                header: "Actions",
                render: (w: MaintenanceWindow) =>
                  w.state === "scheduled" ? (
                    <Button variant="secondary" size="sm" onClick={() => setCancelTarget(w)}>Cancel</Button>
                  ) : (
                    <span className="text-xs text-ink-3">—</span>
                  ),
              },
            ]}
            emptyState={<Callout tone="info">No maintenance windows — schedule one before risky work like kernel patches.</Callout>}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon="power" onClick={() => setDrainConfirm(true)}>
            Drain — stop new placements
          </Button>
        </div>
        <p className="text-xs text-ink-3">
          Drain keeps existing workloads running but refuses new ones — used before taking a node out of rotation once
          fleets arrive in v2. Verified as an operation, like every maintenance action.
        </p>

        {/* Enter maintenance: fields, then impact review */}
        <Modal
          open={enterOpen && !enterReview}
          onClose={() => setEnterOpen(false)}
          title="Enter maintenance"
          description={`${affected} serving workloads on ${db.server.name} will pause until you exit.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEnterOpen(false)}>Cancel</Button>
              <Button onClick={() => setEnterReview(true)}>Review impact</Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Reason" htmlFor="mnt-reason" required>
              <Select id="mnt-reason" value={enterReason} onChange={(e) => setEnterReason(e.target.value)}>
                {MAINT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Planned duration (minutes)" htmlFor="mnt-minutes" required hint="Owners see this estimate while workloads are paused.">
              <Input id="mnt-minutes" type="number" min="5" value={enterMinutes} onChange={(e) => setEnterMinutes(e.target.value)} />
            </Field>
          </div>
        </Modal>

        {enterOpen && enterReview && (
          <ImpactReview
            open
            onClose={() => setEnterReview(false)}
            onSubmit={submitEnter}
            title={`Enter maintenance — ${db.server.name}`}
            submitLabel="Enter maintenance"
            impact={{
              before: `${affected} serving workloads answering requests; placements open`,
              after: `Workloads paused (${enterReason}, ~${enterMinutes} min); no new placements accepted`,
              affectedResources: [...db.websites, ...db.applications, ...db.serviceInstances].map((r) => r.name),
              downtimeEstimate: `About ${enterMinutes} minutes — until you exit maintenance`,
              reversibility: "Exit maintenance resumes everything immediately; no data is changed",
            }}
          >
            <p>
              This is a traffic pause, not a data operation: websites, apps and services stop answering while the window
              is active. The operation verifies the maintenance state before reporting success.
            </p>
          </ImpactReview>
        )}

        {/* Schedule window */}
        <Modal
          open={scheduleOpen}
          onClose={() => {
            setScheduleOpen(false);
            setSchedError(null);
          }}
          title="Schedule a maintenance window"
          description="Owners subscribed to this server are notified before the window opens."
          footer={
            <>
              <Button variant="secondary" onClick={() => setScheduleOpen(false)}>Cancel</Button>
              <Button loading={busy} onClick={submitSchedule}>Schedule</Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Reason" htmlFor="sched-reason" required>
              <Select id="sched-reason" value={schedReason} onChange={(e) => setSchedReason(e.target.value)}>
                {MAINT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Window start (your local time)" htmlFor="sched-from" required>
              <Input id="sched-from" type="datetime-local" value={schedFrom} onChange={(e) => setSchedFrom(e.target.value)} />
            </Field>
            <Field label="Planned duration (minutes)" htmlFor="sched-minutes" required>
              <Input id="sched-minutes" type="number" min="5" value={schedMinutes} onChange={(e) => setSchedMinutes(e.target.value)} />
            </Field>
            {schedError !== null && <Callout tone="danger">{schedError}</Callout>}
          </div>
        </Modal>

        <ConfirmDialog
          open={cancelTarget !== null}
          onClose={() => setCancelTarget(null)}
          onConfirm={cancelWindow}
          title={`Cancel this window? ${cancelTarget?.reason ?? ""}`}
          confirmLabel="Cancel window"
          body="The scheduled window is removed and notifications stop. Workloads keep running — nothing has started yet."
        />

        <ConfirmDialog
          open={exitConfirm}
          onClose={() => setExitConfirm(false)}
          onConfirm={() => {
            exitMaintenance()
              .then((op) => {
                setTick((t) => t + 1);
                push("success", "Exiting maintenance", `Operation ${op.id} — workloads resume and health checks are verified.`);
                setFocusedId(op.id);
                setTrayOpen(true);
              })
              .catch(() => push("error", "Could not exit maintenance", "Try again — workloads are still paused."));
          }}
          title={`Exit maintenance — ${db.server.name}`}
          confirmLabel="Resume workloads"
          body="Serving workloads resume and new placements are accepted again. The panel verifies health checks before reporting the operation as done."
        />

        <ConfirmDialog
          open={drainConfirm}
          onClose={() => setDrainConfirm(false)}
          onConfirm={() => {
            drainServer()
              .then((op) => {
                push("success", "Drain submitted", `Operation ${op.id} — new placements stop; existing workloads keep running.`);
                setFocusedId(op.id);
                setTrayOpen(true);
              })
              .catch(() => push("error", "Drain failed", "Could not start the drain."));
          }}
          title={`Drain ${db.server.name}?`}
          confirmLabel="Stop new placements"
          destructive
          body="Draining refuses new placements (and, where supported, migrates workloads away). Running websites and apps keep serving — this is the safe first half of taking a node out of rotation."
        />
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-008 — Agent health and upgrades                              */
/* ------------------------------------------------------------------ */

export function AgentsView() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const now = useNow();
  const [recoverConfirm, setRecoverConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const upgradeAvailable = agentStatus.version !== agentStatus.latest_version;

  const upgrade = () => {
    setBusy(true);
    planAgentUpgrade(agentStatus.latest_version)
      .then((op) => {
        setBusy(false);
        push("success", "Agent upgrade submitted", `Operation ${op.id} — the agent swaps binaries and re-verifies trust before reporting success.`);
        setFocusedId(op.id);
        setTrayOpen(true);
      })
      .catch((e: unknown) => {
        setBusy(false);
        push("error", "Upgrade refused", e instanceof Error ? e.message : "The upgrade could not be planned.");
      });
  };

  return (
    <Screen
      id="UX-INF-008"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Agent health" }]}
      actions={
        upgradeAvailable ? (
          <Button icon="trending-up" loading={busy} onClick={upgrade}>Upgrade to {agentStatus.latest_version}</Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <Card title={`Agent on ${db.server.name}`} description="The agent is the panel's hands on the server — every operation runs through it.">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={agentStatus.connected ? "healthy" : "offline"} at={agentStatus.last_checkin_at} />
            <Chip tone={agentStatus.trust === "verified" ? "success" : "warning"}>trust {agentStatus.trust}</Chip>
            {agentStatus.drift === null ? (
              <Chip tone="neutral">no configuration drift</Chip>
            ) : (
              <Chip tone="warning">drift: {agentStatus.drift.kind}</Chip>
            )}
          </div>
          <KeyValue
            className="mt-4"
            columns={2}
            items={[
              { label: "Running version", value: agentStatus.version, mono: true },
              { label: "Latest version", value: agentStatus.latest_version, mono: true },
              { label: "Socket", value: agentStatus.socket, mono: true },
              { label: "Check-in interval", value: `${agentStatus.checkin_interval_seconds}s` },
              {
                label: "Configuration drift",
                value: agentStatus.drift === null ? "None detected" : `${agentStatus.drift.kind} — ${agentStatus.drift.detail}`,
              },
            ]}
          />
          <div className="mt-4 border-t border-line pt-3">
            <LiveStatusLine at={agentStatus.last_checkin_at} label="Agent check-in" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {upgradeAvailable ? (
              <p className="text-sm text-ink-2">
                Version {agentStatus.latest_version} is available. Upgrades can also ride the{" "}
                <Link href="/infrastructure/maintenance" className="text-accent hover:underline">maintenance window</Link> already
                scheduled for the panel update — the swap verifies trust before finishing either way.
              </p>
            ) : (
              <p className="text-sm text-ink-2">The agent is on the latest version — no upgrade job to plan.</p>
            )}
            <Button variant="secondary" onClick={() => setRecoverConfirm(true)}>Recover connection</Button>
          </div>
        </Card>

        <Card title="Agent log — trust and check-in evidence" description="What the agent did and verified, newest first (already redacted).">
          <LogViewer lines={agentLogLines} />
          <p className="mt-3 text-xs text-ink-3">
            Deeper evidence lives in the{" "}
            <Link href={`/infrastructure/servers/${db.server.id}/diagnostics`} className="text-accent hover:underline">server diagnostics</Link> and{" "}
            <Link href="/audit" className="text-accent hover:underline">audit trail</Link>.
          </p>
        </Card>

        <ConfirmDialog
          open={recoverConfirm}
          onClose={() => setRecoverConfirm(false)}
          onConfirm={() => {
            recoverAgent()
              .then((op) => {
                push("success", "Recovery submitted", `Operation ${op.id} — socket permissions, service restart and trust are re-verified.`);
                setFocusedId(op.id);
                setTrayOpen(true);
              })
              .catch(() => push("error", "Recovery failed", "Could not start the agent recovery."));
          }}
          title={`Recover the agent connection — ${db.server.name}`}
          confirmLabel="Run recovery"
          body="The recovery checks socket permissions, restarts the agent service and re-verifies peer-credential trust. Workloads are not touched."
        />
        <p className="text-xs text-ink-3">Checked {formatRelative(agentStatus.last_checkin_at, now)}.</p>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-009 — Installed modules                                      */
/* ------------------------------------------------------------------ */

export function ModulesView() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [, setTick] = useState(0);
  const { loading, data } = useFixtureLoad(() => listModules());
  const modules = data ?? [];
  const [disableTarget, setDisableTarget] = useState<PanelModule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const dependents = (key: string) => modules.filter((m) => m.dependencies.includes(key));

  const install = (mod: PanelModule) => {
    setBusy(mod.key);
    installModule(mod.key)
      .then((op) => {
        setBusy(null);
        setTick((t) => t + 1);
        push("success", `${mod.name} — install submitted`, `Operation ${op.id} — dependencies resolve, files stage and a smoke check verifies.`);
        setFocusedId(op.id);
        setTrayOpen(true);
      })
      .catch(() => {
        setBusy(null);
        push("error", "Install failed", "Could not queue the module install.");
      });
  };

  const disable = () => {
    if (disableTarget === null) return;
    setBusy(disableTarget.key);
    disableModule(disableTarget.key)
      .then((op) => {
        setBusy(null);
        setTick((t) => t + 1);
        push("success", `${disableTarget.name} — disable submitted`, `Operation ${op.id} — dependents are checked and the module stops.`);
        setFocusedId(op.id);
        setTrayOpen(true);
      })
      .catch(() => {
        setBusy(null);
        push("error", "Disable failed", "Could not queue the module disable.");
      });
  };

  const renderRow = (mod: PanelModule) => {
    const deps = dependents(mod.key);
    return (
      <div key={mod.key} className="rounded-card border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink">{mod.name}</p>
              <span className="font-mono text-[11px] text-ink-3">{mod.key}</span>
              <Chip tone={mod.state === "enabled" ? "success" : mod.state === "disabled" ? "neutral" : "warning"}>{mod.state.replace("_", " ")}</Chip>
              <Chip>{mod.category}</Chip>
            </div>
            <p className="mt-1 text-xs text-ink-2">{mod.note}</p>
            <p className="mt-1 text-xs text-ink-3">
              v{mod.version} · {mod.owner}
              {mod.dependencies.length > 0 ? ` · depends on ${mod.dependencies.join(", ")}` : ""}
              {deps.length > 0 ? ` · required by ${deps.map((d) => d.name).join(", ")}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {mod.state === "disabled" && (
              <Button size="sm" loading={busy === mod.key} onClick={() => install(mod)}>Install</Button>
            )}
            {mod.state === "enabled" && (
              <Button size="sm" variant="secondary" loading={busy === mod.key} onClick={() => setDisableTarget(mod)}>Disable</Button>
            )}
            {mod.state === "requires_docker" && (
              <ButtonLink size="sm" variant="secondary" href="/system/upgrade">Upgrade path</ButtonLink>
            )}
          </div>
        </div>
      </div>
    );
  };

  const installed = modules.filter((m) => m.state === "enabled");
  const available = modules.filter((m) => m.state === "disabled");
  const blocked = modules.filter((m) => m.state === "requires_docker");

  return (
    <Screen
      id="UX-INF-009"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Installed modules" }]}
    >
      <div className="flex flex-col gap-4">
        {loading && <SkeletonTable rows={3} cols={3} />}
        {!loading && data !== null && (
          <>
            <section aria-label="Installed modules" className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-ink">Installed ({installed.length})</h2>
              {installed.map(renderRow)}
            </section>
            <section aria-label="Available modules" className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-ink">Available, not installed ({available.length})</h2>
              {available.length === 0 ? (
                <p className="text-sm text-ink-2">Nothing waiting — every catalog module that fits this VPS is installed.</p>
              ) : (
                available.map(renderRow)
              )}
            </section>
            <section aria-label="Modules that need Docker" className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-ink">Blocked on this VPS ({blocked.length})</h2>
              {blocked.map(renderRow)}
            </section>
          </>
        )}
        <Callout tone="info" title="Ownership and dependencies">
          Modules are owned by the panel installation (Wanjiku Digital&apos;s build) and validated as signed units.
          Disabling a module checks its dependents first — php-runtime, for example, is required by the WordPress sites,
          so its disable job verifies them before stopping.
        </Callout>

        <ConfirmDialog
          open={disableTarget !== null}
          onClose={() => setDisableTarget(null)}
          onConfirm={disable}
          title={`Disable ${disableTarget?.name ?? ""}?`}
          confirmLabel={`Disable ${disableTarget?.name ?? "module"}`}
          destructive
          body={
            dependents(disableTarget?.key ?? "").length > 0
              ? `This module is required by ${dependents(disableTarget?.key ?? "").map((d) => d.name).join(", ")}. The disable job verifies dependents first and fails honestly if they would break.`
              : "The module stops after the panel verifies no other module or workload depends on it. You can reinstall it from this page at any time."
          }
        />
      </div>
    </Screen>
  );
}
