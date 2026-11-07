import type { PersonaId, PresentationMode, ProfileId, RoleLabel } from "@/lib/types";

/**
 * Personas are jobs-to-be-done, NOT permission identities (Stage 3 §0:
 * "persona ≠ permission"). Guided / Standard / Expert are presentation modes
 * with identical permissions. The switcher exists so every persona's landing,
 * navigation emphasis and honest states can be demoed.
 *
 * The six user-facing buckets from the product documents map onto the API's
 * eight persona identifiers (Stage 5 inventory.persona_capability_matrix):
 *   Solo VPS owner          → website_owner / self_hoster / explorer
 *   Hosting customer        → (customer role label; persona storage_user)
 *   Developer               → app_developer
 *   Reseller                → reseller
 *   Provider operator       → provider_admin
 *   Support / billing / auditor → support & auditor role labels (function)
 */

export interface PersonaDef {
  id: PersonaId;
  label: string;
  bucket: string; // the six buckets the product documents use
  role_labels: RoleLabel[];
  /** GET /me/default-landing → router | portfolio | fleet (Stage 6 §3). */
  landing: "router" | "portfolio" | "fleet";
  blurb: string;
}

export const PERSONAS: PersonaDef[] = [
  {
    id: "self_hoster",
    label: "Solo VPS owner (first-run)",
    bucket: "Solo VPS owner",
    role_labels: ["owner"],
    landing: "router",
    blurb: "“What do you want to run?” — the guided router is the primary IA. Owner of one VPS, non-technical.",
  },
  {
    id: "website_owner",
    label: "Solo VPS owner (returning)",
    bucket: "Solo VPS owner",
    role_labels: ["owner"],
    landing: "portfolio",
    blurb: "Manage what I already have — the service portfolio is the primary IA.",
  },
  {
    id: "explorer",
    label: "Explorer (not sure yet)",
    bucket: "Solo VPS owner",
    role_labels: ["owner"],
    landing: "router",
    blurb: "Fell through “I'm not sure yet” — starts at the router with the capability display fallback.",
  },
  {
    id: "storage_user",
    label: "Hosting customer",
    bucket: "Hosting customer",
    role_labels: ["customer"],
    landing: "portfolio",
    blurb: "Uses what was provisioned for them: their site, their invoices, their backups. No infrastructure menus.",
  },
  {
    id: "app_developer",
    label: "Developer",
    bucket: "Developer",
    role_labels: ["developer"],
    landing: "router",
    blurb: "“Deploy my app with hosting depth” — git deploys, env vars, processes, logs.",
  },
  {
    id: "reseller",
    label: "Reseller",
    bucket: "Reseller",
    role_labels: ["reseller"],
    landing: "portfolio",
    blurb: "Runs hosting accounts and customers under their own brand. Commercial surface (v2+ gate on v1).",
  },
  {
    id: "provider_admin",
    label: "Provider operator",
    bucket: "Provider operator",
    role_labels: ["provider"],
    landing: "portfolio",
    blurb: "Fleet, placement, service roles, reseller delegation, licensing. Commercial surface (v2+).",
  },
  {
    id: "infrastructure_user",
    label: "Support / billing / auditor",
    bucket: "Support / billing / auditor",
    role_labels: ["support", "auditor"],
    landing: "fleet",
    blurb: "Function-based access: read operations, audit chain, support access grants. Every action audited.",
  },
];

export const PERSONA_BY_ID: Record<PersonaId, PersonaDef> = Object.fromEntries(
  PERSONAS.map((p) => [p.id, p])
) as Record<PersonaId, PersonaDef>;

export const PRESENTATION_MODES: { id: PresentationMode; label: string; blurb: string }[] = [
  {
    id: "guided",
    label: "Guided",
    blurb: "Router, portfolio and guided flows front-and-center. The full menu is demoted behind “Advanced tools”.",
  },
  {
    id: "standard",
    label: "Standard",
    blurb: "Grouped navigation with progressive disclosure. The default for day-to-day operation.",
  },
  {
    id: "expert",
    label: "Expert",
    blurb: "Compact density, deep controls surfaced, full menu expanded. Same permissions — presentation only.",
  },
];

/**
 * Which navigation modules each presentation mode emphasizes (Stage 3 §2.3:
 * disclosure, never removal — permitted capability is never hidden by mode).
 */
export function moduleExposure(
  mode: PresentationMode
): "router-first" | "grouped" | "expanded" {
  if (mode === "guided") return "router-first";
  if (mode === "standard") return "grouped";
  return "expanded";
}

/** The organization switcher demo set (DS-002). */
export const ORGANIZATIONS: {
  id: string;
  name: string;
  type: "standalone" | "provider" | "reseller" | "customer";
  profile_hint: ProfileId;
}[] = [
  { id: "org_01JKV7Q4N2", name: "Wanjiku Digital (my VPS)", type: "standalone", profile_hint: "nano" },
  { id: "org_01JKV8Z9P3", name: "Jamii Hosting Ltd", type: "provider", profile_hint: "provider" },
];
