import type { ApiToken, Organization, Operation, SessionDevice } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { iamClaim, iamInvites, type IamInvite } from "@/lib/mock/iam";
import { ApiError, failWith, newId, problem, withLatency } from "@/lib/api/core";
import { operations } from "@/lib/operations";
import { currentOrganization, currentUser } from "@/lib/api/me";

/**
 * IAM module API client — the mock stand-ins for the Stage 6 §2/§4.3
 * identity endpoints. Screens call these; when the Go control plane exists
 * each body swaps for a fetch of the same shape. Mutations that provision or
 * change durable state go through operations.submit() (202 + operation);
 * plain creates/revocations (invitations, tokens, sessions) follow their
 * real HTTP semantics (201 created / 204 no body) and are applied directly.
 */

function actorContext(): { actor_id: string; organization_id: string } {
  return { actor_id: currentUser().id, organization_id: currentOrganization().id };
}

/* ------------------------------------------------------------------ */
/* Organizations (UX-IAM-005 / UX-IAM-006)                             */
/* ------------------------------------------------------------------ */

/** GET /organizations — owned organizations and memberships. */
export async function listOrganizations(): Promise<Organization[]> {
  return withLatency(() => db.organizations.map((o) => ({ ...o })));
}

/** POST /organizations — 202 + operation (a control-plane mutation). */
export async function createOrganization(input: {
  name: string;
  organization_type: Organization["organization_type"];
}): Promise<{ organization: Organization; operation: Operation }> {
  const spec = input;
  return withLatency(() => {
    const organization: Organization = {
      id: newId("org"),
      slug: spec.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "new-organization",
      name: spec.name,
      organization_type: spec.organization_type,
      primary_persona: null,
    };
    const operation = operations.submit({
      kind: "organization.create",
      title: `Create organization ${organization.name}`,
      resource_ref: { type: "organization", id: organization.id, name: organization.name },
      workload_category: "infrastructure",
      step_titles: ["Validate name and type", "Provision organization record", "Link owner membership"],
      ...actorContext(),
    });
    return { organization, operation };
  }, 350);
}

/* ------------------------------------------------------------------ */
/* Invitations (UX-IAM-006 / UX-IAM-007)                               */
/* ------------------------------------------------------------------ */

/** GET /organizations/{id}/invitations?state=pending */
export async function listInvites(organizationId?: string): Promise<IamInvite[]> {
  return withLatency(() =>
    iamInvites.filter((i) => organizationId === undefined || i.organization_id === organizationId)
  );
}

/** POST /organizations/{id}/invitations — 201 created. */
export async function inviteMember(input: {
  organization_id: string;
  email: string;
  role_labels: IamInvite["role_labels"];
  persona_hint: IamInvite["persona_hint"];
}): Promise<IamInvite> {
  return withLatency(() => {
    const invite: IamInvite = {
      id: newId("inv"),
      organization_id: input.organization_id,
      email: input.email,
      role_labels: input.role_labels,
      persona_hint: input.persona_hint,
      invited_by: currentUser().id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      state: "pending",
    };
    iamInvites.push(invite);
    return invite;
  }, 300);
}

/** DELETE /invitations/{id} — 204 no body. */
export async function revokeInvite(inviteId: string): Promise<void> {
  await withLatency(() => {
    const idx = iamInvites.findIndex((i) => i.id === inviteId);
    if (idx >= 0) iamInvites.splice(idx, 1);
    return true;
  }, 250);
}

/* ------------------------------------------------------------------ */
/* Sessions (UX-IAM-009) — GET/DELETE /me/sessions                     */
/* ------------------------------------------------------------------ */

export async function listSessions(): Promise<SessionDevice[]> {
  return withLatency(() => db.sessions.map((s) => ({ ...s })), 220);
}

/** DELETE /me/sessions/{id} — 204 + audit event. */
export async function revokeSession(sessionId: string): Promise<void> {
  await withLatency(() => {
    const idx = db.sessions.findIndex((s) => s.id === sessionId);
    if (idx >= 0) db.sessions.splice(idx, 1);
    return true;
  }, 250);
}

/** POST /me/sessions/revoke-others — 204, audited, step-up protected. */
export async function revokeAllOtherSessions(): Promise<number> {
  return withLatency(() => {
    let n = 0;
    for (let i = db.sessions.length - 1; i >= 0; i--) {
      if (!db.sessions[i].current) {
        db.sessions.splice(i, 1);
        n += 1;
      }
    }
    return n;
  }, 300);
}

/* ------------------------------------------------------------------ */
/* API tokens (UX-IAM-010) — GET/POST/DELETE /api-tokens               */
/* ------------------------------------------------------------------ */

export interface CreatedToken {
  token: ApiToken;
  /** The full secret — returned ONCE at creation, never retrievable again. */
  secret: string;
}

export async function listApiTokens(): Promise<ApiToken[]> {
  return withLatency(() => db.apiTokens.map((t) => ({ ...t })), 220);
}

/** POST /api-tokens — 201; write-only secret, hashed at rest on the server. */
export async function createApiToken(input: {
  name: string;
  scopes: string[];
  expires_in_days: number | null;
}): Promise<CreatedToken> {
  return withLatency(() => {
    if (input.scopes.length === 0) {
      failWith(
        problem(422, "TOKEN_SCOPES_REQUIRED", "No scopes selected", "Select at least one scope — tokens are least-privilege by default.")
      );
    }
    const secret = `np_${newId("tok").slice(4).toLowerCase()}${Math.random().toString(36).slice(2, 10)}`;
    const token: ApiToken = {
      id: newId("tok"),
      name: input.name,
      scopes: [...input.scopes],
      created_at: new Date().toISOString(),
      last_used_at: null,
      expires_at:
        input.expires_in_days === null
          ? null
          : new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000).toISOString(),
      masked_secret: `${secret.slice(0, 10)}••••••••`,
    };
    db.apiTokens.push(token);
    return { token: { ...token }, secret };
  }, 350);
}

/** DELETE /api-tokens/{id} — 204 + audit event. */
export async function revokeApiToken(tokenId: string): Promise<void> {
  await withLatency(() => {
    const idx = db.apiTokens.findIndex((t) => t.id === tokenId);
    if (idx >= 0) db.apiTokens.splice(idx, 1);
    return true;
  }, 250);
}

/* ------------------------------------------------------------------ */
/* Installation claim + owner bootstrap (UX-IAM-001 / UX-IAM-002)      */
/* ------------------------------------------------------------------ */

/** POST /setup/claim — one-time adoption of this installation. */
export async function claimInstallation(input: {
  server_ip: string;
  claim_token: string;
}): Promise<Operation> {
  return withLatency(() => {
    if (input.claim_token.trim() !== iamClaim.token) {
      failWith(
        problem(403, "CLAIM_TOKEN_INVALID", "Claim token rejected", "That claim token does not match this installation. Copy it from the installer output on the server.")
      );
    }
    return operations.submit({
      kind: "panel.claim",
      title: "Claim this NexusPanel installation",
      resource_ref: { type: "server", id: db.server.id, name: db.server.name },
      workload_category: "infrastructure",
      step_titles: ["Verify claim token", "Bind owner identity to server", "Mark installation claimed"],
      ...actorContext(),
    });
  }, 400);
}

export interface OwnerBootstrap {
  operation: Operation;
  /** Recovery codes — shown once, hashed at rest (DS-008). */
  recovery_codes: string[];
}

/** POST /setup/owner — create the owner identity + MFA factor (FLOW-013 gate). */
export async function bootstrapOwner(input: {
  display_name: string;
  email: string;
  password: string;
  mfa_code: string;
}): Promise<OwnerBootstrap> {
  return withLatency(() => {
    if (!/^\d{6}$/.test(input.mfa_code.trim())) {
      failWith(
        problem(422, "MFA_CODE_INVALID", "Invalid authenticator code", "Enter the 6-digit code from your authenticator app to confirm MFA setup.")
      );
    }
    const recovery_codes = Array.from({ length: 8 }, (_, i) => {
      const block = () => Math.random().toString(36).slice(2, 6).toUpperCase();
      return `npx-${block()}-${block()}-${String(i + 1).padStart(2, "0")}`;
    });
    const operation = operations.submit({
      kind: "panel.owner_bootstrap",
      title: "Create owner account and MFA",
      resource_ref: { type: "user", id: "usr_owner_new", name: input.display_name },
      workload_category: "infrastructure",
      step_titles: ["Create owner identity", "Bind MFA factor", "Hash and store recovery codes"],
      ...actorContext(),
    });
    return { operation, recovery_codes };
  }, 400);
}

/* ------------------------------------------------------------------ */
/* Support access grants (UX-IAM-011) — DS-019                         */
/* ------------------------------------------------------------------ */

export interface SupportGrantInput {
  engineer_id: string;
  scope: "read-only" | "extended";
  reason: string;
  duration_hours: 2 | 24;
}

export interface ActiveGrant {
  actor: string;
  scope: string;
  reason: string;
  granted_at: string;
  expires_at: string;
}

/** POST /support-grants — time-limited, reason required, audited. */
export async function grantSupportAccess(input: SupportGrantInput): Promise<ActiveGrant> {
  return withLatency(() => {
    if (input.reason.trim().length < 10) {
      failWith(
        problem(422, "GRANT_REASON_REQUIRED", "Reason too short", "Describe why support needs access — the reason is stored with the grant and every audited action.")
      );
    }
    const engineer = db.users.find((u) => u.id === input.engineer_id);
    const granted_at = new Date();
    return {
      actor: engineer?.display_name ?? "Support engineer",
      scope: input.scope === "read-only" ? "read-only" : "extended (may run safe diagnostics)",
      reason: input.reason.trim(),
      granted_at: granted_at.toISOString(),
      expires_at: new Date(granted_at.getTime() + input.duration_hours * 60 * 60 * 1000).toISOString(),
    };
  }, 350);
}

/* ------------------------------------------------------------------ */
/* Sign-in (UX-IAM-004) — POST /auth/login, /auth/mfa/verify           */
/* ------------------------------------------------------------------ */

/**
 * Demo auth contract (documented on the sign-in screen):
 *  - any well-formed email + any password EXCEPT `wrongpassword` succeeds;
 *    `wrongpassword` → 401 INVALID_CREDENTIALS with anti-enumeration copy.
 *  - MFA code `000000` → 401 MFA_CHALLENGE_FAILED with attempts remaining;
 *    any other 6-digit code succeeds. Recovery codes: any non-empty code.
 */
export async function signIn(email: string, password: string): Promise<{ mfa_required: true }> {
  return withLatency(() => {
    if (!email.includes("@") || email.length < 5) {
      failWith(problem(422, "VALIDATION_FAILED", "Check the email address", "Enter a valid email address to continue."));
    }
    if (password === "wrongpassword") {
      // Anti-enumeration: the copy never reveals whether the account exists.
      failWith(
        problem(401, "INVALID_CREDENTIALS", "Sign-in failed", "Invalid email or password. Reset your password or use a recovery code if you lost your MFA device.")
      );
    }
    return { mfa_required: true as const };
  }, 450);
}

export async function verifyMfaCode(code: string): Promise<{ verified: true }> {
  return withLatency(() => {
    if (!/^\d{6}$/.test(code.trim())) {
      failWith(problem(422, "MFA_CODE_INVALID", "Invalid code", "Enter the 6-digit code from your authenticator app."));
    }
    if (code.trim() === "000000") {
      failWith(
        problem(401, "MFA_CHALLENGE_FAILED", "Verification failed", "That code did not match. Two attempts remaining before the challenge is invalidated.")
      );
    }
    return { verified: true as const };
  }, 400);
}

export async function verifyRecoveryCode(code: string): Promise<{ verified: true }> {
  return withLatency(() => {
    if (code.trim().length < 6) {
      failWith(
        problem(401, "RECOVERY_CODE_INVALID", "Recovery code rejected", "That recovery code is not valid — each code works once. Try another code or contact support.")
      );
    }
    return { verified: true as const };
  }, 400);
}

/** Shared guard for unexpected ApiError handling in screens. */
export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
