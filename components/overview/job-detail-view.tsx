"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import type { Operation, OperationStatus } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { useOperationStream, useNow, useToast } from "@/components/providers";
import { cancelOperation, retryOperation } from "@/lib/api/overview";
import { isTerminal } from "@/lib/operations";
import { OperationTimeline } from "@/components/common/operation-timeline";
import { Screen } from "@/components/common/screen";
import { NotFoundInline } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip, StatusPill, type StatusPillStatus } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code";
import { Callout } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { deriveOperationEvents, sseLog } from "@/lib/mock/overview";
import { operations } from "@/lib/operations";
import { formatRelative } from "@/lib/format";

/** OperationStatus → nearest DS-004 pill (shared by activity list + job detail). */
export const OP_PILL: Record<OperationStatus, StatusPillStatus> = {
  pending: "pending",
  validating: "pending",
  awaiting_approval: "awaiting_approval",
  queued: "queued",
  running: "running",
  verifying: "running",
  succeeded: "succeeded",
  failed: "failed",
  partially_succeeded: "partially_succeeded",
  cancelled: "cancelled",
  rejected: "failed",
  compensating: "running",
  partially_compensated: "partially_succeeded",
  needs_attention: "awaiting_approval",
};

/** Resolve an operation from the live stream first, then the seeded history. */
export function useResolvedOperation(jobId: string): Operation | undefined {
  const { list } = useOperationStream();
  return useMemo(() => {
    const live = list.find((o) => o.id === jobId);
    if (live !== undefined) return live;
    return db.operations.find((o) => o.id === jobId);
  }, [list, jobId]);
}

export function actorLabel(actorId: string): string {
  return db.users.find((u) => u.id === actorId)?.display_name ?? actorId;
}

export function JobDetailView({ jobId }: { jobId: string }) {
  const op = useResolvedOperation(jobId);
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();

  if (op === undefined) {
    return (
      <Screen id="UX-OV-005" breadcrumbs={[{ label: "Activity", href: "/activity" }, { label: "Job detail" }]}>
        <NotFoundInline what="job" />
      </Screen>
    );
  }

  // Live operations replay their recorded event stream; seeded history is
  // reconstructed from the operation's own steps (labelled as a replay).
  const liveEvents = operations.eventsFor(op.id);
  const events = liveEvents.length > 0 ? liveEvents : deriveOperationEvents(op);
  const isReplay = liveEvents.length === 0;

  const onRetry = () => {
    retryOperation(op);
    push("success", "Retry submitted", "A new attempt is queued — track it in the operation tray.");
    setFocusedId(null);
    setTrayOpen(true);
  };

  const onCancel = () => {
    cancelOperation(op.id);
    push("info", "Cancellation requested", "Cancellation is best-effort — committed changes are not reversed.");
  };

  return (
    <Screen
      id="UX-OV-005"
      breadcrumbs={[{ label: "Activity", href: "/activity" }, { label: "Jobs", href: "/activity" }, { label: op.id }]}
      actions={
        <>
          {op.status === "failed" && (
            <Button icon="refresh" onClick={onRetry}>
              Retry job
            </Button>
          )}
          {!isTerminal(op.status) && (
            <Button variant="secondary" icon="x" onClick={onCancel}>
              Cancel when safe
            </Button>
          )}
          <ButtonLink href="/activity" variant="ghost">
            Back to activity
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{op.kind}</Chip>
          <Chip tone={op.workload_category === "batch" ? "info" : "neutral"}>
            {op.workload_category}
            {op.batch?.low_priority ? " · low priority" : ""}
          </Chip>
          <span className="text-xs text-ink-2">
            requested by {actorLabel(op.actor_id)} · created {formatRelative(op.created_at, now)}
          </span>
        </div>

        <OperationTimeline operation={op} />

        <section aria-label="Event log">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Event log</h2>
            <p className="text-xs text-ink-2">
              {isReplay
                ? "Replayed from the operation's recorded steps — the live stream starts when a job runs in this session."
                : "Live SSE-shaped stream — resumable via Last-Event-ID."}
            </p>
          </div>
          <CodeBlock language="text/event-stream" code={sseLog(events)} maxHeight={340} />
        </section>

        {op.status === "failed" && (
          <Callout tone="info" title="About retries">
            A retry creates a new attempt with its own job ID — it never duplicates the resource. The failed
            attempt stays in the history for the audit trail.
          </Callout>
        )}

        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <Icon name="activity" size={13} className="shrink-0 text-ink-3" />
          Job history lives in{" "}
          <Link href="/activity" className="text-accent hover:underline">
            Activity
          </Link>{" "}
          — the correlation ID above is what support needs.
        </p>
      </div>
    </Screen>
  );
}
