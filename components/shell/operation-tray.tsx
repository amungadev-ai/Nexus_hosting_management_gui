"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { OperationTimeline } from "@/components/common/operation-timeline";
import { isTerminal, operations } from "@/lib/operations";
import { formatRelative } from "@/lib/format";
import type { Operation, OperationStatus } from "@/lib/types";
import type { StatusPillStatus } from "@/components/ui/badge";

/**
 * Operation tray (Stage 3 §4.1 region 6 / DS-011): durable, cross-navigation
 * operation progress. Reads the live operation stream from the providers —
 * updates arrive free. Focusing a row shows the full operation timeline with
 * a best-effort cancel for non-terminal jobs.
 */

/** Engine status → DS-004 pill status (closest honest icon+text pairing). */
const PILL_STATUS: Record<OperationStatus, StatusPillStatus> = {
  pending: "pending",
  validating: "pending",
  awaiting_approval: "awaiting_approval",
  queued: "queued",
  running: "running",
  verifying: "pending",
  succeeded: "succeeded",
  failed: "failed",
  partially_succeeded: "partially_succeeded",
  cancelled: "cancelled",
  rejected: "failed",
  compensating: "running",
  partially_compensated: "partially_succeeded",
  needs_attention: "degraded",
};

export function OperationTray() {
  const { list, trayOpen, setTrayOpen, focusedId, setFocusedId } = useOperationStream();
  const { push } = useToast();
  const now = useNow();

  const activeCount = list.filter((op) => !isTerminal(op.status)).length;
  const focused = focusedId === null ? undefined : list.find((op) => op.id === focusedId);

  const cancel = (op: Operation) => {
    operations.cancel(op.id);
    push("info", "Cancellation requested — best effort");
  };

  return (
    <Drawer open={trayOpen} onClose={() => setTrayOpen(false)} title="Operations">
      {focused !== undefined ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setFocusedId(null)}
            className="inline-flex items-center gap-1 rounded-control text-sm text-accent hover:underline"
          >
            <Icon name="chevron-left" size={14} className="shrink-0" />
            All operations
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusPill status={PILL_STATUS[focused.status]} />
            {focused.workload_category === "batch" && <Chip>batch · low priority</Chip>}
          </div>
          <OperationTimeline operation={focused} />
          {!isTerminal(focused.status) && (
            <Button variant="secondary" onClick={() => cancel(focused)}>
              Cancel operation
            </Button>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Chip tone={activeCount > 0 ? "info" : "neutral"}>
              {activeCount} {activeCount === 1 ? "operation" : "operations"} active
            </Chip>
            <span className="text-xs text-ink-3">{list.length} total</span>
          </div>
          {list.length === 0 ? (
            <EmptyState
              icon="activity"
              title="No operations yet"
              body="Submissions appear here and survive navigation."
            />
          ) : (
            <ul className="space-y-1.5">
              {list.map((op) => (
                <li key={op.id}>
                  <button
                    type="button"
                    onClick={() => setFocusedId(op.id)}
                    className="flex w-full flex-col gap-1 rounded-control border border-line px-3 py-2 text-left hover:border-line-strong"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <StatusPill status={PILL_STATUS[op.status]} />
                      <span className="text-xs text-ink-3">{formatRelative(op.created_at, now)}</span>
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-ink">{op.title}</span>
                    {op.workload_category === "batch" && (
                      <span>
                        <Chip>batch · low priority</Chip>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-4 border-t border-line pt-3">
        <ButtonLink href="/activity" variant="secondary" icon="activity">
          Open activity center
        </ButtonLink>
      </div>
    </Drawer>
  );
}
