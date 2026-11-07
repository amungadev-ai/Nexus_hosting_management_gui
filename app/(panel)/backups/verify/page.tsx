"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableCard } from "@/components/ui/table";
import { StatusPill } from "@/components/ui/badge";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { backupPolicies, verificationHistory } from "@/lib/mock/ops";
import { submitBackupVerify, downloadCsv } from "@/lib/api/ops";
import { formatRelative } from "@/lib/format";
import type { VerificationRecord } from "@/lib/mock/ops";

/**
 * UX-OPS-021 /backups/verify — scheduled restore-test evidence per policy
 * ("last verified restore: 3 days ago"). Explicitly a v1 feature: "backup
 * succeeded" is not the same as "backup is restorable".
 */
export default function BackupVerifyPage() {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const policies = useFixture(() => backupPolicies);
  const history = useFixture(() => verificationHistory);
  const [pickedBackup, setPickedBackup] = useState(db.backups[0]?.id ?? "");

  const run = () => {
    const b = db.backups.find((x) => x.id === pickedBackup);
    if (!b) return;
    const op = submitBackupVerify(b.id, `${b.resource_ref.name ?? b.resource_ref.id} — ${b.policy_name}`);
    setFocusedId(op.id);
    setTrayOpen(true);
    push(
      "info",
      "Verification queued",
      "The snapshot is restored to a disposable target and compared — nothing live is touched."
    );
  };

  const exportHistory = () => {
    if (history === null) return;
    downloadCsv(
      "backup-verifications.csv",
      ["id", "backup", "ran_at_utc", "result", "duration_s", "detail"],
      history.map((v) => [v.id, v.backup_label, v.ran_at, v.result, String(v.duration_s), v.detail])
    );
  };

  return (
    <Screen
      id="UX-OPS-021"
      breadcrumbs={[{ label: "Backups", href: "/backups" }, { label: "Verification" }]}
      actions={
        <Button variant="secondary" icon="download" onClick={exportHistory} disabled={history === null}>
          Export history
        </Button>
      }
    >
      <Callout tone="info" className="mb-4" title="“Backup succeeded” is not “backup is restorable”">
        A verification restores the snapshot to a disposable target and compares
        checksums. It never touches live files. Policies surface their last verified
        restore everywhere a snapshot is offered for restore.
      </Callout>

      {policies === null ? (
        <SkeletonTable rows={2} cols={3} />
      ) : (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {policies.map((p) => (
            <Card key={p.id} title={p.name} description={p.scope}>
              <p className="text-sm text-ink">
                Last verified restore:{" "}
                <span className="font-medium">
                  {p.last_verified_restore_at !== null
                    ? formatRelative(p.last_verified_restore_at, now)
                    : "never"}
                </span>
              </p>
              <p className="mt-1 text-xs text-ink-3">
                {p.last_verified_restore_at === null
                  ? "Schedule a verification below — weekly is the recommended cadence."
                  : "Restores from this policy can be trusted; the next test is due in ~7 days."}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card title="Run verification now" className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-1 flex-col gap-1.5 text-sm font-medium text-ink">
            Snapshot to test
            <select
              value={pickedBackup}
              onChange={(e) => setPickedBackup(e.target.value)}
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent"
              aria-label="Snapshot to verify"
            >
              {db.backups.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.resource_ref.name ?? b.resource_ref.id} — {b.policy_name}
                </option>
              ))}
            </select>
          </label>
          <Button icon="play" onClick={run} disabled={pickedBackup === ""}>
            Run verification
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Runs as a batch job — it yields to site traffic like every other backup task.
        </p>
      </Card>

      {history === null ? (
        <SkeletonTable rows={3} cols={5} />
      ) : history.length === 0 ? (
        <Callout tone="info" title="No verification history yet">
          The first scheduled test will appear here with its evidence.
        </Callout>
      ) : (
        <TableCard<VerificationRecord>
          title="Verification history"
          caption="Scheduled restore tests and their outcomes"
          rowKey={(v) => v.id}
          rows={history}
          columns={[
            { key: "backup_label", header: "Snapshot", render: (v) => <span className="font-medium text-ink">{v.backup_label}</span>, className: "sticky left-0 bg-surface" },
            { key: "ran_at", header: "Ran", render: (v) => formatRelative(v.ran_at, now) },
            {
              key: "result",
              header: "Result",
              render: (v) => <StatusPill status={v.result === "passed" ? "verified" : "failed"} />,
            },
            { key: "duration_s", header: "Duration", render: (v) => `${v.duration_s}s` },
            { key: "detail", header: "Evidence" },
          ]}
        />
      )}
    </Screen>
  );
}
