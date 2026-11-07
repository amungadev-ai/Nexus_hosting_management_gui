"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { UnavailableState } from "@/components/common/states";
import { useFixture } from "@/components/ops/use-fixture";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { useCapability, useNow, useOperationStream, useSession, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { backupPolicies, backupDestinations } from "@/lib/mock/ops";
import { submitBackupNow, submitRestore } from "@/lib/api/ops";
import { formatMb, formatRelative } from "@/lib/format";
import type { Operation } from "@/lib/types";

/**
 * UX-OPS-001 /backups — Backup overview: coverage, last verified restore,
 * failed jobs. On Nano backups are remote-only: the local destination renders
 * the honest UnavailableState (capability backup.local) instead of a dead
 * toggle. "Back up now" submits a batch operation that queues in the tray.
 */
export default function BackupsPage() {
  const { profile } = useSession();
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const localCap = useCapability("backup.local");
  const now = useNow();
  const policies = useFixture(() => backupPolicies);
  const [modalOpen, setModalOpen] = useState(false);
  const [resource, setResource] = useState(db.websites[0]?.id ?? "");
  const [destination, setDestination] = useState<"remote" | "local">("remote");

  const failedRestores = useMemo(
    () =>
      list.filter(
        (op) => op.kind === "backup.restore" && op.status === "failed"
      ),
    [list]
  );

  const resourceOptions = useMemo(
    () => [
      ...db.websites.map((w) => ({ id: w.id, name: w.title })),
      ...db.applications.map((a) => ({ id: a.id, name: a.name })),
      ...db.serviceInstances.map((s) => ({ id: s.id, name: s.name })),
    ],
    []
  );
  const chosen = resourceOptions.find((r) => r.id === resource);
  const localUnavailable = destination === "local" && localCap.state === "unavailable";

  const runBackup = () => {
    if (!chosen) return;
    const op = submitBackupNow(
      { type: "workload", id: chosen.id, name: chosen.name },
      destination
    );
    setFocusedId(op.id);
    setTrayOpen(true);
    push(
      "success",
      "Backup queued",
      destination === "remote"
        ? "It will run when your websites are idle, usually within minutes."
        : "Queued — the snapshot runs as a low-priority batch job."
    );
    setModalOpen(false);
  };

  return (
    <Screen
      id="UX-OPS-001"
      breadcrumbs={[{ label: "Backups" }]}
      actions={
        <>
          <ButtonLink href="/backups/restore" variant="secondary" icon="upload">
            Restore
          </ButtonLink>
          <Button icon="plus" onClick={() => setModalOpen(true)}>
            Back up now
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Coverage + trust signals */}
        {policies === null ? (
          <SkeletonTable rows={2} cols={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {policies.map((p) => {
              const lastRestore = p.last_verified_restore_at;
              return (
                <Card
                  key={p.id}
                  title={
                    <span className="flex items-center gap-2">
                      {p.name}
                      <StatusPill status={p.enabled ? "active" : "cancelled"} />
                    </span>
                  }
                  description={p.scope}
                  actions={
                    <ButtonLink href="/backups/policies" variant="ghost" size="sm" icon="edit">
                      Edit
                    </ButtonLink>
                  }
                  footer={
                    <span>
                      Last verified restore:{" "}
                      {lastRestore !== null ? formatRelative(lastRestore, now) : "never — run one from Backups → Verify"}
                    </span>
                  }
                >
                  <ul className="flex list-none flex-col gap-1 p-0 text-sm text-ink-2">
                    <li className="flex items-center gap-1.5">
                      <Icon name="clock" size={14} className="shrink-0 text-ink-3" />
                      {p.schedule_label} · {p.timezone}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Icon name="cloud" size={14} className="shrink-0 text-ink-3" />
                      {p.destination_label} · keep {p.retention_days} days
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Icon name="lock" size={14} className="shrink-0 text-ink-3" />
                      {p.encryption}
                    </li>
                  </ul>
                  <p className="mt-3 text-xs text-ink-3">
                    Covers: {p.covered_resources.join(", ")}
                  </p>
                </Card>
              );
            })}
          </div>
        )}

        {/* Failed jobs — honest, with the safe-recovery path (DS-011 failed). */}
        {failedRestores.length > 0 && (
          <section aria-label="Failed backup jobs" className="flex flex-col gap-3">
            {failedRestores.map((op) => (
              <FailedRestoreCard key={op.id} op={op} />
            ))}
          </section>
        )}

        {/* Recent snapshots */}
        <Card
          title="Recent snapshots"
          description="Snapshots from the last runs — integrity is what makes a backup restorable, not its size."
          actions={
            <ButtonLink href="/backups/sets" variant="secondary" size="sm">
              Open full inventory
            </ButtonLink>
          }
        >
          <SnapshotRows />
        </Card>

        {/* Local destination — honest capability gate on Nano. */}
        {backupDestinations.find((d) => d.kind === "local") && localCap.state === "unavailable" && (
          <UnavailableState capabilityKey="backup.local">
            <p className="text-sm text-ink-2">
              Until then your offsite destination (Backblaze B2) is the primary backup
              path — it is tested after every nightly run.
            </p>
            <div className="mt-3">
              <ButtonLink href="/backups/destinations" variant="secondary" size="sm">
                Open destinations
              </ButtonLink>
            </div>
          </UnavailableState>
        )}

        <p className="text-xs text-ink-3">
          On this profile backups are {profile === "nano" ? "remote-only" : "encrypted at rest and copied offsite"} —
          see <ButtonLink href="/backups/verify" variant="link" size="sm">Backup verification</ButtonLink> for
          the scheduled restore tests that prove a snapshot is restorable.
        </p>
      </div>

      {/* Back up now modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Back up now"
        description="Runs as a batch job — it queues when your websites are busy. This is normal."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={runBackup}
              disabled={chosen === undefined || localUnavailable}
              loading={false}
            >
              Queue backup
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="What to back up" htmlFor="backup-resource" required>
            <Select id="backup-resource" value={resource} onChange={(e) => setResource(e.target.value)}>
              {resourceOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Destination"
            htmlFor="backup-destination"
            hint={localUnavailable ? undefined : "Remote destinations survive a VPS failure; local ones do not."}
          >
            <Select
              id="backup-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value === "local" ? "local" : "remote")}
            >
              <option value="remote">Backblaze B2 (wanjiku-backups)</option>
              <option value="local">Local disk (/var/backups)</option>
            </Select>
          </Field>
          {localUnavailable && (
            <Callout tone="warning" title="Local backups are not available on this VPS">
              {localCap.reason}
            </Callout>
          )}
        </div>
      </Modal>
    </Screen>
  );
}

function FailedRestoreCard({ op }: { op: Operation }) {
  const { push, } = useToast();
  return (
    <Card className="border-danger/30">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status="failed" />
          <h3 className="text-sm font-semibold text-ink">{op.title}</h3>
        </div>
        <Callout tone="danger" title="RESTORE_CHECKSUM_MISMATCH">
          {op.error?.detail ??
            "Snapshot archive failed integrity verification. No files were changed — the previous state remains active."}
        </Callout>
        <p className="text-xs text-ink-2">
          Correlation ID <span className="font-mono">{op.correlation_id}</span> · the snapshot
          itself was left untouched; the next nightly run writes a fresh one.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={() => {
              submitRestore(op.resource_ref, "the 06:00 snapshot");
              push("success", "Restore retry queued", "It runs as a batch job — progress is in the operation tray.");
            }}
          >
            Retry restore
          </Button>
          <ButtonLink href="/backups/verify" variant="ghost" size="sm">
            Run a verification instead
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}

function SnapshotRows() {
  const now = useNow();
  const rows = useFixture(() => db.backups);
  if (rows === null) return <SkeletonTable rows={4} cols={4} />;
  if (rows.length === 0) {
    return (
      <Callout tone="info" title="No snapshots yet">
        The first nightly run writes one at 02:00 EAT. You can also queue one with
        “Back up now”.
      </Callout>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {rows.map((b) => (
        <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {b.resource_ref.name ?? b.resource_ref.id} — {b.policy_name}
            </p>
            <p className="text-xs text-ink-3">
              {formatRelative(b.snapshot_at, now)} · {formatMb(b.size_mb)} · {b.destination_label}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill status={b.integrity === "verified" ? "verified" : b.integrity === "failed" ? "failed" : "unknown"} />
            <ButtonLink href="/backups/restore" variant="secondary" size="sm">
              Restore
            </ButtonLink>
          </div>
        </li>
      ))}
    </ul>
  );
}
