import type { Iso8601, WorkloadCategory } from "@/lib/types";

/**
 * Infrastructure fixtures (Stage 3 §8.3 incl. the v2 cgroup/capability
 * screens, Stage 6 §4.5 server/capability/usage endpoints).
 *
 * The server's own specs are NOT stored here — they come from
 * PROFILES[useSession().profile] because the demo profile switcher simulates
 * "which VPS did you buy". Everything the agent observes (heartbeat, cgroup
 * counters, diagnostics evidence, module inventory) lives here.
 */

const T = (h: number, m: number) => `2026-11-06T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

/* ------------------------------------------------------------------ */
/* Agent health (UX-INF-002, UX-INF-008)                               */
/* ------------------------------------------------------------------ */

export interface AgentStatus {
  server_id: string;
  connected: boolean;
  version: string;
  latest_version: string;
  trust: "verified" | "pending" | "revoked";
  drift: null | { kind: string; detail: string };
  socket: string;
  last_checkin_at: Iso8601;
  checkin_interval_seconds: number;
}

export const agentStatus: AgentStatus = {
  server_id: "srv_01JNAI01",
  connected: true,
  version: "1.4.2",
  latest_version: "1.4.3",
  trust: "verified",
  drift: null,
  socket: "/run/nexuspanel/agent.sock",
  last_checkin_at: "2026-11-06T14:59:47Z",
  checkin_interval_seconds: 30,
};

/* ------------------------------------------------------------------ */
/* Diagnostics (UX-INF-010)                                            */
/* ------------------------------------------------------------------ */

export interface DiagnosticCheck {
  name: string;
  result: "pass" | "warn" | "fail";
  detail: string;
  ran_at: Iso8601;
}

/** Read-only evidence from the last "Run safe checks" run. */
export const diagnosticChecks: DiagnosticCheck[] = [
  { name: "Agent connectivity", result: "pass", detail: "Unix socket /run/nexuspanel/agent.sock answered in 4 ms; peer-credential check ok.", ran_at: T(14, 52) },
  { name: "Disk space", result: "warn", detail: "72% of the data volume used. Above 80% batch jobs (backups, builds) start queueing earlier.", ran_at: T(14, 52) },
  { name: "Memory pressure", result: "pass", detail: "No memory.max events in the last 24h; 1 OOM kill 7 days ago (orders-api, since resolved).", ran_at: T(14, 52) },
  { name: "Certificate renewal timer", result: "pass", detail: "ACME renewal timer armed; next window in 9 days. No certificates within 14 days of expiry.", ran_at: T(14, 52) },
  { name: "Port 25 reachability", result: "fail", detail: "Outbound port 25 blocked by the VPS provider. Expected — self-hosted mail is not offered; external SMTP relay is unaffected.", ran_at: T(14, 52) },
  { name: "Time synchronization", result: "pass", detail: "systemd-timesyncd synchronized (offset 3 ms). TLS issuance depends on this.", ran_at: T(14, 52) },
];

export const diagnosticLogLines: { ts: string; severity: "info" | "warn" | "error"; message: string }[] = [
  { ts: "2026-11-06T14:52:01Z", severity: "info", message: "diagnostics.run start (safe checks only, read-only)" },
  { ts: "2026-11-06T14:52:01Z", severity: "info", message: "system.inventory.read — 4 vCPU, 6144 MB, 100 GB data volume" },
  { ts: "2026-11-06T14:52:02Z", severity: "info", message: "disk.usage — 72% of /srv/data (72 GB of 100 GB)" },
  { ts: "2026-11-06T14:52:02Z", severity: "warn", message: "disk.usage above the 70% advisory threshold" },
  { ts: "2026-11-06T14:52:03Z", severity: "info", message: "memory.events — 0 oom_kill in 24h, 1 in 7d (orders-api cgroup)" },
  { ts: "2026-11-06T14:52:03Z", severity: "error", message: "network.port25 — connect timeout to peer 25 (blocked upstream by provider)" },
  { ts: "2026-11-06T14:52:04Z", severity: "info", message: "tls.timers — acme-renewal armed, next fire 2026-11-15T03:00:00Z" },
  { ts: "2026-11-06T14:52:04Z", severity: "info", message: "time.sync — offset 3ms vs ke.ke.pool.ntp.org" },
  { ts: "2026-11-06T14:52:05Z", severity: "info", message: "diagnostics.run complete — 5 pass, 1 warn, 1 fail (expected blocker)" },
];

export interface RunbookLink {
  title: string;
  description: string;
  href: string;
}

export const diagnosticRunbooks: RunbookLink[] = [
  { title: "Disk filling up", description: "Find the growth (uploads, logs, backups) and either clean up or extend the volume. Backup jobs warn before they fail.", href: "/help" },
  { title: "A workload is near its memory ceiling", description: "Check the cgroup page for current/typical/peak, then adjust the ceiling or upgrade the VPS.", href: "/infrastructure/servers/srv_01JNAI01/cgroups" },
  { title: "Recovery center", description: "Offline-safe runbooks and rescue modes when the panel itself cannot start.", href: "/system/recovery" },
  { title: "Maintenance and drain", description: "Pause serving workloads safely before hardware or panel maintenance.", href: "/infrastructure/maintenance" },
];

/* ------------------------------------------------------------------ */
/* Per-workload cgroup metrics (UX-INF-013 — data behind DS-022)       */
/* ------------------------------------------------------------------ */

export interface CgroupWorkload {
  resource_ref: { type: "website" | "application" | "service_instance"; id: string; name: string };
  workload_category: WorkloadCategory;
  /** memory.current / memory.peak (24h) / memory.max in MB. */
  memory: { current_mb: number; peak_mb: number; ceiling_mb: number; oom_events_7d: number };
  /** cpu.stat-derived usage plus the applied cpu.max for batch. */
  cpu: { current_mc: number; typical_mc: number; peak_mc: number; cpu_weight: number; cpu_max_mc: number | null };
  /** io.stat-derived throughput (MB/s) and pids.current. */
  io: { read_mb_s: number; write_mb_s: number };
  pids_current: number;
  throttled_seconds_24h: number;
  updated_at: Iso8601;
}

export const cgroupWorkloads: CgroupWorkload[] = [
  {
    resource_ref: { type: "website", id: "web_01JKILI02", name: "kili-shop" },
    workload_category: "serving",
    memory: { current_mb: 198, peak_mb: 295, ceiling_mb: 400, oom_events_7d: 0 },
    cpu: { current_mc: 145, typical_mc: 120, peak_mc: 380, cpu_weight: 100, cpu_max_mc: null },
    io: { read_mb_s: 0.4, write_mb_s: 1.2 },
    pids_current: 64,
    throttled_seconds_24h: 0,
    updated_at: T(14, 59),
  },
  {
    resource_ref: { type: "application", id: "app_01JORDR01", name: "orders-api" },
    workload_category: "serving",
    memory: { current_mb: 380, peak_mb: 490, ceiling_mb: 512, oom_events_7d: 1 },
    cpu: { current_mc: 340, typical_mc: 310, peak_mc: 720, cpu_weight: 100, cpu_max_mc: null },
    io: { read_mb_s: 0.2, write_mb_s: 0.8 },
    pids_current: 31,
    throttled_seconds_24h: 0,
    updated_at: T(14, 55),
  },
  {
    resource_ref: { type: "application", id: "app_01JIMGW02", name: "image-worker" },
    workload_category: "batch",
    memory: { current_mb: 90, peak_mb: 480, ceiling_mb: 600, oom_events_7d: 0 },
    cpu: { current_mc: 60, typical_mc: 190, peak_mc: 500, cpu_weight: 10, cpu_max_mc: 500 },
    io: { read_mb_s: 2.8, write_mb_s: 3.4 },
    pids_current: 18,
    throttled_seconds_24h: 1540,
    updated_at: T(14, 50),
  },
  {
    resource_ref: { type: "website", id: "web_01JACME01", name: "acme-consulting" },
    workload_category: "serving",
    memory: { current_mb: 26, peak_mb: 48, ceiling_mb: 80, oom_events_7d: 0 },
    cpu: { current_mc: 65, typical_mc: 40, peak_mc: 210, cpu_weight: 100, cpu_max_mc: null },
    io: { read_mb_s: 0.1, write_mb_s: 0.02 },
    pids_current: 8,
    throttled_seconds_24h: 0,
    updated_at: T(14, 59),
  },
  {
    resource_ref: { type: "service_instance", id: "svc_01JNEXT03", name: "team-cloud (Nextcloud)" },
    workload_category: "serving",
    memory: { current_mb: 690, peak_mb: 760, ceiling_mb: 1024, oom_events_7d: 0 },
    cpu: { current_mc: 300, typical_mc: 180, peak_mc: 520, cpu_weight: 100, cpu_max_mc: null },
    io: { read_mb_s: 1.1, write_mb_s: 2.6 },
    pids_current: 96,
    throttled_seconds_24h: 0,
    updated_at: T(14, 48),
  },
  {
    resource_ref: { type: "service_instance", id: "svc_01JREDIS4", name: "session-cache (Redis)" },
    workload_category: "serving",
    memory: { current_mb: 75, peak_mb: 120, ceiling_mb: 300, oom_events_7d: 0 },
    cpu: { current_mc: 20, typical_mc: 15, peak_mc: 45, cpu_weight: 100, cpu_max_mc: null },
    io: { read_mb_s: 0.05, write_mb_s: 0.1 },
    pids_current: 6,
    throttled_seconds_24h: 0,
    updated_at: T(14, 58),
  },
  {
    resource_ref: { type: "service_instance", id: "svc_01JMINIO1", name: "media-store (MinIO)" },
    workload_category: "serving",
    memory: { current_mb: 155, peak_mb: 260, ceiling_mb: 400, oom_events_7d: 0 },
    cpu: { current_mc: 90, typical_mc: 60, peak_mc: 240, cpu_weight: 100, cpu_max_mc: null },
    io: { read_mb_s: 4.2, write_mb_s: 1.8 },
    pids_current: 24,
    throttled_seconds_24h: 0,
    updated_at: T(14, 57),
  },
];

/* ------------------------------------------------------------------ */
/* Maintenance windows (UX-INF-007)                                    */
/* ------------------------------------------------------------------ */

export interface MaintenanceWindow {
  id: string;
  reason: string;
  window_from: Iso8601;
  window_to: Iso8601;
  state: "scheduled" | "active" | "completed";
  affected_workloads: number;
}

/** Mutable — lib/api/infrastructure.ts schedules and completes windows. */
export const maintenanceWindows: MaintenanceWindow[] = [
  {
    id: "mnt_01JWIN001",
    reason: "Panel upgrade to 1.4.3 (agent + control plane)",
    window_from: "2026-11-09T01:00:00Z",
    window_to: "2026-11-09T03:00:00Z",
    state: "scheduled",
    affected_workloads: 9,
  },
  {
    id: "mnt_01JWIN000",
    reason: "Kernel security patch + reboot",
    window_from: "2026-11-02T01:00:00Z",
    window_to: "2026-11-02T01:38:00Z",
    state: "completed",
    affected_workloads: 9,
  },
];

/* ------------------------------------------------------------------ */
/* Service roles (UX-INF-004)                                          */
/* ------------------------------------------------------------------ */

export interface ServiceRole {
  id: string;
  server_id: string;
  role: "panel" | "web" | "database" | "queue" | "backup";
  state: "assigned" | "recommended" | "conflict";
  detail: string;
  capacity_note: string;
}

/** Mutable — role assignment is a server label change (PATCH /servers/{id}). */
export const serviceRoles: ServiceRole[] = [
  { id: "role_01JPANEL1", server_id: "srv_01JNAI01", role: "panel", state: "assigned", detail: "Control plane + metadata database (SQLite on Nano/Starter, Postgres on Standard+).", capacity_note: "Panel footprint ~40 MB." },
  { id: "role_01JWEB002", server_id: "srv_01JNAI01", role: "web", state: "assigned", detail: "Serves websites and applications (Nginx on Nano/Starter, Caddy on Standard+).", capacity_note: "6 serving workloads placed." },
  { id: "role_01JDB0003", server_id: "srv_01JNAI01", role: "database", state: "assigned", detail: "Hosts MariaDB/Postgres containers (database.mariadb, database.postgres templates).", capacity_note: "2 database containers, 1.9 GB combined ceiling." },
  { id: "role_01JBAK004", server_id: "srv_01JNAI01", role: "backup", state: "assigned", detail: "Runs restic batch jobs to the remote B2 destination nightly.", capacity_note: "Batch, yields to serving traffic." },
  { id: "role_01JQUEUE5", server_id: "srv_01JNAI01", role: "queue", state: "recommended", detail: "RabbitMQ-style queue for workflow automation — recommended only when an automation workload needs it.", capacity_note: "Needs 300 MB RAM ceiling; free on this VPS." },
];

/* ------------------------------------------------------------------ */
/* Fleet topology (UX-INF-005)                                         */
/* ------------------------------------------------------------------ */

export interface TopologyZone {
  zone: string;
  region_label: string;
  nodes: { server_id: string; name: string; roles: string[]; state: "active" | "draining" | "registration" }[];
}

export const topologyZones: TopologyZone[] = [
  {
    zone: "nairobi-01",
    region_label: "Nairobi (Leaseweb route, ~4 ms to IXP Ke)",
    nodes: [{ server_id: "srv_01JNAI01", name: "nairobi-01", roles: ["panel", "web", "database", "backup"], state: "active" }],
  },
];

/* ------------------------------------------------------------------ */
/* Installed modules (UX-INF-009)                                      */
/* ------------------------------------------------------------------ */

export interface PanelModule {
  key: string;
  name: string;
  category: "adapter" | "runtime" | "dependency";
  state: "enabled" | "disabled" | "requires_docker";
  version: string;
  owner: string;
  dependencies: string[];
  note: string;
}

/** Mutable — install/disable flows update state. */
export const panelModules: PanelModule[] = [
  { key: "nginx-adapter", name: "Nginx adapter", category: "adapter", state: "enabled", version: "1.4.2", owner: "Wanjiku Digital", dependencies: [], note: "Validates and applies site configs (nginx.site.validate / apply)." },
  { key: "php-runtime", name: "PHP-FPM 8.2 runtime", category: "runtime", state: "enabled", version: "8.2.26", owner: "Wanjiku Digital", dependencies: ["nginx-adapter"], note: "Required by WordPress sites (kili-shop, jamboshop)." },
  { key: "restic-backup", name: "Restic backup engine", category: "dependency", state: "enabled", version: "0.17", owner: "Wanjiku Digital", dependencies: [], note: "Nightly snapshots to B2 bucket wanjiku-backups (batch workload)." },
  { key: "docker-runtime", name: "Docker runtime", category: "runtime", state: "requires_docker", version: "—", owner: "Wanjiku Digital", dependencies: [], note: "Containers for apps, databases and ServiceTemplate instances. Needs a Standard VPS (6 GB)." },
  { key: "caddy-adapter", name: "Caddy adapter", category: "adapter", state: "disabled", version: "2.8", owner: "Wanjiku Digital", dependencies: [], note: "Automatic-HTTPS reverse proxy. Becomes the default proxy on Standard+." },
  { key: "smtp-relay", name: "External SMTP relay adapter", category: "adapter", state: "enabled", version: "1.1", owner: "Wanjiku Digital", dependencies: [], note: "Panel notifications and WordPress outbound mail via Resend." },
  { key: "imgproxy-batch", name: "imgproxy transform worker", category: "runtime", state: "requires_docker", version: "3.27", owner: "Wanjiku Digital", dependencies: ["docker-runtime"], note: "Batch image transformation; yields to serving traffic." },
];

/* ------------------------------------------------------------------ */
/* Capability detection evidence (UX-INF-011, UX-INF-012)              */
/* ------------------------------------------------------------------ */

export const DETECTION_STEPS = [
  "Read hardware counters (vCPU, RAM, disk, virtualization hints)",
  "Probe prerequisites (Docker socket, port 25, public IP, kernel cgroup v2)",
  "Fit each capability's floor/typical/ceiling against free RAM",
  "Flag overcommit (RAM ceiling sum ≤ physical × 1.2; CPU soft > 3×)",
  "Sign the capability file and record the digest",
];

/** Detection log shown as evidence on the capability screen. */
export const detectionLogLines: { ts: string; severity: "info" | "warn" | "error"; message: string }[] = [
  { ts: "2026-11-06T09:00:00Z", severity: "info", message: "capability.detect step 1/5 — hardware: 4 vCPU, 6144 MB RAM, 100 GB disk" },
  { ts: "2026-11-06T09:00:01Z", severity: "info", message: "capability.detect step 2/5 — docker socket present, public IP 203.0.113.10, port 25 blocked (recorded)" },
  { ts: "2026-11-06T09:00:02Z", severity: "info", message: "capability.detect step 3/5 — 14 candidate capabilities fitted against free RAM" },
  { ts: "2026-11-06T09:00:03Z", severity: "warn", message: "capability.detect step 4/5 — CPU overcommit 3.1× at full batch load (soft warning)" },
  { ts: "2026-11-06T09:00:04Z", severity: "info", message: "capability.detect step 5/5 — capability file signed, digest sha256:9f1c02ba…" },
];

/* ------------------------------------------------------------------ */
/* Host facts (UX-INF-002 — kernel/cgroup observed by the agent)        */
/* ------------------------------------------------------------------ */

/** Observed by the agent (uname -r); the specs themselves come from PROFILES. */
export const hostKernel: string = "6.8.0-45-generic";

/* ------------------------------------------------------------------ */
/* Agent check-in / trust log (UX-INF-008 — detection evidence)         */
/* ------------------------------------------------------------------ */

export const agentLogLines: { ts: string; severity: "info" | "warn" | "error"; message: string }[] = [
  { ts: "2026-11-06T14:59:47Z", severity: "info", message: "agent.checkin ok — peer credential verified (uid 0, socket /run/nexuspanel/agent.sock)" },
  { ts: "2026-11-06T14:58:12Z", severity: "info", message: "cgroup.sample — 7 workloads read (memory.current, cpu.stat, pids.current)" },
  { ts: "2026-11-06T09:00:04Z", severity: "info", message: "capability.detect — signed file written, digest sha256:9f1c02ba… (unchanged since 2026-11-02)" },
  { ts: "2026-11-02T08:15:00Z", severity: "info", message: "capability.rescan — hardware re-read after plan change, no drift in floors" },
  { ts: "2026-11-02T07:59:41Z", severity: "warn", message: "agent.upgrade staged — 1.4.2 → 1.4.3 available, deferred to the 2026-11-09 maintenance window" },
  { ts: "2026-10-24T07:02:00Z", severity: "info", message: "agent.connected — trust verified on first enrollment (panel.installed 4 minutes earlier)" },
];

/* ------------------------------------------------------------------ */
/* Placement planner defaults (UX-INF-006)                             */
/* ------------------------------------------------------------------ */

export interface PlacementRequest {
  workload_name: string;
  workload_category: WorkloadCategory;
  ram_floor_mb: number;
  ram_typical_mb: number;
  ram_ceiling_mb: number;
  cpu_weight: number;
}

export const placementRequests: PlacementRequest[] = [
  { workload_name: "orders-api (v2 replica)", workload_category: "serving", ram_floor_mb: 200, ram_typical_mb: 256, ram_ceiling_mb: 512, cpu_weight: 100 },
  { workload_name: "Nightly analytics export", workload_category: "batch", ram_floor_mb: 150, ram_typical_mb: 220, ram_ceiling_mb: 400, cpu_weight: 10 },
];
