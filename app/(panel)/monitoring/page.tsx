"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { LiveStatusLine } from "@/components/common/states";
import { useFixture } from "@/components/ops/use-fixture";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { Sparkline } from "@/components/ui/misc";
import { useNow, useSession } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { metricsCatalog, serverUsage, serviceHealth } from "@/lib/mock/ops";
import { formatMillicores, formatMb, formatRelative, seededSeries } from "@/lib/format";

/**
 * UX-OPS-006 /monitoring — Monitoring overview: CPU/RAM/disk/load trends,
 * service health, the DS-022 server aggregate strip, latency and drill-downs.
 * Metrics show their source, window and last refresh; "Unavailable" is never 0.
 */
export default function MonitoringPage() {
  const now = useNow();
  const { profile } = useSession();
  const health = useFixture(() => serviceHealth);
  const usage = useMemo(() => serverUsage(profile), [profile]);

  const series = useMemo(
    () =>
      Object.fromEntries(
        metricsCatalog.map((m) => [m.key, seededSeries(`ops-${m.key}`, 36, m.base, m.variance)])
      ),
    []
  );

  const metricMeta: { key: string; label: string; value: string; unit: string; tone: "accent" | "warning" | "info" | "success" }[] = [
    { key: "cpu", label: "CPU", value: `${series.cpu[series.cpu.length - 1]}%`, unit: "now", tone: "accent" },
    { key: "ram", label: "RAM", value: formatMb(series.ram[series.ram.length - 1]), unit: "in use", tone: "info" },
    { key: "disk", label: "Disk used", value: `${series.disk[series.disk.length - 1]} GB`, unit: "of 100 GB", tone: "accent" },
    { key: "load", label: "Load (1m)", value: `${(series.load[series.load.length - 1] / 10).toFixed(1)}`, unit: "4 vCPU", tone: "success" },
  ];

  const degraded = health?.filter((h) => h.state !== "healthy") ?? [];

  return (
    <Screen
      id="UX-OPS-006"
      breadcrumbs={[{ label: "Monitoring" }]}
      actions={
        <>
          <ButtonLink href="/monitoring/metrics" variant="secondary" icon="activity">
            Metrics explorer
          </ButtonLink>
          <ButtonLink href="/monitoring/usage" variant="secondary" icon="layers">
            Allocation and usage
          </ButtonLink>
        </>
      }
    >
      <div className="mb-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">Want a guided plan? <a href="/operations/center" className="font-semibold text-accent hover:underline">Open Operations center →</a></div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-2">
            Server <span className="font-medium text-ink">{db.server.name}</span> ({db.server.provider_label}, {db.server.os})
          </p>
          <LiveStatusLine at={db.server.last_seen_at} label="Agent heartbeat" />
        </div>

        {/* DS-022 server aggregate */}
        <AllocationStrip usage={usage} />

        {/* Trend cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricMeta.map((m) => (
            <Card key={m.key}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-ink-3">{m.label}</p>
                  <p className="text-xl font-semibold tabular-nums text-ink">{m.value}</p>
                  <p className="text-xs text-ink-3">{m.unit}</p>
                </div>
                <Sparkline values={series[m.key]} tone={m.tone} width={96} height={32} />
              </div>
              <p className="mt-2 text-xs text-ink-3">Last 36 minutes · agent samples, refreshed {formatRelative(db.server.last_seen_at, now)}</p>
            </Card>
          ))}
        </div>

        {/* Latency + incidents + batch shortcuts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="HTTP p95 latency" description="Across all served sites (nginx measurements)">
            <Sparkline values={series.latency} tone="accent" width={220} height={48} />
            <p className="mt-2 text-sm text-ink-2">
              {series.latency[series.latency.length - 1]} ms now · peak{" "}
              {Math.max(...series.latency)} ms in the window
            </p>
          </Card>
          <Card title="Incidents" description="Open items that need a decision">
            {db.incidents.filter((i) => i.state !== "resolved").length === 0 ? (
              <p className="text-sm text-ink-2">No open incidents. Recent ones are in the incident list.</p>
            ) : (
              <ul className="flex list-none flex-col gap-2 p-0">
                {db.incidents
                  .filter((i) => i.state !== "resolved")
                  .map((i) => (
                    <li key={i.id}>
                      <Link href={`/incidents/${i.id}`} className="text-sm font-medium text-accent hover:underline">
                        {i.title}
                      </Link>
                      <span className="ml-2 align-middle">
                        <StatusPill status={i.severity === "major" || i.severity === "critical" ? "degraded" : "unknown"} />
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <div className="mt-3">
              <ButtonLink href="/incidents" variant="ghost" size="sm" icon="arrow-right">
                All incidents
              </ButtonLink>
            </div>
          </Card>
          <Card title="Batch workloads" description="Backups, transforms and builds are low-priority by design">
            <p className="text-sm text-ink-2">
              Queue position, yields and completions live in the batch queue view —
              queued is the honest state, never “slow” or “failed”.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href="/monitoring/batch" variant="secondary" size="sm">
                Batch queue
              </ButtonLink>
              <ButtonLink href="/monitoring/pressure" variant="secondary" size="sm">
                Memory pressure
              </ButtonLink>
            </div>
          </Card>
        </div>

        {/* Service health */}
        {health === null ? (
          <SkeletonTable rows={4} cols={4} />
        ) : degraded.length > 0 ? (
          <Callout tone="warning" title={`${degraded.length} service${degraded.length > 1 ? "s" : ""} need attention`}>
            {degraded.map((d) => `${d.name} — ${d.detail}`).join(" · ")}
          </Callout>
        ) : (
          <Callout tone="success" title="All services healthy">
            Every monitored service answered its last health check.
          </Callout>
        )}
        {health !== null && (
          <Card title="Service health" description={`Checked ${formatRelative(db.server.last_seen_at, now)} by the agent`}>
            <ul className="divide-y divide-line">
              {health.map((h) => (
                <li key={h.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {h.name} <span className="font-normal text-ink-3">· {h.kind}</span>
                    </p>
                    <p className="text-xs text-ink-3">{h.detail}</p>
                  </div>
                  <StatusPill
                    status={h.state === "healthy" ? "healthy" : h.state === "degraded" ? "degraded" : h.state === "unhealthy" ? "failed" : "unknown"}
                    at={h.last_check_at}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}

        <p className="text-xs text-ink-3">
          CPU figures render as {formatMillicores(usage.cpu_millicores.allocated)} allocated across workloads.
          Drill into per-workload numbers in{" "}
          <Link href="/monitoring/usage" className="text-accent hover:underline">Allocation and usage</Link>.
        </p>
      </div>
    </Screen>
  );
}
