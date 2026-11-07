import type { Certificate, DomainName } from "@/lib/types";
import type { Operation } from "@/lib/types";
import type { SubmitSpec } from "@/lib/operations";
import { db } from "@/lib/mock/data";
import { sleep, withLatency } from "@/lib/api/core";
import { operations } from "@/lib/operations";
import { guidanceForDomain, allCertificates as allCertificatesList } from "@/lib/mock/dns";

/**
 * DNS-module API client (mock). v1 = DNS guidance mode; authoritative DNS is
 * a v2 surface and every v2 screen renders the gate instead of calling this.
 * Mutations follow the 202 + operation pattern; check/poll endpoints submit a
 * short operation so the "we checked at …" result is tracked and auditable.
 */

export interface OperationAccepted {
  operation: Operation;
  request_id: string;
}

type OpInput = Omit<SubmitSpec, "actor_id" | "organization_id">;

async function submitOp(spec: OpInput): Promise<OperationAccepted> {
  await sleep(200);
  const operation = operations.submit({
    ...spec,
    actor_id: db.currentUser,
    organization_id: db.currentOrganization,
  });
  return { operation, request_id: operation.correlation_id };
}

// ---------------------------------------------------------------------------
// Reads (GET /domains, /certificates)
// ---------------------------------------------------------------------------

export async function listDomains(): Promise<DomainName[]> {
  return withLatency(() => db.domains);
}

export async function getDomain(domainId: string): Promise<DomainName | undefined> {
  return withLatency(() => db.domains.find((d) => d.id === domainId));
}

export async function listCertificates(): Promise<Certificate[]> {
  return withLatency(() => allCertificatesList());
}

export interface AddDomainInput {
  name: string;
  intended_site: string;
}

/** POST /domains → 201 + operation (prototype: operation-backed create). */
export async function addDomain(input: AddDomainInput) {
  return submitOp({
    kind: "domain.create",
    title: `Add domain ${input.name}`,
    resource_ref: { type: "domain", id: `dom_new_${input.name}`, name: input.name },
    workload_category: "serving",
    step_titles: [
      "Validate domain name (.co.ke zone checks)",
      "Create domain record",
      "Generate TXT verification challenge",
      "Prepare DNS guidance",
    ],
  });
}

/**
 * POST /domains/{id}/verify — the check runs as an operation; whether the
 * TXT challenge is found comes back in the operation outcome, never as a
 * client-side guess.
 */
export async function verifyDomain(domainId: string, domainName: string) {
  const guidance = guidanceForDomain(domainId);
  const found = guidance?.propagation_state === "propagated";
  return submitOp({
    kind: "domain.verify",
    title: `Verify ownership of ${domainName}`,
    resource_ref: { type: "domain", id: domainId, name: domainName },
    workload_category: "serving",
    step_titles: [
      `Look up TXT ${guidance ? "challenge" : "record"}`,
      "Query registrar nameservers",
      "Compare challenge value",
      "Update verification state",
    ],
    outcome: found ? "succeeded" : "failed",
    error: found
      ? undefined
      : {
          code: "DNS_TXT_NOT_FOUND",
          detail:
            "The TXT challenge record was not found yet. Resolvers may still hold the old cached value (TTL up to 1 hour) — wait a few minutes and check again. Nothing has changed on your registrar.",
          retryable: true,
        },
  });
}

/** POST /domains/{id}/dns-guidance/check — polls propagation honestly. */
export async function checkDnsPropagation(domainId: string, domainName: string) {
  const guidance = guidanceForDomain(domainId);
  const propagated = guidance?.check_outcome === "propagated";
  return submitOp({
    kind: "domain.dns.check",
    title: `Check DNS propagation — ${domainName}`,
    resource_ref: { type: "domain", id: domainId, name: domainName },
    workload_category: "serving",
    step_titles: [
      "Query 1.1.1.1 (Cloudflare)",
      "Query 197.232.82.1 (Safaricom)",
      "Compare observed values with the expected records",
    ],
    outcome: propagated ? "succeeded" : "failed",
    error: propagated
      ? undefined
      : {
          code: "DNS_NOT_PROPAGATED",
          detail:
            "Some resolvers still return the old (or no) value. This is normal while caches expire — the panel keeps the exact records ready and you can check again in a few minutes. We never claim the domain is live before every checked resolver agrees.",
          retryable: true,
        },
  });
}

/** GET/POST delegation check — registrar NS vs observed NS. */
export async function recheckDelegation(domainId: string, domainName: string) {
  const guidance = guidanceForDomain(domainId);
  const delegated = guidance?.delegation?.delegated ?? true;
  return submitOp({
    kind: "domain.delegation.check",
    title: `Recheck delegation — ${domainName}`,
    resource_ref: { type: "domain", id: domainId, name: domainName },
    workload_category: "serving",
    step_titles: [
      "Read registrar NS/glue records",
      "Query observed nameservers",
      "Compare delegation",
    ],
    outcome: delegated ? "succeeded" : "failed",
    error: delegated
      ? undefined
      : {
          code: "DNS_DELEGATION_PENDING",
          detail:
            "The registrar still serves parking nameservers for this domain. Update the nameservers (or add the records on the parked zone) — the checklist has the exact values.",
          retryable: true,
        },
  });
}

/** POST /certificates — HTTP-01 in v1 (DNS-01/wildcard deferred to v2+). */
export async function issueCertificate(domains: string[]) {
  const name = domains[0] ?? "certificate";
  return submitOp({
    kind: "certificate.issue",
    title: `Issue certificate for ${name}`,
    resource_ref: { type: "certificate", id: `crt_new_${name}`, name },
    workload_category: "serving",
    step_titles: [
      "Validate prerequisites (domain resolves to this server)",
      "ACME order (HTTP-01 challenge)",
      "Serve challenge response",
      "Download certificate chain",
      "Install + reload nginx",
      "Verify HTTPS from the outside",
    ],
  });
}

export async function renewCertificate(certId: string, primaryDomain: string) {
  return submitOp({
    kind: "certificate.renew",
    title: `Renew certificate — ${primaryDomain}`,
    resource_ref: { type: "certificate", id: certId, name: primaryDomain },
    workload_category: "serving",
    step_titles: [
      "ACME order (HTTP-01 challenge)",
      "Serve challenge response",
      "Download renewed certificate",
      "Install + reload nginx",
      "Verify HTTPS from the outside",
    ],
  });
}

export async function revokeCertificate(certId: string, primaryDomain: string) {
  return submitOp({
    kind: "certificate.revoke",
    title: `Revoke certificate — ${primaryDomain}`,
    resource_ref: { type: "certificate", id: certId, name: primaryDomain },
    workload_category: "serving",
    step_titles: [
      "Submit revocation to Let's Encrypt",
      "Remove certificate from nginx",
      "Verify site falls back safely",
    ],
  });
}

/** PATCH /websites/{id} HTTPS policy — preview first, then apply via operation. */
export async function applyHttpsPolicy(siteId: string, siteName: string, hsts: boolean) {
  return submitOp({
    kind: "website.https.apply",
    title: `Apply HTTPS policy — ${siteName}${hsts ? " (HSTS on)" : ""}`,
    resource_ref: { type: "website", id: siteId, name: siteName },
    workload_category: "serving",
    step_titles: [
      "Validate policy (redirect + HSTS headers)",
      "Apply nginx TLS settings",
      "Reload nginx",
      "Verify redirect + TLS from the outside",
    ],
  });
}

export async function previewHttpsPolicy(siteId: string, hsts: boolean) {
  await sleep(300);
  return {
    valid: true as const,
    site_id: siteId,
    config_diff: [
      { path: "force_https", from: "301 (temporary)", to: "308 (permanent)" },
      { path: "hsts", from: hsts ? "max-age=0" : "max-age=0", to: hsts ? "max-age=2592000; includeSubDomains" : "max-age=0" },
      { path: "tls_modes", from: "Compatible (TLS 1.2+)", to: "Compatible (TLS 1.2+)" },
    ],
  };
}
