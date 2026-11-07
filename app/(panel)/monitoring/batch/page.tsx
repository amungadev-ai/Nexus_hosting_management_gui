"use client";

import React from "react";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { OperationTimeline } from "@/components/common/operation-timeline";
import { useOperationStream, useToast } from "@/components/providers";
import { operations } from "@/lib/operations";
import { isTerminal } from "@/lib/operations";
import type { Operation } from "@/lib/types";

/**
 * UX-OPS-019 /monitoring/batch — THE batch queue page (DS-023 full contract):
 * Queued (position numbers), Running (yield note), Completed today.
 * Informational, not an error — copy verbatim from the design system.
 */
const QUEUED = ["pending", "validating", "queued"];
const RUNNING = ["running", "verifying"];

export default function BatchQueuePage() {
  const { list } = useOperationStream();
  const { push } = useToast();

  const batch = list.filter((op) => op.workload_category === "batch");
  const queued = batch.filter((op) => !isTerminal(op.status) && QUEUED.includes(op.status));
  const running = batch.filter((op) => !isTerminal(op.status) && RUNNING.includes(op.status));
  const done = batch.filter((op) => isTerminal(op.status));
  const anyYielded = running.some((op) => op.batch?.yielded === true);

  const cancelQueued = (op: Operation) => {
    operations.cancel(op.id);
    push("info", "Cancel requested", `${op.title} will stop before its next step if it is still safe to cancel.`);
  };

  return (
    <Screen
      id="UX-OPS-019"
      breadcrumbs={[{ label: "Monitoring", href: "/monitoring" }, { label: "Batch queue" }]}
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="Batch workloads are low-priority by design">
          Batch workloads run low-priority and queue when your websites are busy. This is
          normal. Queued jobs carry a position and start when the server is idle — they are
          never shown as “slow” or “failed” while waiting.
        </Callout>

        {queued.length === 0 && running.length === 0 && done.length === 0 && (
          <EmptyState
            icon="layers"
            title="No batch jobs right now"
            body="Backups, image transforms, builds, AI diagnostics and migrations appear here with their queue state while they run."
            action={{ label: "Queue a backup now", href: "/backups" }}
          />
        )}

        {queued.length > 0 && (
          <section aria-label="Queued batch jobs" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink">
              Queued ({queued.length}) — will run when your websites are idle
            </h2>
            {queued
              .sort((a, b) => (a.batch?.queue_position ?? 99) - (b.batch?.queue_position ?? 99))
              .map((op) => (
                <Card key={op.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-label={`Queue position ${op.batch?.queue_position ?? "—"}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info-soft text-sm font-semibold text-info"
                      >
                        {op.batch?.queue_position ?? "—"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{op.title}</p>
                        <p className="font-mono text-xs text-ink-3">{op.id} · {op.kind}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status="queued" />
                      <ButtonLink href={`/activity/jobs/${op.id}`} variant="ghost" size="sm">
                        Inspect
                      </ButtonLink>
                      <button
                        type="button"
                        onClick={() => cancelQueued(op)}
                        className="rounded-control px-2 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
          </section>
        )}

        {running.length > 0 && (
          <section aria-label="Running batch jobs" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink">Running ({running.length})</h2>
            {anyYielded && (
              <Callout tone="info">
                One or more jobs yielded to serving traffic — normal. They resume automatically
                when the sites go idle.
              </Callout>
            )}
            {running.map((op) => (
              <div key={op.id} className="flex flex-col gap-2">
                <OperationTimeline operation={op} dense />
                {op.batch?.yielded === true && (
                  <p className="px-1 text-xs text-ink-2">
                    {op.title}: yielded to serving traffic — normal.
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {done.length > 0 && (
          <section aria-label="Completed batch jobs" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink">Completed today ({done.length})</h2>
            {done.map((op) => (
              <Card key={op.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{op.title}</p>
                    <p className="font-mono text-xs text-ink-3">{op.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill
                      status={
                        op.status === "succeeded"
                          ? "succeeded"
                          : op.status === "failed"
                            ? "failed"
                            : op.status === "partially_succeeded"
                              ? "partially_succeeded"
                              : "cancelled"
                      }
                    />
                    <ButtonLink href={`/activity/jobs/${op.id}`} variant="ghost" size="sm">
                      Inspect
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )}
      </div>
    </Screen>
  );
}
