import type { Iso8601 } from "@/lib/types";

/**
 * Automation-module fixtures (§4.19 automations, cron, webhooks, extensions).
 * The outbound event taxonomy (§5.4) drives the webhook event picker.
 */

export interface ScheduledJob {
  id: string; // aut_01J…
  name: string;
  cron: string;
  timezone: string;
  preset_label: string;
  workload_category: "batch" | "serving" | "infrastructure";
  state: "active" | "paused";
  owner: string;
  last_run_at: Iso8601;
  next_run_at: Iso8601;
  last_outcome: "succeeded" | "failed" | "missed";
  derived_from_command: boolean;
}

export const EVENT_TAXONOMY: { group: string; events: string[] }[] = [
  {
    group: "Websites & deployments",
    events: ["website.created", "website.deployment.started", "website.deployment.succeeded", "website.deployment.failed"],
  },
  {
    group: "Payments",
    events: ["payment.pending", "payment.confirmed", "payment.failed", "payment.expired", "payment.reversed", "payment.unmatched"],
  },
  {
    group: "Capability & services",
    events: ["capability.changed", "service.instance.running", "service.instance.degraded", "service.instance.uninstalled", "service.instance.exported"],
  },
  {
    group: "Backups & restore",
    events: ["backup.completed", "backup.failed", "restore.completed"],
  },
  {
    group: "Server & security",
    events: ["server.agent.connected", "server.agent.disconnected", "security.alert.created", "incident.opened"],
  },
  {
    group: "Operations",
    events: ["operation.failed", "batch.queued", "batch.yielded", "workload.oom_kill"],
  },
];

export interface WebhookEndpoint {
  id: string; // whk_01J…
  url: string;
  events: string[];
  state: "active" | "paused";
  secret_masked: string;
  created_at: Iso8601;
  last_delivery_at: Iso8601 | null;
}

export interface WebhookDelivery {
  id: string; // wde_01J…
  webhook_id: string;
  event_type: string;
  attempt: number;
  status: "delivered" | "failed" | "pending";
  status_code: number | null;
  last_attempt_at: Iso8601;
  detail: string;
}

export interface ConnectedIntegration {
  id: string;
  name: string;
  category: string;
  state: "connected" | "available" | "error";
  scopes: string[];
  connected_at: Iso8601 | null;
  health: string;
}

const T = (h: number, m: number) =>
  `2026-11-06T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

export const scheduledJobs: ScheduledJob[] = [
  { id: "aut_01JNIGHT1", name: "Nightly website backup", cron: "0 2 * * *", timezone: "Africa/Nairobi", preset_label: "Nightly 02:00", workload_category: "batch", state: "active", owner: "Jane Wanjiku (Owner)", last_run_at: T(2, 7), next_run_at: "2026-11-06T23:00:00Z", last_outcome: "succeeded", derived_from_command: true },
  { id: "aut_01JWEEKR2", name: "Weekly client report", cron: "0 6 * * 1", timezone: "Africa/Nairobi", preset_label: "Weekly Monday 06:00", workload_category: "batch", state: "active", owner: "Jane Wanjiku (Owner)", last_run_at: "2026-11-02T06:00:00Z", next_run_at: "2026-11-09T03:00:00Z", last_outcome: "succeeded", derived_from_command: false },
  { id: "aut_01JCACHE3", name: "Session cache warmer", cron: "*/15 * * * *", timezone: "Africa/Nairobi", preset_label: "Every 15 minutes", workload_category: "serving", state: "paused", owner: "Kevin Otieno (Developer)", last_run_at: T(11, 45), next_run_at: "—", last_outcome: "missed", derived_from_command: true },
];

export const webhookEndpoints: WebhookEndpoint[] = [
  {
    id: "whk_01JBILINK1",
    url: "https://hooks.blinkkenya.example/nexus/wanjiku",
    events: ["payment.confirmed", "payment.failed", "payment.expired"],
    state: "active",
    secret_masked: "whsec_01JBLS••••••••",
    created_at: "2026-10-27T09:00:00Z",
    last_delivery_at: T(13, 12),
  },
  {
    id: "whk_01JSLACK2",
    url: "https://hooks.slack.com/services/T0/B0/xyz",
    events: ["security.alert.created", "backup.failed", "operation.failed"],
    state: "active",
    secret_masked: "whsec_01JSLK••••••••",
    created_at: "2026-11-01T14:00:00Z",
    last_delivery_at: T(11, 6),
  },
];

export const webhookDeliveries: WebhookDelivery[] = [
  { id: "wde_01JW01", webhook_id: "whk_01JBILINK1", event_type: "payment.failed", attempt: 2, status: "delivered", status_code: 200, last_attempt_at: T(13, 12), detail: "Delivered after 1 retry (first attempt timed out at 5s)." },
  { id: "wde_01JW02", webhook_id: "whk_01JSLACK2", event_type: "backup.failed", attempt: 1, status: "delivered", status_code: 200, last_attempt_at: T(11, 6), detail: "Delivered on first attempt." },
  { id: "wde_01JW03", webhook_id: "whk_01JSLACK2", event_type: "operation.failed", attempt: 4, status: "failed", status_code: 500, last_attempt_at: T(12, 30), detail: "Receiver returned 500 on every attempt — dead-lettered after 4 tries; use Redeliver." },
  { id: "wde_01JW04", webhook_id: "whk_01JBILINK1", event_type: "payment.confirmed", attempt: 1, status: "pending", status_code: null, last_attempt_at: T(14, 20), detail: "Waiting on receiver — retries with backoff + jitter." },
];

export const connectedIntegrations: ConnectedIntegration[] = [
  { id: "int_01JRESEND1", name: "Resend (transactional email)", category: "email", state: "connected", scopes: ["email.send"], connected_at: "2026-10-26T10:00:00Z", health: "Healthy — 41 emails in the last 7 days, 0 bounces" },
  { id: "int_01JB2DST2", name: "Backblaze B2 (backup destination)", category: "storage", state: "connected", scopes: ["backup.write"], connected_at: "2026-10-24T07:05:00Z", health: "Healthy — nightly verify passed" },
  { id: "int_01JBLINK3", name: "Blink Kenya (SMS via webhook)", category: "notifications", state: "connected", scopes: ["webhook.post"], connected_at: "2026-10-27T09:00:00Z", health: "Healthy — last delivery 200 OK" },
  { id: "int_01JCLOUD4", name: "Cloudflare (DNS proxy)", category: "dns", state: "available", scopes: [], connected_at: null, health: "Not connected — v1 uses external-manual DNS guidance" },
  { id: "int_01JSTRIPE5", name: "Stripe (card payments)", category: "billing", state: "available", scopes: [], connected_at: null, health: "Deferred to v2+ — the commercial surface is gated on this profile" },
];

/** Plugin catalog fixtures — the marketplace itself is a v2 phase gate. */
export interface PluginDef {
  id: string; // slug
  name: string;
  publisher: string;
  version: string;
  summary: string;
}

export const pluginCatalog: PluginDef[] = [
  { id: "wordpress-toolkit", name: "WordPress Toolkit", publisher: "NexusPanel Labs", version: "1.0.0", summary: "Staging, cloning and one-click hardening for WordPress sites." },
  { id: "uptime-probes", name: "Uptime Probes", publisher: "Jamii Cloud", version: "0.9.2", summary: "External probes from Nairobi and Mombasa with status-page widgets." },
  { id: "mpesa-reconciler", name: "M-Pesa Reconciler", publisher: "NexusPanel Labs", version: "1.1.0", summary: "Bulk-match unmatched M-Pesa callbacks to invoices." },
];
