/**
 * Core domain types for the NexusPanel GUI prototype.
 *
 * Field naming follows the Stage 6 API contract: snake_case JSON fields,
 * money as integer minor units + currency, RFC 3339 UTC timestamps,
 * prefixed opaque IDs (`web_01J...`). These types mirror what the real
 * Go control plane will return from /api/v1 — when the backend exists,
 * the mock layer in lib/api/* is replaced with fetch calls of the same shapes.
 *
 * ⚠ marks enums the spec never enumerated (Stage 5/6 drafts); the mock layer
 *   interpolates them and flags them here.
 */

export type Iso8601 = string; // RFC 3339 UTC, e.g. "2026-11-06T15:00:00Z"

export type WorkloadCategory = "serving" | "batch" | "infrastructure";

export type CapabilityState = "available" | "unavailable" | "borderline";

/** The 8 personas of inventory.persona_capability_matrix (Stage 5/6). */
export type PersonaId =
  | "website_owner"
  | "app_developer"
  | "self_hoster"
  | "storage_user"
  | "infrastructure_user"
  | "explorer"
  | "reseller"
  | "provider_admin";

/** Guided / Standard / Expert are presentation modes only — never permissions. */
export type PresentationMode = "guided" | "standard" | "expert";

/** Server capability tiers (Stage 6 §8). */
export type ProfileId = "nano" | "starter" | "standard" | "provider";

/** UI role labels are UI concepts only (never authorization). */
export type RoleLabel =
  | "owner"
  | "provider"
  | "reseller"
  | "customer"
  | "developer"
  | "support"
  | "auditor";

export interface Money {
  amount_minor: number; // integer minor units: 15000 = 150.00
  currency: string; // "KES" | "USD" | "EUR" | "GBP"
}

/** Cursor-pagination list envelope (Stage 6 §1). */
export interface Page<T> {
  data: T[];
  page: { next_cursor: string | null; has_more: boolean };
  meta: { request_id: string };
}

/** RFC 9457-style problem+json error envelope (Stage 6 §1, verbatim fields). */
export interface Problem {
  type: string; // "https://docs.nexuspanel.example/problems/quota-exceeded"
  title: string;
  status: number;
  code: string; // stable machine-readable code, e.g. CAPABILITY_UNAVAILABLE
  detail: string; // safe message, no stack traces / SQL / secrets
  request_id: string;
  errors?: { field: string; code: string }[];
  /** Resource delta attached to CAPABILITY_UNAVAILABLE (Stage 6 §1). */
  resource_delta?: { required_ram_mb?: number; available_ram_mb?: number };
}

/** Union of both operation state machines (Stage 5 + Stage 6; see api_fixtures §5.2). */
export type OperationStatus =
  | "pending"
  | "validating"
  | "awaiting_approval"
  | "queued"
  | "running"
  | "verifying"
  | "succeeded"
  | "failed"
  | "partially_succeeded"
  | "cancelled"
  | "rejected"
  | "compensating"
  | "partially_compensated"
  | "needs_attention";

export interface OperationStep {
  key: string;
  title: string;
  status: OperationStatus;
  occurred_at?: Iso8601;
}

export interface OperationEvent {
  id: string; // opevt_… — SSE Last-Event-ID resumption point
  event: "operation.updated" | "operation.completed";
  operation_id: string;
  data: {
    event_type: string; // step.started | step.succeeded | operation.succeeded | batch.yielded | …
    step_key?: string;
    status: OperationStatus;
    attempt?: number;
    occurred_at: Iso8601;
    progress?: { completed_steps: number; total_steps: number };
    payload_redacted?: Record<string, string | number | boolean | null>;
  };
}

export interface Operation {
  id: string; // op_01J…
  kind: string; // website.provision | backup.create | payment.resolve | …
  title: string;
  status: OperationStatus;
  workload_category: WorkloadCategory; // immutable
  actor_id: string;
  organization_id: string;
  resource_ref: { type: string; id: string; name?: string };
  steps: OperationStep[];
  progress: { completed_steps: number; total_steps: number };
  batch?: {
    /** Batch ops queue under serving contention; position is shown honestly. */
    queue_position?: number;
    low_priority: boolean;
    yielded?: boolean;
  };
  created_at: Iso8601;
  started_at?: Iso8601;
  finished_at?: Iso8601;
  last_verified_at?: Iso8601;
  correlation_id: string; // req_01J…
  error?: { code: string; detail: string; retryable: boolean };
  /** Per-step outcomes for partially_succeeded (DS-011). */
  partial?: { step_key: string; outcome: string; note: string }[];
}

/** ⚠ Invented interpolation — the spec only documents "active" (api_fixtures §6.1). */
export type SiteStatus = "provisioning" | "active" | "suspended" | "closing";

export interface UsageSnapshot {
  /** MB values; allocation is a ceiling, not a reservation (UXR rule 4). */
  ram_mb: { allocated: number; typical: number; peak: number; current: number };
  cpu_millicores: { allocated: number; typical: number; peak: number; current: number };
  disk_gb: { allocated: number; current: number };
  throttled_seconds_24h: number;
  oom_events_7d: number;
  updated_at: Iso8601;
}

export interface Website {
  id: string; // web_01J…
  organization_id: string;
  name: string; // slug
  title: string; // human label
  status: SiteStatus;
  kind: "static" | "php" | "node";
  primary_domain: string;
  php_version?: string;
  node_version?: string;
  health: "healthy" | "degraded" | "unknown";
  last_verified_at: Iso8601;
  pending_operation_id?: string;
  usage: UsageSnapshot;
  created_at: Iso8601;
}

export interface Application {
  id: string; // app_01J…
  organization_id: string;
  name: string;
  runtime: "node" | "php" | "python";
  runtime_version: string;
  status: SiteStatus;
  category: WorkloadCategory; // serving or batch — immutable
  health: "healthy" | "degraded" | "unknown";
  last_verified_at: Iso8601;
  pending_operation_id?: string;
  usage: UsageSnapshot;
  created_at: Iso8601;
}

export type DomainState =
  | "verified"
  | "pending_verification"
  | "delegation_pending"
  | "failed";
export type DnsMode = "external_manual" | "external_api" | "local_authoritative";

export interface DomainName {
  id: string; // dom_01J…
  name: string; // punycode display ready
  state: DomainState;
  dns_mode: DnsMode; // v1: guidance mode only
  registrar?: string;
  expires_at?: Iso8601;
  website_id?: string;
  last_checked_at: Iso8601;
}

export interface Certificate {
  id: string; // crt_01J…
  domains: string[];
  issuer: string; // "Let's Encrypt"
  status: "active" | "issuing" | "renewing" | "failed" | "expired";
  auto_renew: boolean;
  expires_at: Iso8601;
  last_renewal_attempt_at?: Iso8601;
}

export type ServiceInstanceState =
  | "provisioning"
  | "running"
  | "degraded"
  | "stopped"
  | "updating"
  | "failed"
  | "removing";

export interface ServiceInstance {
  id: string; // svc_01J…
  template_key: string;
  name: string;
  state: ServiceInstanceState;
  health: "healthy" | "unhealthy" | "unknown";
  exposure: "public" | "private";
  hostname?: string;
  version: string;
  usage: UsageSnapshot;
  created_at: Iso8601;
}

export type TemplateCategory =
  | "storage"
  | "transform"
  | "delivery"
  | "self_hosted_app"
  | "database"
  | "cache"
  | "queue"
  | "search";

export interface ServiceTemplate {
  key: string; // minio | nextcloud | … (data, not code — Stage 3 DS-027)
  name: string;
  category: TemplateCategory;
  description: string;
  ram_floor_mb: number;
  ram_typical_mb: number;
  ram_ceiling_mb: number;
  disk_floor_gb: number;
  docker_required: boolean;
  published: boolean;
  version: string;
}

/** ⚠ Invented interpolation (invoice states not enumerated; api_fixtures §6.5). */
export type InvoiceState = "draft" | "open" | "paid" | "void" | "uncollectible";

export interface Invoice {
  id: string; // inv_01J…
  invoice_number: string; // "NP-2026-0092"
  state: InvoiceState;
  amount: Money;
  tax: Money; // Kenya VAT 16%
  total: Money;
  period_start: Iso8601;
  period_end: Iso8601;
  due_at: Iso8601;
  subscription_id: string;
  created_at: Iso8601;
}

export type PaymentState =
  | "initiated"
  | "pending"
  | "confirmed"
  | "failed"
  | "expired"
  | "reversed";
export type ReconciliationState = "matched" | "unmatched" | "manual";
export type PaymentProvider = "mpesa" | "stripe";

export interface PaymentEvent {
  from_state: PaymentState | null;
  to_state: PaymentState;
  event_type: string;
  occurred_at: Iso8601;
  payload_redacted?: Record<string, string | number | boolean | null>;
}

export interface Payment {
  id: string; // pay_01J…
  invoice_id: string;
  provider: PaymentProvider;
  state: PaymentState;
  reconciliation_state: ReconciliationState;
  amount: Money;
  phone_number?: string; // Safaricom number for M-Pesa STK push
  provider_reference: string; // Daraja CheckoutRequestID | Stripe pi_…
  created_at: Iso8601;
  resolved_at?: Iso8601;
  events: PaymentEvent[];
}

export interface AuditEvent {
  id: string; // aud_01J…
  action: string; // canonical vocabulary = event taxonomy + operation kinds
  actor_id: string;
  actor_label: string;
  organization_id: string;
  resource: { type: string; id: string; name?: string };
  outcome: "succeeded" | "failed" | "denied";
  occurred_at: Iso8601; // rendered in UTC for audits
  operation_id?: string;
  support_context?: { actor: string; reason: string; expires_at: Iso8601 };
  previous_hash: string;
  record_hash: string; // sha256(previous_hash || actor || action || resource || ts || payload)
}

export type ServerState = "registration" | "quarantine" | "active" | "draining";

export interface ServerNode {
  id: string; // srv_01J…
  name: string;
  provider_label: string; // "Leaseweb VPS — Nairobi route"
  state: ServerState;
  profile: ProfileId;
  specs: { vcpu: number; ram_mb: number; disk_gb: number };
  agent_version: string;
  agent_connected: boolean;
  last_seen_at: Iso8601;
  ip: string;
  os: string; // "Ubuntu 24.04 LTS"
  cgroup_version: "v2";
}

/** Per-capability installer record (Stage 6 §8, GET /servers/{id}/capabilities/{key}). */
export interface CapabilityRecord {
  capability_key: string;
  workload_category: WorkloadCategory;
  ram_floor_mb: number;
  ram_typical_mb: number;
  ram_ceiling_mb: number;
  cpu_weight: number;
  cpu_max_millicores: number | null; // only for batch
  disk_floor_gb: number | null;
  prerequisites: { docker?: boolean; port_25?: boolean; public_ip?: boolean };
  state: CapabilityState;
  reason: string | null;
  /** Resource delta for unavailable caps: how much more the VPS needs. */
  delta?: { ram_mb?: number; vcpu?: number; disk_gb?: number };
  detected_at: Iso8601;
  source_digest: string; // signed file digest echoed in every capability_decision
}

export interface PersonaMatrixRow {
  capability_key: string;
  surface: "default_landing" | "visible_menu" | "hidden";
  notes: string | null;
}

export interface NotificationItem {
  id: string; // ntf_01J…
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  read: boolean;
  occurred_at: Iso8601;
  deep_link?: string;
  channel: "in_app";
}

export interface BackupSet {
  id: string; // bak_01J…
  resource_ref: { type: string; id: string; name?: string };
  policy_name: string;
  snapshot_at: Iso8601;
  size_mb: number;
  destination: "remote" | "local";
  destination_label: string;
  verified: boolean;
  integrity: "verified" | "unverified" | "failed";
}

export interface Incident {
  id: string; // inc_01J…
  title: string;
  severity: "critical" | "major" | "minor";
  state: "open" | "acknowledged" | "resolved";
  started_at: Iso8601;
  resolved_at?: Iso8601;
  affected: string[];
  summary: string;
}

export interface UserAccount {
  id: string; // usr_01J…
  email: string;
  display_name: string;
  role_labels: RoleLabel[];
  persona: PersonaId;
  status: "active" | "locked" | "disabled";
  mfa_enabled: boolean;
  avatar_initials: string;
}

export interface Organization {
  id: string; // org_01J…
  slug: string;
  name: string;
  organization_type: "standalone" | "provider" | "reseller" | "customer";
  primary_persona: PersonaId | null;
}

export interface SessionDevice {
  id: string;
  device: string;
  browser: string;
  location: string;
  created_at: Iso8601;
  last_active_at: Iso8601;
  current: boolean;
}

export interface ApiToken {
  id: string; // tok_01J…
  name: string;
  scopes: string[];
  created_at: Iso8601;
  last_used_at: Iso8601 | null;
  expires_at: Iso8601 | null;
  masked_secret: string; // "np_01J…••••" — secret shown once at creation only (DS-008)
}

export interface ApprovalRequest {
  id: string; // apr_01J…
  operation_id: string;
  title: string;
  requested_by: string;
  reason: string;
  policy: string; // e.g. "second-person approval for firewall changes"
  expires_at: Iso8601;
  impact: {
    before: string;
    after: string;
    affected_resources: string[];
    downtime_estimate: string;
    reversibility: string;
  };
  diff?: { path: string; before: string; after: string }[];
}
