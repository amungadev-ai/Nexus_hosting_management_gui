import type {
  ApiToken,
  ApprovalRequest,
  Application,
  AuditEvent,
  BackupSet,
  Certificate,
  DomainName,
  Incident,
  Invoice,
  NotificationItem,
  Operation,
  Organization,
  Payment,
  ServiceInstance,
  ServiceTemplate,
  SessionDevice,
  UserAccount,
  Website,
} from "@/lib/types";

/**
 * The shared demo dataset — the single source of truth that keeps all 184
 * screens coherent (the site on the portfolio is the site in the websites
 * list, the invoice the M-Pesa payment references, the operation the audit
 * chain records).
 *
 * Context: Wanjiku Digital, a small Nairobi web studio, on a Leaseweb VPS.
 * Kenya-specific sample data throughout: KES amounts, .co.ke domains,
 * Safaricom M-Pesa numbers, 16% VAT.
 *
 * This is mock data — lib/api/* modules read and mutate it client-side.
 * The server record's specs come from the profile switcher (lib/profiles.ts),
 * not from here.
 */

const T = (h: number, m: number) =>
  `2026-11-06T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

function usage(
  ram: [number, number, number, number],
  cpu: [number, number, number, number],
  disk: [number, number],
  throttled = 0,
  oom = 0
): Website["usage"] {
  return {
    ram_mb: { allocated: ram[0], typical: ram[1], peak: ram[2], current: ram[3] },
    cpu_millicores: { allocated: cpu[0], typical: cpu[1], peak: cpu[2], current: cpu[3] },
    disk_gb: { allocated: disk[0], current: disk[1] },
    throttled_seconds_24h: throttled,
    oom_events_7d: oom,
    updated_at: T(14, 58),
  };
}

export const db = {
  organizations: [
    {
      id: "org_01JKV7Q4N2",
      slug: "wanjiku-digital",
      name: "Wanjiku Digital (my VPS)",
      organization_type: "standalone",
      primary_persona: "self_hoster",
    },
    {
      id: "org_01JKV8Z9P3",
      slug: "jamii-hosting",
      name: "Jamii Hosting Ltd",
      organization_type: "provider",
      primary_persona: "provider_admin",
    },
  ] as Organization[],

  users: [
    { id: "usr_01JOWN01", email: "jane@wanjiku.digital", display_name: "Jane Wanjiku", role_labels: ["owner"], persona: "self_hoster", status: "active", mfa_enabled: true, avatar_initials: "JW" },
    { id: "usr_01JDEV02", email: "kevin@wanjiku.digital", display_name: "Kevin Otieno", role_labels: ["developer"], persona: "app_developer", status: "active", mfa_enabled: true, avatar_initials: "KO" },
    { id: "usr_01JCST03", email: "peter@acmeconsulting.co.ke", display_name: "Peter Kimani", role_labels: ["customer"], persona: "storage_user", status: "active", mfa_enabled: false, avatar_initials: "PK" },
    { id: "usr_01JSUP04", email: "grace@jamiihosting.co.ke", display_name: "Grace Njeri", role_labels: ["support"], persona: "infrastructure_user", status: "active", mfa_enabled: true, avatar_initials: "GN" },
    { id: "usr_01JAUD05", email: "audit@jamiihosting.co.ke", display_name: "Sam Barasa", role_labels: ["auditor"], persona: "infrastructure_user", status: "active", mfa_enabled: true, avatar_initials: "SB" },
  ] as UserAccount[],

  /** The signed-in user of the demo session. */
  currentUser: "usr_01JOWN01" as string,
  currentOrganization: "org_01JKV7Q4N2" as string,

  /** DS-019 access-grant banner demo: support session active. */
  supportGrant: {
    active: false,
    actor: "Grace Njeri (Support)",
    reason: "Ticket #4821 — investigate backup schedule",
    scope: "read-only, backups and operations",
    expires_at: "2026-11-06T17:00:00Z",
  },

  server: {
    id: "srv_01JNAI01",
    name: "nairobi-01",
    provider_label: "Leaseweb VPS",
    state: "active" as const,
    profile: "standard" as const, // display specs come from the profile switcher
    agent_version: "1.4.2",
    agent_connected: true,
    last_seen_at: "2026-11-06T14:59:47Z",
    ip: "203.0.113.10",
    os: "Ubuntu 24.04 LTS",
    cgroup_version: "v2" as const,
  },

  websites: [
    {
      id: "web_01JACME01",
      organization_id: "org_01JKV7Q4N2",
      name: "acme-consulting",
      title: "Acme Consulting",
      status: "active",
      kind: "static",
      primary_domain: "acmeconsulting.co.ke",
      health: "healthy",
      last_verified_at: T(14, 59),
      usage: usage([80, 22, 48, 26], [100, 40, 210, 65], [10, 1.2]),
      created_at: "2026-10-28T09:12:00Z",
    },
    {
      id: "web_01JKILI02",
      organization_id: "org_01JKV7Q4N2",
      name: "kili-shop",
      title: "Kili Shop (WordPress)",
      status: "active",
      kind: "php",
      primary_domain: "kilishop.co.ke",
      php_version: "8.2",
      health: "healthy",
      last_verified_at: T(14, 58),
      usage: usage([400, 185, 295, 198], [100, 120, 380, 145], [25, 6.4]),
      created_at: "2026-10-30T11:40:00Z",
    },
    {
      id: "web_01JBLOG03",
      organization_id: "org_01JKV7Q4N2",
      name: "wanjiku-blog",
      title: "Wanjiku Blog",
      status: "active",
      kind: "static",
      primary_domain: "wanjiku.co.ke",
      health: "healthy",
      last_verified_at: T(14, 57),
      usage: usage([80, 12, 26, 14], [100, 15, 60, 22], [10, 0.4]),
      created_at: "2026-11-01T16:05:00Z",
    },
    {
      id: "web_01JSHOP04",
      organization_id: "org_01JKV7Q4N2",
      name: "jamboshop",
      title: "Jambo Shop",
      status: "provisioning",
      kind: "php",
      primary_domain: "jamboshop.co.ke",
      php_version: "8.2",
      health: "unknown",
      last_verified_at: T(14, 40),
      pending_operation_id: "op_01JPROV07",
      usage: usage([400, 0, 0, 0], [100, 0, 0, 0], [25, 0.1]),
      created_at: T(14, 40),
    },
  ] as Website[],

  applications: [
    {
      id: "app_01JORDR01",
      organization_id: "org_01JKV7Q4N2",
      name: "orders-api",
      runtime: "node",
      runtime_version: "20 LTS",
      status: "active",
      category: "serving",
      health: "degraded",
      last_verified_at: T(14, 55),
      usage: usage([512, 256, 490, 380], [1000, 310, 720, 340], [10, 2.1], 0, 1),
      created_at: "2026-10-25T08:30:00Z",
    },
    {
      id: "app_01JIMGW02",
      organization_id: "org_01JKV7Q4N2",
      name: "image-worker",
      runtime: "python",
      runtime_version: "3.12",
      status: "active",
      category: "batch",
      health: "healthy",
      last_verified_at: T(14, 50),
      usage: usage([600, 210, 480, 90], [500, 190, 500, 60], [20, 3.3], 1540, 0),
      created_at: "2026-10-26T14:00:00Z",
    },
  ] as Application[],

  domains: [
    { id: "dom_01JACME01", name: "acmeconsulting.co.ke", state: "verified", dns_mode: "external_manual", registrar: "Kenic-accredited registrar", expires_at: "2027-10-01T00:00:00Z", website_id: "web_01JACME01", last_checked_at: T(14, 45) },
    { id: "dom_01JKILI02", name: "kilishop.co.ke", state: "verified", dns_mode: "external_manual", registrar: "Kenic-accredited registrar", expires_at: "2027-08-14T00:00:00Z", website_id: "web_01JKILI02", last_checked_at: T(14, 45) },
    { id: "dom_01JWANI03", name: "wanjiku.co.ke", state: "delegation_pending", dns_mode: "external_manual", registrar: "Kenic-accredited registrar", website_id: "web_01JBLOG03", last_checked_at: T(14, 30) },
    { id: "dom_01JJAMB04", name: "jamboshop.co.ke", state: "pending_verification", dns_mode: "external_manual", registrar: "Kenic-accredited registrar", website_id: "web_01JSHOP04", last_checked_at: T(14, 20) },
  ] as DomainName[],

  certificates: [
    { id: "crt_01JACME01", domains: ["acmeconsulting.co.ke", "www.acmeconsulting.co.ke"], issuer: "Let's Encrypt", status: "active", auto_renew: true, expires_at: "2027-01-04T00:00:00Z" },
    { id: "crt_01JKILI02", domains: ["kilishop.co.ke", "www.kilishop.co.ke"], issuer: "Let's Encrypt", status: "renewing", auto_renew: true, expires_at: "2026-12-20T00:00:00Z", last_renewal_attempt_at: T(14, 41) },
    { id: "crt_01JJAMB03", domains: ["jamboshop.co.ke"], issuer: "Let's Encrypt", status: "issuing", auto_renew: true, expires_at: "2027-02-01T00:00:00Z" },
  ] as Certificate[],

  serviceInstances: [
    { id: "svc_01JMINIO1", template_key: "minio", name: "media-store", state: "running", health: "healthy", exposure: "private", hostname: "media-store.internal", version: "2026-10", usage: usage([400, 140, 260, 155], [1000, 60, 240, 90], [100, 34.5]), created_at: "2026-10-27T10:00:00Z" },
    { id: "svc_01JUPIME2", template_key: "uptime-kuma", name: "status-page", state: "running", health: "healthy", exposure: "public", hostname: "status.wanjiku.digital", version: "1.23", usage: usage([300, 90, 150, 105], [1000, 25, 70, 40], [10, 1.1]), created_at: "2026-10-29T09:00:00Z" },
    { id: "svc_01JNEXT03", template_key: "nextcloud", name: "team-cloud", state: "degraded", health: "unhealthy", exposure: "public", hostname: "cloud.wanjiku.digital", version: "29", usage: usage([800, 420, 760, 690], [1000, 180, 520, 300], [100, 22.0]), created_at: "2026-10-27T15:30:00Z" },
    { id: "svc_01JREDIS4", template_key: "redis", name: "session-cache", state: "running", health: "healthy", exposure: "private", hostname: "session-cache.internal", version: "7.4", usage: usage([300, 60, 120, 75], [1000, 15, 45, 20], [10, 0.3]), created_at: "2026-10-28T08:00:00Z" },
  ] as ServiceInstance[],

  templates: [
    { key: "wordpress", name: "WordPress", category: "self_hosted_app", description: "The classic CMS. Managed PHP runtime, database and wp-cli.", ram_floor_mb: 120, ram_typical_mb: 185, ram_ceiling_mb: 400, disk_floor_gb: 2, docker_required: false, published: true, version: "6.7" },
    { key: "nextcloud", name: "Nextcloud", category: "self_hosted_app", description: "Self-hosted files, calendar and contacts for your team.", ram_floor_mb: 512, ram_typical_mb: 420, ram_ceiling_mb: 1024, disk_floor_gb: 10, docker_required: true, published: true, version: "29" },
    { key: "gitea", name: "Gitea", category: "self_hosted_app", description: "Lightweight Git service with issues and pull requests.", ram_floor_mb: 200, ram_typical_mb: 160, ram_ceiling_mb: 400, disk_floor_gb: 2, docker_required: true, published: true, version: "1.22" },
    { key: "ghost", name: "Ghost", category: "self_hosted_app", description: "Publishing platform for blogs and newsletters.", ram_floor_mb: 256, ram_typical_mb: 220, ram_ceiling_mb: 512, disk_floor_gb: 1, docker_required: true, published: true, version: "5.87" },
    { key: "n8n", name: "n8n", category: "self_hosted_app", description: "Workflow automation — connect your services with visual flows.", ram_floor_mb: 300, ram_typical_mb: 260, ram_ceiling_mb: 600, disk_floor_gb: 1, docker_required: true, published: true, version: "1.60" },
    { key: "uptime-kuma", name: "Uptime Kuma", category: "self_hosted_app", description: "Self-hosted uptime monitoring with a public status page.", ram_floor_mb: 150, ram_typical_mb: 90, ram_ceiling_mb: 300, disk_floor_gb: 1, docker_required: true, published: true, version: "1.23" },
    { key: "minio", name: "MinIO", category: "storage", description: "S3-compatible object storage for media, backups and exports.", ram_floor_mb: 120, ram_typical_mb: 140, ram_ceiling_mb: 400, disk_floor_gb: 10, docker_required: true, published: true, version: "2026-10" },
    { key: "imgproxy", name: "imgproxy", category: "transform", description: "Fast, batch-friendly image transformation pipeline.", ram_floor_mb: 200, ram_typical_mb: 300, ram_ceiling_mb: 600, disk_floor_gb: 1, docker_required: true, published: true, version: "3.27" },
    { key: "redis", name: "Redis", category: "cache", description: "In-memory cache and session store.", ram_floor_mb: 100, ram_typical_mb: 60, ram_ceiling_mb: 300, disk_floor_gb: 0.5, docker_required: true, published: true, version: "7.4" },
    { key: "meilisearch", name: "Meilisearch", category: "search", description: "Typo-tolerant search for your sites and apps.", ram_floor_mb: 150, ram_typical_mb: 120, ram_ceiling_mb: 300, disk_floor_gb: 1, docker_required: true, published: true, version: "1.9" },
    { key: "phpmyadmin", name: "phpMyAdmin", category: "database", description: "Web administration for MariaDB databases.", ram_floor_mb: 100, ram_typical_mb: 80, ram_ceiling_mb: 200, disk_floor_gb: 0.5, docker_required: true, published: true, version: "5.2" },
    { key: "pgadmin", name: "pgAdmin", category: "database", description: "Web administration for PostgreSQL databases.", ram_floor_mb: 150, ram_typical_mb: 120, ram_ceiling_mb: 300, disk_floor_gb: 0.5, docker_required: true, published: true, version: "8.12" },
  ] as ServiceTemplate[],

  invoices: [
    { id: "inv_01JINV092", invoice_number: "NP-2026-0092", state: "open", amount: { amount_minor: 15000, currency: "KES" }, tax: { amount_minor: 2400, currency: "KES" }, total: { amount_minor: 17400, currency: "KES" }, period_start: "2026-11-01T00:00:00Z", period_end: "2026-11-30T23:59:59Z", due_at: "2026-11-15T00:00:00Z", subscription_id: "sub_01JSUB01", created_at: T(6, 0) },
    { id: "inv_01JINV091", invoice_number: "NP-2026-0091", state: "paid", amount: { amount_minor: 15000, currency: "KES" }, tax: { amount_minor: 2400, currency: "KES" }, total: { amount_minor: 17400, currency: "KES" }, period_start: "2026-10-01T00:00:00Z", period_end: "2026-10-31T23:59:59Z", due_at: "2026-10-15T00:00:00Z", subscription_id: "sub_01JSUB01", created_at: "2026-10-01T06:00:00Z" },
    { id: "inv_01JINV090", invoice_number: "NP-2026-0090", state: "void", amount: { amount_minor: 50000, currency: "KES" }, tax: { amount_minor: 8000, currency: "KES" }, total: { amount_minor: 58000, currency: "KES" }, period_start: "2026-09-01T00:00:00Z", period_end: "2026-09-30T23:59:59Z", due_at: "2026-09-15T00:00:00Z", subscription_id: "sub_01JSUB01", created_at: "2026-09-01T06:00:00Z" },
  ] as Invoice[],

  payments: [
    {
      id: "pay_01JPEND44", invoice_id: "inv_01JINV092", provider: "mpesa", state: "pending", reconciliation_state: "matched",
      amount: { amount_minor: 17400, currency: "KES" }, phone_number: "+254712345678",
      provider_reference: "ws_CO_DMZ_48211", created_at: T(15, 2),
      events: [{ from_state: null, to_state: "initiated", event_type: "payment.initiated", occurred_at: T(15, 2) }, { from_state: "initiated", to_state: "pending", event_type: "payment.pending", occurred_at: T(15, 2), payload_redacted: { checkout_request_id: "ws_CO_DMZ_48211" } }],
    },
    {
      id: "pay_01JCONF43", invoice_id: "inv_01JINV091", provider: "mpesa", state: "confirmed", reconciliation_state: "matched",
      amount: { amount_minor: 17400, currency: "KES" }, phone_number: "+254712345678",
      provider_reference: "ws_CO_DMZ_47108", created_at: "2026-10-14T09:31:00Z", resolved_at: "2026-10-14T09:32:10Z",
      events: [{ from_state: null, to_state: "initiated", event_type: "payment.initiated", occurred_at: "2026-10-14T09:31:00Z" }, { from_state: "initiated", to_state: "pending", event_type: "payment.pending", occurred_at: "2026-10-14T09:31:00Z" }, { from_state: "pending", to_state: "confirmed", event_type: "payment.confirmed", occurred_at: "2026-10-14T09:32:10Z", payload_redacted: { mpesa_receipt: "QK47HJ2N9F" } }],
    },
    {
      id: "pay_01JFAIL42", invoice_id: "inv_01JINV092", provider: "mpesa", state: "failed", reconciliation_state: "matched",
      amount: { amount_minor: 17400, currency: "KES" }, phone_number: "+254712345678",
      provider_reference: "ws_CO_DMZ_46980", created_at: T(13, 10), resolved_at: T(13, 12),
      events: [{ from_state: null, to_state: "initiated", event_type: "payment.initiated", occurred_at: T(13, 10) }, { from_state: "initiated", to_state: "pending", event_type: "payment.pending", occurred_at: T(13, 10) }, { from_state: "pending", to_state: "failed", event_type: "payment.failed", occurred_at: T(13, 12), payload_redacted: { result_desc: "Request cancelled by user" } }],
    },
    {
      id: "pay_01JEXPI45", invoice_id: "inv_01JINV092", provider: "mpesa", state: "expired", reconciliation_state: "matched",
      amount: { amount_minor: 17400, currency: "KES" }, phone_number: "+254711000222",
      provider_reference: "ws_CO_DMZ_46001", created_at: T(12, 0), resolved_at: T(12, 5),
      events: [{ from_state: null, to_state: "initiated", event_type: "payment.initiated", occurred_at: T(12, 0) }, { from_state: "initiated", to_state: "pending", event_type: "payment.pending", occurred_at: T(12, 0) }, { from_state: "pending", to_state: "expired", event_type: "payment.expired", occurred_at: T(12, 5), payload_redacted: { reason: "no callback within timeout" } }],
    },
    {
      id: "pay_01JUNMT39", invoice_id: "inv_01JINV090", provider: "mpesa", state: "pending", reconciliation_state: "unmatched",
      amount: { amount_minor: 55000, currency: "KES" }, phone_number: "+254733998877",
      provider_reference: "ws_CO_DMZ_44190", created_at: "2026-09-18T10:02:00Z",
      events: [{ from_state: null, to_state: "initiated", event_type: "payment.initiated", occurred_at: "2026-09-18T10:02:00Z" }, { from_state: "initiated", to_state: "pending", event_type: "payment.pending", occurred_at: "2026-09-18T10:02:00Z" }],
    },
  ] as Payment[],

  operations: [
    {
      id: "op_01JDEPL01", kind: "website.deploy", title: "Deploy acme-consulting v7", status: "succeeded",
      workload_category: "serving", actor_id: "usr_01JDEV02", organization_id: "org_01JKV7Q4N2",
      resource_ref: { type: "website", id: "web_01JACME01", name: "acme-consulting" },
      steps: [
        { key: "step_1", title: "Validate upload archive", status: "succeeded", occurred_at: T(14, 52) },
        { key: "step_2", title: "nginx.site.validate", status: "succeeded", occurred_at: T(14, 52) },
        { key: "step_3", title: "Release to web root", status: "succeeded", occurred_at: T(14, 53) },
        { key: "step_4", title: "Reload nginx", status: "succeeded", occurred_at: T(14, 53) },
        { key: "step_5", title: "Health check https://acmeconsulting.co.ke", status: "succeeded", occurred_at: T(14, 54) },
      ],
      progress: { completed_steps: 5, total_steps: 5 },
      created_at: T(14, 52), started_at: T(14, 52), finished_at: T(14, 54), last_verified_at: T(14, 54),
      correlation_id: "req_01JDEPC01",
    },
    {
      id: "op_01JBAKQ02", kind: "backup.create", title: "Nightly backup — kilishop.co.ke", status: "queued",
      workload_category: "batch", actor_id: "usr_01JOWN01", organization_id: "org_01JKV7Q4N2",
      resource_ref: { type: "website", id: "web_01JKILI02", name: "kili-shop" },
      steps: [
        { key: "step_1", title: "Snapshot files (restic)", status: "pending" },
        { key: "step_2", title: "Snapshot database", status: "pending" },
        { key: "step_3", title: "Upload to B2 bucket", status: "pending" },
        { key: "step_4", title: "Verify snapshot integrity", status: "pending" },
      ],
      progress: { completed_steps: 0, total_steps: 4 },
      batch: { queue_position: 2, low_priority: true },
      created_at: T(14, 56), correlation_id: "req_01JBAKC02",
    },
    {
      id: "op_01JBAKR03", kind: "backup.create", title: "Backup — wanjiku-blog", status: "queued",
      workload_category: "batch", actor_id: "usr_01JOWN01", organization_id: "org_01JKV7Q4N2",
      resource_ref: { type: "website", id: "web_01JBLOG03", name: "wanjiku-blog" },
      steps: [
        { key: "step_1", title: "Snapshot files (restic)", status: "pending" },
        { key: "step_2", title: "Upload to B2 bucket", status: "pending" },
      ],
      progress: { completed_steps: 0, total_steps: 2 },
      batch: { queue_position: 3, low_priority: true },
      created_at: T(14, 56), correlation_id: "req_01JBAKC03",
    },
    {
      id: "op_01JTRAN04", kind: "image.transform", title: "Transform product images — kili-shop", status: "running",
      workload_category: "batch", actor_id: "usr_01JDEV02", organization_id: "org_01JKV7Q4N2",
      resource_ref: { type: "application", id: "app_01JIMGW02", name: "image-worker" },
      steps: [
        { key: "step_1", title: "Fetch source images from media-store", status: "succeeded", occurred_at: T(14, 51) },
        { key: "step_2", title: "Resize and compress (WebP)", status: "running" },
        { key: "step_3", title: "Publish to delivery", status: "pending" },
      ],
      progress: { completed_steps: 1, total_steps: 3 },
      batch: { low_priority: true, yielded: true },
      created_at: T(14, 50), started_at: T(14, 51), correlation_id: "req_01JTRAC04",
    },
    {
      id: "op_01JPROV07", kind: "website.provision", title: "Provision jamboshop (WordPress)", status: "running",
      workload_category: "serving", actor_id: "usr_01JOWN01", organization_id: "org_01JKV7Q4N2",
      resource_ref: { type: "website", id: "web_01JSHOP04", name: "jamboshop" },
      steps: [
        { key: "step_1", title: "Allocate PHP runtime", status: "succeeded", occurred_at: T(14, 41) },
        { key: "step_2", title: "Install WordPress", status: "running" },
        { key: "step_3", title: "Configure nginx site", status: "pending" },
        { key: "step_4", title: "Issue TLS certificate", status: "pending" },
        { key: "step_5", title: "Health check", status: "pending" },
      ],
      progress: { completed_steps: 1, total_steps: 5 },
      created_at: T(14, 40), started_at: T(14, 41), correlation_id: "req_01JPROVC07",
    },
    {
      id: "op_01JFWCN05", kind: "firewall.apply", title: "Firewall: allow 8443/tcp (Jambo dashboard)", status: "awaiting_approval",
      workload_category: "infrastructure", actor_id: "usr_01JDEV02", organization_id: "org_01JKV7Q4N2",
      resource_ref: { type: "server", id: "srv_01JNAI01", name: "nairobi-01" },
      steps: [
        { key: "step_1", title: "Preview rule diff", status: "succeeded", occurred_at: T(14, 30) },
        { key: "step_2", title: "Second-person approval", status: "awaiting_approval" },
        { key: "step_3", title: "firewall.apply", status: "pending" },
        { key: "step_4", title: "Verify SSH session survives", status: "pending" },
      ],
      progress: { completed_steps: 1, total_steps: 4 },
      created_at: T(14, 30), correlation_id: "req_01JFWCC05",
    },
    {
      id: "op_01JREST06", kind: "backup.restore", title: "Restore wanjiku-blog from 06:00 snapshot", status: "failed",
      workload_category: "batch", actor_id: "usr_01JOWN01", organization_id: "org_01JKV7Q4N2",
      resource_ref: { type: "backup", id: "bak_01JBLOG02", name: "wanjiku-blog nightly" },
      steps: [
        { key: "step_1", title: "Enumerate overwritten resources", status: "succeeded", occurred_at: T(11, 2) },
        { key: "step_2", title: "Download snapshot from B2", status: "succeeded", occurred_at: T(11, 4) },
        { key: "step_3", title: "Restore files (atomic)", status: "failed", occurred_at: T(11, 6) },
      ],
      progress: { completed_steps: 2, total_steps: 4 },
      created_at: T(11, 2), started_at: T(11, 2), finished_at: T(11, 6),
      correlation_id: "req_01JRESTC06",
      error: { code: "RESTORE_CHECKSUM_MISMATCH", detail: "Snapshot archive failed integrity verification. No files were changed — the previous state remains active.", retryable: true },
    },
  ] as Operation[],

  audit: [
    { id: "aud_01JAUD10", action: "support.access.granted", actor_id: "usr_01JSUP04", actor_label: "Grace Njeri (Support)", organization_id: "org_01JKV7Q4N2", resource: { type: "organization", id: "org_01JKV7Q4N2" }, outcome: "succeeded", occurred_at: T(14, 10), support_context: { actor: "Grace Njeri", reason: "Ticket #4821", expires_at: "2026-11-06T17:00:00Z" }, previous_hash: "sha256:c04e…9a71", record_hash: "sha256:7f2b…41cd" },
    { id: "aud_01JAUD09", action: "website.deploy", actor_id: "usr_01JDEV02", actor_label: "Kevin Otieno (Developer)", organization_id: "org_01JKV7Q4N2", resource: { type: "website", id: "web_01JACME01", name: "acme-consulting" }, outcome: "succeeded", occurred_at: T(14, 54), operation_id: "op_01JDEPL01", previous_hash: "sha256:88d0…c2f4", record_hash: "sha256:c04e…9a71" },
    { id: "aud_01JAUD08", action: "firewall.apply", actor_id: "usr_01JDEV02", actor_label: "Kevin Otieno (Developer)", organization_id: "org_01JKV7Q4N2", resource: { type: "server", id: "srv_01JNAI01", name: "nairobi-01" }, outcome: "denied", occurred_at: T(14, 30), operation_id: "op_01JFWCN05", previous_hash: "sha256:11a9…7b30", record_hash: "sha256:88d0…c2f4" },
    { id: "aud_01JAUD07", action: "backup.completed", actor_id: "usr_01JOWN01", actor_label: "Jane Wanjiku (Owner)", organization_id: "org_01JKV7Q4N2", resource: { type: "website", id: "web_01JACME01", name: "acme-consulting" }, outcome: "succeeded", occurred_at: "2026-11-06T02:00:12Z", previous_hash: "sha256:9d45…1e88", record_hash: "sha256:11a9…7b30" },
    { id: "aud_01JAUD06", action: "payment.confirmed", actor_id: "usr_01JCST03", actor_label: "Peter Kimani (Customer)", organization_id: "org_01JKV7Q4N2", resource: { type: "payment", id: "pay_01JCONF43" }, outcome: "succeeded", occurred_at: "2026-10-14T09:32:10Z", previous_hash: "sha256:3f77…0b52", record_hash: "sha256:9d45…1e88" },
    { id: "aud_01JAUD05", action: "capability.rescan", actor_id: "usr_01JOWN01", actor_label: "Jane Wanjiku (Owner)", organization_id: "org_01JKV7Q4N2", resource: { type: "server", id: "srv_01JNAI01", name: "nairobi-01" }, outcome: "succeeded", occurred_at: "2026-11-02T08:15:00Z", previous_hash: "sha256:5e10…d9c3", record_hash: "sha256:3f77…0b52" },
    { id: "aud_01JAUD04", action: "session.revoked", actor_id: "usr_01JOWN01", actor_label: "Jane Wanjiku (Owner)", organization_id: "org_01JKV7Q4N2", resource: { type: "session", id: "ses_01JOLD99" }, outcome: "succeeded", occurred_at: "2026-11-01T18:44:00Z", previous_hash: "sha256:a2c8…34f6", record_hash: "sha256:5e10…d9c3" },
    { id: "aud_01JAUD03", action: "website.created", actor_id: "usr_01JOWN01", actor_label: "Jane Wanjiku (Owner)", organization_id: "org_01JKV7Q4N2", resource: { type: "website", id: "web_01JBLOG03", name: "wanjiku-blog" }, outcome: "succeeded", occurred_at: "2026-11-01T16:05:00Z", previous_hash: "sha256:77b1…8e02", record_hash: "sha256:a2c8…34f6" },
    { id: "aud_01JAUD02", action: "server.agent.connected", actor_id: "usr_01JOWN01", actor_label: "System", organization_id: "org_01JKV7Q4N2", resource: { type: "server", id: "srv_01JNAI01", name: "nairobi-01" }, outcome: "succeeded", occurred_at: "2026-10-24T07:02:00Z", previous_hash: "sha256:0d93…55aa", record_hash: "sha256:77b1…8e02" },
    { id: "aud_01JAUD01", action: "panel.installed", actor_id: "usr_01JOWN01", actor_label: "Jane Wanjiku (Owner)", organization_id: "org_01JKV7Q4N2", resource: { type: "server", id: "srv_01JNAI01", name: "nairobi-01" }, outcome: "succeeded", occurred_at: "2026-10-24T06:58:00Z", previous_hash: "sha256:genesis", record_hash: "sha256:0d93…55aa" },
  ] as AuditEvent[],

  notifications: [
    { id: "ntf_01JNTF06", severity: "warning", title: "Payment awaiting your M-Pesa PIN", body: "We sent a payment request of KES 174.00 to your phone for invoice NP-2026-0092.", read: false, occurred_at: T(15, 2), deep_link: "/commercial/payments/pay_01JPEND44/pending", channel: "in_app" },
    { id: "ntf_01JNTF05", severity: "info", title: "Backup queued", body: "Your backup is queued. It will run when your websites are idle, usually within minutes.", read: false, occurred_at: T(14, 56), deep_link: "/monitoring/batch", channel: "in_app" },
    { id: "ntf_01JNTF04", severity: "warning", title: "orders-api is close to its memory limit", body: "Using 380 MB of its 400 MB limit. If it hits the limit, it will be restarted. Consider upgrading.", read: false, occurred_at: T(14, 40), deep_link: "/apps/app_01JORDR01", channel: "in_app" },
    { id: "ntf_01JNTF03", severity: "critical", title: "team-cloud (Nextcloud) is degraded", body: "Health checks failed 3 times in the last 15 minutes. AI diagnostics are available.", read: true, occurred_at: T(14, 20), deep_link: "/services/template/svc_01JNEXT03", channel: "in_app" },
    { id: "ntf_01JNTF02", severity: "info", title: "Certificate renewal running", body: "kilishop.co.ke certificate is being renewed — no action needed.", read: true, occurred_at: T(14, 41), deep_link: "/certificates/crt_01JKILI02", channel: "in_app" },
    { id: "ntf_01JNTF01", severity: "info", title: "Restore attempt failed safely", body: "The wanjiku-blog restore failed its integrity check. No files were changed. You can retry.", read: true, occurred_at: T(11, 6), deep_link: "/operations/updates", channel: "in_app" },
  ] as NotificationItem[],

  backups: [
    { id: "bak_01JACME01", resource_ref: { type: "website", id: "web_01JACME01", name: "acme-consulting" }, policy_name: "Nightly 02:00", snapshot_at: "2026-11-06T02:00:12Z", size_mb: 118, destination: "remote", destination_label: "B2 bucket wanjiku-backups", verified: true, integrity: "verified" },
    { id: "bak_01JKILI02", resource_ref: { type: "website", id: "web_01JKILI02", name: "kili-shop" }, policy_name: "Nightly 02:00", snapshot_at: "2026-11-06T02:07:41Z", size_mb: 412, destination: "remote", destination_label: "B2 bucket wanjiku-backups", verified: true, integrity: "verified" },
    { id: "bak_01JBLOG02", resource_ref: { type: "website", id: "web_01JBLOG03", name: "wanjiku-blog" }, policy_name: "Nightly 02:00", snapshot_at: "2026-11-06T02:03:05Z", size_mb: 64, destination: "remote", destination_label: "B2 bucket wanjiku-backups", verified: true, integrity: "verified" },
    { id: "bak_01JSVC04", resource_ref: { type: "service_instance", id: "svc_01JNEXT03", name: "team-cloud" }, policy_name: "Weekly Sunday", snapshot_at: "2026-11-02T03:00:00Z", size_mb: 2140, destination: "remote", destination_label: "B2 bucket wanjiku-backups", verified: false, integrity: "unverified" },
  ] as BackupSet[],

  incidents: [
    { id: "inc_01JINC01", title: "Memory pressure on orders-api", severity: "major", state: "open", started_at: T(14, 38), affected: ["orders-api", "kili-shop checkout"], summary: "orders-api has been above 80% of its memory ceiling for 25 minutes with 1 OOM kill in the last 7 days. AI diagnostics suggest a cache without eviction." },
    { id: "inc_01JINC00", title: "Certificate renewal hit Let's Encrypt rate limit", severity: "minor", state: "resolved", started_at: "2026-11-04T09:00:00Z", resolved_at: "2026-11-04T11:30:00Z", affected: ["kilishop.co.ke"], summary: "Existing certificate preserved; renewal retried successfully after the rate-limit window." },
  ] as Incident[],

  sessions: [
    { id: "ses_01JCUR01", device: "MacBook Pro", browser: "Chrome 141", location: "Nairobi, KE", created_at: "2026-11-06T07:30:00Z", last_active_at: T(14, 59), current: true },
    { id: "ses_01JPHN02", device: "iPhone 15", browser: "Safari", location: "Nairobi, KE", created_at: "2026-11-03T18:12:00Z", last_active_at: "2026-11-05T20:40:00Z", current: false },
    { id: "ses_01JWIN03", device: "Windows 11", browser: "Firefox 133", location: "Naivasha, KE", created_at: "2026-10-30T09:00:00Z", last_active_at: "2026-11-02T17:22:00Z", current: false },
  ] as SessionDevice[],

  apiTokens: [
    { id: "tok_01JTOK01", name: "ci-deploy", scopes: ["website.deploy"], created_at: "2026-10-26T10:00:00Z", last_used_at: T(14, 52), expires_at: null, masked_secret: "np_01JCITK••••••••" },
    { id: "tok_01JTOK02", name: "monitoring-readonly", scopes: ["server.read", "workload.usage.read"], created_at: "2026-11-01T12:00:00Z", last_used_at: T(14, 58), expires_at: "2027-01-01T00:00:00Z", masked_secret: "np_01JMNTR••••••••" },
  ] as ApiToken[],

  approvals: [
    {
      id: "apr_01JAPPR01", operation_id: "op_01JFWCN05",
      title: "Firewall: allow 8443/tcp (Jambo dashboard)",
      requested_by: "Kevin Otieno (Developer)", reason: "Customer needs the Jambo dashboard reachable; scope limited to 8443/tcp from their office IP.",
      policy: "Second-person approval for firewall changes (UXT-029)",
      expires_at: "2026-11-06T18:30:00Z",
      impact: {
        before: "8443/tcp: denied from all sources",
        after: "8443/tcp: allowed from 197.232.81.14/32 only",
        affected_resources: ["nairobi-01", "jamboshop"],
        downtime_estimate: "None — rule apply is atomic with rollback",
        reversibility: "Fully reversible; previous rule set restored on failure",
      },
      diff: [
        { path: "ufw/8443", before: "DENY all", after: "ALLOW from 197.232.81.14/32" },
      ],
    },
  ] as ApprovalRequest[],

  recommendations: [
    {
      id: "rec_01JREC01", severity: "warning" as const,
      title: "orders-api peak RAM has been above 80% for 7 days",
      evidence: "Peak 490 MB of 512 MB ceiling (24h p99). 1 OOM kill on Nov 3. CPU contention 2.1% of the week.",
      action: "Consider upgrading to a 4 GB VPS for more headroom, or reduce the cache size.",
      deep_link: "/apps/app_01JORDR01/runtime",
      upgrade_link: "/system/upgrade",
    },
    {
      id: "rec_01JREC02", severity: "info" as const,
      title: "Disk usage is growing steadily on team-cloud",
      evidence: "34.5 GB used of 100 GB; +0.8 GB/day over 30 days (mostly Nextcloud uploads).",
      action: "Enable video transcoding limits, or add a storage bucket for cold files.",
      deep_link: "/services/template/svc_01JNEXT03",
      upgrade_link: "/system/upgrade",
    },
  ],
};

export type Db = typeof db;
