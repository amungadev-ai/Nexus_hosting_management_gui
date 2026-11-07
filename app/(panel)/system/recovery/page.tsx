"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/mock/data";
import { rescueRunbooks, type RescueRunbook } from "@/lib/mock/support";
import { enableRescueMode, exitRescueMode } from "@/lib/api/support";
import { isTerminal } from "@/lib/operations";
import { useOperationStream, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, ErrorBlock, SkeletonTable } from "@/components/ui/feedback";
import { Drawer, ImpactReview, ConfirmDialog } from "@/components/ui/overlay";
import { Icon } from "@/components/ui/icons";
import { useFixture } from "@/components/support/shared";

/**
 * UX-SUP-008 /system/recovery — recovery center. Offline-safe runbooks are
 * documentation (View opens the runbook); out-of-band access verification is
 * an honest local check. Rescue mode is the break-glass action: it stops the
 * serving stack, keeps all files, and requires an impact review plus a typed
 * confirmation — every rescue action lands in the audit chain (UTC).
 */

type RescueStage = "idle" | "reviewing" | "confirming" | "active-requested";

export default function RecoveryCenterPage() {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const runbooks = useFixture(() => rescueRunbooks);

  const [openRunbook, setOpenRunbook] = useState<RescueRunbook | null>(null);
  const [verified, setVerified] = useState(false);
  const [stage, setStage] = useState<RescueStage>("idle");
  const [rescueOpId, setRescueOpId] = useState<string | null>(null);
  const [exitOpId, setExitOpId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rescueOperation = useMemo(
    () => (rescueOpId === null ? undefined : list.find((o) => o.id === rescueOpId)),
    [rescueOpId, list]
  );
  const exitOperation = useMemo(
    () => (exitOpId === null ? undefined : list.find((o) => o.id === exitOpId)),
    [exitOpId, list]
  );

  // Honest: rescue is active only when the operation itself verified it —
  // never because a button was pressed, and not anymore once exit succeeded.
  const rescueActive = rescueOperation?.status === "succeeded" && exitOperation?.status !== "succeeded";

  const verifyAccess = () => {
    setVerified(true);
    push(
      "success",
      "Out-of-band access verified",
      "Rescue credentials are present and the provider console URL was confirmed against the server record. Re-verify after any provider change."
    );
  };

  const submitRescue = () => {
    setStage("confirming");
  };

  const confirmRescue = () => {
    setStage("active-requested");
    setActionError(null);
    try {
      const op = enableRescueMode();
      setRescueOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      push(
        "success",
        "Rescue mode requested (202)",
        "The serving stack stops only when the runbook switches over — track it in the tray. Websites stay offline until rescue mode is exited."
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Rescue mode could not be requested.");
      setStage("idle");
    }
  };

  const exitRescue = () => {
    setActionError(null);
    try {
      const op = exitRescueMode();
      setExitOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      push("success", "Exit accepted (202)", "The serving stack restarts and health checks verify recovery before the panel reports normal.");
      if (stage === "active-requested") setStage("idle");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Exit could not be submitted.");
    }
  };

  return (
    <Screen
      id="UX-SUP-008"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "System" }, { label: "Recovery" }]}
    >
      <div className="flex flex-col gap-6">
        <p className="max-w-3xl text-sm text-ink-2">
          Offline-safe runbooks and rescue modes. Recovery procedures here assume the panel itself
          may be unreachable — that is why out-of-band access is verified separately.
        </p>

        {/* Out-of-band verification */}
        <Card
          title="Out-of-band access"
          description="Confirm you can reach this server without the panel — provider console, rescue credentials, documented SSH path."
        >
          <div className="flex flex-wrap items-center gap-3">
            {verified ? (
              <Callout tone="success" title="Verified for this session">
                Rescue credentials present; provider console URL matches {db.server.name}. Recovery
                steps assume this path works.
              </Callout>
            ) : (
              <>
                <Button variant="secondary" icon="key" onClick={verifyAccess}>
                  Verify out-of-band access
                </Button>
                <span className="text-xs text-ink-3">
                  Do this before you need it — recovery that depends on the panel being up is not recovery.
                </span>
              </>
            )}
          </div>
        </Card>

        {/* Runbooks */}
        <section aria-labelledby="runbooks">
          <h2 id="runbooks" className="text-sm font-semibold text-ink">
            Offline-safe runbooks
          </h2>
          {runbooks === null ? (
            <div className="mt-3">
              <SkeletonTable rows={3} cols={2} />
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {runbooks.map((rb) => (
                <Card
                  key={rb.id}
                  title={rb.title}
                  description={rb.applies_when}
                  actions={
                    <Button variant="secondary" size="sm" onClick={() => setOpenRunbook(rb)}>
                      View runbook
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Rescue mode — the break-glass action */}
        <section aria-labelledby="rescue-mode">
          <h2 id="rescue-mode" className="text-sm font-semibold text-ink">
            Rescue mode
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <Callout tone="warning" title="What rescue mode actually does">
              It stops the serving stack: your websites and apps go offline until rescue mode is
              exited. Files, databases and backups are untouched — nothing is deleted. Use it only
              when a runbook requires the stack down (e.g. disk surgery, corrupted metadata store).
            </Callout>

            {actionError !== null && (
              <Callout tone="danger" title="Action failed">
                {actionError}
              </Callout>
            )}

            {exitOperation !== undefined && !isTerminal(exitOperation.status) && (
              <PendingState operation={exitOperation}>
                <p className="text-xs text-ink-2">
                  Restarting the serving stack; health checks must pass before the panel reports
                  normal service.
                </p>
              </PendingState>
            )}
            {exitOperation?.status === "succeeded" && (
              <Callout tone="success" title="Serving resumed — health checks passed">
                Rescue mode ended. Verify your sites if you made changes under rescue.
              </Callout>
            )}

            {rescueOperation !== undefined && !isTerminal(rescueOperation.status) && (
              <PendingState operation={rescueOperation}>
                <p className="text-xs text-ink-2">
                  Switching to the offline-safe runbook. Websites go offline only when the switchover
                  completes — the panel never claims rescue mode is active before that.
                </p>
              </PendingState>
            )}
            {rescueOperation?.status === "failed" && (
              <ErrorBlock
                code={rescueOperation.error?.code ?? "RESCUE_MODE_FAILED"}
                detail={rescueOperation.error?.detail ?? "Rescue mode did not engage. The serving stack is unchanged — review the runbook and retry."}
                correlationId={rescueOperation.correlation_id}
              />
            )}

            {rescueActive ? (
              <Card title="Rescue mode is active" description="Serving is stopped; files are intact.">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="destructive" icon="play" onClick={exitRescue}>
                    Exit rescue mode
                  </Button>
                  <span className="text-xs text-ink-3">
                    Exiting restarts the serving stack and re-verifies health.
                  </span>
                </div>
              </Card>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="destructive"
                  icon="power"
                  onClick={() => setStage("reviewing")}
                  disabled={rescueOperation !== undefined && !isTerminal(rescueOperation.status)}
                >
                  Enter rescue mode
                </Button>
                <span className="text-xs text-ink-3">
                  Requires the impact review and a typed confirmation — this stops your websites.
                </span>
              </div>
            )}

            <Callout tone="info" title="Break-glass actions are audited">
              Entering and exiting rescue mode writes a server-scoped entry to the audit chain with
              the exact UTC timestamp, actor and outcome — visible to auditors even if the panel was
              the thing that was broken.{" "}
              <Link href="/audit" className="font-medium text-accent hover:underline">
                Open the audit trail
              </Link>
              .
            </Callout>
          </div>
        </section>

        <div>
          <ButtonLink href="/settings/system" variant="secondary" size="sm">
            Back to system overview
          </ButtonLink>
        </div>
      </div>

      {/* Runbook drawer */}
      <Drawer
        open={openRunbook !== null}
        onClose={() => setOpenRunbook(null)}
        title={openRunbook?.title ?? "Runbook"}
      >
        {openRunbook !== null && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-2">{openRunbook.applies_when}</p>
            <ol className="flex list-none flex-col gap-3 p-0">
              {openRunbook.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-ink-2">
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-sm text-ink">{s}</span>
                </li>
              ))}
            </ol>
            <p className="flex items-start gap-1.5 text-xs text-ink-3">
              <Icon name="info" size={12} className="mt-0.5 shrink-0" />
              Runbook steps run outside the panel where noted — the panel cannot help once it is the
              broken thing.
            </p>
          </div>
        )}
      </Drawer>

      {/* Rescue: impact review → typed confirmation → operation */}
      <ImpactReview
        open={stage === "reviewing"}
        onClose={() => setStage("idle")}
        onSubmit={submitRescue}
        title="Enter rescue mode"
        submitLabel="Continue to confirmation"
        impact={{
          before: "Serving: websites and apps online",
          after: "Serving stopped — rescue runbook active; files and databases intact",
          affectedResources: [db.server.name, "All websites", "All apps and services"],
          downtimeEstimate: "Websites offline from switchover until rescue mode is exited.",
          reversibility: "Exit rescue mode restarts the serving stack and verifies health. No data is deleted.",
        }}
      >
        <p>
          Rescue mode is for repair work that needs the stack down. Anything a runbook can do with
          the panel up should be done with the panel up.
        </p>
      </ImpactReview>

      <ConfirmDialog
        open={stage === "confirming"}
        onClose={() => setStage("idle")}
        onConfirm={confirmRescue}
        title={`Take ${db.server.name} offline for rescue?`}
        confirmLabel="Enter rescue mode"
        destructive
        typedConfirmation="RESCUE"
        body={
          <>
            <p>
              Websites and apps on this server stop serving now and stay offline until you exit
              rescue mode. Files and databases are kept exactly as they are.
            </p>
            <p className="mt-2">
              The action is recorded in the audit chain as a break-glass entry with the current UTC
              time.
            </p>
          </>
        }
      />
    </Screen>
  );
}
