"use client";

import React, { useState } from "react";
import Link from "next/link";
import { databaseHref } from "@/lib/database-routes";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog, ImpactReview } from "@/components/ui/overlay";
import { DataTable } from "@/components/ui/table";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { CodeBlock, CopyButton, SecretField } from "@/components/ui/code";
import { KeyValue, ProgressBar } from "@/components/ui/misc";
import { LiveStatusLine, NotFoundInline, UnavailableState } from "@/components/common/states";
import { useCapability, useNow, useToast, useOperationStream } from "@/components/providers";
import {
  adminToolFor,
  connectionString,
  databaseById,
  type DatabaseInstance,
} from "@/lib/mock/databases";
import {
  backupNow,
  createDatabaseUser,
  exportDump,
  importDump,
  restoreBackup,
  rotateUserPassword,
} from "@/lib/api/databases";
import { ApiError } from "@/lib/api/core";
import { formatBytes, formatDateTime, formatMb, formatRelative } from "@/lib/format";

/** Shared header + section tabs for the /databases/[db] detail family. */

function DbShell({
  dbId,
  screenId,
  active,
  children,
}: {
  dbId: string;
  screenId: string;
  active: string;
  children: React.ReactNode;
}) {
  const record = databaseById(dbId);
  const now = useNow();
  if (record === undefined) {
    return (
      <Screen id={screenId} breadcrumbs={[{ label: "Databases", href: "/databases" }, { label: "Not found" }]}>
        <NotFoundInline what="database instance" />
      </Screen>
    );
  }
  const tabs = [
    { id: "", label: "Overview" },
    { id: "users", label: "Users & grants" },
    { id: "admin", label: "Admin tools" },
    { id: "transfers", label: "Import / export" },
    { id: "backups", label: "Backups" },
    { id: "service", label: "As a service" },
  ];
  return (
    <Screen id={screenId} breadcrumbs={[{ label: "Databases", href: "/databases" }, { label: record.display_name }]}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              {record.display_name}
              <Chip tone="neutral">{record.engine === "mariadb" ? "MariaDB" : "PostgreSQL"} {record.engine_version}</Chip>
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <StatusPill status={record.health === "healthy" ? "healthy" : record.health === "unhealthy" ? "degraded" : "unknown"} />
              <LiveStatusLine at={record.last_health_check_at} label="Health check" />
            </div>
          </div>
        </div>
        <nav aria-label="Database sections" className="flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={databaseHref(record.id, t.id)}
              aria-current={active === t.id ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${active === t.id ? "border-accent font-medium text-accent" : "border-transparent text-ink-2 hover:text-ink"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

export function DatabaseDetailView({ dbId }: { dbId: string }) {
  const record = databaseById(dbId);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  if (record === undefined) return null;
  const tool = adminToolFor(record);

  return (
    <DbShell dbId={dbId} screenId="UX-DB-003" active="">
      {record.state === "provisioning" && (
        <Callout tone="info" title="Provisioning — connection details appear when the first query verifies">
          The provision job is still running. No false green: this card turns into the connection view once the
          operation succeeds. Track it in{" "}
          <Link href="/activity" className="text-accent hover:underline">Activity</Link>.
        </Callout>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Connection"
          actions={<CopyButton text={connectionString(record)} label="Copy connection string" />}
        >
          <CodeBlock code={connectionString(record)} language="connection string" />
          <div className="mt-3">
            <SecretField label="App user password (one-time reveal)" value={`dbpass-${record.container_id.slice(-6)}`} />
          </div>
          <KeyValue
            className="mt-4"
            columns={2}
            items={[
              { label: "Host", value: record.hostname, mono: true },
              { label: "Port", value: String(record.port), mono: true },
              { label: "Database", value: record.database_name, mono: true },
              { label: "TLS", value: record.tls ? "Enforced (sslmode=require)" : "Off" },
            ]}
          />
        </Card>
        <Card title="Storage and policy">
          <ProgressBar
            value={record.size_mb}
            max={record.ram_ceiling_mb * 2}
            label={`Data volume: ${formatMb(record.size_mb)} used · memory ceiling ${formatMb(record.ram_ceiling_mb)}`}
            showValue
          />
          <KeyValue
            className="mt-4"
            items={[
              { label: "Backup policy", value: record.backup_policy },
              { label: "Admin tool", value: <Link href={tool.href} className="text-accent hover:underline">{tool.label} (template)</Link> },
              { label: "Created", value: formatDateTime(record.created_at) },
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              icon="shield"
              onClick={() => {
                backupNow(record.id)
                  .then(({ operation }) => {
                    push("success", "Backup queued", "It runs as a batch job when the server is idle — progress in the tray.");
                    setFocusedId(operation.id);
                    setTrayOpen(true);
                  })
                  .catch(() => push("error", "Backup failed", "Could not queue the snapshot."));
              }}
            >
              Back up now
            </Button>
            <ButtonLink href={databaseHref(record.id, "backups")} variant="secondary">Backups & restore</ButtonLink>
          </div>
        </Card>
      </div>
      <Card title="Users" actions={<ButtonLink href={databaseHref(record.id, "users")} variant="secondary" size="sm">Manage users</ButtonLink>}>
        <DataTable
          caption="Database users"
          rows={record.users}
          rowKey={(u) => u.id}
          columns={[
            { key: "principal_name", header: "User", render: (u: DatabaseInstance["users"][number]) => <span className="font-mono text-xs">{u.principal_name}</span> },
            { key: "grants", header: "Grants", render: (u: DatabaseInstance["users"][number]) => <span className="flex flex-wrap gap-1">{u.grants.map((g) => <Chip key={g}>{g}</Chip>)}</span> },
            { key: "host_restriction", header: "Host restriction", render: (u: DatabaseInstance["users"][number]) => u.host_restriction },
          ]}
        />
      </Card>
    </DbShell>
  );
}

/* ------------------------------------------------------------------ */

export function DatabaseUsersView({ dbId }: { dbId: string }) {
  const record = databaseById(dbId);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const now = useNow();
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<string | null>(null);
  if (record === undefined) return null;

  return (
    <DbShell dbId={dbId} screenId="UX-DB-004" active="users">
      <Callout tone="info" title="Host vs DB user, in plain language">
        A <strong>database user</strong> is a login inside the engine; the <strong>host restriction</strong> says
        where that login may connect from. Least-privilege default: the app user connects only from its own
        container, the backup reader only from the agent socket. No global superuser is ever granted.
      </Callout>
      <DataTable
        caption="Database users and grants"
        rows={record.users}
        rowKey={(u) => u.id}
        columns={[
          { key: "principal_name", header: "User", render: (u: DatabaseInstance["users"][number]) => <span className="font-mono text-xs">{u.principal_name}</span> },
          { key: "grants", header: "Grants", render: (u: DatabaseInstance["users"][number]) => <span className="flex flex-wrap gap-1">{u.grants.map((g) => <Chip key={g}>{g}</Chip>)}</span> },
          { key: "host_restriction", header: "Connects from", render: (u: DatabaseInstance["users"][number]) => u.host_restriction },
          { key: "last_rotated_at", header: "Password rotated", render: (u: DatabaseInstance["users"][number]) => (u.last_rotated_at ? formatRelative(u.last_rotated_at, now) : "never") },
          {
            key: "actions",
            header: "Actions",
            render: (u: DatabaseInstance["users"][number]) => (
              <Button variant="ghost" size="sm" onClick={() => setRotateTarget(u.id)}>
                Rotate password
              </Button>
            ),
          },
        ]}
        emptyState={<EmptyState title="No users" body="Create the least-privilege user your app will connect with." action={{ label: "Create user", onClick: () => setCreateOpen(true) }} />}
      />
      <div className="flex gap-2">
        <Button icon="plus" onClick={() => setCreateOpen(true)}>Create user</Button>
      </div>

      <Modalish
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setSecret(null);
        }}
        dbId={record.id}
        onSecret={(s) => setSecret(s)}
        onDone={() => {
          setCreateOpen(false);
          push("success", "User created", "The password is shown once — copy it now.");
        }}
        secret={secret}
      />

      <ConfirmDialog
        open={rotateTarget !== null}
        onClose={() => setRotateTarget(null)}
        onConfirm={() => {
          if (rotateTarget === null) return;
          rotateUserPassword(record.id, rotateTarget)
            .then((op) => {
              push("success", "Rotation submitted", `Operation ${op.id} — the new secret replaces the old one after verification.`);
              setFocusedId(op.id);
              setTrayOpen(true);
            })
            .catch(() => push("error", "Rotation failed", "Could not queue the credential rotation."));
        }}
        title="Rotate this password?"
        confirmLabel="Rotate password"
        body="The app using this user must be updated with the new secret. Rotation is applied as a verified job; the old credential stops working when it completes."
      />
    </DbShell>
  );
}

function Modalish({
  open,
  onClose,
  dbId,
  onSecret,
  onDone,
  secret,
}: {
  open: boolean;
  onClose: () => void;
  dbId: string;
  onSecret: (s: string) => void;
  onDone: () => void;
  secret: string | null;
}) {
  const [name, setName] = useState("");
  const [grants, setGrants] = useState<string[]>(["SELECT"]);
  const [host, setHost] = useState("container only");
  const [error, setError] = useState<string | null>(null);
  const all = ["SELECT", "INSERT", "UPDATE", "DELETE", "USAGE"];
  return (
    <ModalFix
      open={open}
      onClose={onClose}
      title="Create database user"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {secret === null && (
            <Button
              disabled={name.trim() === ""}
              onClick={() => {
                createDatabaseUser({ dbId, principal_name: name.trim(), grants, host_restriction: host })
                  .then(({ secret_once }) => {
                    onSecret(secret_once);
                    onDone();
                  })
                  .catch((e: unknown) => setError(e instanceof ApiError ? e.problem.detail : "Unexpected error."));
              }}
            >
              Create user
            </Button>
          )}
        </>
      }
    >
      {secret !== null ? (
        <SecretField label="New user password — shown once" value={secret} />
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="User name" htmlFor="dbu-name" required>
            <Input id="dbu-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className="font-mono" />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Grants (least privilege)</legend>
            <div className="flex flex-wrap gap-3">
              {all.map((g) => (
                <Checkbox
                  key={g}
                  label={g}
                  checked={grants.includes(g)}
                  onChange={(on) => setGrants((prev) => (on ? [...prev, g] : prev.filter((x) => x !== g)))}
                />
              ))}
            </div>
          </fieldset>
          <Field label="Host restriction" htmlFor="dbu-host" required>
            <Select id="dbu-host" value={host} onChange={(e) => setHost(e.target.value)}>
              <option value="container only">Its own container only</option>
              <option value="local agent socket only">Local agent socket only</option>
              <option value="any host on the panel network">Any host on the panel network</option>
            </Select>
          </Field>
          {error !== null && <Callout tone="danger">{error}</Callout>}
        </div>
      )}
    </ModalFix>
  );
}

function ModalFix(props: React.ComponentProps<typeof ImportModalInner>) {
  return <ImportModalInner {...props} />;
}

function ImportModalInner({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div role="presentation" hidden={!open}>
      <ModalShell open={open} onClose={onClose} title={title} footer={footer}>
        {children}
      </ModalShell>
    </div>
  );
}

import { Modal as ModalShell } from "@/components/ui/overlay";

/* ------------------------------------------------------------------ */

export function DatabaseAdminView({ dbId }: { dbId: string }) {
  const record = databaseById(dbId);
  const docker = useCapability("service.docker");
  if (record === undefined) return null;
  const tool = adminToolFor(record);
  if (docker.state === "unavailable") {
    return (
      <DbShell dbId={dbId} screenId="UX-DB-005" active="admin">
        <UnavailableState capabilityKey="service.docker" title="Admin tools need containers" />
      </DbShell>
    );
  }
  return (
    <DbShell dbId={dbId} screenId="UX-DB-005" active="admin">
      <Card title={`${tool.label} — launch with restricted scopes`}>
        <KeyValue
          items={[
            { label: "Tool", value: `${tool.label} (template ${tool.template_key})` },
            { label: "Session scope", value: "Read/write on this database only — no server shell, no file access, no other databases. The session expires after 60 minutes and is audited." },
            { label: "Launches from", value: <span className="font-mono text-xs">{tool.href}</span> },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={tool.href} icon="external-link">Open {tool.label} template</ButtonLink>
          <ButtonLink href={databaseHref(record.id, "transfers")} variant="secondary">Import / export instead</ButtonLink>
        </div>
      </Card>
      <Callout tone="warning" title="Admin tools are powerful">
        phpMyAdmin/pgAdmin can drop tables. Prefer the panel&apos;s users, transfers and backups screens for
        routine work; use the admin tool for the occasional surgery and audit-check the session afterwards.
      </Callout>
    </DbShell>
  );
}

/* ------------------------------------------------------------------ */

export function DatabaseTransfersView({ dbId }: { dbId: string }) {
  const record = databaseById(dbId);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [importOpen, setImportOpen] = useState(false);
  const [source, setSource] = useState("");
  const [sizeMb, setSizeMb] = useState("40");
  if (record === undefined) return null;

  const run = (fn: () => Promise<{ id: string }>, label: string) => {
    fn()
      .then((op) => {
        push("success", label, "Batch job queued — it yields to site traffic and runs when the server is idle.");
        setFocusedId(op.id);
        setTrayOpen(true);
      })
      .catch((e: unknown) => push("error", label + " failed", e instanceof ApiError ? e.problem.detail : "Unexpected error."));
  };

  return (
    <DbShell dbId={dbId} screenId="UX-DB-006" active="transfers">
      <div className="flex flex-wrap gap-2">
        <Button icon="download" onClick={() => setImportOpen(true)}>Import dump</Button>
        <Button variant="secondary" icon="upload" onClick={() => run(() => exportDump(record.id), "Export submitted")}>
          Export to B2
        </Button>
      </div>
      <DataTable
        caption="Import/export jobs"
        rows={record.transfers}
        rowKey={(t) => t.id}
        columns={[
          { key: "direction", header: "Direction", render: (t) => <Chip tone={t.direction === "import" ? "accent" : "neutral"}>{t.direction}</Chip> },
          { key: "source", header: "Source", render: (t) => <span className="break-all">{t.source}</span> },
          { key: "size_mb", header: "Size", render: (t) => formatMb(t.size_mb) },
          { key: "state", header: "Status", render: (t) => t.state === "succeeded" ? <StatusPill status="succeeded" /> : t.state === "failed" ? <StatusPill status="failed" /> : <StatusPill status="queued" /> },
          { key: "started_at", header: "Started", render: (t) => formatDateTime(t.started_at) },
          { key: "checks", header: "Checks", render: (t) => <span className="text-xs text-ink-2">{t.checks}</span> },
          { key: "error", header: "Detail", render: (t) => (t.error ? <span className="text-xs text-danger">{t.error}</span> : "—") },
        ]}
        emptyState={<EmptyState title="No transfers yet" body="Import a SQL dump or export the current database to the remote bucket." />}
      />

      <ModalShell
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import a dump"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              disabled={source.trim() === ""}
              onClick={() => {
                run(() => importDump({ dbId: record.id, source: source.trim(), size_mb: Number(sizeMb) }), "Import submitted");
                setImportOpen(false);
              }}
            >
              Queue import
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Source file" htmlFor="imp-src" required hint="Schema and size are checked before anything is applied; the import is transactional.">
            <Input id="imp-src" value={source} onChange={(e) => setSource(e.target.value)} placeholder="kilishop-migrate.sql.gz" />
          </Field>
          <Field label="Size (MB)" htmlFor="imp-size" required>
            <Input id="imp-size" type="number" min="1" value={sizeMb} onChange={(e) => setSizeMb(e.target.value)} />
          </Field>
        </div>
      </ModalShell>
    </DbShell>
  );
}

/* ------------------------------------------------------------------ */

export function DatabaseBackupsView({ dbId }: { dbId: string }) {
  const record = databaseById(dbId);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const now = useNow();
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  if (record === undefined) return null;
  const target = record.backups.find((b) => b.id === restoreTarget) ?? null;

  return (
    <DbShell dbId={dbId} screenId="UX-DB-007" active="backups">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">{record.backup_policy}</p>
        <Button
          icon="shield"
          onClick={() => {
            backupNow(record.id)
              .then(({ operation }) => {
                push("success", "Backup queued", "Batch job — runs when the server is idle, then verifies its own integrity.");
                setFocusedId(operation.id);
                setTrayOpen(true);
              })
              .catch(() => push("error", "Backup failed", "Could not queue the snapshot."));
          }}
        >
          Back up now
        </Button>
      </div>
      <DataTable
        caption="Snapshots"
        rows={record.backups}
        rowKey={(b) => b.id}
        columns={[
          { key: "snapshot_at", header: "Snapshot", render: (b) => formatRelative(b.snapshot_at, now) },
          { key: "size_mb", header: "Size", render: (b) => formatMb(b.size_mb) },
          { key: "consistency", header: "Consistency", render: (b) => (b.consistency === "logical" ? "Logical (dump)" : "Filesystem") },
          { key: "verified", header: "Integrity", render: (b) => (b.verified ? <StatusPill status="verified" /> : <StatusPill status="stale" />) },
          { key: "destination_label", header: "Destination", render: (b) => b.destination_label },
          {
            key: "actions",
            header: "Actions",
            render: (b) => (
              <Button variant="secondary" size="sm" onClick={() => setRestoreTarget(b.id)}>
                Restore preview
              </Button>
            ),
          },
        ]}
        emptyState={<EmptyState icon="shield" title="No snapshots yet" body="Run a backup to create the first restore point." />}
      />
      <Callout tone="info" title="“Backup succeeded” ≠ “restorable”">
        A snapshot counts as trustworthy only after a verified restore test. Unverified snapshots are marked
        honestly above — run a restore preview to promote one.
      </Callout>

      <ImpactReview
        open={target !== null}
        onClose={() => setRestoreTarget(null)}
        onSubmit={() => {
          if (target === null) return;
          restoreBackup(record.id, target.id)
            .then((op) => {
              push("success", "Restore submitted", `Operation ${op.id} — success requires a real query against the restored copy.`);
              setFocusedId(op.id);
              setTrayOpen(true);
              setRestoreTarget(null);
            })
            .catch(() => push("error", "Restore failed", "Could not queue the restore job."));
        }}
        title={`Restore ${record.display_name} from ${target?.snapshot_at.slice(0, 16).replace("T", " ") ?? ""} UTC`}
        submitLabel="Submit restore job"
        impact={{
          before: "Current data in " + record.database_name,
          after: `Tables replaced with the ${formatDateTime(target?.snapshot_at ?? new Date().toISOString())} snapshot`,
          affectedResources: [record.display_name],
          downtimeEstimate: "Brief — the swap happens atomically after verification",
          reversibility: "A fresh backup is taken first; the current state stays recoverable",
        }}
      >
        <p>
          The restore enumerates overwritten tables first, restores into a scratch schema, verifies with a real
          query, and only then swaps — a finished file copy is never reported as a working database.
        </p>
      </ImpactReview>
    </DbShell>
  );
}

/* ------------------------------------------------------------------ */

export function DatabaseServiceView({ dbId }: { dbId: string }) {
  const record = databaseById(dbId);
  if (record === undefined) return null;
  return (
    <DbShell dbId={dbId} screenId="UX-DB-010" active="service">
      <Card title="This database is a ServiceTemplate instance">
        <KeyValue
          columns={2}
          items={[
            { label: "Template", value: `${record.template_key} v${record.engine_version}`, mono: true },
            { label: "Container", value: record.container_id, mono: true },
            { label: "Volume", value: record.volume_id, mono: true },
            { label: "Exposure", value: "Private — reachable from the panel network only" },
            { label: "Health check", value: `${record.health} · verified query every 60s` },
            { label: "Backup policy", value: record.backup_policy },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/services" variant="secondary">Open service portfolio</ButtonLink>
          <ButtonLink href="/settings/templates/transfer" variant="secondary" icon="download">
            Export instance (OCI)
          </ButtonLink>
        </div>
      </Card>
      <Callout tone="info" title="Same primitive, same lifecycle">
        Databases ship as ServiceTemplate instances — the same container/volume/health/backup lifecycle as every
        other self-hosted service. OCI export/import moves the whole instance (data included) to another VPS via
        the transfer center.
      </Callout>
    </DbShell>
  );
}
