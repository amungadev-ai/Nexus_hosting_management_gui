"use client";

import React from "react";
import { cx, formatRelative, formatDateTime } from "@/lib/format";
import type { Operation, OperationStatus } from "@/lib/types";
import { useNow } from "@/components/providers";
import { StatusPill, type StatusPillStatus } from "@/components/ui/badge";
import { Callout, ErrorBlock, Spinner } from "@/components/ui/feedback";
import { KeyValue, ProgressBar } from "@/components/ui/misc";
import { CopyButton } from "@/components/ui/code";
import { Icon, type IconName } from "@/components/ui/icons";

/**
 * DS-011 Operation timeline — one timeline per operation with the full
 * honest lifecycle: queued / running / waiting / partial / success / failed
 * / cancelled. "No false green success" while pending; success shows the
 * observed result + timestamp; partial shows per-step outcomes and remaining
 * risk; failed shows the safe error code, reason and correlation ID.
 * Batch variants surface queue position, low priority and yielding as the
 * normal, informational state they are. No logs section — log streaming
 * lives in the screens, not in the timeline.
 */

/** Human status text for any operation/step status (shared with states.tsx). */
export const OPERATION_STATUS_TEXT: Record<OperationStatus, string> = {
  pending: "Pending",
  validating: "Validating",
  awaiting_approval: "Awaiting approval",
  queued: "Queued",
  running: "Running",
  verifying: "Verifying",
  succeeded: "Succeeded",
  failed: "Failed",
  partially_succeeded: "Partially succeeded",
  cancelled: "Cancelled",
  rejected: "Rejected",
  compensating: "Rolling back",
  partially_compensated: "Partially rolled back",
  needs_attention: "Needs attention",
};

/** OperationStatus → nearest DS-004 StatusPill status. */
const PILL_STATUS: Record<OperationStatus, StatusPillStatus> = {
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

type NodeSpec = { icon: IconName; cls: string } | null; // null → hollow circle

const NODE_META: Record<OperationStatus, NodeSpec> = {
  pending: null,
  validating: null,
  queued: { icon: "clock", cls: "bg-info-soft text-info" },
  running: null, // spinner node, handled separately
  verifying: null,
  succeeded: { icon: "check", cls: "bg-success-soft text-success" },
  failed: { icon: "x", cls: "bg-danger-soft text-danger" },
  rejected: { icon: "x", cls: "bg-danger-soft text-danger" },
  partially_succeeded: { icon: "list", cls: "bg-warning-soft text-warning" },
  partially_compensated: { icon: "minus", cls: "bg-surface-2 text-ink-3" },
  cancelled: { icon: "minus", cls: "bg-surface-2 text-ink-3" },
  awaiting_approval: { icon: "lock", cls: "bg-warning-soft text-warning" },
  needs_attention: { icon: "lock", cls: "bg-warning-soft text-warning" },
  compensating: null,
};

const SPINNER_STATUSES: OperationStatus[] = ["running", "verifying", "compensating"];

function StepNode({ status }: { status: OperationStatus }) {
  if (SPINNER_STATUSES.includes(status)) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        <Spinner size={16} />
      </span>
    );
  }
  const meta = NODE_META[status];
  if (meta === null) {
    // Hollow circle — not started, nothing claimed.
    return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-line bg-surface" />;
  }
  return (
    <span
      className={cx(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
        meta.cls
      )}
    >
      <Icon name={meta.icon} size={13} />
    </span>
  );
}

function InfoLine({
  icon = "info",
  children,
  className,
}: {
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cx("flex items-start gap-1.5 text-xs text-ink-2", className)}>
      <Icon name={icon} size={14} className="mt-0.5 shrink-0 text-info" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function OperationTimeline({
  operation,
  dense = false,
}: {
  operation: Operation;
  dense?: boolean;
}) {
  const now = useNow();
  const status = operation.status;
  const total = Math.max(1, operation.progress.total_steps);
  const completed = operation.progress.completed_steps;
  const batch = operation.batch;

  const headerTone =
    status === "failed" || status === "rejected"
      ? "danger"
      : status === "succeeded"
        ? "success"
        : "accent";

  const verifiedAt = operation.last_verified_at ?? operation.finished_at;

  return (
    <div
      className={cx(
        "rounded-card border border-line bg-surface",
        dense ? "p-3" : "p-4 sm:p-6"
      )}
    >
      {/* Progress header */}
      <div className="flex flex-wrap items-center gap-2">
        {status === "needs_attention" ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-control bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning">
            <Icon name="alert-triangle" size={12} className="shrink-0" />
            Needs attention
          </span>
        ) : (
          <StatusPill status={PILL_STATUS[status]} />
        )}
        <h3 className="min-w-0 text-sm font-semibold text-ink">{operation.title}</h3>
        <span className="shrink-0 text-xs tabular-nums text-ink-3">
          {completed}/{total} steps
        </span>
      </div>
      <ProgressBar
        className={cx("mt-2", dense && "max-w-sm")}
        value={completed}
        max={total}
        tone={headerTone}
        label="Steps completed"
      />

      {/* Batch variants — informational, never errors (DS-011/DS-023). */}
      {batch !== undefined && status === "queued" && (
        <Callout tone="info" className="mt-3">
          Queued — will run when your websites are idle.
          {batch.queue_position !== undefined && ` Queue position: ${batch.queue_position}.`}
        </Callout>
      )}
      {batch !== undefined && status === "running" && batch.low_priority && (
        <InfoLine className="mt-2">
          Low-priority batch job — yields to site traffic.
        </InfoLine>
      )}
      {batch?.yielded === true && (
        <InfoLine icon="pause" className="mt-2">
          Yielded to serving workloads once — this is normal and will resume.
        </InfoLine>
      )}
      {batch !== undefined && status === "verifying" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-2">
          <Spinner size={12} />
          Verifying the actual result…
        </p>
      )}

      {/* Step timeline */}
      <ol className="mt-4 flex list-none flex-col p-0">
        {operation.steps.map((step, i) => (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepNode status={step.status} />
              {i < operation.steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cx("w-px shrink-0 bg-line", dense ? "h-4" : "h-6")}
                />
              )}
            </div>
            <div className={cx("min-w-0", dense ? "pb-2" : "pb-4")}>
              <p
                className={cx(
                  "text-sm",
                  step.status === "pending" ? "text-ink-2" : "font-medium text-ink"
                )}
              >
                {step.title}
              </p>
              <p className="text-xs text-ink-3">
                {OPERATION_STATUS_TEXT[step.status]}
                {step.occurred_at !== undefined &&
                  ` · ${formatRelative(step.occurred_at, now)}`}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Terminal states — verified success, safe failure, partial risk. */}
      {status === "succeeded" && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-success">
          <Icon name="check-circle" size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            {verifiedAt !== undefined
              ? `Verified ${formatRelative(verifiedAt, now)} — postcondition checks passed.`
              : "Postcondition checks passed."}
          </span>
        </p>
      )}
      {(status === "failed" || status === "rejected") && (
        <ErrorBlock
          className="mt-2"
          code={operation.error?.code ?? "OPERATION_FAILED"}
          detail={
            operation.error?.detail ??
            "The operation did not complete. No further detail was recorded."
          }
          correlationId={operation.correlation_id}
        />
      )}
      {status === "partially_succeeded" && (
        <div className="mt-2">
          {operation.partial !== undefined && operation.partial.length > 0 && (
            <KeyValue
              items={operation.partial.map((p) => ({
                label:
                  operation.steps.find((s) => s.key === p.step_key)?.title ??
                  p.step_key,
                value: `${p.outcome} — ${p.note}`,
              }))}
            />
          )}
          <p className="mt-2 flex items-start gap-1.5 text-sm text-warning">
            <Icon name="alert-triangle" size={16} className="mt-0.5 shrink-0" />
            Some steps did not complete — review before retrying.
          </p>
        </div>
      )}
      {status === "needs_attention" && (
        <Callout tone="warning" className="mt-2">
          Needs attention — the operation paused for a decision.
        </Callout>
      )}
      {status === "cancelled" && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-2">
          <Icon name="minus" size={16} className="mt-0.5 shrink-0" />
          This operation was cancelled.
        </p>
      )}
      {status === "compensating" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
          <Spinner size={14} />
          Rolling back the changes made so far…
        </p>
      )}
      {status === "partially_compensated" && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-warning">
          <Icon name="alert-triangle" size={16} className="mt-0.5 shrink-0" />
          Rollback partially completed — review the resource before retrying.
        </p>
      )}

      {/* Footer: correlation ID for support + absolute timestamps */}
      <div
        className={cx(
          "mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-3",
          dense && "mt-3 pt-2"
        )}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          Correlation ID <span className="font-mono text-ink-2">{operation.correlation_id}</span>
          <CopyButton text={operation.correlation_id} label="Copy ID" />
        </span>
        <span className="ml-auto text-right">
          Created {formatDateTime(operation.created_at)}
          {operation.started_at !== undefined &&
            ` · started ${formatDateTime(operation.started_at)}`}
          {operation.finished_at !== undefined &&
            ` · finished ${formatDateTime(operation.finished_at)}`}
        </span>
      </div>
    </div>
  );
}
