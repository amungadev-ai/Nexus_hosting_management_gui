import type { Certificate, DomainName, DomainState, Iso8601 } from "@/lib/types";
import { db } from "@/lib/mock/data";

/**
 * DNS-module fixture extensions (DNS guidance records, verification
 * challenges, delegation checks, extra certificates). v1 = guidance mode only:
 * NexusPanel does not host DNS yet — these fixtures are the "exact records to
 * add at your registrar" data source (UX-DNS-014 / UX-WEB-018).
 */

export type GuidanceRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX";

export interface GuidanceRecord {
  type: GuidanceRecordType;
  name: string;
  value: string;
  ttl_seconds: number;
  purpose: string;
}

export interface PropagationCheck {
  resolver: string;
  expected: string;
  observed: string | null;
  match: boolean;
}

export interface DnsGuidanceFixture {
  domain_id: string;
  domain: string;
  records: GuidanceRecord[];
  instructions: string;
  registrar_hint: string;
  propagation_state: "propagated" | "pending" | "failed";
  checks: PropagationCheck[];
  last_checked_at: Iso8601 | null;
  /** Expected outcome when the user runs "Check propagation" for this fixture. */
  check_outcome: "propagated" | "pending";
  /** For delegation_pending domains: registrar vs observed nameservers. */
  delegation?: {
    registrar_nameservers: string[];
    observed_nameservers: string[];
    delegated: boolean;
  };
}

const SERVER_IP = "203.0.113.10"; // nairobi-01 (db.server.ip)

export const dnsGuidance: DnsGuidanceFixture[] = [
  {
    domain_id: "dom_01JACME01",
    domain: "acmeconsulting.co.ke",
    records: [
      { type: "A", name: "@", value: SERVER_IP, ttl_seconds: 3600, purpose: "Points acmeconsulting.co.ke at this server." },
      { type: "CNAME", name: "www", value: "acmeconsulting.co.ke", ttl_seconds: 3600, purpose: "Serves www on the same site." },
      { type: "TXT", name: "@", value: "v=spf1 include:_spf.google.com ~all", ttl_seconds: 3600, purpose: "SPF — only needed if you send mail for this domain." },
    ],
    instructions:
      "Add these records at your Kenic-accredited registrar. The A record points your domain at this server (203.0.113.10); the CNAME covers www.",
    registrar_hint: "Kenic registrars expose this under “DNS management” or “Zone records”. Changes usually appear within minutes; the TTL above is how long resolvers may cache the old value.",
    propagation_state: "propagated",
    checks: [
      { resolver: "1.1.1.1 (Cloudflare)", expected: SERVER_IP, observed: SERVER_IP, match: true },
      { resolver: "197.232.82.1 (Safaricom)", expected: SERVER_IP, observed: SERVER_IP, match: true },
      { resolver: "41.90.30.10 (Liquid)", expected: SERVER_IP, observed: SERVER_IP, match: true },
    ],
    last_checked_at: "2026-11-06T14:45:00Z",
    check_outcome: "propagated",
  },
  {
    domain_id: "dom_01JKILI02",
    domain: "kilishop.co.ke",
    records: [
      { type: "A", name: "@", value: SERVER_IP, ttl_seconds: 3600, purpose: "Points kilishop.co.ke at this server." },
      { type: "CNAME", name: "www", value: "kilishop.co.ke", ttl_seconds: 3600, purpose: "Serves www on the same shop." },
      { type: "A", name: "shop", value: SERVER_IP, ttl_seconds: 3600, purpose: "Subdomain for the storefront test channel." },
    ],
    instructions:
      "Add these records at your Kenic-accredited registrar. All three records point at this server (203.0.113.10).",
    registrar_hint: "Kenic registrars expose this under “DNS management” or “Zone records”. If your registrar edits take hours, that is their queue — the panel will keep polling.",
    propagation_state: "propagated",
    checks: [
      { resolver: "1.1.1.1 (Cloudflare)", expected: SERVER_IP, observed: SERVER_IP, match: true },
      { resolver: "197.232.82.1 (Safaricom)", expected: SERVER_IP, observed: SERVER_IP, match: true },
    ],
    last_checked_at: "2026-11-06T14:45:00Z",
    check_outcome: "propagated",
  },
  {
    domain_id: "dom_01JWANI03",
    domain: "wanjiku.co.ke",
    records: [
      { type: "A", name: "@", value: SERVER_IP, ttl_seconds: 3600, purpose: "Will point wanjiku.co.ke at this server." },
      { type: "CNAME", name: "www", value: "wanjiku.co.ke", ttl_seconds: 3600, purpose: "Serves www on the same site." },
    ],
    instructions:
      "wanjiku.co.ke is registered but its nameservers still point at your registrar's parking page. First fix the delegation (see the delegation checklist), then add these records.",
    registrar_hint: "In your registrar's panel, replace the nameserver entries with the ones your registrar assigns to hosted DNS — or add an A record if they support direct records on parking NS.",
    propagation_state: "pending",
    checks: [
      { resolver: "1.1.1.1 (Cloudflare)", expected: SERVER_IP, observed: null, match: false },
      { resolver: "197.232.82.1 (Safaricom)", expected: SERVER_IP, observed: null, match: false },
    ],
    last_checked_at: "2026-11-06T14:30:00Z",
    check_outcome: "pending",
    delegation: {
      registrar_nameservers: ["ns1.kenic-parking.example", "ns2.kenic-parking.example"],
      observed_nameservers: [],
      delegated: false,
    },
  },
  {
    domain_id: "dom_01JJAMB04",
    domain: "jamboshop.co.ke",
    records: [
      { type: "TXT", name: "_nexuspanel-verify", value: "nexuspanel-verify=j4m2b0sh1p7k9e3", ttl_seconds: 3600, purpose: "Proves you control the domain before the panel attaches it to jamboshop." },
      { type: "A", name: "@", value: SERVER_IP, ttl_seconds: 3600, purpose: "Points jamboshop.co.ke at this server (add after verification)." },
      { type: "CNAME", name: "www", value: "jamboshop.co.ke", ttl_seconds: 3600, purpose: "Serves www on the same shop." },
    ],
    instructions:
      "Add the TXT record first — it verifies you control jamboshop.co.ke. Once verification passes, add the A and CNAME records to point the domain at this server.",
    registrar_hint: "Kenic registrars expose TXT records under “DNS management” → “Add record” → type TXT. The verification record can be removed after the domain shows Verified.",
    propagation_state: "pending",
    checks: [
      { resolver: "1.1.1.1 (Cloudflare)", expected: "nexuspanel-verify=j4m2b0sh1p7k9e3", observed: null, match: false },
      { resolver: "197.232.82.1 (Safaricom)", expected: "nexuspanel-verify=j4m2b0sh1p7k9e3", observed: null, match: false },
    ],
    last_checked_at: "2026-11-06T14:20:00Z",
    check_outcome: "pending",
  },
];

export interface VerificationChallenge {
  domain_id: string;
  method: "dns_txt";
  txt_name: string;
  txt_value: string;
  ttl_seconds: number;
  generated_at: Iso8601;
}

export const verificationChallenges: VerificationChallenge[] = [
  {
    domain_id: "dom_01JJAMB04",
    method: "dns_txt",
    txt_name: "_nexuspanel-verify.jamboshop.co.ke",
    txt_value: "nexuspanel-verify=j4m2b0sh1p7k9e3",
    ttl_seconds: 3600,
    generated_at: "2026-11-06T14:20:00Z",
  },
  {
    domain_id: "dom_01JWANI03",
    method: "dns_txt",
    txt_name: "_nexuspanel-verify.wanjiku.co.ke",
    txt_value: "nexuspanel-verify=w4n1j1k0u2c8o5e",
    ttl_seconds: 3600,
    generated_at: "2026-11-06T14:30:00Z",
  },
  {
    domain_id: "dom_01JACME01",
    method: "dns_txt",
    txt_name: "_nexuspanel-verify.acmeconsulting.co.ke",
    txt_value: "nexuspanel-verify=verified-2026-10-28",
    ttl_seconds: 3600,
    generated_at: "2026-10-28T09:20:00Z",
  },
  {
    domain_id: "dom_01JKILI02",
    method: "dns_txt",
    txt_name: "_nexuspanel-verify.kilishop.co.ke",
    txt_value: "nexuspanel-verify=verified-2026-10-30",
    ttl_seconds: 3600,
    generated_at: "2026-10-30T11:50:00Z",
  },
];

export function guidanceForDomain(domainId: string): DnsGuidanceFixture | undefined {
  return dnsGuidance.find((g) => g.domain_id === domainId);
}

export function challengeForDomain(domainId: string): VerificationChallenge | undefined {
  return verificationChallenges.find((c) => c.domain_id === domainId);
}

// ---------------------------------------------------------------------------
// Zones (v2 surfaces) — the zone list is derived from the domain inventory:
// in v1 every domain's DNS lives at the registrar, so each domain name is the
// zone the v2 authoritative DNS would host.
// ---------------------------------------------------------------------------

export interface DnsZoneFixture {
  zone: string;
  domain_id: string;
  /** True when a guidance fixture (records the registrar should have) exists. */
  has_guidance: boolean;
}

export function dnsZones(): DnsZoneFixture[] {
  const guided = new Set(dnsGuidance.map((g) => g.domain_id));
  return db.domains.map((d) => ({
    zone: d.name,
    domain_id: d.id,
    has_guidance: guided.has(d.id),
  }));
}

export function guidanceForZone(zone: string): DnsGuidanceFixture | undefined {
  return dnsGuidance.find((g) => g.domain === zone);
}

export function domainForZone(zone: string): DomainName | undefined {
  return db.domains.find((d) => d.name === zone);
}

/**
 * Per-certificate failure details for the honest inline failed state
 * (DS-011 failed: safe error code + reason). The shared Certificate type has
 * no error field, so failed certs get their explanation here.
 */
export const certificateFailures: Record<string, { code: string; detail: string }> = {
  crt_01JWANI04: {
    code: "ACME_HTTP_01_UNREACHABLE",
    detail:
      "Let's Encrypt could not reach http://wanjiku.co.ke/.well-known/acme-challenge — the domain's nameservers still point at the registrar's parking, so no server answered for it. Fix the delegation first, then renew; the certificate will keep failing until the domain actually resolves to this server.",
  },
};

export function certificateFailure(certId: string): { code: string; detail: string } | undefined {
  return certificateFailures[certId];
}

/**
 * A failed certificate: wanjiku.co.ke cannot complete HTTP-01 because the
 * domain's delegation is still parked — an honest failure with a retry path.
 */
export const certificatesExtra: Certificate[] = [
  {
    id: "crt_01JWANI04",
    domains: ["wanjiku.co.ke", "www.wanjiku.co.ke"],
    issuer: "Let's Encrypt",
    status: "failed",
    auto_renew: true,
    expires_at: "2027-02-10T00:00:00Z",
    last_renewal_attempt_at: "2026-11-06T13:05:00Z",
  },
];

export function allCertificates(): Certificate[] {
  return [...db.certificates, ...certificatesExtra];
}

/** DomainState → honest next-step copy used by several DNS screens. */
export function domainStateCopy(state: DomainState): string {
  switch (state) {
    case "verified":
      return "Ownership verified. DNS guidance records resolve to this server.";
    case "pending_verification":
      return "Waiting for the TXT challenge to appear at your registrar's nameservers.";
    case "delegation_pending":
      return "Registered, but the nameservers still point at the registrar's parking — delegation has to move before DNS records can resolve.";
    case "failed":
      return "The last verification attempt failed. Check the record values, then retry.";
  }
}
