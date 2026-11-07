"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/mock/data";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { retryOperation } from "@/lib/api/overview";
import { isTerminal } from "@/lib/operations";
import { Screen } from "@/components/common/screen";
import { OP_PILL, actorLabel } from "@/components/overview/job-detail-view";
import { Button } from "@/components/ui/button";
import { Chip, StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/nav";
import { Icon } from "@/components/ui/icons";
import { formatRelative } from "@/lib/format";
import { jobHref } from "@/lib/job-routes";

/**
 * UX-OV-004 — Activity and jobs: the unified operation stream (seeded
 * history merged with the live engine stream, deduped by id), filterable
 * All/Serving/Batch, with batch workloads visible as batch.
 */
export default function ActivityPage() {
  const { list } = useOperationStream();
  const now = useNow();
  const { push } = useToast();
  const [filter, setFilter] = useState("all");

  const merged = useMemo(() => {
    const byId = new Map<string, (typeof db.operations)[number]>();
    for (const op of db.operations) byId.set(op.id, op);
    for (const op of list) byId.set(op.id, op);
    return [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [list]);

  const filtered = merged.filter((op) => {
    if (filter === "batch") return op.workload_category === "batch";
    if (filter === "serving") return op.workload_category === "serving" || op.workload_category === "infrastructure";
    return true;
  });

  const openCount = merged.filter((op) => !isTerminal(op.status)).length;

  return (
    <Screen
      id="UX-OV-004"
      breadcrumbs={[{ label: "Activity" }]}
      actions={
        <SegmentedControl
          aria-label="Filter jobs by workload category"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: "all", label: `All (${merged.length})` },
            { value: "serving", label: "Serving" },
            { value: "batch", label: `Batch (${merged.filter((o) => o.workload_category === "batch").length})` },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {openCount > 0 && (
          <p className="text-sm text-ink-2" role="status">
            {openCount} job{openCount === 1 ? "" : "s"} still running — this page updates live; toasts are only
            acknowledgements, the durable result is here.
          </p>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon="activity"
            title="No jobs in this view"
            body="Jobs appear here the moment they are submitted — deploys, installs, backups and restores. Batch workloads (backups, transforms) queue when your sites are busy; that is normal, not a failure."
            action={{ label: "Show all jobs", onClick: () => setFilter("all") }}
          />
        ) : (
          <ul className="flex list-none flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface p-0">
            {filtered.map((op) => (
              <li key={op.id} className="relative">
                <Link href={jobHref(op.id)} className="flex items-center gap-3 px-4 py-3 pr-4 transition-colors hover:bg-surface-2 max-md:flex-wrap">
                  <StatusPill status={OP_PILL[op.status]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{op.title}</span>
                    <span className="block truncate text-xs text-ink-2">
                      {op.resource_ref.name ?? op.resource_ref.type} · requested by {actorLabel(op.actor_id)} ·{" "}
                      {formatRelative(op.created_at, now)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Chip tone="neutral">{op.kind}</Chip>
                    {op.workload_category === "batch" && <Chip tone="info">batch · low priority</Chip>}
                    {op.status === "awaiting_approval" && (
                      <Chip tone="warning">
                        <Link href="/approvals" className="underline">
                          review
                        </Link>
                      </Chip>
                    )}
                  </span>
                  <Icon name="chevron-right" size={15} className="shrink-0 text-ink-3" />
                </Link>
                {op.status === "failed" && (
                  <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 md:block">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="refresh"
                      onClick={() => {
                        retryOperation(op);
                        push("success", "Retry submitted", "A new attempt is queued with a fresh job ID.");
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="px-1 text-xs text-ink-2">
          Every entry carries a correlation ID — open a job to copy it for support. Approvals waiting on you are
          also surfaced in <Link href="/approvals" className="text-accent hover:underline">Approvals</Link>.
        </p>
      </div>
    </Screen>
  );
}
