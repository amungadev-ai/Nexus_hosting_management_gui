import type { Operation, ProfileId } from "@/lib/types";
import { db } from "@/lib/mock/data";
import {
  adminToolFor,
  connectionString,
  databases,
  databaseById,
  type DatabaseBackup,
  type DatabaseInstance,
  type DatabaseTransfer,
  type DatabaseUser,
  type DbEngine,
} from "@/lib/mock/databases";
import { capabilitiesFor } from "@/lib/profiles";
import { operations } from "@/lib/operations";
import { ApiError, newId, ok, problem, withLatency } from "@/lib/api/core";

/**
 * Mock API client for /databases (Stage 6 §4.9). The real /databases family
 * is a read-only view over /service-instances where template.category =
 * "database"; creation goes through POST /service-instances with template_id
 * database.mariadb / database.postgres — modeled here as a
 * "database.provision" operation. On Nano the list mirrors the spec response:
 * {"data": [], "meta": {"capability_unavailable": true, "reason": …}}.
 */

function actor(): { actor_id: string; organization_id: string } {
  return { actor_id: db.currentUser, organization_id: db.currentOrganization };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export interface DatabaseListResult {
  data: DatabaseInstance[];
  meta: { capability_unavailable: boolean; reason: string | null };
}

export async function listDatabases(profile: ProfileId): Promise<DatabaseListResult> {
  return withLatency(() => {
    if (profile === "nano") {
      const rec = capabilitiesFor(profile).find((c) => c.capability_key === "db.mariadb");
      return {
        data: [],
        meta: {
          capability_unavailable: true,
          reason: rec?.reason ?? "No room for a MariaDB/Postgres container on this VPS.",
        },
      };
    }
    return { data: databases, meta: { capability_unavailable: false, reason: null } };
  }, 220);
}

export async function getDatabase(id: string): Promise<DatabaseInstance> {
  return withLatency(() => {
    const record = databaseById(id);
    if (!record) {
      throw new ApiError(problem(404, "NOT_FOUND", "Database not found", "That database instance does not exist in this organization."));
    }
    return record;
  }, 180);
}

export { connectionString, adminToolFor };

/* ------------------------------------------------------------------ */
/* Provision (FLOW-006 → POST /service-instances)                      */
/* ------------------------------------------------------------------ */

export async function createDatabase(input: {
  engine: DbEngine;
  name: string;
  size_mb: number;
  backup_policy: string;
}): Promise<{ instance: DatabaseInstance; operation: Operation }> {
  const templateKey = input.engine === "mariadb" ? "database.mariadb" : "database.postgres";
  if (!/^[a-z][a-z0-9-]{2,30}$/.test(input.name)) {
    throw new ApiError(
      problem(422, "INVALID_DATABASE_NAME", "Invalid database name", "Use 3–31 lowercase letters, digits or hyphens, starting with a letter (e.g. kilishop-db).")
    );
  }
  if (databases.some((d) => d.display_name === input.name)) {
    throw new ApiError(problem(409, "NAME_CONFLICT", "Name already in use", `A database named ${input.name} already exists on this server.`));
  }

  const instance: DatabaseInstance = {
    id: newId("db"),
    display_name: input.name,
    engine: input.engine,
    engine_version: input.engine === "mariadb" ? "11.4 LTS" : "16",
    template_key: templateKey,
    state: "provisioning",
    hostname: `db.${input.name}.nairobi-01.wanjiku.digital`,
    port: input.engine === "mariadb" ? 3306 : 5432,
    database_name: input.name.replace(/-/g, "_"),
    tls: true,
    size_mb: 0,
    ram_ceiling_mb: input.engine === "mariadb" ? 900 : 1000,
    container_id: newId("c"),
    volume_id: newId("vol"),
    health: "unknown",
    last_health_check_at: new Date().toISOString(),
    backup_policy: input.backup_policy,
    users: [],
    backups: [],
    transfers: [],
    created_at: new Date().toISOString(),
  };

  const operation = operations.submit({
    kind: "database.provision", // agent typed action (Stage 6 §6.8)
    title: `Provision database ${input.name} (${input.engine})`,
    resource_ref: { type: "database", id: instance.id, name: instance.display_name },
    workload_category: "serving",
    step_titles: [
      "Validate name, quota and capability fit",
      "Allocate volume and pull engine image",
      "Start container and initialize schema",
      "Create least-privilege app user",
      "Verify connection with a real query",
    ],
    ...actor(),
  });
  instance.pending_operation_id = operation.id;
  databases.unshift(instance);

  // When the operation verifies, the instance becomes running (the UI never
  // marks completion itself).
  operations.subscribe((op) => {
    if (op.id !== operation.id) return;
    if (op.status === "succeeded") {
      instance.state = "running";
      instance.health = "healthy";
      instance.pending_operation_id = undefined;
      instance.size_mb = Math.round(input.size_mb / 8);
    }
    if (op.status === "failed" || op.status === "cancelled") {
      // A failed provision leaves no instance behind — honest list state.
      const idx = databases.findIndex((d) => d.id === instance.id);
      if (idx >= 0) databases.splice(idx, 1);
    }
  });

  return { instance, operation };
}

/* ------------------------------------------------------------------ */
/* Users and grants (UX-DB-004)                                        */
/* ------------------------------------------------------------------ */

/** POST /databases/{id}/users → 201 with the secret shown once. */
export async function createDatabaseUser(input: {
  dbId: string;
  principal_name: string;
  grants: string[];
  host_restriction: string;
}): Promise<{ user: DatabaseUser; secret_once: string }> {
  return withLatency(() => {
    const record = databaseById(input.dbId);
    if (!record) throw new ApiError(problem(404, "NOT_FOUND", "Database not found", "That database instance no longer exists."));
    if (!/^[a-z][a-z0-9_]{2,30}$/.test(input.principal_name)) {
      throw new ApiError(problem(422, "INVALID_PRINCIPAL", "Invalid user name", "Use 3–31 lowercase letters, digits or underscores, starting with a letter."));
    }
    if (record.users.some((u) => u.principal_name === input.principal_name)) {
      throw new ApiError(problem(409, "NAME_CONFLICT", "User already exists", `A database user named ${input.principal_name} already exists.`));
    }
    if (input.grants.includes("ALL PRIVILEGES")) {
      throw new ApiError(problem(422, "GRANT_POLICY", "Global superuser is never granted", "Grant only the privileges the app needs — no global superuser, per the least-privilege policy."));
    }
    const user: DatabaseUser = {
      id: newId("dbu"),
      principal_name: input.principal_name,
      grants: input.grants,
      host_restriction: input.host_restriction,
      created_at: new Date().toISOString(),
      last_rotated_at: null,
    };
    record.users.push(user);
    return { user, secret_once: `dbpass-${newId("s").slice(4)}` };
  }, 450);
}

/** POST /database-users/{id}/rotate-password — write-only credential. */
export async function rotateUserPassword(dbId: string, userId: string): Promise<Operation> {
  const record = databaseById(dbId);
  const user = record?.users.find((u) => u.id === userId);
  if (!record || !user) throw new ApiError(problem(404, "NOT_FOUND", "User not found", "That database user no longer exists."));
  user.last_rotated_at = new Date().toISOString();
  return operations.submit({
    kind: "database.user.rotate", // agent typed action (Stage 6 §6.8)
    title: `Rotate password — ${user.principal_name} @ ${record.display_name}`,
    resource_ref: { type: "database", id: record.id, name: record.display_name },
    workload_category: "serving",
    step_titles: ["Generate new credential", "Apply grant rotation", "Verify connection with the new secret"],
    ...actor(),
  });
}

/* ------------------------------------------------------------------ */
/* Backups, restore, transfers (batch workloads — DS-023)              */
/* ------------------------------------------------------------------ */

/** POST /databases/{id}/backups — batch operation, queues under contention. */
export async function backupNow(dbId: string): Promise<{ operation: Operation; snapshot: DatabaseBackup }> {
  const record = databaseById(dbId);
  if (!record) throw new ApiError(problem(404, "NOT_FOUND", "Database not found", "That database instance no longer exists."));
  const snapshot: DatabaseBackup = {
    id: newId("bak"),
    snapshot_at: new Date().toISOString(),
    size_mb: Math.max(8, Math.round(record.size_mb * 0.27)),
    consistency: "logical",
    verified: false,
    destination_label: "B2 bucket wanjiku-backups",
  };
  const operation = operations.submit({
    kind: "backup.create",
    title: `Backup ${record.display_name} on demand`,
    resource_ref: { type: "database", id: record.id, name: record.display_name },
    workload_category: "batch",
    yields_once: true,
    step_titles: [
      "Flush and lock for a consistent read",
      `Dump schema + data (${record.engine === "mariadb" ? "mysqldump" : "pg_dump"})`,
      "Compress and checksum",
      "Upload to B2 bucket wanjiku-backups",
      "Verify snapshot integrity",
    ],
    ...actor(),
  });
  operations.subscribe((op) => {
    if (op.id === operation.id && op.status === "succeeded") snapshot.verified = true;
  });
  record.backups.unshift(snapshot);
  return { operation, snapshot };
}

/** POST /databases/{id}/restore — governed; impact reviewed in the UI first. */
export async function restoreBackup(dbId: string, backupId: string): Promise<Operation> {
  const record = databaseById(dbId);
  const backup = record?.backups.find((b) => b.id === backupId);
  if (!record || !backup) throw new ApiError(problem(404, "NOT_FOUND", "Backup not found", "That snapshot no longer exists."));
  return operations.submit({
    kind: "backup.restore",
    title: `Restore ${record.display_name} from ${backup.snapshot_at.slice(0, 16).replace("T", " ")} UTC`,
    resource_ref: { type: "database", id: record.id, name: record.display_name },
    workload_category: "batch",
    yields_once: true,
    step_titles: [
      "Enumerate overwritten tables",
      "Download snapshot from B2",
      "Restore into a scratch schema",
      "Verify with a real query against the restored copy",
      "Swap schemas atomically",
    ],
    ...actor(),
  });
}

/** POST /databases/{id}/transfers direction=import — batch, preflighted. */
export async function importDump(input: { dbId: string; source: string; size_mb: number }): Promise<Operation> {
  const record = databaseById(input.dbId);
  if (!record) throw new ApiError(problem(404, "NOT_FOUND", "Database not found", "That database instance no longer exists."));
  if (input.size_mb > 512) {
    throw new ApiError(problem(422, "IMPORT_TOO_LARGE", "Import too large", "On this VPS imports are capped at 512 MB. Split the dump or import over the admin tool connection."));
  }
  const transfer: DatabaseTransfer = {
    id: newId("trf"),
    direction: "import",
    source: input.source,
    size_mb: input.size_mb,
    state: "queued",
    started_at: new Date().toISOString(),
    finished_at: null,
    checks: "schema and size preflight queued",
  };
  const operation = operations.submit({
    kind: "database.import",
    title: `Import ${input.source} into ${record.display_name}`,
    resource_ref: { type: "database", id: record.id, name: record.display_name },
    workload_category: "batch",
    yields_once: true,
    step_titles: ["Validate schema and size", "Stage upload", "Apply in a single transaction", "Verify row counts and foreign keys"],
    ...actor(),
  });
  operations.subscribe((op) => {
    if (op.id !== operation.id) return;
    if (op.status === "succeeded") {
      transfer.state = "succeeded";
      transfer.finished_at = new Date().toISOString();
      transfer.checks = "schema matched, foreign keys verified";
    }
    if (op.status === "failed" || op.status === "cancelled") {
      transfer.state = "failed";
      transfer.finished_at = new Date().toISOString();
      transfer.error = "Import did not verify — the transaction was rolled back, nothing changed.";
    }
  });
  record.transfers.unshift(transfer);
  return operation;
}

/** POST /databases/{id}/transfers direction=export — batch. */
export async function exportDump(dbId: string): Promise<Operation> {
  const record = databaseById(dbId);
  if (!record) throw new ApiError(problem(404, "NOT_FOUND", "Database not found", "That database instance no longer exists."));
  const transfer: DatabaseTransfer = {
    id: newId("trf"),
    direction: "export",
    source: `${record.database_name}-${new Date().toISOString().slice(0, 10)}.sql.gz`,
    size_mb: Math.max(4, Math.round(record.size_mb * 0.27)),
    state: "queued",
    started_at: new Date().toISOString(),
    finished_at: null,
    checks: "dump queued",
  };
  const operation = operations.submit({
    kind: "database.export",
    title: `Export ${record.display_name} to B2`,
    resource_ref: { type: "database", id: record.id, name: record.display_name },
    workload_category: "batch",
    yields_once: true,
    step_titles: ["Flush and lock for a consistent read", "Dump schema + data", "Compress and checksum", "Upload to B2 bucket wanjiku-backups"],
    ...actor(),
  });
  operations.subscribe((op) => {
    if (op.id !== operation.id) return;
    if (op.status === "succeeded") {
      transfer.state = "succeeded";
      transfer.finished_at = new Date().toISOString();
      transfer.checks = "dump checksummed after upload";
    }
    if (op.status === "failed" || op.status === "cancelled") {
      transfer.state = "failed";
      transfer.finished_at = new Date().toISOString();
      transfer.error = "Export job did not complete — retry when the server is less busy.";
    }
  });
  record.transfers.unshift(transfer);
  return operation;
}
