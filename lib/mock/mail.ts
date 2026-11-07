import type { Iso8601 } from "@/lib/types";

/**
 * Email-module fixtures. v1 email = external SMTP relay (Stage 6 §4.11);
 * self-hosted mailboxes ship in v2 (capability `mail.mailboxes`, Standard+).
 * Exact DNS record values below are the deliverability guidance source
 * (UX-MAIL-008) and tie into the DNS-guidance story.
 */

export type SmtpProvider = "resend" | "postmark" | "mailgun" | "ses";

export interface SmtpConfig {
  id: string; // smtp_01J…
  provider: SmtpProvider;
  host: string;
  port: number;
  username: string;
  from_address: string;
  masked_password: string;
  verified_at: Iso8601 | null;
  enabled: boolean;
}

export interface MailDomain {
  id: string; // mdom_01J…
  domain: string;
  mode: "external_smtp" | "self_hosted";
  health: "healthy" | "degraded" | "unknown";
  mx_verified: boolean;
  last_checked_at: Iso8601;
}

export interface Mailbox {
  id: string; // mbox_01J…
  address: string;
  quota_mb: number;
  used_mb: number;
  state: "active" | "suspended";
  forwarders: string[];
  created_at: Iso8601;
}

export interface MailAlias {
  id: string; // mal_01J…
  source: string;
  target: string;
  state: "active";
}

export interface DeliverabilityRecord {
  id: string;
  role: "SPF" | "DKIM" | "DMARC" | "PTR";
  type: "TXT" | "CNAME" | "pointer";
  name: string;
  value: string;
  status: "verified" | "pending" | "action_needed";
  note: string;
}

export interface MailQueueItem {
  id: string; // mq_01J…
  recipient: string;
  subject: string;
  state: "deferred" | "bounced";
  attempts: number;
  reason: string;
  last_attempt_at: Iso8601;
}

const T = (h: number, m: number) =>
  `2026-11-06T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

export const smtpConfig: SmtpConfig = {
  id: "smtp_01JRESEND1",
  provider: "resend",
  host: "smtp.resend.com",
  port: 587,
  username: "resend",
  from_address: "panel@wanjiku.co.ke",
  masked_password: "re_••••••••••••",
  verified_at: T(9, 2),
  enabled: true,
};

export const mailDomains: MailDomain[] = [
  {
    id: "mdom_01JWANI01",
    domain: "wanjiku.co.ke",
    mode: "external_smtp",
    health: "healthy",
    mx_verified: false, // no MX needed for outbound relay only
    last_checked_at: T(14, 45),
  },
];

export const mailboxes: Mailbox[] = [
  {
    id: "mbox_01JJANE01",
    address: "jane@wanjiku.co.ke",
    quota_mb: 5120,
    used_mb: 1830,
    state: "active",
    forwarders: [],
    created_at: "2026-10-24T07:10:00Z",
  },
  {
    id: "mbox_01JHEL02",
    address: "hello@wanjiku.co.ke",
    quota_mb: 2048,
    used_mb: 412,
    state: "active",
    forwarders: ["jane@wanjiku.co.ke"],
    created_at: "2026-10-26T10:00:00Z",
  },
];

export const mailAliases: MailAlias[] = [
  { id: "mal_01JINFO01", source: "info@wanjiku.co.ke", target: "jane@wanjiku.co.ke", state: "active" },
  { id: "mal_01JBILL02", source: "billing@wanjiku.co.ke", target: "hello@wanjiku.co.ke", state: "active" },
];

export const catchAll: { target: string | null } = { target: null };

export const deliverabilityRecords: DeliverabilityRecord[] = [
  {
    id: "dxr_01JSPF01",
    role: "SPF",
    type: "TXT",
    name: "wanjiku.co.ke",
    value: "v=spf1 include:_spf.resend.com ~all",
    status: "verified",
    note: "Authorizes the external SMTP relay to send for your domain.",
  },
  {
    id: "dxr_01JDKIM02",
    role: "DKIM",
    type: "TXT",
    name: "resend._domainkey.wanjiku.co.ke",
    value: "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7tQ1kZm9WxY0pQn8sA2vJ4LhT6uE3bR8cD5fG7iK1mN9oP2qS4tU6vW8xY0zA1bC3dE5fG7hJ9kL2mN4pQ6rS8tU0vW2xY4zB6cD8eF0gH2iJ4kL6mN8pQ0rS2tU4vW6xY8zA0bC2dE4fG6hJ8kL0mN2pQ4rS6tU8vW0xY2zB4cD6eF8gH0iJ2kL4mN6pQ8rS0tU2vW4xY6zB8cD0eF2gH4iJ6kL8mN0pQ2rS4tU6vW8xY0zA2bC4dE6fG8hJ0kL2mN4pQ6rS8tU0vIDAQAB",
    status: "verified",
    note: "Signs outbound mail so receivers can verify it was really sent by you.",
  },
  {
    id: "dxr_01JDMARC3",
    role: "DMARC",
    type: "TXT",
    name: "_dmarc.wanjiku.co.ke",
    value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@wanjiku.co.ke; adkim=s; aspf=s",
    status: "pending",
    note: "Add this record at your registrar — it tells receivers what to do with mail that fails SPF/DKIM.",
  },
  {
    id: "dxr_01JPTR04",
    role: "PTR",
    type: "pointer",
    name: "203.0.113.10",
    value: "mail.wanjiku.co.ke (set in your VPS provider's control panel)",
    status: "action_needed",
    note: "NexusPanel cannot set PTR for you — request it from Leaseweb. Receivers check it for outbound mail.",
  },
];

export const mailboxActivity: { ts: string; severity: "info" | "warn" | "error"; message: string }[] = [
  { ts: T(14, 42), severity: "info", message: "Delivered to jane@wanjiku.co.ke — panel notification 'Backup queued' via smtp.resend.com (250 OK, 412 ms)" },
  { ts: T(13, 5), severity: "info", message: "Delivered to peter@acmeconsulting.co.ke — invoice NP-2026-0092 (250 OK, 380 ms)" },
  { ts: T(11, 20), severity: "warn", message: "Deferred: billing@kilishop.co.ke — recipient domain greylisted, will retry (attempt 1)" },
  { ts: T(9, 2), severity: "info", message: "SMTP credentials verified — test message to postmaster@wanjiku.co.ke accepted" },
];

export const mailQueue: MailQueueItem[] = [
  {
    id: "mq_01JGREY01",
    recipient: "billing@kilishop.co.ke",
    subject: "Invoice NP-2026-0092 — KES 174.00 due 15 Nov",
    state: "deferred",
    attempts: 2,
    reason: "Recipient mail server greylisted the message. Delivery retries automatically — no action needed.",
    last_attempt_at: T(11, 20),
  },
  {
    id: "mq_01JBOUN02",
    recipient: "old-address@wanjiku.co.ke",
    subject: "Panel notification — certificate renewal",
    state: "bounced",
    attempts: 1,
    reason: "550 mailbox unavailable — the mailbox no longer exists. Remove this recipient from the notification list.",
    last_attempt_at: T(10, 4),
  },
];
