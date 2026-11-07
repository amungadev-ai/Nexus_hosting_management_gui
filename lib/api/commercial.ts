import type { Invoice, Payment, PaymentState } from "@/lib/types";
import { db } from "@/lib/mock/data";
import {
  branding,
  hostingAccounts,
  hostingPackages,
  license,
  mpesaConfig,
  paymentMethods,
  reconciliationNotes,
  resellers,
  RESERVED_PAYMENT_IDS,
  subscriptions,
  type HostingAccount,
  type HostingPackage,
  type MpesaConfig,
  type PaymentMethod,
  type ResellerGrant,
} from "@/lib/mock/commercial";
import { operations } from "@/lib/operations";
import { currentOrganization, currentUser } from "@/lib/api/me";
import { newId, problem, ApiError } from "@/lib/api/core";

type PaymentMethodKind = PaymentMethod["kind"];

/**
 * Commercial mock API — mirrors Stage 6 §4.14–4.16. Payments are async-first:
 * initiation returns a `pending` payment + a `payment.initiate` operation, and
 * only the callback (simulated by the demo controls) resolves state. The
 * simulate actions mutate fixtures directly (they stand in for the signed
 * Daraja callback), while provisioning-style mutations submit real operations.
 */

function actor(): { actor_id: string; organization_id: string } {
  return { actor_id: currentUser().id, organization_id: currentOrganization().id };
}

/* ------------------------------------------------------------------ */
/* Payments (Stage 6 §4.16 + §7 M-Pesa flow)                           */
/* ------------------------------------------------------------------ */

export function findPayment(id: string): Payment | undefined {
  return db.payments.find((p) => p.id === id);
}

export function invoiceById(id: string): Invoice | undefined {
  return db.invoices.find((i) => i.id === id);
}

function takeReservedSlot(): string {
  const used = new Set(db.payments.map((p) => p.id));
  const slot = RESERVED_PAYMENT_IDS.find((id) => !used.has(id));
  if (!slot) {
    throw new ApiError(
      problem(429, "RATE_LIMITED", "Too many payment attempts", "All demo payment slots are in use. Resolve a pending payment first, then retry.")
    );
  }
  return slot;
}

function appendEvent(p: Payment, from: PaymentState | null, to: PaymentState, type: string, payload?: Payment["events"][number]["payload_redacted"]) {
  p.events.push({ from_state: from, to_state: to, event_type: type, occurred_at: new Date().toISOString(), payload_redacted: payload });
}

/**
 * POST /payments — 202 + pending payment + `payment.initiate` operation.
 * Throws 409 PAYMENT_PENDING when the invoice already has a pending payment
 * (composed idempotency: actor+invoice+amount+provider).
 */
export function initiateMpesaPayment(invoiceId: string, phoneNumber: string): Payment {
  const invoice = invoiceById(invoiceId);
  if (!invoice) {
    throw new ApiError(problem(404, "NOT_FOUND", "Invoice not found", "That invoice does not exist or is not visible to you."));
  }
  if (invoice.state === "paid") {
    throw new ApiError(problem(409, "PAYMENT_ALREADY_RESOLVED", "Invoice already paid", "This invoice has already been settled — no further payment is needed."));
  }
  if (invoice.state === "void") {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Invoice is void", "Void invoices cannot be paid. Ask billing to reissue the invoice."));
  }
  const existing = db.payments.find((p) => p.invoice_id === invoiceId && (p.state === "pending" || p.state === "initiated"));
  if (existing) {
    throw new ApiError(
      problem(409, "PAYMENT_PENDING", "A payment is already pending", `Payment ${existing.provider_reference} is awaiting confirmation for invoice ${invoice.invoice_number}. Enter the M-Pesa PIN or wait for it to resolve.`)
    );
  }
  const id = takeReservedSlot();
  const now = new Date().toISOString();
  const payment: Payment = {
    id,
    invoice_id: invoiceId,
    provider: "mpesa",
    state: "pending",
    reconciliation_state: "matched",
    amount: invoice.total,
    phone_number: phoneNumber,
    provider_reference: `ws_CO_DMZ_${Math.floor(10000 + Math.random() * 89999)}`,
    created_at: now,
    events: [],
  };
  appendEvent(payment, null, "initiated", "payment.initiated");
  appendEvent(payment, "initiated", "pending", "payment.pending", { checkout_request_id: payment.provider_reference });
  db.payments.push(payment);
  operations.submit({
    kind: "payment.initiate",
    title: `M-Pesa STK push — ${invoice.invoice_number}`,
    resource_ref: { type: "payment", id, name: invoice.invoice_number },
    workload_category: "infrastructure",
    step_titles: ["Validate invoice and amount", "Send STK push via Daraja", "Await customer PIN (5-minute window)"],
    ...actor(),
  });
  return payment;
}

/** POST /payments/{id}/retry — new payment, new idempotency key. */
export function retryPayment(id: string): Payment {
  const prior = findPayment(id);
  if (!prior) throw new ApiError(problem(404, "NOT_FOUND", "Payment not found", "That payment does not exist or is not visible to you."));
  if (prior.state === "pending" || prior.state === "initiated") {
    throw new ApiError(problem(409, "PAYMENT_PENDING", "Payment still pending", "Wait for the current request to resolve before retrying."));
  }
  const fresh = initiateMpesaPayment(prior.invoice_id, prior.phone_number ?? "+254712345678");
  return fresh;
}

/**
 * Demo stand-in for the signed Daraja callback (POST /integrations/payments/
 * mpesa/callback): resolves the payment directly in the fixture store and
 * appends the matching event. Confirmed payments mark their invoice paid.
 */
export function updatePaymentState(
  id: string,
  state: Extract<PaymentState, "confirmed" | "failed" | "expired">,
  extra?: { receipt?: string; reason?: string }
): Payment {
  const payment = findPayment(id);
  if (!payment) throw new ApiError(problem(404, "NOT_FOUND", "Payment not found", "That payment does not exist or is not visible to you."));
  if (payment.state !== "pending" && payment.state !== "initiated") {
    throw new ApiError(problem(409, "PAYMENT_ALREADY_RESOLVED", "Payment already resolved", `This payment is already ${payment.state} — duplicate callbacks are ignored (idempotent 200).`));
  }
  const from = payment.state;
  payment.state = state;
  payment.resolved_at = new Date().toISOString();
  if (state === "confirmed") {
    appendEvent(payment, from, "confirmed", "payment.confirmed", { mpesa_receipt: extra?.receipt ?? "QK47HJ2N9F" });
    const invoice = invoiceById(payment.invoice_id);
    if (invoice && invoice.state === "open") invoice.state = "paid";
  } else if (state === "failed") {
    appendEvent(payment, from, "failed", "payment.failed", { result_desc: extra?.reason ?? "Request cancelled by user" });
  } else {
    appendEvent(payment, from, "expired", "payment.expired", { reason: extra?.reason ?? "no callback within timeout" });
  }
  return payment;
}

/** POST /payments/{id}/cancel — best-effort cancel of a pending payment. */
export function cancelPendingPayment(id: string): Payment {
  return updatePaymentState(id, "failed", { reason: "Cancelled by user before entering the M-Pesa PIN" });
}

/** POST /payments/{id}/reconcile (admin) — proposal only in the demo. */
export function proposeReconciliationMatch(paymentId: string, note: string): Payment {
  const payment = findPayment(paymentId);
  if (!payment) throw new ApiError(problem(404, "NOT_FOUND", "Payment not found", "That payment does not exist or is not visible to you."));
  payment.reconciliation_state = "manual";
  reconciliationNotes[paymentId] = note;
  return payment;
}

export function reconciliationNoteFor(paymentId: string): string | undefined {
  return reconciliationNotes[paymentId];
}

/* ------------------------------------------------------------------ */
/* Payment methods (UX-COM-014 — tokenized references only)            */
/* ------------------------------------------------------------------ */

export function savePaymentMethod(input: { kind: PaymentMethodKind; phone_number?: string; card_last4?: string }): PaymentMethod {
  if (input.kind === "mpesa") {
    const phone = input.phone_number ?? "";
    if (!/^\+2547\d{8}$/.test(phone)) {
      throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Invalid Safaricom number", "Enter the number in international format, for example +254712345678."));
    }
    const pm: PaymentMethod = {
      id: newId("pm"),
      kind: "mpesa",
      label: "M-Pesa (Safaricom)",
      masked: `${phone.slice(0, 6)}•••${phone.slice(-3)}`,
      is_default: false,
      verified: false,
      created_at: new Date().toISOString(),
      phone_number: phone,
    };
    paymentMethods.push(pm);
    return pm;
  }
  const last4 = input.card_last4 ?? "0000";
  const pm: PaymentMethod = {
    id: newId("pm"),
    kind: "stripe",
    label: "Card (Stripe)",
    masked: `Card •••• ${last4}`,
    is_default: false,
    verified: false,
    created_at: new Date().toISOString(),
    token_ref: `pm_stripe_${newId("tok").slice(4)}`,
  };
  paymentMethods.push(pm);
  return pm;
}

export function setDefaultPaymentMethod(id: string): void {
  for (const pm of paymentMethods) pm.is_default = pm.id === id;
}

export function deletePaymentMethod(id: string): void {
  const idx = paymentMethods.findIndex((pm) => pm.id === id);
  if (idx >= 0) paymentMethods.splice(idx, 1);
}

/** Verify runs as a durable operation — the UI never claims verified early. */
export function verifyPaymentMethod(id: string) {
  const pm = paymentMethods.find((m) => m.id === id);
  if (!pm) throw new ApiError(problem(404, "NOT_FOUND", "Payment method not found", "That payment method does not exist."));
  return operations.submit({
    kind: "payment.method.verify",
    title: `Verify ${pm.label} (${pm.masked})`,
    resource_ref: { type: "payment_method", id: pm.id, name: pm.label },
    workload_category: "infrastructure",
    step_titles: ["Send provider challenge", "Await provider confirmation", "Mark method verified"],
    ...actor(),
  });
}

/* ------------------------------------------------------------------ */
/* Hosting accounts, packages, resellers, branding                     */
/* ------------------------------------------------------------------ */

export function createHostingAccount(input: { customer_name: string; contact_email: string; package_id: string; region: string }): { account: HostingAccount; operation_id: string } {
  const pkg = hostingPackages.find((p) => p.id === input.package_id);
  if (!pkg) throw new ApiError(problem(404, "NOT_FOUND", "Package not found", "Choose a published package before provisioning."));
  if (pkg.status !== "published") {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Package is a draft", "Only published packages can be used to provision accounts."));
  }
  const account: HostingAccount = {
    id: newId("acct"),
    name: input.customer_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || newId("acct").slice(5),
    customer_org_id: newId("org"),
    customer_name: input.customer_name,
    package_id: pkg.id,
    state: "provisioning",
    owner: { name: input.customer_name, email: input.contact_email },
    resources: { websites: 0, mailboxes: 0, disk_gb: 0, ram_mb: 0 },
    limits: { websites: pkg.resources.websites, mailboxes: pkg.resources.mailboxes, disk_gb: pkg.resources.disk_gb },
    site_ids: [],
    created_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
  };
  hostingAccounts.push(account);
  const op = operations.submit({
    kind: "hosting-account.create",
    title: `Provision hosting account ${account.name}`,
    resource_ref: { type: "hosting_account", id: account.id, name: account.name },
    workload_category: "serving",
    step_titles: ["Reserve capacity", "Create account and quotas", "Send onboarding invitation", "Verify account active"],
    ...actor(),
  });
  return { account, operation_id: op.id };
}

export function suspendHostingAccount(id: string) {
  const account = hostingAccounts.find((a) => a.id === id);
  if (!account) throw new ApiError(problem(404, "NOT_FOUND", "Account not found", "That hosting account does not exist."));
  return operations.submit({
    kind: "hosting-account.suspend",
    title: `Suspend hosting account ${account.name}`,
    resource_ref: { type: "hosting_account", id: account.id, name: account.name },
    workload_category: "serving",
    step_titles: ["Preview impact", "Mark account suspended", "Verify sites unreachable"],
    outcome: "succeeded",
    ...actor(),
  });
}

export function savePackage(input: { id?: string; name: string; price_minor: number; websites: number; mailboxes: number; disk_gb: number; features: string }): HostingPackage {
  if (input.id) {
    const pkg = hostingPackages.find((p) => p.id === input.id);
    if (!pkg) throw new ApiError(problem(404, "NOT_FOUND", "Package not found", "That package does not exist."));
    if (pkg.status === "published") {
      throw new ApiError(problem(409, "CONFLICT", "Published revision is immutable", "Published package revisions cannot be edited. Create a new draft revision instead."));
    }
    pkg.name = input.name;
    pkg.price = { amount_minor: input.price_minor, currency: "KES" };
    pkg.resources = { ...pkg.resources, websites: input.websites, mailboxes: input.mailboxes, disk_gb: input.disk_gb };
    pkg.features = input.features.split("\n").map((f) => f.trim()).filter(Boolean);
    return pkg;
  }
  const pkg: HostingPackage = {
    id: newId("pkg"),
    name: input.name,
    revision: 1,
    status: "draft",
    price: { amount_minor: input.price_minor, currency: "KES" },
    resources: { websites: input.websites, mailboxes: input.mailboxes, disk_gb: input.disk_gb, ram_mb: 512 },
    features: input.features.split("\n").map((f) => f.trim()).filter(Boolean),
  };
  hostingPackages.push(pkg);
  return pkg;
}

export function publishPackage(id: string): HostingPackage {
  const pkg = hostingPackages.find((p) => p.id === id);
  if (!pkg) throw new ApiError(problem(404, "NOT_FOUND", "Package not found", "That package does not exist."));
  if (pkg.status === "published") return pkg;
  pkg.status = "published";
  pkg.revision += 1;
  return pkg;
}

export function createReseller(input: { name: string; max_accounts: number }): ResellerGrant {
  const grant: ResellerGrant = {
    id: newId("res"),
    name: input.name,
    org_slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    max_accounts: input.max_accounts,
    accounts: 0,
    state: "active",
    branding_domain: null,
    expiry: "2027-11-06T00:00:00Z",
  };
  resellers.push(grant);
  return grant;
}

export function setResellerState(id: string, state: ResellerGrant["state"]): void {
  const res = resellers.find((r) => r.id === id);
  if (!res) throw new ApiError(problem(404, "NOT_FOUND", "Reseller not found", "That reseller grant does not exist."));
  res.state = state;
}

export function saveBranding(patch: Partial<typeof branding>): void {
  Object.assign(branding, patch);
}

/* ------------------------------------------------------------------ */
/* Subscriptions, M-Pesa config, license                               */
/* ------------------------------------------------------------------ */

export function adjustSubscriptionPrice(id: string, priceMinor: number): void {
  const sub = subscriptions.find((s) => s.id === id);
  if (!sub) throw new ApiError(problem(404, "NOT_FOUND", "Subscription not found", "That subscription does not exist."));
  sub.price = { amount_minor: priceMinor, currency: "KES" };
}

export function cancelSubscription(id: string): void {
  const sub = subscriptions.find((s) => s.id === id);
  if (!sub) throw new ApiError(problem(404, "NOT_FOUND", "Subscription not found", "That subscription does not exist."));
  if (sub.status !== "active") {
    throw new ApiError(problem(409, "CONFLICT", "Subscription not active", `This subscription is already ${sub.status}.`));
  }
  sub.status = "cancel_scheduled";
  sub.cancel_effective_at = sub.next_billing_at;
}

export function saveMpesaConfig(patch: Partial<MpesaConfig>): MpesaConfig {
  Object.assign(mpesaConfig, patch);
  return mpesaConfig;
}

export function recordMpesaTestResult(checkoutRequestId: string): void {
  mpesaConfig.last_test = { ok: true, checkout_request_id: checkoutRequestId, at: new Date().toISOString() };
}

/** Activation is a direct, synchronous entitlement change (POST /licenses/activate → 200). */
export function activateLicense(key: string): void {
  const cleaned = key.trim().toUpperCase();
  if (!/^NXP(-[A-Z0-9]{4}){3}$/.test(cleaned)) {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Invalid license key", "License keys look like NXP-XXXX-XXXX-XXXX. Check the key from your provider invoice."));
  }
  license.status = "active";
  license.key_masked = `NXP-••••-••••-${cleaned.slice(-4)}`;
  license.expires_at = "2027-11-06T00:00:00Z";
}

export function renewLicense(): void {
  license.status = "active";
  license.expires_at = "2027-11-06T00:00:00Z";
}
