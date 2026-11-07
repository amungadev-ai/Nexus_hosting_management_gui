"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { ButtonLink } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table";
import { StatusPill } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/overlay";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { CopyButton } from "@/components/ui/code";
import { useNow } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { backupPolicies } from "@/lib/mock/ops";
import { formatDate, formatMb, formatRelative, parseIso } from "@/lib/format";
import type { BackupSet } from "@/lib/types";

/**
 * UX-OPS-003 /backups/sets — Backup inventory: snapshots with size, integrity
 * and expiry. Inspect opens the context drawer (DS-020) with the full record;
 * restore routes to the wizard (UX-OPS-004). Backup detail is rendered here as
 * a drawer because the registry has no /backups/[id] route.
 */
export default function BackupSetsPage() {
  const now = useNow();
  const rows = useFixture(() => db.backups);
  const policies = useFixture(() => backupPolicies);
  const [inspect, setInspect] = useState<BackupSet | null>(null);

  const expiryFor = (b: BackupSet): string => {
    const policy = policies?.find((p) => p.name === b.policy_name);
    const days = policy?.retention_days ?? 30;
    const d = parseIso(b.snapshot_at);
    d.setDate(d.getDate() + days);
    return formatDate(d.toISOString());
  };

  return (
    <Screen
      id="UX-OPS-003"
      breadcrumbs={[{ label: "Backups", href: "/backups" }, { label: "Inventory" }]}
      actions={
        <ButtonLink href="/backups/verify" variant="secondary" icon="shield">
          Run verification
        </ButtonLink>
      }
    >
      {rows === null ? (
        <SkeletonTable rows={6} cols={5} />
      ) : rows.length === 0 ? (
        <Callout tone="info" title="No snapshots yet">
          Snapshots appear here after the first policy run. Queue one now with
          “Back up now” on the backup overview.
        </Callout>
      ) : (
        <TableCard
          title="Snapshots"
          caption="Backup snapshots with size, integrity and expiry"
          rowKey={(b) => b.id}
          rows={rows}
          onRowClick={(b) => setInspect(b)}
          columns={[
            {
              key: "resource_ref",
              header: "Snapshot",
              render: (b) => (
                <span className="font-medium text-ink">{b.resource_ref.name ?? b.resource_ref.id}</span>
              ),
              className: "sticky left-0 bg-surface",
            },
            { key: "policy_name", header: "Policy" },
            {
              key: "snapshot_at",
              header: "Taken",
              render: (b) => formatRelative(b.snapshot_at, now),
            },
            { key: "size_mb", header: "Size", render: (b) => formatMb(b.size_mb) },
            { key: "destination_label", header: "Destination" },
            {
              key: "integrity",
              header: "Integrity",
              render: (b) => (
                <StatusPill
                  status={b.integrity === "verified" ? "verified" : b.integrity === "failed" ? "failed" : "unknown"}
                />
              ),
            },
            { key: "expires", header: "Expires", render: (b) => expiryFor(b) },
            {
              key: "actions",
              header: "",
              render: (b) => (
                <ButtonLink href="/backups/restore" variant="secondary" size="sm">
                  Restore
                </ButtonLink>
              ),
            },
          ]}
        />
      )}

      <p className="mt-3 text-xs text-ink-3">
        Integrity “unverified” means the snapshot completed but no restore test has
        read it back yet — “backup succeeded” is not the same as “backup is restorable”.
      </p>

      {inspect !== null && (
        <Drawer
          open
          title={`Snapshot — ${inspect.resource_ref.name ?? inspect.resource_ref.id}`}
          onClose={() => setInspect(null)}
          footer={
            <ButtonLink href="/backups/restore" variant="primary" size="sm">
              Restore from this snapshot
            </ButtonLink>
          }
        >
          <div className="flex flex-col gap-4">
            <StatusPill
              status={
                inspect.integrity === "verified" ? "verified" : inspect.integrity === "failed" ? "failed" : "unknown"
              }
              at={inspect.snapshot_at}
            />
            <KeyValue
              items={[
                { label: "Snapshot ID", value: inspect.id, mono: true },
                { label: "Policy", value: inspect.policy_name },
                { label: "Taken", value: formatRelative(inspect.snapshot_at, now) },
                { label: "Size", value: formatMb(inspect.size_mb) },
                { label: "Destination", value: inspect.destination_label },
                { label: "Integrity", value: inspect.integrity },
              ]}
            />
            <p className="text-xs text-ink-3">
              The restore test (Backups → Verify) is what promotes a snapshot to
              “verified” — it restores to a disposable target and compares checksums.
            </p>
          </div>
        </Drawer>
      )}
    </Screen>
  );
}
