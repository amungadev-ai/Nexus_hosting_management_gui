import type { Iso8601, PersonaId, RoleLabel } from "@/lib/types";

/**
 * IAM module fixtures — extends the shared dataset (`db`) with the
 * identity-side records the 8.1 screens need. Kept in lib/mock/iam.ts per
 * the generator conventions (module mock data extensions never touch
 * lib/mock/data.ts).
 */

/** Pending organization invitations (UX-IAM-006 / UX-IAM-007). */
export interface IamInvite {
  id: string; // inv_01J…
  organization_id: string;
  email: string;
  role_labels: RoleLabel[];
  /** Persona hint shown to the inviter — UI guidance only, never a permission. */
  persona_hint: PersonaId;
  invited_by: string; // usr_01J…
  created_at: Iso8601;
  expires_at: Iso8601;
  state: "pending" | "expired";
}

export const iamInvites: IamInvite[] = [
  {
    id: "inv_01JINV01",
    organization_id: "org_01JKV7Q4N2",
    email: "amina@wanjiku.digital",
    role_labels: ["developer"],
    persona_hint: "app_developer",
    invited_by: "usr_01JOWN01",
    created_at: "2026-11-05T09:30:00Z",
    expires_at: "2026-11-12T09:30:00Z",
    state: "pending",
  },
  {
    id: "inv_01JINV02",
    organization_id: "org_01JKV7Q4N2",
    email: "mary@wanjiku.co.ke",
    role_labels: ["customer"],
    persona_hint: "storage_user",
    invited_by: "usr_01JOWN01",
    created_at: "2026-11-04T15:10:00Z",
    expires_at: "2026-11-11T15:10:00Z",
    state: "pending",
  },
  {
    id: "inv_01JINV03",
    organization_id: "org_01JKV8Z9P3",
    email: "operations@jamiihosting.co.ke",
    role_labels: ["support"],
    persona_hint: "infrastructure_user",
    invited_by: "usr_01JOWN01",
    created_at: "2026-10-20T08:00:00Z",
    expires_at: "2026-10-27T08:00:00Z",
    state: "expired",
  },
];

/** Organization memberships — drives the members table on org detail. */
export interface IamMembership {
  user_id: string;
  organization_id: string;
}

export const iamMemberships: IamMembership[] = [
  { user_id: "usr_01JOWN01", organization_id: "org_01JKV7Q4N2" }, // Jane — owner
  { user_id: "usr_01JDEV02", organization_id: "org_01JKV7Q4N2" }, // Kevin — developer
  { user_id: "usr_01JCST03", organization_id: "org_01JKV7Q4N2" }, // Peter — customer
  { user_id: "usr_01JOWN01", organization_id: "org_01JKV8Z9P3" }, // Jane also owns Jamii
  { user_id: "usr_01JSUP04", organization_id: "org_01JKV8Z9P3" }, // Grace — support
  { user_id: "usr_01JAUD05", organization_id: "org_01JKV8Z9P3" }, // Sam — auditor
];

/**
 * The installation claim (UX-IAM-001): the server was installed with a
 * one-time claim token so nobody else can adopt it. Expires — setup is
 * expected to happen right after install.
 */
export const iamClaim = {
  token: "npx-claim-7F3K-9Q2M",
  issued_at: "2026-11-06T09:00:00Z",
  expires_at: "2026-11-06T19:00:00Z",
};

/** Standing policy cards for UX-IAM-008 (roles & access policies). */
export interface IamPolicy {
  id: string;
  title: string;
  body: string;
  source: string;
}

export const iamPolicies: IamPolicy[] = [
  {
    id: "pol_second_person_firewall",
    title: "Second-person approval for firewall changes",
    body: "Any firewall rule change is submitted as a plan and needs a second person to approve it before it applies. Kevin's request to allow 8443/tcp is waiting in the approvals inbox right now — one person can never open a port alone.",
    source: "UXT-029 · FLOW-009",
  },
  {
    id: "pol_step_up",
    title: "Step-up re-authentication for sensitive actions",
    body: "Actions the API marks sensitive (firewall apply, hosting-account suspend, payment reverse) ask for a fresh MFA code. The step-up token is short-lived and bound to that exact action + resource — it cannot be replayed elsewhere.",
    source: "POST /me/step-up · Stage 6 §2",
  },
  {
    id: "pol_session_lifetime",
    title: "Session lifetime and revocation",
    body: "Web sessions are HttpOnly, Secure, SameSite cookies — no bearer tokens in localStorage. Sessions rotate on privilege change, can be revoked per device from Sessions & devices, and every revocation writes an audit event.",
    source: "Stage 6 §2 Auth and session",
  },
];

/** Role options for the invite modal — paired with the persona hint blurb. */
export const iamInviteRoles: { role: RoleLabel; persona_hint: PersonaId }[] = [
  { role: "owner", persona_hint: "website_owner" },
  { role: "developer", persona_hint: "app_developer" },
  { role: "customer", persona_hint: "storage_user" },
  { role: "reseller", persona_hint: "reseller" },
  { role: "support", persona_hint: "infrastructure_user" },
  { role: "auditor", persona_hint: "infrastructure_user" },
];
