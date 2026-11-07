import type { CapabilityRecord, Operation } from "@/lib/types";
import { db } from "@/lib/mock/data";
import {
  agentStatus,
  cgroupWorkloads,
  maintenanceWindows,
  panelModules,
  serviceRoles,
  type CgroupWorkload,
  type MaintenanceWindow,
  type PanelModule,
  type ServiceRole,
} from "@/lib/mock/infrastructure";
import { capabilitiesFor } from "@/lib/profiles";
import { operations } from "@/lib/operations";
import { ApiError, newId, ok, problem, withLatency } from "@/lib/api/core";

/**
 * Mock API client for the server / capability / cgroup surface
 * (Stage 6 §4.5). Documented operation kinds are used where the spec names
 * them (capability.rescan, capability.apply, resource.limit.update);
 * maintenance, diagnostics and agent-upgrade jobs follow the same 202 +
 * operation pattern with derived kinds.
 */

function actor(): { actor_id: string; organization_id: string } {
  return { actor_id: db.currentUser, organization_id: db.currentOrganization };
}

export function serverRef() {
  return { type: "server" as const, id: db.server.id, name: db.server.name };
}

/* ------------------------------------------------------------------ */
/* Server inventory / detail (UX-INF-001, UX-INF-002)                  */
/* ------------------------------------------------------------------ */

export async function getServerHealth() {
  return withLatency(() => {
    return ok({
      state: db.server.state,
      heartbeat_at: db.server.last_seen_at,
      connectivity: db.server.agent_connected ? ("ok" as const) : ("unreachable" as const),
      agent_version: db.server.agent_version,
    });
  }, 160);
}

/* ------------------------------------------------------------------ */
/* Enrollment (UX-INF-003)                                             */
/* ------------------------------------------------------------------ */

/** POST /agents/enrollment-tokens → 201 (one-time, short-lived). */
export async function generateEnrollmentToken(): Promise<{ token_once: string; expires_at: string }> {
  return withLatency(() => {
    return {
      token_once: `aet_01J${newId("t").slice(6)}${newId("t").slice(6)}`,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }, 550);
}

/* ------------------------------------------------------------------ */
/* Service roles (UX-INF-004) — server label change, PATCH semantics    */
/* ------------------------------------------------------------------ */

export async function assignServiceRole(role: ServiceRole["role"], assign: boolean): Promise<ServiceRole> {
  return withLatency(() => {
    const existing = serviceRoles.find((r) => r.role === role);
    if (!existing) {
      throw new ApiError(problem(404, "NOT_FOUND", "Role not found", "That service role is not part of this installation."));
    }
    existing.state = assign ? "assigned" : "recommended";
    return existing;
  }, 350);
}

export function listServiceRoles(): ServiceRole[] {
  return serviceRoles;
}

/* ------------------------------------------------------------------ */
/* Maintenance and drain (UX-INF-007)                                  */
/* ------------------------------------------------------------------ */

export function listMaintenanceWindows(): MaintenanceWindow[] {
  return maintenanceWindows;
}

export async function enterMaintenance(reason: string, minutes: number): Promise<Operation> {
  maintenanceWindows.unshift({
    id: newId("mnt"),
    reason,
    window_from: new Date().toISOString(),
    window_to: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    state: "active",
    affected_workloads: db.websites.length + db.applications.length + db.serviceInstances.length,
  });
  return operations.submit({
    kind: "server.maintenance",
    title: `Enter maintenance — ${db.server.name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: [
      "Enumerate serving workloads",
      "Pause placements and notify owners",
      "Enter maintenance state and verify",
    ],
    ...actor(),
  });
}

export async function exitMaintenance(): Promise<Operation> {
  const active = maintenanceWindows.find((w) => w.state === "active");
  if (active) active.state = "completed";
  return operations.submit({
    kind: "server.maintenance",
    title: `Exit maintenance — ${db.server.name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: ["Resume serving workloads", "Re-open placements", "Verify health checks"],
    ...actor(),
  });
}

export async function scheduleMaintenance(reason: string, from: Date, minutes: number): Promise<Operation> {
  maintenanceWindows.unshift({
    id: newId("mnt"),
    reason,
    window_from: from.toISOString(),
    window_to: new Date(from.getTime() + minutes * 60 * 1000).toISOString(),
    state: "scheduled",
    affected_workloads: db.websites.length + db.applications.length + db.serviceInstances.length,
  });
  return operations.submit({
    kind: "server.maintenance",
    title: `Schedule maintenance — ${db.server.name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: ["Validate window", "Notify subscribed owners", "Arm the scheduler"],
    ...actor(),
  });
}

export async function drainServer(): Promise<Operation> {
  return operations.submit({
    kind: "server.drain",
    title: `Drain ${db.server.name} — stop new placements`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: ["Stop new placements", "Migrate workloads where supported", "Verify the drain"],
    ...actor(),
  });
}

/* ------------------------------------------------------------------ */
/* Agent health and upgrades (UX-INF-008)                              */
/* ------------------------------------------------------------------ */

export async function planAgentUpgrade(target: string): Promise<Operation> {
  if (target === agentStatus.version) {
    throw new ApiError(problem(422, "ALREADY_CURRENT", "Agent already on this version", `The agent is already running ${agentStatus.version}.`));
  }
  const op = operations.submit({
    kind: "agent.upgrade",
    title: `Upgrade agent to ${target} — ${db.server.name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: ["Download signed agent build", "Verify signature", "Swap binary and restart", "Reconnect and verify trust"],
    ...actor(),
  });
  operations.subscribe((op2) => {
    if (op2.id === op.id && op2.status === "succeeded") {
      agentStatus.version = target;
      agentStatus.latest_version = target;
    }
  });
  return op;
}

export async function recoverAgent(): Promise<Operation> {
  return operations.submit({
    kind: "agent.recover",
    title: `Recover agent connection — ${db.server.name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: ["Check socket permissions", "Restart agent service", "Verify peer credentials and trust"],
    ...actor(),
  });
}

/* ------------------------------------------------------------------ */
/* Modules (UX-INF-009)                                                */
/* ------------------------------------------------------------------ */

export function listModules(): PanelModule[] {
  return panelModules;
}

export async function installModule(key: string): Promise<Operation> {
  const mod = panelModules.find((m) => m.key === key);
  if (!mod) throw new ApiError(problem(404, "NOT_FOUND", "Module not found", "That module is not in the installation catalog."));
  if (mod.state === "requires_docker") {
    throw new ApiError(problem(409, "CAPABILITY_UNAVAILABLE", "This module cannot run here", mod.note));
  }
  const op = operations.submit({
    kind: "module.install",
    title: `Install ${mod.name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: ["Resolve dependencies", "Stage module files", "Register adapter", "Verify with a smoke check"],
    ...actor(),
  });
  operations.subscribe((op2) => {
    if (op2.id === op.id && op2.status === "succeeded") mod.state = "enabled";
  });
  return op;
}

export async function disableModule(key: string): Promise<Operation> {
  const mod = panelModules.find((m) => m.key === key);
  if (!mod) throw new ApiError(problem(404, "NOT_FOUND", "Module not found", "That module is not installed."));
  const op = operations.submit({
    kind: "module.disable",
    title: `Disable ${mod.name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: ["Check dependents", "Stop the module", "Verify dependent workloads"],
    ...actor(),
  });
  operations.subscribe((op2) => {
    if (op2.id === op.id && op2.status === "succeeded") {
      if (mod.state === "enabled") mod.state = "disabled";
    }
  });
  return op;
}

/* ------------------------------------------------------------------ */
/* Diagnostics (UX-INF-010)                                            */
/* ------------------------------------------------------------------ */

export async function runDiagnostics(): Promise<Operation> {
  return operations.submit({
    kind: "server.diagnostics",
    title: `Run safe checks — ${db.server.name}`,
    resource_ref: serverRef(),
    workload_category: "batch",
    yields_once: true,
    step_titles: [
      "Read inventory (read-only)",
      "Probe connectivity and timers",
      "Sample cgroup counters",
      "Write evidence to the diagnostics report",
    ],
    ...actor(),
  });
}

/* ------------------------------------------------------------------ */
/* Capabilities (UX-INF-011, UX-INF-012)                               */
/* ------------------------------------------------------------------ */

/** POST /servers/{id}/capabilities/rescan → 202, kind capability.rescan. */
export async function rescanCapabilities(): Promise<Operation> {
  return operations.submit({
    kind: "capability.rescan",
    title: `Rescan hardware — ${db.server.name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: [
      "Read hardware counters",
      "Probe prerequisites (Docker, port 25, public IP)",
      "Fit capability floors against free RAM",
      "Check overcommit limits",
      "Sign the new capability file",
    ],
    ...actor(),
  });
}

/** POST /servers/{id}/capabilities/apply → 202 (accept the rescan diff). */
export async function applyCapabilitySet(): Promise<Operation> {
  return operations.submit({
    kind: "capability.apply",
    title: `Apply new capability set — ${db.server.name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: ["Verify the signed digest", "Stage the new capability set", "Enable new workloads", "Verify metadata database"],
    ...actor(),
  });
}

export function currentCapabilityRecords(): CapabilityRecord[] {
  return capabilitiesFor(db.server.profile);
}

/* ------------------------------------------------------------------ */
/* cgroup ceilings (UX-INF-013) — kind resource.limit.update           */
/* ------------------------------------------------------------------ */

export function listCgroupWorkloads(): CgroupWorkload[] {
  return cgroupWorkloads;
}

export async function updateResourceLimit(input: {
  workload: CgroupWorkload;
  field: "memory_ceiling_mb" | "cpu_max_mc";
  before: number | null;
  after: number;
  physical_ram_mb: number;
}): Promise<Operation> {
  const { workload } = input;
  // CGROUP_CONFIG_INVALID rules (Stage 6 §1): RAM ceiling ≤ physical × 1.2;
  // batch keeps a cpu.max; serving keeps cpu.max null.
  if (input.field === "memory_ceiling_mb") {
    const hardMax = Math.round(input.physical_ram_mb * 1.2);
    if (input.after > hardMax) {
      throw new ApiError(
        problem(422, "CGROUP_CONFIG_INVALID", "Ceiling exceeds the hard limit", `A memory ceiling above ${hardMax} MB (physical RAM × 1.2) would overcommit the server and is refused.`)
      );
    }
  }
  if (input.field === "cpu_max_mc" && workload.workload_category !== "batch") {
    throw new ApiError(
      problem(422, "CGROUP_CONFIG_INVALID", "cpu.max only exists for batch", "Serving workloads use cpu.weight for fair sharing; a hard cpu.max would starve them under load.")
    );
  }
  const op = operations.submit({
    kind: "resource.limit.update",
    title: `Adjust ${input.field === "memory_ceiling_mb" ? "memory ceiling" : "cpu.max"} — ${workload.resource_ref.name}`,
    resource_ref: { type: workload.resource_ref.type, id: workload.resource_ref.id, name: workload.resource_ref.name },
    workload_category: "infrastructure",
    step_titles: [
      "Validate against category constraints",
      "Write cgroup memory.max / cpu.max",
      "Re-read the value and verify it applied",
    ],
    ...actor(),
  });
  operations.subscribe((op2) => {
    if (op2.id !== op.id || op2.status !== "succeeded") return;
    if (input.field === "memory_ceiling_mb") workload.memory.ceiling_mb = input.after;
    if (input.field === "cpu_max_mc") workload.cpu.cpu_max_mc = input.after;
    workload.updated_at = new Date().toISOString();
  });
  return op;
}

/* ------------------------------------------------------------------ */
/* Placement (UX-INF-006)                                              */
/* ------------------------------------------------------------------ */

export async function reservePlacement(input: {
  workload_name: string;
  workload_category: "serving" | "batch";
  ram_ceiling_mb: number;
  cpu_weight: number;
}): Promise<Operation> {
  return operations.submit({
    kind: "workload.create",
    title: `Reserve capacity — ${input.workload_name}`,
    resource_ref: serverRef(),
    workload_category: "infrastructure",
    step_titles: ["Check capability fit", "Reserve RAM/CPU headroom", "Confirm the placement"],
    ...actor(),
  });
}

/* ------------------------------------------------------------------ */
/* Database service settings (UX-DB-008)                               */
/* ------------------------------------------------------------------ */

export async function planDatabaseCapacityChange(deltaRamMb: number): Promise<Operation> {
  return operations.submit({
    kind: "resource.limit.update",
    title: `Database capacity plan change (+${deltaRamMb} MB ceiling)`,
    resource_ref: { type: "database_pool", id: "db-pool-nairobi-01", name: "database service" },
    workload_category: "infrastructure",
    step_titles: [
      "Validate the sum of memory.max against physical × 1.2",
      "Stage the new pool ceilings",
      "Apply and verify running containers",
    ],
    ...actor(),
  });
}
