"use client";

import React from "react";
import { cx, formatRelative, formatMb, formatGb, formatMillicores, formatDuration } from "@/lib/format";
import type { UsageSnapshot } from "@/lib/types";
import { ProgressBar } from "@/components/ui/misc";
import { Icon } from "@/components/ui/icons";

/**
 * DS-022 Allocation/usage strip — compact strip below the page header on
 * workload detail pages ("am I close to my limits?"). Allocation is a
 * ceiling, not a reservation: current / typical (7-day p50) / peak (24h p99)
 * are measured; the copy says so. Horizontal scroll on mobile — cells never
 * wrap, each workload stays reachable. RAM > 80% of allocation warns,
 * >= 95% escalates — always icon + text, never color alone.
 */

export function AllocationStrip({ usage }: { usage: UsageSnapshot }) {
  const ram = usage.ram_mb;
  const cpu = usage.cpu_millicores;
  const disk = usage.disk_gb;

  const ramRatio = ram.allocated > 0 ? ram.current / ram.allocated : 0;
  const ramTone = ramRatio >= 0.95 ? "danger" : ramRatio > 0.8 ? "warning" : "accent";

  return (
    <section
      aria-label="Resource allocation and usage"
      className="rounded-card border border-line bg-surface p-4"
    >
      <div className="flex snap-x flex-nowrap gap-6 overflow-x-auto pb-1">
        {/* RAM */}
        <div className="min-w-44 shrink-0 snap-start">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-2">RAM</span>
            <span className="text-xs tabular-nums text-ink-3">
              {formatMb(ram.current)} / {formatMb(ram.allocated)}
            </span>
          </div>
          <ProgressBar
            value={ram.current}
            max={ram.allocated}
            tone={ramTone}
            label={`RAM usage: ${formatMb(ram.current)} of ${formatMb(ram.allocated)} allocated`}
          />
          <p className="mt-1 text-xs text-ink-3">
            typical {formatMb(ram.typical)} · peak {formatMb(ram.peak)}
          </p>
          {ramRatio > 0.8 && (
            <p
              className={cx(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                ramRatio >= 0.95 ? "text-danger" : "text-warning"
              )}
            >
              <Icon name="alert-triangle" size={12} className="shrink-0" />
              close to limit
            </p>
          )}
        </div>

        {/* CPU */}
        <div className="min-w-44 shrink-0 snap-start">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-2">CPU</span>
            <span className="text-xs tabular-nums text-ink-3">
              {formatMillicores(cpu.current)} / {formatMillicores(cpu.allocated)}
            </span>
          </div>
          <ProgressBar
            value={cpu.current}
            max={cpu.allocated}
            tone="accent"
            label={`CPU usage: ${formatMillicores(cpu.current)} of ${formatMillicores(cpu.allocated)} allocated`}
          />
          <p className="mt-1 text-xs text-ink-3">
            typical {formatMillicores(cpu.typical)} · peak {formatMillicores(cpu.peak)}
          </p>
        </div>

        {/* Disk — the usage API tracks current/allocated only; no typical/peak claim. */}
        <div className="min-w-44 shrink-0 snap-start">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-ink-2">Disk</span>
            <span className="text-xs tabular-nums text-ink-3">
              {formatGb(disk.current)} / {formatGb(disk.allocated)}
            </span>
          </div>
          <ProgressBar
            value={disk.current}
            max={disk.allocated}
            tone="accent"
            label={`Disk usage: ${formatGb(disk.current)} of ${formatGb(disk.allocated)} allocated`}
          />
        </div>

        {/* Throttling — informational, never an error (DS-022/§5 throttled state). */}
        {usage.throttled_seconds_24h > 0 && (
          <div className="min-w-44 shrink-0 snap-start">
            <p className="flex items-center gap-1 text-xs font-medium text-info">
              <Icon name="info" size={12} className="shrink-0" />
              Throttled {formatDuration(usage.throttled_seconds_24h)}
            </p>
            <p className="mt-1.5 text-xs text-ink-3">
              yielding to site traffic — this is normal
            </p>
          </div>
        )}

        {/* OOM events — honest memory-pressure signal. */}
        {usage.oom_events_7d > 0 && (
          <div className="min-w-44 shrink-0 snap-start">
            <p className="flex items-center gap-1 text-xs font-medium text-warning">
              <Icon name="alert-triangle" size={12} className="shrink-0" />
              {usage.oom_events_7d} OOM events (7d)
            </p>
            <p className="mt-1.5 text-xs text-ink-3">
              the workload hit its memory limit
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-2 text-xs text-ink-3">
        <p>
          Allocation is a ceiling, not a reservation — this workload may use up
          to {formatMb(ram.allocated)}, typical is {formatMb(ram.typical)}.
        </p>
        <p>updated {formatRelative(usage.updated_at)}</p>
      </div>
    </section>
  );
}
