"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PROFILES } from "@/lib/profiles";
import { useSession } from "@/components/providers";
import { aggregateUsage, serverRamSeries, workloadUsageRows } from "@/lib/mock/overview";
import { Screen } from "@/components/common/screen";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { ProgressBar, Sparkline } from "@/components/ui/misc";
import { formatGb, formatMb, formatMillicores, sparklinePath } from "@/lib/format";

/**
 * UX-OV-009 — Allocation and usage (server level): the aggregate strip plus
 * a per-workload table answering "am I close to my limits?". Allocation is
 * a ceiling, not a reservation — the copy says so.
 */
export default function UsagePage() {
  const { profile } = useSession();
  const router = useRouter();
  const aggregate = useMemo(() => aggregateUsage(), []);
  const rows = useMemo(() => workloadUsageRows(), []);
  const series = useMemo(() => serverRamSeries(), []);
  const p = PROFILES[profile];

  const overcommitted = aggregate.ram_mb.allocated > p.specs.ram_mb;

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "label",
      header: "Workload",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{r.label}</p>
          <p className="truncate text-xs text-ink-2">{r.detail}</p>
        </div>
      ),
      className: "min-w-56",
    },
    {
      key: "ram",
      header: "RAM (current / ceiling)",
      render: (r) => (
        <div className="w-44 min-w-36">
          <ProgressBar
            value={r.usage.ram_mb.current}
            max={r.usage.ram_mb.allocated}
            tone={r.usage.ram_mb.current / Math.max(1, r.usage.ram_mb.allocated) > 0.8 ? "warning" : "accent"}
            label="RAM"
          />
          <p className="mt-1 text-xs tabular-nums text-ink-3">
            {formatMb(r.usage.ram_mb.current)} / {formatMb(r.usage.ram_mb.allocated)} · peak {formatMb(r.usage.ram_mb.peak)}
          </p>
        </div>
      ),
    },
    {
      key: "cpu",
      header: "CPU (current / ceiling)",
      render: (r) => (
        <div className="w-40 min-w-32">
          <ProgressBar value={r.usage.cpu_millicores.current} max={r.usage.cpu_millicores.allocated} tone="accent" label="CPU" />
          <p className="mt-1 text-xs tabular-nums text-ink-3">
            {formatMillicores(r.usage.cpu_millicores.current)} / {formatMillicores(r.usage.cpu_millicores.allocated)}
          </p>
        </div>
      ),
    },
    {
      key: "trend",
      header: "30-day RAM trend",
      render: (r) => <Sparkline values={r.ramSeries} tone="accent" />,
    },
  ];

  return (
    <Screen
      id="UX-OV-009"
      breadcrumbs={[{ label: "Overview", href: "/overview" }, { label: "Usage" }]}
      actions={
        <>
          <ButtonLink href="/monitoring/usage" variant="secondary">
            Monitoring view
          </ButtonLink>
          <ButtonLink href="/system/upgrade" icon="trending-up">
            Upgrade
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <AllocationStrip usage={aggregate} />

        <Card
          title={`VPS profile: ${p.label}`}
          description={`${p.tagline} · sum of workload ceilings ${formatMb(aggregate.ram_mb.allocated)} · disk used ${formatGb(aggregate.disk_gb.current)} of ${formatGb(p.specs.disk_gb)}`}
        >
          {overcommitted ? (
            <Callout tone="warning" title="Ceilings exceed the selected profile's RAM">
              The demo portfolio was recorded on a Standard-size VPS. With the {p.label} profile selected
              ({formatMb(p.specs.ram_mb)}), the recorded ceilings sum to {formatMb(aggregate.ram_mb.allocated)} —
              ceilings are per-workload maximums, not reservations, which is exactly why the honest usage view
              shows measured current / typical / peak instead.
            </Callout>
          ) : (
            <p className="text-sm text-ink-2">
              Headroom to the RAM ceiling: {formatMb(Math.max(0, p.specs.ram_mb - aggregate.ram_mb.allocated))}.
            </p>
          )}
          <div className="mt-3">
            <p className="text-xs font-medium text-ink-2">Server RAM, last 30 days (seeded demo series)</p>
            <svg viewBox="0 0 480 56" className="mt-1 h-14 w-full text-accent" role="img" aria-label="Server RAM over 30 days">
              <path d={sparklinePath(series, 480, 56)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
        </Card>

        <DataTable
          caption="Per-workload allocation and usage"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => {
            if (r.href !== null) router.push(r.href);
          }}
          emptyState={
            <p className="p-4 text-sm text-ink-2">
              No workloads yet — usage rows appear as soon as a website, app or service exists.
            </p>
          }
        />

        <p className="px-1 text-xs text-ink-2">
          Updated every 60s by the agent — numbers are point-in-time, not reservations. Typical is the 7-day p50,
          peak the 24h p99; allocation is the cgroup ceiling this workload may use up to.
        </p>
      </div>
    </Screen>
  );
}
