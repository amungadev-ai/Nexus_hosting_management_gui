"use client";

import React from "react";
import { Screen } from "@/components/common/screen";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { useFixture } from "@/components/ops/use-fixture";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { workloadUsageRows } from "@/lib/mock/ops";

/**
 * UX-OPS-018 /monitoring/usage — per-workload allocation / typical / peak /
 * throttled view (the per-workload counterpart of /overview/usage). Each
 * workload keeps its own DS-022 strip; mobile scrolls horizontally, never wraps.
 */
export default function MonitoringUsagePage() {
  const rows = useFixture(() => workloadUsageRows());

  return (
    <Screen
      id="UX-OPS-018"
      breadcrumbs={[{ label: "Monitoring", href: "/monitoring" }, { label: "Allocation and usage" }]}
      actions={
        <ButtonLink href="/monitoring/pressure" variant="secondary" icon="alert-triangle">
          Memory pressure
        </ButtonLink>
      }
    >
      {rows === null ? (
        <SkeletonTable rows={6} cols={3} />
      ) : rows.length === 0 ? (
        <Callout tone="info" title="No workloads yet">
          Websites, applications and services appear here with their usage once created.
        </Callout>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rows.map((w) => (
            <Card
              key={w.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <ButtonLink href={w.href} variant="link" size="sm">
                    {w.name}
                  </ButtonLink>
                  <StatusPill
                    status={w.health === "healthy" ? "healthy" : w.health === "degraded" ? "degraded" : w.health === "unhealthy" ? "failed" : "unknown"}
                  />
                </span>
              }
              description={w.kind}
            >
              <AllocationStrip usage={w.usage} />
            </Card>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-ink-3">
        Allocation is a ceiling, not a reservation — typical is the 7-day p50 and peak the
        24h p99 measured per workload (cgroup memory.current / memory.peak / cpu.stat).
      </p>
    </Screen>
  );
}
