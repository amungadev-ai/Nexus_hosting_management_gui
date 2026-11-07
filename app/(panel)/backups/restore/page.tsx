"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { useFixture } from "@/components/ops/use-fixture";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Stepper } from "@/components/ui/nav";
import { ConfirmDialog, ImpactReview } from "@/components/ui/overlay";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { useNow, useOperationStream as useOps, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { backupPolicies } from "@/lib/mock/ops";
import { submitRestore } from "@/lib/api/ops";
import { formatMb, formatRelative } from "@/lib/format";
import type { BackupSet, Operation } from "@/lib/types";

/**
 * UX-OPS-004 /backups/restore — Restore wizard (FLOW-008): source, target,
 * overwrite impact, typed confirmation, approval. Shows the "last verified
 * restore" trust signal; a completed file copy is never presented as a
 * verified recovery — success arrives only when the operation verifies.
 */
const STEPS = ["Choose snapshot", "Review impact", "Confirm", "Track"];

export default function RestoreWizardPage() {
  const now = useNow();
  const backups = useFixture(() => db.backups);
  const policies = useFixture(() => backupPolicies);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [impactOpen, setImpactOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState<Operation | null>(null);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOps();

  const snapshot = backups?.find((b) => b.id === snapshotId) ?? null;
  const policy = policies?.find((p) => p.name === snapshot?.policy_name) ?? null;
  const lastVerified = policy?.last_verified_restore_at ?? null;

  const reviewed = () => {
    setImpactOpen(false);
    setConfirmOpen(true);
  };

  const doRestore = () => {
    if (!snapshot) return;
    const label = formatRelative(snapshot.snapshot_at, now);
    const op = submitRestore(snapshot.resource_ref, label);
    setSubmitted(op);
    setFocusedId(op.id);
    setTrayOpen(true);
    push("success", "Restore queued", "It runs as a batch job — the tray tracks each step.");
  };

  return (
    <Screen
      id="UX-OPS-004"
      breadcrumbs={[{ label: "Backups", href: "/backups" }, { label: "Restore" }]}
    >
      <Stepper steps={STEPS} current={submitted !== null ? 3 : confirmOpen ? 2 : impactOpen ? 1 : snapshot ? 1 : 0} className="mb-4" />

      {submitted !== null ? (
        <div className="flex flex-col gap-4">
          <PendingState operation={submitted}>
            <p className="text-sm text-ink-2">
              A completed file copy is not yet a verified recovery — the wizard stays
              on this step until the health check verifies the restored site.
            </p>
          </PendingState>
          <Card title="What happens after">
            <ul className="flex list-none flex-col gap-1.5 p-0 text-sm text-ink-2">
              <li>1 · The operation enumerates what will be overwritten before writing anything.</li>
              <li>2 · Files are restored atomically; the database is restored consistency-checked.</li>
              <li>3 · A health check must pass before the operation reports success.</li>
              <li>
                4 · The restore and its outcome are recorded in the{" "}
                <ButtonLink href="/audit" variant="link" size="sm">audit trail</ButtonLink>.
              </li>
            </ul>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Callout tone="warning" title="Restores overwrite live data">
            Restoring replaces the current files (and, when included, the database) of the
            target with the snapshot&apos;s contents. A safety backup of the current state is
            taken first, so the restore is reversible until that safety copy expires.
          </Callout>

          {lastVerified !== null && (
            <Callout tone="success" title="Trust signal">
              This policy&apos;s last verified restore test passed {formatRelative(lastVerified, now)} —
              snapshots from it have proven restorable.
            </Callout>
          )}

          {backups === null ? (
            <SkeletonTable rows={4} cols={4} />
          ) : backups.length === 0 ? (
            <Callout tone="info" title="Nothing to restore from yet">
              Queue a backup first — restores need at least one snapshot.
            </Callout>
          ) : (
            <Card title="1 · Choose snapshot" description="Only snapshots from your destinations are listed.">
              <ul className="divide-y divide-line">
                {backups.map((b) => (
                  <li key={b.id}>
                    <label className="flex cursor-pointer items-start gap-3 py-2.5">
                      <input
                        type="radio"
                        name="restore-snapshot"
                        checked={snapshotId === b.id}
                        onChange={() => setSnapshotId(b.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-accent"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">
                            {b.resource_ref.name ?? b.resource_ref.id}
                          </span>
                          <StatusPill
                            status={
                              b.integrity === "verified" ? "verified" : b.integrity === "failed" ? "failed" : "unknown"
                            }
                          />
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-3">
                          {b.policy_name} · {formatRelative(b.snapshot_at, now)} · {formatMb(b.size_mb)} ·{" "}
                          {b.destination_label}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {snapshot !== null && (
            <Card title="2 · Target" description="Restores go back to the original location — the resource the snapshot was taken from.">
              <KeyValue
                items={[
                  { label: "Resource", value: snapshot.resource_ref.name ?? snapshot.resource_ref.id },
                  { label: "Snapshot", value: `${snapshot.policy_name} — ${formatRelative(snapshot.snapshot_at, now)}` },
                ]}
              />
              <div className="mt-4">
                <Button onClick={() => setImpactOpen(true)} icon="shield">
                  Review impact
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {snapshot !== null && (
        <ImpactReview
          open={impactOpen}
          onClose={() => setImpactOpen(false)}
          onSubmit={reviewed}
          title={`Restore ${snapshot.resource_ref.name ?? snapshot.resource_ref.id}`}
          submitLabel="Continue to confirmation"
          impact={{
            before: "current live files + database of the resource",
            after: "files + database exactly as in the snapshot",
            affectedResources: [snapshot.resource_ref.name ?? snapshot.resource_ref.id, "its database", "nginx vhost"],
            downtimeEstimate: "Brief — seconds to minutes while files swap atomically",
            reversibility: "A safety backup of the current state is taken first; restore is reversible until it expires",
          }}
        >
          <p>
            Overwritten resources are enumerated before the first write. If the snapshot
            fails its checksum during download, nothing is changed (see the failed restore
            on the backup overview — the previous state stayed active).
          </p>
        </ImpactReview>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doRestore}
        title={`Restore ${snapshot?.resource_ref.name ?? ""} — irreversible overwrite of current files`}
        body="The current files and database are replaced by the snapshot's contents after a safety backup is taken. This runs as a batch operation."
        confirmLabel="Restore now"
        destructive
        typedConfirmation="RESTORE"
      />
    </Screen>
  );
}
