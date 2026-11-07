import type { Iso8601, ProfileId, UsageSnapshot } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { PROFILES } from "@/lib/profiles";

/**
 * Ops-module fixture extensions (backups, monitoring, incidents, security,
 * updates). Extends the shared `db` dataset — same Kenya-context demo world
 * (Wanjiku Digital, Nairobi). Shapes mirror the Stage 6 endpoint families
 * (§4.12 backups, §4.13 security/audit, §4.14 monitoring) with snake_case
 * fields so the mock layer swaps for fetch() calls unchanged.
 */

export interface BackupPolicy {
  id: string; // bp_01J…
  name: string;
  scope: string;
  cron: string;
  schedule_label: string;
  timezone: string;
  destination: "remote" | "local";
  destination_label: string;
  retention_days: number;
  encryption: string; // "age/xchacha20"
  consistency: "filesystem" | "database-consistent";
  enabled: boolean;
  last_run_at: Iso8601;
  last_verified_restore_at: Iso8601 | null;
  covered_resources: string[];
}

export interface BackupDestination {
  id: string; // dst_01J…
  kind: "remote" | "local";
  name: string;
  detail: string;
  credential_hint: string;
  status: "healthy" | "untested" | "degraded" | "unavailable";
  status_detail: string | null;
  last_tested_at: Iso8601 | null;
  capability_key: string | null; // e.g. "backup.local" — honest gate on nano
}

export interface FirewallRule {
  id: string; // fw_01J…
  position: number;
  direction: "in" | "out";
  family: "ipv4" | "ipv6";
  protocol: "tcp" | "udp" | "any";
  port: string; // "22" | "80,443" | "any"
  source: string; // CIDR or "anywhere"
  action: "allow" | "deny";
  note: string;
  added_at: Iso8601;
  added_by: string;
}

export interface SshKey {
  id: string; // ssh_01J…
  name: string;
  algorithm: string;
  fingerprint: string;
  added_at: Iso8601;
  last_used_at: Iso8601 | null;
  added_by: string;
}

export interface LoginEvent {
  id: string; // sev_01J…
  occurred_at: Iso8601;
  outcome: "succeeded" | "failed";
  actor_label: string;
  ip: string;
  detail: string;
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  occurred_at: Iso8601;
  actor: string;
  kind: "alert" | "diagnosis" | "action" | "note" | "state";
  text: string;
}

export interface AlertRule {
  id: string; // alr_01J…
  name: string;
  metric: string;
  comparator: ">" | "<";
  threshold_label: string;
  window: string;
  channel: string;
  state: "ok" | "firing" | "silenced";
  fired_at: Iso8601 | null;
  silenced_until: Iso8601 | null;
  detail: string;
}

export interface ServiceHealthRow {
  name: string;
  kind: string;
  state: "healthy" | "degraded" | "unhealthy" | "unknown";
  detail: string;
  last_check_at: Iso8601;
}

export interface LogRow {
  ts: string;
  severity: "info" | "warn" | "error";
  source: string;
  message: string;
}

export interface MetricDef {
  key: string;
  label: string;
  unit: string;
  base: number;
  variance: number;
  description: string;
}

export interface CompatRow {
  component: string;
  current: string;
  state: "compatible" | "attention";
  detail: string;
}

export interface VerificationRecord {
  id: string; // ver_01J…
  backup_id: string;
  backup_label: string;
  ran_at: Iso8601;
  result: "passed" | "failed";
  detail: string;
  duration_s: number;
}

const T = (h: number, m: number) =>
  `2026-11-06T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

export const backupPolicies: BackupPolicy[] = [
  {
    id: "bp_01JNIGHT1",
    name: "Nightly 02:00",
    scope: "All websites and their databases",
    cron: "0 2 * * *",
    schedule_label: "Every night at 02:00",
    timezone: "Africa/Nairobi (UTC+3)",
    destination: "remote",
    destination_label: "B2 bucket wanjiku-backups",
    retention_days: 30,
    encryption: "age/xchacha20 (key held on server, never uploaded)",
    consistency: "database-consistent",
    enabled: true,
    last_run_at: T(2, 7),
    last_verified_restore_at: "2026-11-05T04:10:00Z",
    covered_resources: ["acme-consulting", "kili-shop", "wanjiku-blog"],
  },
  {
    id: "bp_01JWEEK1",
    name: "Weekly Sunday",
    scope: "Self-hosted services (team-cloud, media-store)",
    cron: "0 3 * * 0",
    schedule_label: "Sundays at 03:00",
    timezone: "Africa/Nairobi (UTC+3)",
    destination: "remote",
    destination_label: "B2 bucket wanjiku-backups",
    retention_days: 60,
    encryption: "age/xchacha20",
    consistency: "filesystem",
    enabled: true,
    last_run_at: "2026-11-02T03:00:00Z",
    last_verified_restore_at: null,
    covered_resources: ["team-cloud", "media-store"],
  },
];

export const backupDestinations: BackupDestination[] = [
  {
    id: "dst_01JB2REM1",
    kind: "remote",
    name: "Backblaze B2",
    detail: "bucket wanjiku-backups · region eu-central · restic repository",
    credential_hint: "applicationKey ••••7f2b",
    status: "healthy",
    status_detail: "Last nightly upload verified — 594 MB stored, 30-day retention.",
    last_tested_at: T(2, 9),
    capability_key: null,
  },
  {
    id: "dst_01JLOCAL1",
    kind: "local",
    name: "Local disk (/var/backups)",
    detail: "Second copy on the same VPS disk",
    credential_hint: "—",
    status: "unavailable",
    status_detail: null,
    last_tested_at: null,
    capability_key: "backup.local",
  },
];

export const firewallRules: FirewallRule[] = [
  { id: "fw_01JFW001", position: 1, direction: "in", family: "ipv4", protocol: "any", port: "any", source: "anywhere", action: "deny", note: "Default deny — everything not allowed below is rejected", added_at: "2026-10-24T07:00:00Z", added_by: "Installer" },
  { id: "fw_01JFW002", position: 2, direction: "in", family: "ipv4", protocol: "tcp", port: "22", source: "197.232.81.14/32", action: "allow", note: "SSH — office IP only (Jane's router)", added_at: "2026-10-24T07:01:00Z", added_by: "Jane Wanjiku" },
  { id: "fw_01JFW003", position: 3, direction: "in", family: "ipv4", protocol: "tcp", port: "80,443", source: "anywhere", action: "allow", note: "Public websites (HTTP + HTTPS)", added_at: "2026-10-24T07:01:00Z", added_by: "Installer" },
  { id: "fw_01JFW004", position: 4, direction: "in", family: "ipv6", protocol: "tcp", port: "80,443", source: "::/0", action: "allow", note: "Public websites over IPv6", added_at: "2026-10-24T07:02:00Z", added_by: "Installer" },
  { id: "fw_01JFW005", position: 5, direction: "in", family: "ipv4", protocol: "tcp", port: "8443", source: "197.232.81.14/32", action: "allow", note: "Jambo dashboard — pending second-person approval", added_at: T(14, 30), added_by: "Kevin Otieno" },
];

export const sshKeys: SshKey[] = [
  { id: "ssh_01JKEY01", name: "Jane's laptop", algorithm: "ed25519", fingerprint: "SHA256:8kX2mQpR7vLw3nZ1cA9dEfGh5iJk0lMn4oPq6rS8tU", added_at: "2026-11-01T08:00:00Z", last_used_at: T(9, 12), added_by: "Jane Wanjiku" },
  { id: "ssh_01JKEY02", name: "Kevin's desktop", algorithm: "ed25519", fingerprint: "SHA256:2nW9xRb4tYu8iO0pA1sD6fGh3jK5lZ7vB9cM1nQ4eR", added_at: "2026-10-28T11:30:00Z", last_used_at: "2026-11-05T16:45:00Z", added_by: "Kevin Otieno" },
];

export const loginEvents: LoginEvent[] = [
  { id: "sev_01JLG007", occurred_at: T(14, 2), outcome: "failed", actor_label: "unknown (admin)", ip: "185.220.101.4", detail: "5 failed password attempts — source flagged by rate limiter, no account lock triggered" },
  { id: "sev_01JLG006", occurred_at: T(7, 30), outcome: "succeeded", actor_label: "Jane Wanjiku", ip: "197.232.81.14", detail: "Password + TOTP MFA" },
  { id: "sev_01JLG005", occurred_at: "2026-11-05T20:40:00Z", outcome: "succeeded", actor_label: "Jane Wanjiku", ip: "41.90.64.20", detail: "iPhone 15 — passkey" },
  { id: "sev_01JLG004", occurred_at: "2026-11-05T09:12:00Z", outcome: "succeeded", actor_label: "Kevin Otieno", ip: "197.232.81.14", detail: "Password + TOTP MFA" },
];

export const sessionPolicies: { id: string; label: string; value: string; description: string }[] = [
  { id: "sp_01JSES1", label: "Session lifetime", value: "14 days idle", description: "Sessions are revoked after 14 days without activity. Step-up MFA is required for firewall, suspension and payment-reversal actions." },
  { id: "sp_01JSES2", label: "Step-up MFA", value: "Required for high-risk actions", description: "firewall.apply, hosting-account.suspend and payment.reverse ask for a fresh MFA code bound to the action and resource." },
  { id: "sp_01JMFAS", label: "MFA (your account)", value: "Enabled — TOTP + passkey", description: "Recovery codes are hashed at rest. MFA is enforced by policy for the owner role." },
];

export const incidentEvents: IncidentEvent[] = [
  { id: "ev_01JIN01a", incident_id: "inc_01JINC01", occurred_at: T(14, 38), actor: "Alert rule — orders-api RAM", kind: "alert", text: "orders-api crossed 80% of its memory ceiling (380 MB of 400 MB allocated) and stayed there for 25 minutes." },
  { id: "ev_01JIN01b", incident_id: "inc_01JINC01", occurred_at: T(14, 39), actor: "Agent", kind: "note", text: "1 OOM kill in the last 7 days (Nov 3, 13:22). cgroup memory.peak 490 MB." },
  { id: "ev_01JIN01c", incident_id: "inc_01JINC01", occurred_at: T(14, 41), actor: "AI diagnostics", kind: "diagnosis", text: "Likely cause: in-memory cache without eviction on the /orders endpoint. Confidence medium. Proposed action: restart the app now (safe) and raise memory.max, or reduce cache size." },
  { id: "ev_01JIN00a", incident_id: "inc_01JINC00", occurred_at: "2026-11-04T09:00:00Z", actor: "Cert renewer", kind: "alert", text: "kilishop.co.ke renewal failed — Let's Encrypt rate limit hit (5 identical requests/week)." },
  { id: "ev_01JIN00b", incident_id: "inc_01JINC00", occurred_at: "2026-11-04T11:30:00Z", actor: "Cert renewer", kind: "state", text: "Renewal retried successfully after the rate-limit window. Existing certificate remained valid throughout — no downtime." },
];

export const alertRules: AlertRule[] = [
  { id: "alr_01JRAM01", name: "Workload RAM above 80%", metric: "ram_bytes / memory.max", comparator: ">", threshold_label: "80% of ceiling", window: "15m", channel: "In-app + email (Resend)", state: "firing", fired_at: T(14, 38), silenced_until: null, detail: "Currently firing for orders-api — 95% of ceiling." },
  { id: "alr_01JBKP02", name: "Nightly backup failed or not verified", metric: "backup.create outcome", comparator: ">", threshold_label: "1 failed run", window: "24h", channel: "In-app + webhook → Blink SMS", state: "ok", fired_at: null, silenced_until: null, detail: "Last nightly run (02:00) completed and verified." },
  { id: "alr_01JDSK03", name: "Disk above 85%", metric: "disk_used / disk_total", comparator: ">", threshold_label: "85%", window: "30m", channel: "In-app", state: "silenced", fired_at: null, silenced_until: "2026-11-07T02:00:00Z", detail: "Silenced for tonight's maintenance window — disk is at 61%, silence is precautionary." },
  { id: "alr_01JCRT04", name: "Certificate expiring within 14 days", metric: "certificate.days_to_expiry", comparator: "<", threshold_label: "14 days", window: "1h", channel: "In-app + email (Resend)", state: "ok", fired_at: null, silenced_until: null, detail: "All certificates renew automatically with 30 days left." },
];

export const serviceHealth: ServiceHealthRow[] = [
  { name: "nginx", kind: "reverse proxy", state: "healthy", detail: "Active since Oct 24 · 0 reload errors", last_check_at: T(14, 59) },
  { name: "agent", kind: "panel agent", state: "healthy", detail: "v1.4.2 · heartbeat 13s ago", last_check_at: T(14, 59) },
  { name: "panel api", kind: "control plane", state: "healthy", detail: "p95 latency 84 ms (5m)", last_check_at: T(14, 59) },
  { name: "orders-api", kind: "application (Node)", state: "degraded", detail: "Memory pressure — incident inc_01JINC01", last_check_at: T(14, 55) },
  { name: "team-cloud (Nextcloud)", kind: "service instance", state: "unhealthy", detail: "Health checks failed 3× in 15 minutes", last_check_at: T(14, 50) },
  { name: "license server", kind: "external dependency", state: "degraded", detail: "Offline grace until Nov 20 — activation unaffected", last_check_at: T(13, 10) },
];

export const logLines: LogRow[] = [
  { ts: "2026-11-06T14:59:47Z", severity: "info", source: "agent", message: "heartbeat ok — cpu 12.5% ram 2.0/6.0 GB disk 61%" },
  { ts: "2026-11-06T14:58:12Z", severity: "warn", source: "orders-api", message: "memory.current 390 MB of memory.max 400 MB — approaching limit" },
  { ts: "2026-11-06T14:56:04Z", severity: "info", source: "backup", message: "backup.create queued for kili-shop — will run when sites are idle (position 2)" },
  { ts: "2026-11-06T14:55:31Z", severity: "info", source: "nginx", message: "acmeconsulting.co.ke 200 GET / 12ms from 41.90.64.20" },
  { ts: "2026-11-06T14:54:02Z", severity: "info", source: "panel", message: "operation op_01JDEPL01 succeeded — health check passed for acme-consulting" },
  { ts: "2026-11-06T14:51:44Z", severity: "info", source: "nginx", message: "kilishop.co.ke 200 GET /wp-login.php 61ms from 197.232.81.14" },
  { ts: "2026-11-06T14:50:19Z", severity: "warn", source: "image-worker", message: "batch job yielded to serving traffic — resuming when idle (normal)" },
  { ts: "2026-11-06T14:47:55Z", severity: "error", source: "team-cloud", message: "health check failed: connection refused on :8080 (3 of 3 probes)" },
  { ts: "2026-11-06T14:45:10Z", severity: "info", source: "panel", message: "login succeeded for jane@wanjiku.digital from 197.232.81.14 (TOTP)" },
  { ts: "2026-11-06T14:41:03Z", severity: "info", source: "cert", message: "kilishop.co.ke renewal attempt 2 — waiting on rate-limit window" },
  { ts: "2026-11-06T14:38:41Z", severity: "warn", source: "monitor", message: "alert alr_01JRAM01 firing: orders-api RAM 95% of ceiling for 25m" },
  { ts: "2026-11-06T14:30:00Z", severity: "info", source: "panel", message: "firewall.apply awaiting second-person approval — request sent to /approvals" },
  { ts: "2026-11-06T14:02:14Z", severity: "error", source: "auth", message: "5 failed password attempts from 185.220.101.4 — rate limited (redacted)" },
  { ts: "2026-11-06T11:06:27Z", severity: "error", source: "restore", message: "RESTORE_CHECKSUM_MISMATCH on bak_01JBLOG02 — no files changed, previous state intact" },
];

export const metricsCatalog: MetricDef[] = [
  { key: "cpu", label: "CPU (server)", unit: "%", base: 14, variance: 38, description: "Server CPU utilisation, sampled per minute from the agent." },
  { key: "ram", label: "RAM (server)", unit: "MB", base: 1900, variance: 1400, description: "Total RAM in use across all workloads and the panel itself." },
  { key: "disk", label: "Disk used", unit: "GB", base: 55, variance: 6, description: "Root volume usage. Grows ~0.8 GB/day with Nextcloud uploads." },
  { key: "load", label: "Load average (1m)", unit: "", base: 0.6, variance: 2.2, description: "1-minute load average. Above 4.0 (4 vCPU) the server is saturated." },
  { key: "latency", label: "HTTP p95 latency", unit: "ms", base: 60, variance: 120, description: "p95 response time across all served sites, measured by nginx." },
];

export const panelUpdate = {
  current_version: "2.4.1",
  channel: "stable",
  installed_at: "2026-10-24T06:58:00Z",
  agent_version: "1.4.2",
  capability_data_version: "2026-11-06.3",
  available_version: "2.5.0" as string | null,
  available_released_at: "2026-11-04T10:00:00Z",
  applies_within_window: true,
  maintenance_window: "Sundays 02:00–04:00 EAT (Africa/Nairobi)",
  changelog: [
    "2.5.0 — 2026-11-04",
    "  feat: per-workload usage strip gains throttled-seconds and OOM counters",
    "  feat: batch queue page shows queue positions and estimated start times",
    "  fix: backup verification no longer counts a file copy as a verified restore",
    "  fix: audit chain export includes the previous_hash column again",
    "  sec: webhook deliveries pin the signing timestamp (replay window 5 min)",
  ],
  compatibility: [
    { component: "Panel agent", current: "1.4.2", state: "compatible", detail: "2.5.0 supports agent 1.4.0+; no agent upgrade needed." },
    { component: "Operating system", current: "Ubuntu 24.04 LTS", state: "compatible", detail: "Supported through April 2026+ (LTS)." },
    { component: "Capability data", current: "2026-11-06.3", state: "compatible", detail: "Digest will re-verify after the update." },
    { component: "PHP sites (8.2)", current: "kili-shop", state: "attention", detail: "PHP 8.2 remains supported; 8.4 is recommended for new sites." },
  ] as CompatRow[],
  rollback: "If the post-update health check fails, the panel reverts to 2.4.1 automatically. Your sites keep running on nginx throughout — the update touches the control plane only.",
};

export const verificationHistory: VerificationRecord[] = [
  { id: "ver_01JVER03", backup_id: "bak_01JBLOG02", backup_label: "wanjiku-blog — Nov 6 02:03", ran_at: T(11, 6), result: "failed", detail: "Checksum mismatch while restoring to a disposable target. No live files were changed. The next nightly snapshot will replace it.", duration_s: 214 },
  { id: "ver_01JVER02", backup_id: "bak_01JACME01", backup_label: "acme-consulting — Nov 5 02:00", ran_at: "2026-11-05T04:10:00Z", result: "passed", detail: "Restored to a disposable target; 118 files compared, checksums matched; site booted from the restore.", duration_s: 96 },
  { id: "ver_01JVER01", backup_id: "bak_01JKILI02", backup_label: "kili-shop — Nov 3 02:07", ran_at: "2026-11-03T04:31:00Z", result: "passed", detail: "Database-consistent restore verified with a live query against the restored DB.", duration_s: 331 },
];

export const maintenanceWindow = {
  label: "Weekly maintenance window",
  human: "Sundays 02:00–04:00 EAT (Africa/Nairobi)",
  next_start: "2026-11-08T23:00:00Z", // 02:00 EAT
  note: "Panel self-updates and OS patches run inside this window. Batch workloads pause briefly; your websites keep serving.",
};

/**
 * Server-level aggregate usage (the UX-OV-009 counterpart consumed by the
 * monitoring overview). Allocation ceiling comes from the demo profile
 * (the "which VPS did you buy" switcher); current/typical/peak are the sum
 * of the workloads in the shared dataset — honest arithmetic, no invention.
 */
export function serverUsage(profile: ProfileId): UsageSnapshot {
  const specs = PROFILES[profile].specs;
  const all = [...db.websites, ...db.applications, ...db.serviceInstances];
  const sum = (pick: (u: UsageSnapshot) => number) =>
    all.reduce((acc, w) => acc + pick(w.usage), 0);
  const ramMb = specs.ram_mb;
  const cpuAllocated = specs.vcpu * 1000;
  const diskAllocated = specs.disk_gb;
  return {
    ram_mb: {
      allocated: ramMb,
      typical: Math.round(sum((u) => u.ram_mb.typical)),
      peak: Math.round(sum((u) => u.ram_mb.peak)),
      current: Math.round(sum((u) => u.ram_mb.current)),
    },
    cpu_millicores: {
      allocated: cpuAllocated,
      typical: Math.round(sum((u) => u.cpu_millicores.typical)),
      peak: Math.round(sum((u) => u.cpu_millicores.peak)),
      current: Math.round(sum((u) => u.cpu_millicores.current)),
    },
    disk_gb: {
      allocated: diskAllocated,
      current: Math.round(sum((u) => u.disk_gb.current) * 10) / 10,
    },
    throttled_seconds_24h: Math.round(sum((u) => u.throttled_seconds_24h)),
    oom_events_7d: Math.round(sum((u) => u.oom_events_7d)),
    updated_at: T(14, 58),
  };
}

/** All workloads (websites, applications, service instances) for the usage view. */
export interface WorkloadUsageRow {
  id: string;
  name: string;
  kind: string;
  href: string;
  health: "healthy" | "degraded" | "unhealthy" | "unknown";
  usage: UsageSnapshot;
}

export function workloadUsageRows(): WorkloadUsageRow[] {
  const rows: WorkloadUsageRow[] = [];
  for (const w of db.websites) {
    rows.push({
      id: w.id,
      name: w.title,
      kind: w.kind === "static" ? "Static site" : w.kind === "php" ? "PHP site" : "Node site",
      href: `/websites/${w.id}`,
      health: w.health,
      usage: w.usage,
    });
  }
  for (const a of db.applications) {
    rows.push({
      id: a.id,
      name: a.name,
      kind: a.category === "batch" ? "Batch application" : "Application",
      href: `/apps/${a.id}`,
      health: a.health,
      usage: a.usage,
    });
  }
  for (const s of db.serviceInstances) {
    rows.push({
      id: s.id,
      name: `${s.name} (${s.template_key})`,
      kind: "Service instance",
      href: `/services/template/${s.id}`,
      health: s.health,
      usage: s.usage,
    });
  }
  return rows;
}
