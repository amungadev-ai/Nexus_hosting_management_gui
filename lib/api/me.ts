import type {
  PersonaId,
  PersonaMatrixRow,
  CapabilityRecord,
  ProfileId,
  RoleLabel,
  UserAccount,
  Organization,
} from "@/lib/types";
import { db } from "@/lib/mock/data";
import { capabilitiesFor, PROFILES } from "@/lib/profiles";
import { PERSONA_BY_ID } from "@/lib/personas";
import { ok, withLatency, ApiError, problem } from "@/lib/api/core";

/**
 * GET /me, /me/capabilities, /me/persona-matrix, /me/default-landing —
 * the SPA bootstrap endpoints (Stage 6 §3). The UI composes its landing and
 * navigation from these, never from client-side role logic.
 */

export function currentUser(): UserAccount {
  const user = db.users.find((u) => u.id === db.currentUser);
  if (!user) throw new ApiError(problem(401, "UNAUTHENTICATED", "Not signed in", "Your session has ended. Sign in again."));
  return user;
}

export function currentOrganization(): Organization {
  return db.organizations.find((o) => o.id === db.currentOrganization) ?? db.organizations[0];
}

export async function getMe() {
  return withLatency(() => {
    const user = currentUser();
    const org = currentOrganization();
    return ok({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      status: user.status,
      mfa_enabled: user.mfa_enabled,
      effective_context: {
        organization: {
          id: org.id,
          slug: org.slug,
          organization_type: org.organization_type,
          primary_persona: org.primary_persona,
          branding: { logo_url: null, colors: {}, domain: null },
        },
        memberships: db.organizations.map((o) => ({ organization_id: o.id, state: "active", persona_override: null })),
        role_labels: user.role_labels,
        step_up_required_for: ["firewall.apply", "hosting-account.suspend", "payment.reverse"],
      },
    });
  });
}

/** Capability records for the CURRENT demo profile (the installer's signed file). */
export async function getMyCapabilities(profile: ProfileId) {
  return withLatency(() => {
    const records = capabilitiesFor(profile);
    const data = {
      data_version: "2026-11-06.3",
      digest: "sha256:9f1c02ba7d54e8a1",
      permissions: [
        "server.read", "server.manage", "website.deploy", "domain.dns.write",
        "backup.restore", "security.firewall.write", "billing.read", "audit.read",
        "service.create", "service.manage", "capability.read", "capability.rescan",
        "template.deploy", "workload.usage.read", "approval.decide",
      ],
      server_capabilities: records.map((r) => ({
        capability_key: r.capability_key,
        workload_category: r.workload_category,
        state: r.state,
        reason: r.reason,
      })),
    };
    return ok(data);
  });
}

/** Persona × capability matrix (signed in production; demo returns fixed rows). */
export async function getPersonaMatrix(persona: PersonaId) {
  return withLatency(() => {
    const rows: PersonaMatrixRow[] = personaRowsFor(persona);
    return ok({
      persona,
      rows,
      data_version: "2026-11-06.3",
      digest: "sha256:4ab219ce05d7",
      signature: "ed25519:bb31c5f0a298",
      signature_algorithm: "ed25519",
    });
  });
}

/** GET /me/default-landing → router | portfolio | fleet (values verbatim Stage 6 §3). */
export function landingFor(persona: PersonaId, firstRun: boolean): "router" | "portfolio" | "fleet" {
  if (firstRun) return "router";
  return PERSONA_BY_ID[persona].landing;
}

export async function getDefaultLanding(persona: PersonaId, firstRun: boolean) {
  return withLatency(() =>
    ok({
      default_landing: landingFor(persona, firstRun),
      persona,
      organization_primary_persona: currentOrganization().primary_persona,
      basis: { capabilities_matched: 4, persona_matrix_version: "2026-11-06.3" },
    })
  );
}

/** POST /me/step-up — short-lived token bound to action + resource. */
export async function requestStepUp(action: string, resourceId: string) {
  return withLatency(() => {
    if (action === "denied.demo") {
      throw new ApiError(problem(401, "MFA_CHALLENGE_FAILED", "Verification failed", "That code did not match. Two attempts remaining."));
    }
    return ok({
      step_up_token: `sud_01J${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      bound_action: action,
      bound_resource_id: resourceId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  }, 600);
}

/**
 * Persona rows — which capabilities each persona sees on which surface.
 * The router reads default_landing rows; menus read visible_menu; hidden rows
 * stay undiscoverable (prohibited ≠ capability-unavailable).
 */
export function personaRowsFor(persona: PersonaId): PersonaMatrixRow[] {
  const all: [string, PersonaMatrixRow["surface"], string | null][] = [
    ["website.static", "default_landing", null],
    ["website.php", "default_landing", null],
    ["app.node", "default_landing", null],
    ["service.storage", "visible_menu", null],
    ["db.mariadb", "visible_menu", "runs when the server can host databases"],
    ["mail.external_smtp", "visible_menu", null],
    ["backup.local", "visible_menu", null],
    ["terminal.exec", "visible_menu", null],
    ["commercial.surface", "visible_menu", null],
  ];
  switch (persona) {
    case "self_hoster":
    case "explorer":
      return all.map(([capability_key, surface, notes]) => ({
        capability_key,
        surface: surface === "default_landing" ? "default_landing" : "visible_menu",
        notes,
      }));
    case "website_owner":
      return all.slice(0, 6).map(([capability_key, surface, notes]) => ({
        capability_key,
        surface: surface === "default_landing" ? "default_landing" : "visible_menu",
        notes,
      }));
    case "app_developer":
      return [
        { capability_key: "app.node", surface: "default_landing", notes: null },
        { capability_key: "website.static", surface: "visible_menu", notes: null },
        { capability_key: "db.postgres", surface: "visible_menu", notes: null },
        { capability_key: "service.storage", surface: "visible_menu", notes: null },
        { capability_key: "terminal.exec", surface: "visible_menu", notes: null },
      ];
    case "storage_user":
      return [
        { capability_key: "website.static", surface: "default_landing", notes: null },
        { capability_key: "service.storage", surface: "visible_menu", notes: null },
      ];
    case "reseller":
      return [
        { capability_key: "website.php", surface: "default_landing", notes: null },
        { capability_key: "commercial.surface", surface: "default_landing", notes: null },
        { capability_key: "mail.mailboxes", surface: "visible_menu", notes: null },
      ];
    case "provider_admin":
      return all.map(([capability_key]) => ({ capability_key, surface: "visible_menu" as const, notes: null }));
    case "infrastructure_user":
      return [
        { capability_key: "server.read", surface: "default_landing", notes: null },
        { capability_key: "backup.local", surface: "visible_menu", notes: null },
      ];
  }
}

/** Profile switcher helper used by the shell (the demo's "which VPS did I buy"). */
export function profileSummary(profile: ProfileId): string {
  return PROFILES[profile].summary;
}

/** Role labels for the signed-in user (UI concepts only). */
export function roleLabels(): RoleLabel[] {
  return currentUser().role_labels;
}
