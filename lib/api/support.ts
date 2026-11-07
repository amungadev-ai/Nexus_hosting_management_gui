import type { AuditEvent, Operation } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { migrationConflicts, migrations, tickets, type Migration, type MigrationConflict, type Ticket } from "@/lib/mock/support";
import { operations } from "@/lib/operations";
import { currentOrganization, currentUser } from "@/lib/api/me";
import { newId, problem, ApiError } from "@/lib/api/core";

/**
 * Support mock API. Support access is modelled as audit + permission concern
 * (Stage 6 §4.13 note) — creating a grant updates the shared demo grant and
 * the audit chain; migrations and lifecycle actions submit real operations.
 */

function actor(): { actor_id: string; organization_id: string } {
  return { actor_id: currentUser().id, organization_id: currentOrganization().id };
}

function pushAudit(action: string, resource: AuditEvent["resource"], supportContext?: AuditEvent["support_context"]): void {
  const last = db.audit[0];
  db.audit.unshift({
    id: newId("aud"),
    action,
    actor_id: currentUser().id,
    actor_label: `${currentUser().display_name} (${currentUser().role_labels[0] ?? "member"})`,
    organization_id: currentOrganization().id,
    resource,
    outcome: "succeeded",
    occurred_at: new Date().toISOString(),
    support_context: supportContext,
    previous_hash: last?.record_hash ?? "sha256:genesis",
    record_hash: "sha256:demo-link",
  });
}

/* ------------------------------------------------------------------ */
/* Tickets (UX-SUP-001)                                                */
/* ------------------------------------------------------------------ */

export function createTicket(input: { subject: string; body: string; share_diagnostics: boolean }): Ticket {
  if (input.subject.trim().length < 4) {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Subject too short", "Describe the problem in a few words so support can route the ticket."));
  }
  const ticket: Ticket = {
    id: newId("tkt"),
    subject: input.subject.trim(),
    status: "open",
    channel: "panel",
    updated_at: new Date().toISOString(),
    messages: [
      {
        author: `${currentUser().display_name} (you)`,
        body: input.body.trim() + (input.share_diagnostics ? "\n\n[Diagnostics shared: recent operation outcomes for this organization — redacted.]" : ""),
        at: new Date().toISOString(),
      },
    ],
  };
  tickets.unshift(ticket);
  pushAudit("support.ticket.created", { type: "ticket", id: ticket.id, name: ticket.subject });
  return ticket;
}

export function resolveTicket(id: string): void {
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) throw new ApiError(problem(404, "NOT_FOUND", "Ticket not found", "That ticket does not exist."));
  ticket.status = "resolved";
  ticket.updated_at = new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* Support access grants (demo of the DS-019 banner + audit trail)     */
/* ------------------------------------------------------------------ */

export type GrantScope = "read-only" | "extended";

export function createSupportGrant(input: { engineer_name: string; scope: GrantScope; reason: string; hours: number }): void {
  if (input.reason.trim().length < 8) {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Reason required", "Justify the grant in at least a short sentence — it is recorded in the audit chain."));
  }
  const expires = new Date(Date.now() + input.hours * 3600 * 1000).toISOString();
  db.supportGrant.active = true;
  db.supportGrant.actor = input.engineer_name;
  db.supportGrant.reason = input.reason.trim();
  db.supportGrant.scope = `${input.scope}${input.scope === "read-only" ? ", operations and backups" : ", includes safe recovery actions"}`;
  db.supportGrant.expires_at = expires;
  pushAudit("support.access.granted", { type: "organization", id: currentOrganization().id }, { actor: input.engineer_name, reason: input.reason.trim(), expires_at: expires });
}

export function revokeSupportGrant(): void {
  db.supportGrant.active = false;
  pushAudit("support.access.revoked", { type: "organization", id: currentOrganization().id });
}

/* ------------------------------------------------------------------ */
/* Migrations (UX-SUP-002/003/011)                                     */
/* ------------------------------------------------------------------ */

export function ensureMigrationOperations(): void {
  for (const mig of migrations) {
    if (mig.operation_id) continue;
    if (mig.state === "running") {
      const op = operations.submit({
        kind: "migration.import",
        title: `Import — ${mig.source_label}`,
        resource_ref: { type: "migration", id: mig.id, name: mig.source_label },
        workload_category: "batch",
        step_titles: ["Fetch source inventory", "Dry-run import", "Copy files and databases", "Verify checksums", "Cut over DNS guidance"],
        step_ms: 900,
        yields_once: true,
        ...actor(),
      });
      mig.operation_id = op.id;
    } else if (mig.state === "completed") {
      const op = operations.submit({
        kind: "migration.import",
        title: `Import — ${mig.source_label}`,
        resource_ref: { type: "migration", id: mig.id, name: mig.source_label },
        workload_category: "batch",
        step_titles: ["Fetch source inventory", "Copy files and databases", "Verify checksums"],
        step_ms: 60,
        outcome: "succeeded",
        ...actor(),
      });
      // History happened in the past — finish it immediately and honestly.
      op.status = "succeeded";
      op.progress = { completed_steps: 3, total_steps: 3 };
      for (const step of op.steps) step.status = "succeeded";
      mig.operation_id = op.id;
    }
  }
}

export function startMigration(input: { source_url: string; host_label: string }): { migration: Migration; operation_id: string } {
  let parsed: URL;
  try {
    parsed = new URL(input.source_url);
  } catch {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Invalid source URL", "Enter the full cPanel URL, for example https://server.example.com:2083."));
  }
  if (parsed.protocol !== "https:") {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "HTTPS required", "The migration source must be reached over HTTPS."));
  }
  const migration: Migration = {
    id: newId("mig"),
    source_label: `cPanel import — ${parsed.hostname}`,
    kind: "cpanel_import",
    state: "running",
    items: 0,
    conflicts: 0,
    started_at: new Date().toISOString(),
  };
  migrations.unshift(migration);
  const op = operations.submit({
    kind: "migration.import",
    title: `Import — ${migration.source_label}`,
    resource_ref: { type: "migration", id: migration.id, name: migration.source_label },
    workload_category: "batch",
    step_titles: ["Fetch source inventory", "Dry-run import", "Copy files and databases", "Verify checksums", "Cut over DNS guidance"],
    step_ms: 800,
    yields_once: true,
    ...actor(),
  });
  migration.operation_id = op.id;
  return { migration, operation_id: op.id };
}

export function migrationById(id: string): Migration | undefined {
  return migrations.find((m) => m.id === id);
}

/** Discards a migration that is paused at the conflict-review stage (registry: Rollback). */
export function rollbackMigration(migrationId: string): Operation {
  const migration = migrationById(migrationId);
  if (!migration) throw new ApiError(problem(404, "NOT_FOUND", "Migration not found", "That migration does not exist."));
  migration.state = "rolled_back";
  migration.conflicts = 0;
  const op = operations.submit({
    kind: "migration.rollback",
    title: `Roll back import — ${migration.source_label}`,
    resource_ref: { type: "migration", id: migration.id, name: migration.source_label },
    workload_category: "batch",
    step_titles: ["Verify nothing was cut over", "Remove staged import data", "Record rollback in audit"],
    ...actor(),
  });
  migration.operation_id = op.id;
  return op;
}

export function conflictsFor(migrationId: string): MigrationConflict[] {
  return migrationConflicts.filter((c) => c.migration_id === migrationId);
}

/** Applies keep/skip/rename resolutions as a durable operation, then resumes the import. */
export function applyConflictResolutions(migrationId: string, resolutions: Map<string, { resolution: MigrationConflict["resolution"]; rename: string }>) {
  const migration = migrationById(migrationId);
  if (!migration) throw new ApiError(problem(404, "NOT_FOUND", "Migration not found", "That migration does not exist."));
  for (const conflict of migrationConflicts) {
    const chosen = resolutions.get(conflict.id);
    if (chosen) {
      conflict.resolution = chosen.resolution;
      conflict.rename_value = chosen.rename;
    }
  }
  migration.conflicts = 0;
  migration.state = "running";
  const op = operations.submit({
    kind: "migration.resolve",
    title: `Apply conflict resolutions — ${migration.source_label}`,
    resource_ref: { type: "migration", id: migration.id, name: migration.source_label },
    workload_category: "batch",
    step_titles: ["Apply keep/skip/rename resolutions", "Re-run conflict check", "Resume import and verify"],
    ...actor(),
  });
  migration.operation_id = op.id;
  return op;
}

/* ------------------------------------------------------------------ */
/* Lifecycle: transfer, closure, system operations                     */
/* ------------------------------------------------------------------ */

export function requestOwnershipTransfer(targetEmail: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail)) {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Invalid owner email", "Enter the new owner's full email address."));
  }
  const op = operations.submit({
    kind: "hosting-account.transfer",
    title: `Ownership transfer to ${targetEmail}`,
    resource_ref: { type: "organization", id: currentOrganization().id, name: currentOrganization().name },
    workload_category: "infrastructure",
    step_titles: ["Verify new owner identity", "Transfer resources and grants", "Record audit entry", "Notify both owners"],
    ...actor(),
  });
  pushAudit("hosting_account.transfer_requested", { type: "organization", id: currentOrganization().id, name: currentOrganization().name });
  return op;
}

export function exportAccountData() {
  return operations.submit({
    kind: "data.export",
    title: "Export account data (redacted)",
    resource_ref: { type: "organization", id: currentOrganization().id, name: currentOrganization().name },
    workload_category: "batch",
    step_titles: ["Collect configuration and content", "Redact secrets", "Package archive", "Verify archive checksum"],
    ...actor(),
  });
}

export function closeAccount() {
  const op = operations.submit({
    kind: "account.close",
    title: `Close ${currentOrganization().name} — scheduled`,
    resource_ref: { type: "organization", id: currentOrganization().id, name: currentOrganization().name },
    workload_category: "infrastructure",
    step_titles: ["Verify export exists", "Schedule closure after grace window", "Notify owner", "Record irreversible audit entry"],
    ...actor(),
  });
  pushAudit("organization.close_requested", { type: "organization", id: currentOrganization().id, name: currentOrganization().name });
  return op;
}

/** Import side of UX-SUP-004: restores a previously exported (redacted) config archive. */
export function importDataArchive(manifestJson: string) {
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Manifest is not valid JSON", "Paste the manifest JSON that came with the export archive."));
  }
  const kind = typeof manifest === "object" && manifest !== null && "kind" in manifest
    ? String((manifest as { kind: unknown }).kind)
    : "";
  if (kind !== "nexuspanel-export") {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Not a NexusPanel export", "The manifest must include \"kind\": \"nexuspanel-export\". Refusing to import unknown archives."));
  }
  return operations.submit({
    kind: "data.import",
    title: "Import configuration archive (redacted)",
    resource_ref: { type: "organization", id: currentOrganization().id, name: currentOrganization().name },
    workload_category: "batch",
    step_titles: ["Verify archive checksum", "Redact-check secrets", "Apply configuration", "Verify panel health"],
    ...actor(),
  });
}

/** UX-SUP-007 step 1 — read-only check against the release channel. */
export function checkPanelUpdates() {
  return operations.submit({
    kind: "panel.update.check",
    title: "Check for panel updates",
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: ["Contact update channel", "Compare versions", "Fetch release notes"],
    ...actor(),
  });
}

export function runInstallerRepair() {
  return operations.submit({
    kind: "system.repair",
    title: "Repair installer state",
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: ["Re-run preflight checks", "Repair module state", "Verify panel health"],
    ...actor(),
  });
}

export function schedulePanelUpgrade(version: string) {
  return operations.submit({
    kind: "panel.upgrade",
    title: `Upgrade panel to ${version}`,
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: ["Verify recent backup", "Download and validate release", "Apply upgrade", "Health-check panel"],
    ...actor(),
  });
}

export function enableRescueMode() {
  return operations.submit({
    kind: "system.rescue",
    title: "Enable rescue mode",
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: ["Notify sessions", "Switch to offline-safe runbook", "Verify out-of-band access"],
    ...actor(),
  });
}

/** Leaves rescue mode: serving stack restarts, health checks verify recovery. */
export function exitRescueMode() {
  return operations.submit({
    kind: "system.rescue.exit",
    title: "Exit rescue mode",
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: ["Stop rescue runbook", "Restart serving stack", "Verify health checks"],
    ...actor(),
  });
}

/** UX-SUP-009 — plans a VPS tier upgrade; the resize itself happens at the provider. */
export function planVpsUpgrade(targetLabel: string) {
  return operations.submit({
    kind: "vps.upgrade.plan",
    title: `Plan VPS upgrade — ${targetLabel}`,
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: ["Validate target profile fit", "Draft capability delta", "Send plan to provider", "Schedule maintenance window"],
    ...actor(),
  });
}

/** The ladder paying off — UXD-032 rescan (Stage 6 §4.15: kind capability.rescan). */
export function rescanHardware() {
  return operations.submit({
    kind: "capability.rescan",
    title: "Rescan hardware capabilities",
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "batch",
    step_titles: ["Detect hardware", "Compute capability set", "Diff against current set"],
    ...actor(),
  });
}

export function exportTemplateInstance(instanceId: string, instanceName: string) {
  return operations.submit({
    kind: "service.export",
    title: `Export ${instanceName} as OCI artifact`,
    resource_ref: { type: "service_instance", id: instanceId, name: instanceName },
    workload_category: "batch",
    step_titles: ["Quiesce writes", "Package volume as OCI artifact", "Sign manifest", "Verify digest"],
    ...actor(),
  });
}

export function importTemplateArtifact(digest: string) {
  if (!/^sha256:[0-9a-f]{8,64}$/.test(digest.trim())) {
    throw new ApiError(problem(422, "TEMPLATE_SIGNATURE_INVALID", "Invalid artifact digest", "Enter the sha256:… digest printed next to the exported artifact."));
  }
  return operations.submit({
    kind: "service.import",
    title: "Import ServiceTemplate artifact",
    resource_ref: { type: "service_instance", id: digest.slice(0, 19), name: "imported instance" },
    workload_category: "batch",
    step_titles: ["Verify artifact signature", "Restore volume", "Start instance", "Health-check"],
    ...actor(),
  });
}
