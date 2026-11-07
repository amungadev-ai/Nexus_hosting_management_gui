import type { Iso8601 } from "@/lib/types";

/**
 * Database fixtures (Stage 3 §8.7, FLOW-006, Stage 6 §4.9).
 *
 * Databases ship as ServiceTemplate instances (template keys
 * database.mariadb / database.postgres); /databases is the filtered
 * convenience view over /service-instances. On Nano the API returns
 * {"data": [], "meta": {"capability_unavailable": true, …}} — lib/api/
 * databases.ts models exactly that, so the list screen can render the
 * honest UX-DB-009 state from the same call.
 */

export type DbEngine = "mariadb" | "postgres";

export interface DatabaseUser {
  id: string; // dbu_01J…
  principal_name: string;
  grants: string[]; // least-privilege, never global superuser
  host_restriction: string; // "db user host" — explained in UX-DB-004
  created_at: Iso8601;
  last_rotated_at: Iso8601 | null;
}

export interface DatabaseBackup {
  id: string; // bak_01J…
  snapshot_at: Iso8601;
  size_mb: number;
  consistency: "logical" | "filesystem";
  verified: boolean;
  destination_label: string;
}

export interface DatabaseTransfer {
  id: string; // trf_01J…
  direction: "import" | "export";
  source: string; // file/source label
  size_mb: number;
  state: "queued" | "running" | "succeeded" | "failed";
  started_at: Iso8601;
  finished_at: Iso8601 | null;
  checks: string; // schema/size check summary
  error?: string;
}

export interface DatabaseInstance {
  id: string; // db_01J…
  display_name: string;
  engine: DbEngine;
  engine_version: string;
  template_key: "database.mariadb" | "database.postgres";
  state: "provisioning" | "running" | "degraded" | "stopped";
  hostname: string;
  port: number;
  database_name: string;
  tls: boolean;
  size_mb: number;
  ram_ceiling_mb: number;
  container_id: string;
  volume_id: string;
  health: "healthy" | "unhealthy" | "unknown";
  last_health_check_at: Iso8601;
  backup_policy: string;
  /** Set while the provision operation is in flight (202 + operation). */
  pending_operation_id?: string;
  users: DatabaseUser[];
  backups: DatabaseBackup[];
  transfers: DatabaseTransfer[];
  created_at: Iso8601;
}

const T = (h: number, m: number) => `2026-11-06T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

/** Mutable — lib/api/databases.ts provisions new instances into this list. */
export const databases: DatabaseInstance[] = [
  {
    id: "db_01JKILIDB1",
    display_name: "kilishop-db",
    engine: "mariadb",
    engine_version: "11.4 LTS",
    template_key: "database.mariadb",
    state: "running",
    hostname: "db.kilishop.nairobi-01.wanjiku.digital",
    port: 3306,
    database_name: "kilishop",
    tls: true,
    size_mb: 412,
    ram_ceiling_mb: 900,
    container_id: "c_01JKILIDB",
    volume_id: "vol_01JKILIDB",
    health: "healthy",
    last_health_check_at: T(14, 59),
    backup_policy: "Nightly 02:00 → B2 bucket wanjiku-backups · retention 30 days",
    users: [
      { id: "dbu_01JWPUSR01", principal_name: "kilishop_app", grants: ["SELECT", "INSERT", "UPDATE", "DELETE"], host_restriction: "container kili-shop only", created_at: "2026-10-30T11:42:00Z", last_rotated_at: "2026-11-01T02:00:00Z" },
      { id: "dbu_01JBAKUSR2", principal_name: "backup_reader", grants: ["SELECT", "LOCK TABLES"], host_restriction: "local agent socket only", created_at: "2026-10-30T11:45:00Z", last_rotated_at: null },
    ],
    backups: [
      { id: "bak_01JDBK012", snapshot_at: T(2, 7), size_mb: 118, consistency: "logical", verified: true, destination_label: "B2 bucket wanjiku-backups" },
      { id: "bak_01JDBK011", snapshot_at: "2026-11-05T02:07:12Z", size_mb: 114, consistency: "logical", verified: true, destination_label: "B2 bucket wanjiku-backups" },
      { id: "bak_01JDBK010", snapshot_at: "2026-11-04T02:06:58Z", size_mb: 112, consistency: "logical", verified: false, destination_label: "B2 bucket wanjiku-backups" },
    ],
    transfers: [
      { id: "trf_01JIMEXP1", direction: "import", source: "kilishop-launch-2026-10-30.sql.gz", size_mb: 96, state: "succeeded", started_at: "2026-10-30T12:02:00Z", finished_at: "2026-10-30T12:09:24Z", checks: "schema matched, 1 842 rows, foreign keys verified" },
      { id: "trf_01JIMEXP2", direction: "export", source: "kilishop-2026-11-06T02:07.sql.gz", size_mb: 112, state: "succeeded", started_at: T(2, 7), finished_at: T(2, 9), checks: "dump checksummed after upload" },
    ],
    created_at: "2026-10-30T11:41:00Z",
  },
  {
    id: "db_01JORDRDB2",
    display_name: "orders-db",
    engine: "postgres",
    engine_version: "16",
    template_key: "database.postgres",
    state: "running",
    hostname: "db.orders.nairobi-01.wanjiku.digital",
    port: 5432,
    database_name: "orders",
    tls: true,
    size_mb: 286,
    ram_ceiling_mb: 1000,
    container_id: "c_01JORDRDB",
    volume_id: "vol_01JORDRDB",
    health: "healthy",
    last_health_check_at: T(14, 58),
    backup_policy: "Nightly 02:30 → B2 bucket wanjiku-backups · retention 14 days",
    users: [
      { id: "dbu_01JAPIUSR3", principal_name: "orders_api", grants: ["SELECT", "INSERT", "UPDATE", "DELETE", "USAGE"], host_restriction: "container orders-api only", created_at: "2026-10-25T08:32:00Z", last_rotated_at: "2026-11-03T02:30:00Z" },
      { id: "dbu_01JRPTUSR4", principal_name: "reporting_ro", grants: ["SELECT"], host_restriction: "any host on the panel network", created_at: "2026-10-27T10:00:00Z", last_rotated_at: null },
    ],
    backups: [
      { id: "bak_01JDBK022", snapshot_at: T(2, 31), size_mb: 74, consistency: "logical", verified: true, destination_label: "B2 bucket wanjiku-backups" },
      { id: "bak_01JDBK021", snapshot_at: "2026-11-05T02:30:09Z", size_mb: 71, consistency: "logical", verified: false, destination_label: "B2 bucket wanjiku-backups" },
    ],
    transfers: [
      { id: "trf_01JIMEXP3", direction: "import", source: "orders-seed.csv (COPY)", size_mb: 44, state: "failed", started_at: "2026-11-02T09:12:00Z", finished_at: "2026-11-02T09:13:02Z", checks: "size check passed, schema preflight failed", error: "CSV column order did not match the target table. Nothing was imported — the transaction was rolled back." },
    ],
    created_at: "2026-10-25T08:31:00Z",
  },
];

export function databaseById(id: string): DatabaseInstance | undefined {
  return databases.find((d) => d.id === id);
}

/** Connection string with the password slot masked (never rendered raw). */
export function connectionString(db: DatabaseInstance): string {
  if (db.engine === "mariadb") {
    return `mysql://${db.users[0]?.principal_name ?? "app_user"}:<password>@${db.hostname}:${db.port}/${db.database_name}?ssl=true`;
  }
  return `postgresql://${db.users[0]?.principal_name ?? "app_user"}:<password>@${db.hostname}:${db.port}/${db.database_name}?sslmode=require`;
}

/** Admin tool per engine (templates exist in db.templates: phpmyadmin, pgadmin). */
export function adminToolFor(db: DatabaseInstance): { label: string; template_key: "phpmyadmin" | "pgadmin"; href: string } {
  return db.engine === "mariadb"
    ? { label: "phpMyAdmin", template_key: "phpmyadmin", href: "/templates/phpmyadmin" }
    : { label: "pgAdmin", template_key: "pgadmin", href: "/templates/pgadmin" };
}
