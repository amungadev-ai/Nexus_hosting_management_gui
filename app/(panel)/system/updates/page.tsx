"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/mock/data";
import { panelUpdate, panelVersion } from "@/lib/mock/support";
import { checkPanelUpdates, schedulePanelUpgrade } from "@/lib/api/support";
import { isTerminal } from "@/lib/operations";
import { formatRelative, formatUtc } from "@/lib/format";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { CodeBlock } from "@/components/ui/code";
import { Callout, ErrorBlock, Skeleton } from "@/components/ui/feedback";
import { ImpactReview } from "@/components/ui/overlay";

/**
 * UX-SUP-007 /system/updates — upgrade center. Read-only check against the
 * release channel (panel.update.check operation), changelog, the backup
 * requirement, the maintenance window, and — because a panel upgrade is a
 * high-risk infrastructure change — an ImpactReview before the
 * panel.upgrade operation is submitted. Success is only claimed when the
 * upgrade job verifies panel health.
 */

export default function UpgradeCenterPage() {
  const now = useNow();
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [checkOpId, setCheckOpId] = useState<string | null>(null);
  const [applyOpId, setApplyOpId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const checkOperation = useMemo(
    () => (checkOpId === null ? undefined : list.find((o) => o.id === checkOpId)),
    [checkOpId, list]
  );
  const applyOperation = useMemo(
    () => (applyOpId === null ? undefined : list.find((o) => o.id === applyOpId)),
    [applyOpId, list]
  );

  const checkDone = checkOperation !== undefined && checkOperation.status === "succeeded";
  const checkFailed = checkOperation !== undefined && checkOperation.status === "failed";
  // The version only moves once the upgrade operation itself verified health.
  const applied = applyOperation?.status === "succeeded";
  const installedVersion = applied ? panelUpdate.version : panelVersion.version;
  const lastVerifiedBackup = useMemo(() => {
    const verified = db.backups.filter((b) => b.verified);
    return verified.reduce<string | null>(
      (latest, b) => (latest === null || b.snapshot_at > latest ? b.snapshot_at : latest),
      null
    );
  }, []);

  const check = () => {
    try {
      const op = checkPanelUpdates();
      setCheckOpId(op.id);
      setFocusedId(op.id);
      push("info", "Checking the release channel", "Read-only check — nothing is downloaded or applied yet.");
    } catch (e) {
      push("error", "Check failed", e instanceof Error ? e.message : "The update channel could not be reached.");
    }
  };

  const applyUpdate = () => {
    setReviewOpen(false);
    try {
      const op = schedulePanelUpgrade(panelUpdate.version);
      setApplyOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      push(
        "success",
        "Upgrade accepted (202)",
        "The panel verifies a recent backup, downloads and validates the release, applies it, then health-checks the panel. Success is only reported once verified."
      );
    } catch (e) {
      push("error", "Upgrade failed", e instanceof Error ? e.message : "The upgrade could not be submitted.");
    }
  };

  return (
    <Screen
      id="UX-SUP-007"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "System" }, { label: "Upgrade center" }]}
      actions={
        <Button icon="refresh" onClick={check} disabled={checkOperation !== undefined && !isTerminal(checkOperation.status)}>
          Check for updates
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Current version */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Installed version"
            description={applied ? "Verified by the upgrade job's post-upgrade health check." : "What this panel is running right now."}
          >
            <KeyValue
              columns={2}
              items={[
                { label: "Panel", value: <span className="font-mono text-xs">{installedVersion}</span>, mono: true },
                { label: "Channel", value: <Chip tone="success">{panelVersion.channel}</Chip> },
                {
                  label: "Installed",
                  value: applied ? "Verified just now by the upgrade job" : formatUtc(panelVersion.installed_at),
                },
                { label: "Server", value: <span className="font-mono text-xs">{db.server.name}</span>, mono: true },
              ]}
            />
          </Card>

          <Card title="Backup requirement" description="A panel upgrade only proceeds with a verified recent backup.">
            {lastVerifiedBackup === null ? (
              <Callout tone="danger" title="No verified backup found">
                Run a backup verification before applying any upgrade.
              </Callout>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status="verified" />
                  <span className="text-sm text-ink">
                    Last verified backup {formatRelative(lastVerifiedBackup, now)}
                  </span>
                </div>
                <p className="text-xs text-ink-3">
                  Snapshot {formatUtc(lastVerifiedBackup)} — nightly restic snapshots to the remote B2
                  bucket, integrity-verified.{" "}
                  <Link href="/backups/verify" className="font-medium text-accent hover:underline">
                    Run another verification
                  </Link>
                  .
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Check progress / failure */}
        {checkOperation !== undefined && !isTerminal(checkOperation.status) && (
          <PendingState operation={checkOperation} />
        )}
        {checkFailed && checkOperation !== undefined && (
          <ErrorBlock
            code={checkOperation.error?.code ?? "UPDATE_CHECK_FAILED"}
            detail={checkOperation.error?.detail ?? "The release channel could not be reached. You can retry — checking is read-only."}
            correlationId={checkOperation.correlation_id}
            onRetry={check}
          />
        )}

        {/* Available update */}
        {checkDone && (
          <section aria-labelledby="available-update" className="flex flex-col gap-4">
            <h2 id="available-update" className="text-sm font-semibold text-ink">
              Available update
            </h2>
            <Card
              title={`Panel ${panelUpdate.version} is available`}
              description={`Released ${formatRelative(panelUpdate.released_at, now)} — review the changes before applying.`}
              actions={
                applied ? (
                  <Chip tone="success">Applied — verified</Chip>
                ) : (
                  <Button icon="zap" onClick={() => setReviewOpen(true)}>
                    Apply update
                  </Button>
                )
              }
            >
              <CodeBlock language="CHANGELOG" code={panelUpdate.changelog} maxHeight={260} />
            </Card>
            <Callout tone="info" title="Maintenance window">
              By default upgrades apply inside your maintenance window ({panelUpdate.maintenance_window}).
              Applying now overrides the window — websites keep serving, but the panel API is briefly
              unavailable while the health check runs.
            </Callout>
          </section>
        )}

        {!checkDone && checkOperation === undefined && (
          <Card title="Check the release channel" description="The panel never updates itself without an explicit, reviewed action.">
            {checkOpId !== null ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <p className="text-sm text-ink-2">
                Run a check to see if a newer panel release is available for the stable channel. The
                check is read-only: it contacts the channel, compares versions and fetches release
                notes. You decide if and when to apply.
              </p>
            )}
          </Card>
        )}

        {/* Apply progress / result */}
        {applyOperation !== undefined && !isTerminal(applyOperation.status) && (
          <PendingState operation={applyOperation}>
            <p className="text-xs text-ink-2">
              The job verifies the backup requirement again before applying. If the health check
              fails, the previous release is restored automatically.
            </p>
          </PendingState>
        )}
        {applyOperation !== undefined && applyOperation.status === "succeeded" && (
          <Callout tone="success" title={`Panel upgraded to ${panelUpdate.version} — verified`}>
            The health check passed after the restart. The new version is now reported as installed.
          </Callout>
        )}
        {applyOperation !== undefined && applyOperation.status === "failed" && (
          <ErrorBlock
            code={applyOperation.error?.code ?? "PANEL_UPGRADE_FAILED"}
            detail={applyOperation.error?.detail ?? "The upgrade did not complete. The previous release is still serving — you can retry after checking the runbook."}
            correlationId={applyOperation.correlation_id}
          />
        )}
      </div>

      {/* High-risk gate: DS-009 impact review before panel.upgrade */}
      <ImpactReview
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={applyUpdate}
        title={`Apply panel upgrade — ${panelVersion.version} → ${panelUpdate.version}`}
        submitLabel="Submit upgrade"
        impact={{
          before: `panel ${panelVersion.version} (stable)`,
          after: `panel ${panelUpdate.version} (stable)`,
          affectedResources: [db.server.name, "Panel UI and API", "All managed websites (serving continues)"],
          downtimeEstimate: "Panel briefly unavailable during apply + health check; websites keep serving.",
          reversibility: "Automatic rollback to the previous release if the post-upgrade health check fails.",
        }}
        diff={[{ path: "panel.release", before: panelVersion.version, after: panelUpdate.version }]}
      >
        <p>
          The upgrade runs as a tracked operation with a verified backup required up front. This is a
          high-risk infrastructure change — that is why the impact review is mandatory.
        </p>
      </ImpactReview>

      <div className="mt-6">
        <ButtonLink href="/settings/system" variant="secondary" size="sm">
          Back to system overview
        </ButtonLink>
      </div>
    </Screen>
  );
}
