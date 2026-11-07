"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useOperationStream } from "@/components/providers";
import { isTerminal } from "@/lib/operations";
import { Icon } from "@/components/ui/icons";

/**
 * DS-023 Batch queue indicator — small shell indicator for batch workloads
 * (backups, transforms, builds) that are queued or running. Informational,
 * NOT an error: queued is the honest state ("will run when your sites are
 * idle"), never "failed" or "slow". Stays in the shell on all breakpoints.
 */

const QUEUED_STATUSES = ["pending", "validating", "queued"] as const;
const RUNNING_STATUSES = ["running", "verifying"] as const;

export function BatchQueueIndicator() {
  const { list } = useOperationStream();
  const router = useRouter();

  const batch = list.filter(
    (op) => op.workload_category === "batch" && !isTerminal(op.status)
  );
  const queued = batch.filter((op) =>
    (QUEUED_STATUSES as readonly string[]).includes(op.status)
  ).length;
  const running = batch.filter((op) =>
    (RUNNING_STATUSES as readonly string[]).includes(op.status)
  ).length;
  const yielding = batch.some((op) => op.batch?.yielded === true);

  if (queued === 0 && running === 0) return null;

  return (
    <button
      type="button"
      aria-label={`Batch jobs: ${queued} queued, ${running} running — view queue`}
      title="Batch workloads (backups, transforms, builds) run low-priority and queue when your sites are busy. This is normal."
      onClick={() => router.push("/monitoring/batch")}
      className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-control bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
    >
      <Icon name="layers" size={14} className="shrink-0" />
      <span>
        {queued} queued, {running} running
      </span>
      {yielding && <span aria-label="Currently yielding to site traffic">· yielding</span>}
    </button>
  );
}
