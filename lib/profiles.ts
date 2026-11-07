import type { CapabilityRecord, ProfileId } from "@/lib/types";

/**
 * Server capability tiers (Stage 6 §8 "Server profiles").
 *
 * The profile switcher in the shell simulates "which VPS did you buy" so every
 * capability-honest state (DS-021, FLOW-014) can be demoed without reinstalling.
 * Capability records mirror the installer's signed data file — the UI never
 * invents availability: it renders these records, including reasons and deltas.
 */

export interface ProfileDef {
  id: ProfileId;
  label: string;
  specs: { vcpu: number; ram_mb: number; disk_gb: number };
  db: string;
  proxy: string;
  tagline: string;
  /** Summary shown in the profile switcher tooltip / capability overview. */
  summary: string;
}

export const PROFILES: Record<ProfileId, ProfileDef> = {
  nano: {
    id: "nano",
    label: "Nano",
    specs: { vcpu: 1, ram_mb: 512, disk_gb: 10 },
    db: "SQLite (~15 MB, metadata only)",
    proxy: "Nginx",
    tagline: "512 MB / 1 vCPU / 10 GB",
    summary:
      "Installs on a 512 MB VPS. Static sites and WordPress. Everything else is shown honestly with the reason it cannot run.",
  },
  starter: {
    id: "starter",
    label: "Starter",
    specs: { vcpu: 1, ram_mb: 2048, disk_gb: 25 },
    db: "SQLite or Postgres + small MariaDB (borderline)",
    proxy: "Nginx or Caddy",
    tagline: "2 GB / 1 vCPU / 25 GB",
    summary:
      "Static sites, Node and PHP apps. Small customer database is borderline. External SMTP email.",
  },
  standard: {
    id: "standard",
    label: "Standard",
    specs: { vcpu: 4, ram_mb: 6144, disk_gb: 100 },
    db: "PostgreSQL + MariaDB/Postgres containers",
    proxy: "Caddy (automatic HTTPS)",
    tagline: "6 GB / 4 vCPU / 100 GB",
    summary:
      "The full surface: Docker isolation, customer databases, ServiceTemplate catalog, batch queue with yielding.",
  },
  provider: {
    id: "provider",
    label: "Provider",
    specs: { vcpu: 8, ram_mb: 16384, disk_gb: 200 },
    db: "PostgreSQL (HA in v3+)",
    proxy: "Caddy, per-node",
    tagline: "16 GB / 8 vCPU / 200 GB",
    summary:
      "Multi-node fleet, placement, reseller delegation and provider packages. Provider/reseller API is v2+ — screens render the gate, not hidden menus.",
  },
};

export const PROFILE_ORDER: ProfileId[] = ["nano", "starter", "standard", "provider"];

const T0 = "2026-11-06T09:00:00Z";
const DIGEST = "sha256:9f1c02ba7d54e8a1c603d9f2b7e4a8c1d5f0b3a69e2c7d418a5b0c3f6e9d2a47";

function cap(
  capability_key: string,
  workload_category: CapabilityRecord["workload_category"],
  floors: { ram_floor_mb: number; ram_typical_mb: number; ram_ceiling_mb: number },
  state: CapabilityRecord["state"],
  reason: string | null,
  extra?: Partial<CapabilityRecord>
): CapabilityRecord {
  return {
    capability_key,
    workload_category,
    ram_floor_mb: floors.ram_floor_mb,
    ram_typical_mb: floors.ram_typical_mb,
    ram_ceiling_mb: floors.ram_ceiling_mb,
    cpu_weight: workload_category === "batch" ? 10 : workload_category === "infrastructure" ? 200 : 100,
    cpu_max_millicores: workload_category === "batch" ? 500 : null,
    disk_floor_gb: extra?.disk_floor_gb ?? null,
    prerequisites: extra?.prerequisites ?? { public_ip: true },
    state,
    reason,
    delta: extra?.delta,
    detected_at: T0,
    source_digest: DIGEST,
  };
}

/**
 * Per-profile capability sets. Sources: Stage 6 §8 rows, Stage 3 §5 honest-state
 * examples, FLOW-014 copy. Deltas are the "needs X more" numbers the UI shows.
 */
export const PROFILE_CAPABILITIES: Record<ProfileId, CapabilityRecord[]> = {
  nano: [
    cap("website.static", "serving", { ram_floor_mb: 20, ram_typical_mb: 30, ram_ceiling_mb: 80 }, "available", null),
    cap("website.php", "serving", { ram_floor_mb: 120, ram_typical_mb: 180, ram_ceiling_mb: 400 }, "available", null),
    cap("app.node", "serving", { ram_floor_mb: 200, ram_typical_mb: 256, ram_ceiling_mb: 512 }, "unavailable",
      "This VPS has 120 MB of headroom left; a Node app needs 200 MB more RAM.", { delta: { ram_mb: 200 } }),
    cap("db.mariadb", "serving", { ram_floor_mb: 350, ram_typical_mb: 450, ram_ceiling_mb: 900 }, "unavailable",
      "No room for a MariaDB container — the panel's own metadata database already uses the available budget.", { delta: { ram_mb: 250 } }),
    cap("db.postgres", "serving", { ram_floor_mb: 400, ram_typical_mb: 500, ram_ceiling_mb: 1000 }, "unavailable",
      "No room for a Postgres container on this VPS.", { delta: { ram_mb: 300 } }),
    cap("service.docker", "serving", { ram_floor_mb: 150, ram_typical_mb: 200, ram_ceiling_mb: 400 }, "unavailable",
      "Docker is not installed and this VPS does not have the RAM headroom to run containers.", { delta: { ram_mb: 400 } }),
    cap("service.storage", "serving", { ram_floor_mb: 120, ram_typical_mb: 160, ram_ceiling_mb: 400 }, "unavailable",
      "Storage buckets run as Docker containers (MinIO), which this VPS cannot host.", { delta: { ram_mb: 400 } }),
    cap("service.transform", "batch", { ram_floor_mb: 200, ram_typical_mb: 300, ram_ceiling_mb: 600 }, "unavailable",
      "Image transformation needs a Docker container and 2 more vCPU.", { delta: { ram_mb: 400, vcpu: 2 } }),
    cap("mail.external_smtp", "serving", { ram_floor_mb: 0, ram_typical_mb: 5, ram_ceiling_mb: 10 }, "unavailable",
      "Nano does not offer email of any kind — not even external SMTP relay configuration.", {}),
    cap("mail.mailboxes", "serving", { ram_floor_mb: 300, ram_typical_mb: 400, ram_ceiling_mb: 800 }, "unavailable",
      "Self-hosted email needs Docker, a mail container and port 25 — none available on this VPS.", { delta: { ram_mb: 500 } }),
    cap("terminal.exec", "serving", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "unavailable",
      "Terminal is not available on this VPS because sites are not containerized. SFTP works for file transfer.", {}),
    cap("dns.authoritative", "serving", { ram_floor_mb: 0, ram_typical_mb: 10, ram_ceiling_mb: 30 }, "unavailable",
      "Authoritative DNS hosting is coming in v2. Today NexusPanel guides your DNS at your registrar.", {}),
    cap("backup.local", "batch", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "unavailable",
      "Local backups require more disk. Use a remote backup destination — restic to S3-compatible storage works today.", { delta: { disk_gb: 5 } }),
    cap("ai.diagnostics", "batch", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "borderline",
      "AI diagnostics run as a batch workload against an external LLM API. Add an API key in Settings → AI to enable it.", {}),
    cap("commercial.surface", "infrastructure", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "unavailable",
      "The commercial surface (subscriptions, invoices, hosting accounts) is disabled on Nano.", {}),
  ],
  starter: [
    cap("website.static", "serving", { ram_floor_mb: 20, ram_typical_mb: 30, ram_ceiling_mb: 80 }, "available", null),
    cap("website.php", "serving", { ram_floor_mb: 120, ram_typical_mb: 180, ram_ceiling_mb: 400 }, "available", null),
    cap("app.node", "serving", { ram_floor_mb: 200, ram_typical_mb: 256, ram_ceiling_mb: 512 }, "available", null),
    cap("db.mariadb", "serving", { ram_floor_mb: 350, ram_typical_mb: 450, ram_ceiling_mb: 900 }, "borderline",
      "RAM floor 350 MB exceeds comfortable headroom — it runs, but tight.", {}),
    cap("db.postgres", "serving", { ram_floor_mb: 400, ram_typical_mb: 500, ram_ceiling_mb: 1000 }, "borderline",
      "RAM floor 400 MB exceeds comfortable headroom — it runs, but tight.", {}),
    cap("service.docker", "serving", { ram_floor_mb: 150, ram_typical_mb: 200, ram_ceiling_mb: 400 }, "unavailable",
      "Docker containers need more RAM headroom than a 2 GB VPS reliably offers. Upgrade to a 6 GB Standard VPS to run containers.", { delta: { ram_mb: 2048 } }),
    cap("service.storage", "serving", { ram_floor_mb: 120, ram_typical_mb: 160, ram_ceiling_mb: 400 }, "unavailable",
      "Storage buckets run as Docker containers, which needs a Standard VPS.", { delta: { ram_mb: 2048 } }),
    cap("service.transform", "batch", { ram_floor_mb: 200, ram_typical_mb: 300, ram_ceiling_mb: 600 }, "unavailable",
      "Image transformation runs as a Docker batch container — needs a Standard VPS.", { delta: { ram_mb: 2048 } }),
    cap("mail.external_smtp", "serving", { ram_floor_mb: 0, ram_typical_mb: 5, ram_ceiling_mb: 10 }, "available", null),
    cap("mail.mailboxes", "serving", { ram_floor_mb: 300, ram_typical_mb: 400, ram_ceiling_mb: 800 }, "unavailable",
      "Self-hosted email needs Docker and port 25. External SMTP relay is available today.", { delta: { ram_mb: 2048 } }),
    cap("terminal.exec", "serving", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "unavailable",
      "Terminal is not available because apps on this VPS do not run in containers. SFTP works for file transfer.", {}),
    cap("dns.authoritative", "serving", { ram_floor_mb: 0, ram_typical_mb: 10, ram_ceiling_mb: 30 }, "unavailable",
      "Authoritative DNS hosting is coming in v2. Today NexusPanel guides your DNS at your registrar.", {}),
    cap("backup.local", "batch", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "available", null),
    cap("ai.diagnostics", "batch", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "borderline",
      "AI diagnostics run as a batch workload against an external LLM API. Add an API key in Settings → AI to enable it.", {}),
    cap("commercial.surface", "infrastructure", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "unavailable",
      "The commercial surface (subscriptions, invoices, hosting accounts) is disabled on Starter.", {}),
  ],
  standard: [
    cap("website.static", "serving", { ram_floor_mb: 20, ram_typical_mb: 30, ram_ceiling_mb: 80 }, "available", null),
    cap("website.php", "serving", { ram_floor_mb: 120, ram_typical_mb: 180, ram_ceiling_mb: 400 }, "available", null),
    cap("app.node", "serving", { ram_floor_mb: 200, ram_typical_mb: 256, ram_ceiling_mb: 512 }, "available", null),
    cap("db.mariadb", "serving", { ram_floor_mb: 350, ram_typical_mb: 450, ram_ceiling_mb: 900 }, "available", null),
    cap("db.postgres", "serving", { ram_floor_mb: 400, ram_typical_mb: 500, ram_ceiling_mb: 1000 }, "available", null),
    cap("service.docker", "serving", { ram_floor_mb: 150, ram_typical_mb: 200, ram_ceiling_mb: 400 }, "available", null),
    cap("service.storage", "serving", { ram_floor_mb: 120, ram_typical_mb: 160, ram_ceiling_mb: 400 }, "available", null),
    cap("service.transform", "batch", { ram_floor_mb: 200, ram_typical_mb: 300, ram_ceiling_mb: 600 }, "available", null),
    cap("mail.external_smtp", "serving", { ram_floor_mb: 0, ram_typical_mb: 5, ram_ceiling_mb: 10 }, "available", null),
    cap("mail.mailboxes", "serving", { ram_floor_mb: 300, ram_typical_mb: 400, ram_ceiling_mb: 800 }, "available", null),
    cap("terminal.exec", "serving", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "available", null),
    cap("dns.authoritative", "serving", { ram_floor_mb: 0, ram_typical_mb: 10, ram_ceiling_mb: 30 }, "unavailable",
      "Authoritative DNS hosting is coming in v2. Today NexusPanel guides your DNS at your registrar.", {}),
    cap("backup.local", "batch", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "available", null),
    cap("ai.diagnostics", "batch", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "available", null),
    cap("commercial.surface", "infrastructure", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "available", null),
  ],
  provider: [
    cap("website.static", "serving", { ram_floor_mb: 20, ram_typical_mb: 30, ram_ceiling_mb: 80 }, "available", null),
    cap("website.php", "serving", { ram_floor_mb: 120, ram_typical_mb: 180, ram_ceiling_mb: 400 }, "available", null),
    cap("app.node", "serving", { ram_floor_mb: 200, ram_typical_mb: 256, ram_ceiling_mb: 512 }, "available", null),
    cap("db.mariadb", "serving", { ram_floor_mb: 350, ram_typical_mb: 450, ram_ceiling_mb: 900 }, "available", null),
    cap("db.postgres", "serving", { ram_floor_mb: 400, ram_typical_mb: 500, ram_ceiling_mb: 1000 }, "available", null),
    cap("service.docker", "serving", { ram_floor_mb: 150, ram_typical_mb: 200, ram_ceiling_mb: 400 }, "available", null),
    cap("service.storage", "serving", { ram_floor_mb: 120, ram_typical_mb: 160, ram_ceiling_mb: 400 }, "available", null),
    cap("service.transform", "batch", { ram_floor_mb: 200, ram_typical_mb: 300, ram_ceiling_mb: 600 }, "available", null),
    cap("mail.external_smtp", "serving", { ram_floor_mb: 0, ram_typical_mb: 5, ram_ceiling_mb: 10 }, "available", null),
    cap("mail.mailboxes", "serving", { ram_floor_mb: 300, ram_typical_mb: 400, ram_ceiling_mb: 800 }, "available", null),
    cap("terminal.exec", "serving", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "available", null),
    cap("dns.authoritative", "serving", { ram_floor_mb: 0, ram_typical_mb: 10, ram_ceiling_mb: 30 }, "unavailable",
      "Authoritative DNS hosting is coming in v2. Today NexusPanel guides your DNS at your registrar.", {}),
    cap("backup.local", "batch", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "available", null),
    cap("ai.diagnostics", "batch", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "available", null),
    cap("commercial.surface", "infrastructure", { ram_floor_mb: 0, ram_typical_mb: 0, ram_ceiling_mb: 0 }, "available", null),
  ],
};

/** Human labels for capability keys (banners, router cards, empty states). */
export const CAPABILITY_META: Record<
  string,
  { label: string; upgrade: string }
> = {
  "website.static": { label: "Static sites", upgrade: "No upgrade needed — static sites run on every profile." },
  "website.php": { label: "PHP hosting (WordPress)", upgrade: "Upgrade to a 2 GB VPS to enable PHP hosting and WordPress." },
  "app.node": { label: "Node.js applications", upgrade: "Upgrade to a 2 GB VPS to run Node applications." },
  "db.mariadb": { label: "MariaDB databases", upgrade: "Upgrade to a 6 GB Standard VPS to run customer databases." },
  "db.postgres": { label: "PostgreSQL databases", upgrade: "Upgrade to a 6 GB Standard VPS to run PostgreSQL." },
  "service.docker": { label: "Docker containers", upgrade: "Upgrade to a 6 GB Standard VPS to run containers." },
  "service.storage": { label: "Storage buckets (S3-compatible)", upgrade: "Upgrade to a 6 GB Standard VPS to run storage buckets." },
  "service.transform": { label: "Image transformation", upgrade: "Upgrade to a 6 GB Standard VPS (needs Docker and 2 more vCPU)." },
  "mail.external_smtp": { label: "External SMTP relay", upgrade: "Upgrade to a 2 GB VPS to configure external SMTP." },
  "mail.mailboxes": { label: "Mailboxes", upgrade: "Upgrade to a 6 GB Standard VPS to host mailboxes." },
  "terminal.exec": { label: "Web terminal", upgrade: "Upgrade to a 6 GB Standard VPS — terminal needs containerized sites." },
  "dns.authoritative": { label: "Authoritative DNS", upgrade: "Planned for v2 — no hardware upgrade changes this." },
  "backup.local": { label: "Local backups", upgrade: "Attach more disk, or keep using remote (restic/S3) backups." },
  "ai.diagnostics": { label: "AI diagnostics", upgrade: "Add an LLM API key in Settings → AI — no hardware upgrade needed." },
  "commercial.surface": { label: "Commercial (billing) surface", upgrade: "Upgrade to a 6 GB Standard VPS to enable subscriptions and invoicing." },
};

export function capabilitiesFor(profile: ProfileId): CapabilityRecord[] {
  return PROFILE_CAPABILITIES[profile];
}

export function capabilityFor(profile: ProfileId, key: string): CapabilityRecord | undefined {
  return PROFILE_CAPABILITIES[profile].find((c) => c.capability_key === key);
}

/** DS-021 banner copy — honest, not alarming; never "disabled/not on your plan". */
export function unavailableCopy(rec: CapabilityRecord): string {
  if (rec.state !== "unavailable" || !rec.reason) return rec.reason ?? "";
  return rec.reason;
}
