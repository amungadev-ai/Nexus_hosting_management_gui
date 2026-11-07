"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { cx, formatMb, seededSeries } from "@/lib/format";
import type { Operation, UsageSnapshot } from "@/lib/types";
import { useOperationStream } from "@/components/providers";
import { StatusPill, type StatusPillStatus } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/feedback";
import { Sparkline } from "@/components/ui/misc";

/** Web-module shared view helpers (loading pattern, mini usage, job links). */

/** Loading skeleton → fixture rows; keeps the honest first-paint state. */
export function useFixtureList<T>(load: () => Promise<T[]>): T[] | null {
  const [rows, setRows] = useState<T[] | null>(null);
  useEffect(() => {
    let active = true;
    load().then((r) => {
      if (active) setRows(r);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return rows;
}

export function ListSkeleton({ rows = 4, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return <SkeletonTable rows={rows} cols={cols} className={cx("mt-4", className)} />;
}

/** Compact RAM figure + sparkline for list rows ("mini usage"). */
export function MiniUsage({ usage, seedId }: { usage: UsageSnapshot; seedId: string }) {
  const spread = Math.max(usage.ram_mb.peak - usage.ram_mb.current, 4);
  const series = seededSeries(seedId, 12, Math.max(usage.ram_mb.current, 1), spread);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="tabular-nums text-xs text-ink-2">
        RAM {formatMb(usage.ram_mb.current)} / {formatMb(usage.ram_mb.allocated)}
      </span>
      <Sparkline values={series} width={72} height={20} tone="accent" />
    </span>
  );
}

const OPERATION_PILL: Record<string, StatusPillStatus> = {
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

/** Links an operation to the durable job detail (/activity/jobs/:job). */
export function JobLink({ operationId, className }: { operationId: string; className?: string }) {
  const { list } = useOperationStream();
  const op: Operation | undefined = list.find((o) => o.id === operationId);
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-2", className)}>
      {op !== undefined ? (
        <>
          <StatusPill status={OPERATION_PILL[op.status] ?? "unknown"} />
          <Link href={`/activity/jobs/${op.id}`} className="min-w-0 truncate font-mono text-xs text-accent hover:underline">
            {op.id}
          </Link>
        </>
      ) : (
        <Link href={`/activity/jobs/${operationId}`} className="min-w-0 truncate font-mono text-xs text-accent hover:underline">
          {operationId}
        </Link>
      )}
    </span>
  );
}

export function KindChip({ kind }: { kind: string }) {
  const label = kind === "php" ? "PHP" : kind === "node" ? "Node.js" : kind === "static" ? "Static" : kind;
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-control bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-ink-2">
      {label}
    </span>
  );
}
