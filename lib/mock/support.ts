import type { Iso8601 } from "@/lib/types";

/**
 * Support-module fixtures: tickets, migrations and migration conflicts.
 * Migrations follow the registry note — cPanel-style source import is v2
 * scope (the screens label it honestly); the v1 path is ServiceTemplate
 * export/import. lib/api/support.ts attaches live operation ids at runtime.
 */

export type TicketStatus = "open" | "pending_customer" | "resolved";

export interface TicketMessage {
  author: string;
  body: string;
  at: Iso8601;
}

export interface Ticket {
  id: string; // tkt_01J…
  subject: string;
  status: TicketStatus;
  channel: "panel" | "email";
  updated_at: Iso8601;
  messages: TicketMessage[];
}

export type MigrationState = "completed" | "running" | "conflicts" | "failed" | "rolled_back";

export interface Migration {
  id: string; // mig_01J…
  source_label: string;
  kind: "cpanel_import" | "service_template";
  state: MigrationState;
  items: number;
  conflicts: number;
  started_at: Iso8601;
  finished_at?: Iso8601;
  operation_id?: string;
}

export interface MigrationConflict {
  id: string; // cfl_01J…
  migration_id: string;
  kind: "name_collision" | "php_version_mismatch" | "database_prefix";
  title: string;
  detail: string;
  resolution: "keep" | "skip" | "rename";
  rename_value: string;
}

const T = (h: number, m: number) =>
  `2026-11-06T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

export const tickets: Ticket[] = [
  {
    id: "tkt_01J4821",
    subject: "Backup schedule — can nightly move to 01:00?",
    status: "pending_customer",
    channel: "panel",
    updated_at: T(13, 40),
    messages: [
      { author: "Grace Njeri (Support)", body: "Happy to move the nightly backup window to 01:00 EAT. Confirm your site traffic is lowest then and we'll apply it to all three websites.", at: T(13, 40) },
      { author: "Jane Wanjiku", body: "Traffic drops after midnight — 01:00 works for us.", at: T(12, 5) },
    ],
  },
  {
    id: "tkt_01J4795",
    subject: "PHP 8.2 confirmed for kilishop checkout fix",
    status: "resolved",
    channel: "email",
    updated_at: "2026-11-04T15:12:00Z",
    messages: [
      { author: "Grace Njeri (Support)", body: "The checkout fix needs PHP 8.2+; your site already runs 8.2, so the patch can be applied by your developer directly.", at: "2026-11-04T15:12:00Z" },
    ],
  },
];

export const migrations: Migration[] = [
  {
    id: "mig_01JDONE1",
    source_label: "VPS-to-VPS — wanjiku.co.ke (static site)",
    kind: "service_template",
    state: "completed",
    items: 3,
    conflicts: 0,
    started_at: "2026-10-25T08:00:00Z",
    finished_at: "2026-10-25T08:22:00Z",
  },
  {
    id: "mig_01JRUN02",
    source_label: "cPanel import — kilishop.co.ke",
    kind: "cpanel_import",
    state: "running",
    items: 14,
    conflicts: 0,
    started_at: T(14, 35),
  },
  {
    id: "mig_01JCONF03",
    source_label: "cPanel import — acmeconsulting.co.ke",
    kind: "cpanel_import",
    state: "conflicts",
    items: 9,
    conflicts: 3,
    started_at: T(12, 15),
  },
];

export const migrationConflicts: MigrationConflict[] = [
  {
    id: "cfl_01JNAME1",
    migration_id: "mig_01JCONF03",
    kind: "name_collision",
    title: "Name collision — blog “news”",
    detail: "A blog named “news” exists on both the source (cPanel) and this panel. Only one can keep the name.",
    resolution: "keep",
    rename_value: "news-imported",
  },
  {
    id: "cfl_01JPHP02",
    migration_id: "mig_01JCONF03",
    kind: "php_version_mismatch",
    title: "PHP version mismatch — 7.4 → 8.2",
    detail: "The source site runs PHP 7.4, which this panel does not offer. Destination runtime is PHP 8.2; the installer will validate compatibility.",
    resolution: "keep",
    rename_value: "",
  },
  {
    id: "cfl_01JDBPR03",
    migration_id: "mig_01JCONF03",
    kind: "database_prefix",
    title: "Database prefix clash — wp_",
    detail: "The source database uses prefix wp_, already taken by kilishop's database on this server. Choose a new prefix or skip the import.",
    resolution: "rename",
    rename_value: "acme_",
  },
];

/* ------------------------------------------------------------------ */
/* Data-transfer fixtures (UX-SUP-004)                                 */
/* ------------------------------------------------------------------ */

export type DataExportState = "completed" | "expired";

export interface DataExport {
  id: string; // exp_01J…
  requested_at: Iso8601;
  state: DataExportState;
  scope_label: string;
  size_mb: number;
  /** sha256 digest of the archive — the integrity check the UI can copy. */
  digest: string;
  expires_at: Iso8601;
  download_available: boolean;
}

export const dataExports: DataExport[] = [
  {
    id: "exp_01JEXPORT1",
    requested_at: "2026-11-05T09:15:00Z",
    state: "completed",
    scope_label: "Configuration + website metadata (redacted)",
    size_mb: 12.4,
    digest: "sha256:6b21c9a0f34de815b2c7d94ae50f13c8",
    expires_at: "2026-11-19T09:15:00Z",
    download_available: true,
  },
  {
    id: "exp_01JEXPORT0",
    requested_at: "2026-10-08T11:30:00Z",
    state: "expired",
    scope_label: "Configuration + website metadata (redacted)",
    size_mb: 11.1,
    digest: "sha256:3f77b2d10a94c5e6f80217ab4dc9e531",
    expires_at: "2026-10-22T11:30:00Z",
    download_available: false,
  },
];

/* ------------------------------------------------------------------ */
/* Panel version + update fixtures (UX-SUP-005/007)                    */
/* ------------------------------------------------------------------ */

export const panelVersion = {
  version: "1.8.2",
  channel: "stable",
  installed_at: "2026-11-02T09:12:00Z",
  /** Capability data file version — matches lib/api/me.ts getMyCapabilities. */
  capability_data_version: "2026-11-06.3",
};

export const panelUpdate = {
  version: "1.9.0",
  released_at: "2026-11-04T18:00:00Z",
  maintenance_window: "Sundays 01:00–03:00 EAT (22:00–00:00 UTC the day before)",
  changelog: `panel 1.9.0 — 2026-11-04

Fixed
- Batch queue: transforms no longer resume ahead of site traffic after a yield.
- Backup verification: "last verified restore" now survives panel restarts.

Changed
- Capability rescan reports the diff against the previous set (UXD-032).

Security
- Audit chain records now include the support-access grant context.`,
};

/* ------------------------------------------------------------------ */
/* Rescue runbooks (UX-SUP-008)                                        */
/* ------------------------------------------------------------------ */

export interface RescueRunbook {
  id: string;
  title: string;
  applies_when: string;
  steps: string[];
}

export const rescueRunbooks: RescueRunbook[] = [
  {
    id: "rb_panel_down",
    title: "Panel will not start",
    applies_when: "The panel UI and API are unreachable, websites may still be serving.",
    steps: [
      "Confirm out-of-band access (provider console / rescue credentials) — the panel cannot repair itself while it is down.",
      "Check panel service logs: systemctl status nexuspanel — look for the last failed unit.",
      "If the metadata store is corrupt, restore it from the last verified panel backup; website content is untouched.",
      "Restart the panel and verify GET /healthz returns 200 before signing in.",
    ],
  },
  {
    id: "rb_disk_full",
    title: "Disk full",
    applies_when: "Writes fail, databases refuse new transactions, uploads error.",
    steps: [
      "Stop batch workloads first — they are the usual source of sudden disk growth.",
      "Locate the largest growth: du -x --max-depth=2 /var/nexuspanel | sort -h.",
      "Trim retained releases and old backups; never delete live website content to free space.",
      "Re-run the disk health check before resuming batch work.",
    ],
  },
  {
    id: "rb_cert_lockout",
    title: "Locked out after a TLS change",
    applies_when: "Browser rejects the panel certificate after a hostname or TLS change.",
    steps: [
      "Use the out-of-band console URL — it bypasses the panel certificate entirely.",
      "Re-issue the panel certificate from the recovery runbook (ACME HTTP-01).",
      "Verify the certificate chain with openssl s_client before closing the console.",
    ],
  },
];
