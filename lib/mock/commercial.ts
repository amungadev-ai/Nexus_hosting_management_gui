import type { Iso8601, Money } from "@/lib/types";

/**
 * Commercial-module fixtures (Stage 6 §4.14–4.16 shapes; inventions flagged).
 * Kenya context throughout: KES minor units, 16% VAT, Safaricom +2547…,
 * M-Pesa Daraja sandbox. These arrays extend the shared `db` dataset at
 * runtime — lib/api/commercial.ts reads and mutates them.
 */

export type HostingAccountState = "provisioning" | "active" | "suspended" | "closing";

export interface HostingAccount {
  id: string; // acct_01J…
  name: string;
  customer_org_id: string;
  customer_name: string;
  package_id: string;
  state: HostingAccountState;
  owner: { name: string; email: string };
  resources: { websites: number; mailboxes: number; disk_gb: number; ram_mb: number };
  limits: { websites: number; mailboxes: number; disk_gb: number };
  site_ids: string[];
  created_at: Iso8601;
  last_verified_at: Iso8601;
}

export interface HostingPackage {
  id: string; // pkg_01J…
  name: string;
  revision: number;
  status: "draft" | "published"; // published revisions are immutable (Stage 6 §4.14)
  price: Money; // per month, before VAT
  resources: { websites: number; mailboxes: number; disk_gb: number; ram_mb: number };
  features: string[];
}

/** ⚠ Invented interpolation — subscription states not enumerated (api_fixtures §6.6). */
export type SubscriptionStatus = "active" | "cancel_scheduled" | "cancelled";

export interface Subscription {
  id: string; // sub_01J…
  plan_name: string;
  account_id: string;
  status: SubscriptionStatus;
  price: Money; // per month, before VAT
  vat_rate: number; // Kenya VAT 16%
  period_start: Iso8601;
  next_billing_at: Iso8601;
  cancel_effective_at?: Iso8601;
}

export interface InvoiceLineItem {
  invoice_id: string;
  description: string;
  amount: Money; // before VAT
}

export type PaymentMethodKind = "mpesa" | "stripe";

export interface PaymentMethod {
  id: string; // pm_01J…
  kind: PaymentMethodKind;
  label: string;
  masked: string; // masked phone / card — never raw data (UX-COM-014)
  is_default: boolean;
  verified: boolean;
  created_at: Iso8601;
  phone_number?: string; // full Safaricom number, used for STK push
  token_ref?: string; // Stripe token reference — NexusPanel never sees card data
}

export interface ResellerGrant {
  id: string; // res_01J…
  name: string;
  org_slug: string;
  max_accounts: number;
  accounts: number;
  state: "active" | "suspended";
  branding_domain: string | null;
  expiry: Iso8601;
}

export interface CustomerOrg {
  id: string; // org_01J…
  name: string;
  slug: string;
  contact_name: string;
  contact_email: string;
  services: number;
  account_id: string;
}

export interface BrandingProfile {
  org_id: string;
  portal_name: string;
  logo_url: string | null;
  primary_color: string; // reseller brand data, not a UI token (preview only)
  button_text: string;
  domain: string | null;
  published: boolean;
}

export interface LicenseState {
  status: "active" | "grace" | "inactive";
  key_masked: string;
  seats_used: number;
  seats_total: number;
  nodes: number;
  expires_at: Iso8601;
  offline_grace_until: Iso8601;
  features: string[];
}

export interface MpesaConfig {
  environment: "sandbox" | "production";
  shortcode: string;
  callback_url: string; // panel-generated, read-only + copyable (UX-COM-018)
  consumer_key_masked: string;
  verified_at: Iso8601 | null;
  last_test: { ok: boolean; checkout_request_id: string; at: Iso8601 } | null;
  enabled: boolean;
}

const T = (h: number, m: number) =>
  `2026-11-06T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

export const hostingAccounts: HostingAccount[] = [
  {
    id: "acct_01JACME01",
    name: "acme-consulting",
    customer_org_id: "org_01JCUST1",
    customer_name: "Acme Consulting",
    package_id: "pkg_01JSTART",
    state: "active",
    owner: { name: "Peter Kimani", email: "peter@acmeconsulting.co.ke" },
    resources: { websites: 1, mailboxes: 2, disk_gb: 1.2, ram_mb: 30 },
    limits: { websites: 2, mailboxes: 5, disk_gb: 10 },
    site_ids: ["web_01JACME01"],
    created_at: "2026-10-28T09:00:00Z",
    last_verified_at: T(14, 59),
  },
  {
    id: "acct_01JKILI02",
    name: "kilishop",
    customer_org_id: "org_01JCUST2",
    customer_name: "Kili Shop",
    package_id: "pkg_01JGROWTH",
    state: "active",
    owner: { name: "Amina Hassan", email: "amina@kilishop.co.ke" },
    resources: { websites: 1, mailboxes: 4, disk_gb: 6.4, ram_mb: 198 },
    limits: { websites: 10, mailboxes: 20, disk_gb: 25 },
    site_ids: ["web_01JKILI02"],
    created_at: "2026-10-30T11:30:00Z",
    last_verified_at: T(14, 58),
  },
  {
    id: "acct_01JJAMB03",
    name: "jamboshop",
    customer_org_id: "org_01JCUST3",
    customer_name: "Jambo Shop",
    package_id: "pkg_01JGROWTH",
    state: "provisioning",
    owner: { name: "Brian Otieno", email: "brian@jamboshop.co.ke" },
    resources: { websites: 0, mailboxes: 0, disk_gb: 0.1, ram_mb: 0 },
    limits: { websites: 10, mailboxes: 20, disk_gb: 25 },
    site_ids: ["web_01JSHOP04"],
    created_at: T(14, 40),
    last_verified_at: T(14, 40),
  },
];

export const hostingPackages: HostingPackage[] = [
  {
    id: "pkg_01JSTART",
    name: "Starter",
    revision: 2,
    status: "published",
    price: { amount_minor: 15000, currency: "KES" },
    resources: { websites: 2, mailboxes: 5, disk_gb: 10, ram_mb: 512 },
    features: ["Static + PHP sites", "Free Let's Encrypt SSL", "Nightly remote backups"],
  },
  {
    id: "pkg_01JGROWTH",
    name: "Growth",
    revision: 4,
    status: "published",
    price: { amount_minor: 50000, currency: "KES" },
    resources: { websites: 10, mailboxes: 20, disk_gb: 25, ram_mb: 1024 },
    features: ["Everything in Starter", "Node.js apps", "Weekly restore verification"],
  },
  {
    id: "pkg_01JPRO",
    name: "Pro",
    revision: 1,
    status: "draft",
    price: { amount_minor: 120000, currency: "KES" },
    resources: { websites: 40, mailboxes: 100, disk_gb: 100, ram_mb: 4096 },
    features: ["Everything in Growth", "Dedicated container", "Priority support"],
  },
];

export const subscriptions: Subscription[] = [
  {
    id: "sub_01JSUB01",
    plan_name: "Starter",
    account_id: "acct_01JACME01",
    status: "active",
    price: { amount_minor: 15000, currency: "KES" },
    vat_rate: 0.16,
    period_start: "2026-11-01T00:00:00Z",
    next_billing_at: "2026-12-01T00:00:00Z",
  },
];

export const invoiceLineItems: InvoiceLineItem[] = [
  { invoice_id: "inv_01JINV092", description: "Starter plan — November 2026", amount: { amount_minor: 15000, currency: "KES" } },
  { invoice_id: "inv_01JINV091", description: "Starter plan — October 2026", amount: { amount_minor: 15000, currency: "KES" } },
  { invoice_id: "inv_01JINV090", description: "Growth plan — September 2026", amount: { amount_minor: 50000, currency: "KES" } },
];

export const paymentMethods: PaymentMethod[] = [
  {
    id: "pm_01JMPESA1",
    kind: "mpesa",
    label: "M-Pesa (Safaricom)",
    masked: "+254712•••678",
    is_default: true,
    verified: true,
    created_at: "2026-10-01T08:00:00Z",
    phone_number: "+254712345678",
  },
  {
    id: "pm_01JSTRIPE1",
    kind: "stripe",
    label: "Visa (Stripe)",
    masked: "Visa •••• 4242",
    is_default: false,
    verified: false,
    created_at: "2026-10-20T12:00:00Z",
    token_ref: "pm_stripe_01JTOKEN44",
  },
];

export const resellers: ResellerGrant[] = [
  {
    id: "res_01JNAIRO01",
    name: "Nairobi Web Partners",
    org_slug: "nairobi-web-partners",
    max_accounts: 50,
    accounts: 23,
    state: "active",
    branding_domain: "portal.nairobwebpartners.co.ke",
    expiry: "2027-01-01T00:00:00Z",
  },
  {
    id: "res_01JMOMB02",
    name: "Mombasa Digital",
    org_slug: "mombasa-digital",
    max_accounts: 20,
    accounts: 4,
    state: "active",
    branding_domain: null,
    expiry: "2026-12-15T00:00:00Z",
  },
];

export const customers: CustomerOrg[] = [
  { id: "org_01JCUST1", name: "Acme Consulting", slug: "acme-consulting", contact_name: "Peter Kimani", contact_email: "peter@acmeconsulting.co.ke", services: 1, account_id: "acct_01JACME01" },
  { id: "org_01JCUST2", name: "Kili Shop", slug: "kili-shop", contact_name: "Amina Hassan", contact_email: "amina@kilishop.co.ke", services: 2, account_id: "acct_01JKILI02" },
  { id: "org_01JCUST3", name: "Jambo Shop", slug: "jambo-shop", contact_name: "Brian Otieno", contact_email: "brian@jamboshop.co.ke", services: 1, account_id: "acct_01JJAMB03" },
];

export const branding: BrandingProfile = {
  org_id: "org_01JKV8Z9P3",
  portal_name: "Jamii Hosting",
  logo_url: null,
  primary_color: "#177A53",
  button_text: "#FFFFFF",
  domain: "portal.jamiihosting.co.ke",
  published: false,
};

export const license: LicenseState = {
  status: "active",
  key_masked: "NXP-••••-••••-8F2K",
  seats_used: 3,
  seats_total: 10,
  nodes: 1,
  expires_at: "2027-11-06T00:00:00Z",
  offline_grace_until: "2026-11-20T00:00:00Z",
  features: ["websites", "service_templates", "mpesa"],
};

export const mpesaConfig: MpesaConfig = {
  environment: "sandbox",
  shortcode: "174379",
  callback_url: "https://panel.jamiihosting.co.ke/api/v1/integrations/payments/mpesa/callback",
  consumer_key_masked: "ck_01JDARAJ••••",
  verified_at: "2026-11-01T09:00:00Z",
  last_test: { ok: true, checkout_request_id: "ws_CO_TEST123", at: "2026-11-01T09:05:00Z" },
  enabled: true,
};

/** Reconciliation review notes (payment id → note), written by proposeReconciliationMatch. */
export const reconciliationNotes: Record<string, string> = {};

/**
 * Pre-rendered payment id slots. Static export needs every payment detail
 * route to exist at build time; lib/api/commercial.ts fills an unused slot
 * when a customer pays ("POST /payments" → 202). Direct visits to an unused
 * slot render the honest not-found state.
 */
export const RESERVED_PAYMENT_IDS = ["pay_01JNEW01", "pay_01JNEW02", "pay_01JNEW03"];
