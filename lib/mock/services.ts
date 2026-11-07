import type { ServiceInstance, ServiceInstanceState, TemplateCategory } from "@/lib/types";
import type { StatusPillStatus } from "@/components/ui/badge";
import { db } from "@/lib/mock/data";

/**
 * Platform Services + Templates module fixtures — extends the shared dataset
 * with the records the services module owns: two platform-service instances
 * that live alongside db.serviceInstances (imgproxy transform pipeline,
 * Meilisearch search), storage-bucket objects/keys, consume targets and
 * transform run history.
 *
 * Instances installed at runtime (deploy wizard) are appended to
 * `runtimeInstances` in memory — they appear in every list but, in a static
 * export, they have no detail page, so `instanceHref` returns null for them
 * and rows render without a link (honest, never a dead link).
 */

const UPDATED = "2026-11-06T14:58:00Z";

function svcUsage(
  ram: [number, number, number, number],
  cpu: [number, number, number, number],
  disk: [number, number],
  throttled = 0
): ServiceInstance["usage"] {
  return {
    ram_mb: { allocated: ram[0], typical: ram[1], peak: ram[2], current: ram[3] },
    cpu_millicores: { allocated: cpu[0], typical: cpu[1], peak: cpu[2], current: cpu[3] },
    disk_gb: { allocated: disk[0], current: disk[1] },
    throttled_seconds_24h: throttled,
    oom_events_7d: 0,
    updated_at: UPDATED,
  };
}

/** Module-owned instances that are NOT part of the shared db (services module scope). */
export const EXTRA_SERVICE_INSTANCES: ServiceInstance[] = [
  {
    id: "svc_01JIMGPR5",
    template_key: "imgproxy",
    name: "image-pipeline",
    state: "running",
    health: "healthy",
    exposure: "private",
    hostname: "image-pipeline.internal",
    version: "3.27",
    usage: svcUsage([600, 300, 480, 210], [1000, 180, 500, 260], [10, 2.4], 920),
    created_at: "2026-10-29T11:00:00Z",
  },
  {
    id: "svc_01JMEILI7",
    template_key: "meilisearch",
    name: "site-search",
    state: "running",
    health: "healthy",
    exposure: "private",
    hostname: "site-search.internal",
    version: "1.9",
    usage: svcUsage([300, 120, 210, 140], [1000, 30, 90, 45], [10, 1.8]),
    created_at: "2026-10-31T09:30:00Z",
  },
];

/** Instances created at runtime by the deploy wizard (client-memory only). */
export const runtimeInstances: ServiceInstance[] = [];

/** Idempotently register a freshly submitted install (state: provisioning). */
export function registerProvisioned(instance: ServiceInstance): void {
  if (runtimeInstances.some((i) => i.id === instance.id)) return;
  runtimeInstances.push(instance);
}

/** A failed install never becomes an instance — drop the draft. */
export function removeProvisioned(id: string): void {
  const idx = runtimeInstances.findIndex((i) => i.id === id);
  if (idx >= 0) runtimeInstances.splice(idx, 1);
}

/**
 * The install operation reached `succeeded` (postcondition verified by the
 * engine) — flip the draft instance to its observed running state. In the
 * real system the API does this; here the operation engine is the authority.
 */
export function markInstanceRunning(id: string): void {
  const inst = runtimeInstances.find((i) => i.id === id);
  if (inst !== undefined && inst.state === "provisioning") {
    inst.state = "running";
    inst.health = "healthy";
  }
}

/** db instances + module extras + runtime-installed, newest first. */
export function allServiceInstances(): ServiceInstance[] {
  return [...runtimeInstances, ...db.serviceInstances, ...EXTRA_SERVICE_INSTANCES];
}

export function findServiceInstance(id: string): ServiceInstance | undefined {
  return allServiceInstances().find((i) => i.id === id);
}

/** Statically generated instance ids (have a detail route in the export). */
export function staticInstanceIds(): Set<string> {
  return new Set([...db.serviceInstances, ...EXTRA_SERVICE_INSTANCES].map((i) => i.id));
}

export function templateForKey(key: string) {
  return db.templates.find((t) => t.key === key);
}

/** Registry route prefix per template family (Platform Services IA). */
export function familyRouteForCategory(category: TemplateCategory): string {
  switch (category) {
    case "storage":
      return "/services/storage";
    case "transform":
      return "/services/transform";
    case "cache":
      return "/services/cache";
    case "search":
      return "/services/search";
    case "queue":
      return "/services/queue";
    case "delivery":
      return "/services/delivery";
    case "self_hosted_app":
    case "database":
      return "/services/template";
  }
}

/** Detail href for an instance — null when no static page exists (runtime installs). */
export function instanceHref(instance: ServiceInstance): string | null {
  if (!staticInstanceIds().has(instance.id)) return null;
  const tpl = templateForKey(instance.template_key);
  const category = tpl?.category ?? "self_hosted_app";
  return `${familyRouteForCategory(category)}/${instance.id}`;
}

/** Human category labels (DS-027 catalog vocabulary). */
export function categoryLabel(category: TemplateCategory): string {
  const map: Record<TemplateCategory, string> = {
    storage: "Storage buckets",
    transform: "Transform pipelines",
    delivery: "Delivery endpoints",
    self_hosted_app: "Self-hosted apps",
    database: "Databases",
    cache: "Cache instances",
    queue: "Queues",
    search: "Search instances",
  };
  return map[category];
}

/** ServiceInstanceState → nearest DS-004 StatusPill status (icon + text, never color-only). */
export function serviceStatusPill(instance: ServiceInstance): StatusPillStatus {
  const map: Record<ServiceInstanceState, StatusPillStatus> = {
    provisioning: "provisioning",
    running: instance.health === "healthy" ? "healthy" : instance.health === "unhealthy" ? "degraded-health" : "unknown",
    degraded: "degraded",
    stopped: "offline",
    updating: "running",
    failed: "failed",
    removing: "pending",
  };
  return map[instance.state];
}

/* ------------------------------------------------------------------ */
/* Storage bucket fixtures (UX-SVC-003 / 004)                          */
/* ------------------------------------------------------------------ */

export interface BucketObject {
  key: string;
  size_bytes: number;
  modified_at: string;
  storage_class: "standard" | "infrequent";
}

export const BUCKET_OBJECTS: BucketObject[] = [
  { key: "kili-shop/products/anjela-beads-webp/hero-1200.webp", size_bytes: 184320, modified_at: "2026-11-06T09:41:00Z", storage_class: "standard" },
  { key: "kili-shop/products/anjela-beads-webp/hero-640.webp", size_bytes: 96210, modified_at: "2026-11-06T09:41:00Z", storage_class: "standard" },
  { key: "kili-shop/products/kiondo-basket/img-04.webp", size_bytes: 143880, modified_at: "2026-11-05T16:12:00Z", storage_class: "standard" },
  { key: "kili-shop/originals/autumn-collection.zip", size_bytes: 48128340, modified_at: "2026-11-04T10:02:00Z", storage_class: "infrequent" },
  { key: "wanjiku-blog/media/podcast-ep-12.mp3", size_bytes: 32450190, modified_at: "2026-11-03T18:30:00Z", storage_class: "standard" },
  { key: "wanjiku-blog/media/podcast-ep-11.mp3", size_bytes: 29888010, modified_at: "2026-10-27T18:30:00Z", storage_class: "standard" },
  { key: "orders-api/exports/orders-2026-11-05.csv", size_bytes: 2141188, modified_at: "2026-11-05T23:55:00Z", storage_class: "standard" },
  { key: "orders-api/exports/orders-2026-11-04.csv", size_bytes: 2094462, modified_at: "2026-11-04T23:55:00Z", storage_class: "standard" },
  { key: "backups/team-cloud/weekly-2026-11-02.tar.age", size_bytes: 2244927488, modified_at: "2026-11-02T03:14:00Z", storage_class: "infrequent" },
  { key: "site-assets/logos/wanjiku-digital.svg", size_bytes: 8412, modified_at: "2026-10-28T08:00:00Z", storage_class: "standard" },
];

export interface AccessKey {
  id: string;
  label: string;
  scope: "read-only" | "write-only" | "read-write";
  created_at: string;
  last_used_at: string | null;
}

export const ACCESS_KEYS: AccessKey[] = [
  { id: "sak_01JKILI01", label: "kili-shop uploads", scope: "read-write", created_at: "2026-10-30T12:00:00Z", last_used_at: UPDATED },
  { id: "sak_01JBLOG02", label: "blog media reader", scope: "read-only", created_at: "2026-11-01T09:00:00Z", last_used_at: "2026-11-06T12:20:00Z" },
];

export interface BucketStats {
  objects: number;
  requests_30d: number;
  bandwidth_gb_30d: number;
}

export const BUCKET_STATS: BucketStats = { objects: 1284, requests_30d: 84210, bandwidth_gb_30d: 61.2 };

/** Consumed-by: which site/app uses this bucket, and the keys injected there. */
export interface ConsumeTarget {
  ref: { type: "website" | "application"; id: string; name: string };
  env_keys: string[];
}

export const BUCKET_CONSUMERS: ConsumeTarget[] = [
  { ref: { type: "website", id: "web_01JKILI02", name: "kili-shop" }, env_keys: ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID"] },
  { ref: { type: "application", id: "app_01JIMGW02", name: "image-worker" }, env_keys: ["S3_ENDPOINT", "S3_BUCKET", "S3_SECRET_ACCESS_KEY"] },
];

/** Sites/apps a bucket can be attached to (UX-SVC-010). */
export function consumeCandidates(): { type: "website" | "application"; id: string; label: string }[] {
  return [
    ...db.websites
      .filter((w) => w.status === "active")
      .map((w) => ({ type: "website" as const, id: w.id, label: `${w.title} (website)` })),
    ...db.applications.map((a) => ({ type: "application" as const, id: a.id, label: `${a.name} (app · ${a.runtime})` })),
  ];
}

/* ------------------------------------------------------------------ */
/* Transform pipeline fixtures (UX-SVC-005)                            */
/* ------------------------------------------------------------------ */

export interface TransformSize {
  name: string;
  width: number;
  height: number;
  est_storage_mb_per_1000: number;
}

export const TRANSFORM_SIZES: TransformSize[] = [
  { name: "hero", width: 1200, height: 630, est_storage_mb_per_1000: 180 },
  { name: "card", width: 640, height: 480, est_storage_mb_per_1000: 95 },
  { name: "thumb", width: 240, height: 240, est_storage_mb_per_1000: 24 },
];

export interface TransformRun {
  id: string;
  rule: string;
  source: string;
  images: number;
  status: "succeeded" | "running" | "queued";
  duration_seconds: number | null;
  started_at: string;
  queue_position?: number;
}

export const TRANSFORM_RUNS: TransformRun[] = [
  { id: "trn_01JRUN05", rule: "kili-shop product set → hero/card/thumb (WebP)", source: "kili-shop/originals/autumn-collection.zip", images: 214, status: "running", duration_seconds: null, started_at: "2026-11-06T14:50:00Z" },
  { id: "trn_01JRUN04", rule: "blog covers → card (WebP)", source: "wanjiku-blog/media", images: 32, status: "succeeded", duration_seconds: 96, started_at: "2026-11-05T13:02:00Z" },
  { id: "trn_01JRUN03", rule: "kili-shop product set → thumb (WebP)", source: "kili-shop/originals", images: 540, status: "succeeded", duration_seconds: 412, started_at: "2026-11-04T02:40:00Z" },
  { id: "trn_01JRUN02", rule: "orders-api exports → compress", source: "orders-api/exports", images: 0, status: "queued", duration_seconds: null, started_at: "2026-11-06T14:56:00Z", queue_position: 3 },
  { id: "trn_01JRUN01", rule: "blog covers → hero (WebP)", source: "wanjiku-blog/media", images: 18, status: "succeeded", duration_seconds: 61, started_at: "2026-11-02T09:10:00Z" },
];

/* ------------------------------------------------------------------ */
/* Search instance fixtures (UX-SVC-009)                               */
/* ------------------------------------------------------------------ */

export interface SearchIndexStat {
  index: string;
  documents: number;
  size_mb: number;
}

export const SEARCH_INDEXES: SearchIndexStat[] = [
  { index: "kilishop-products", documents: 4120, size_mb: 610 },
  { index: "wanjiku-posts", documents: 214, size_mb: 88 },
  { index: "help-articles", documents: 96, size_mb: 12 },
];
