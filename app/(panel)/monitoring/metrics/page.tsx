"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { Sparkline } from "@/components/ui/misc";
import { useNow } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { metricsCatalog } from "@/lib/mock/ops";
import { downloadCsv } from "@/lib/api/ops";
import { formatRelative, seededSeries } from "@/lib/format";

/**
 * UX-OPS-007 /monitoring/metrics — Metrics explorer: timeseries, comparison,
 * filters and freshness. Charts are seeded series (deterministic per metric +
 * window); the source, measurement period and last refresh are always shown.
 */
const WINDOWS = [
  { value: "1h", label: "Last hour", points: 36, stepMin: 1 },
  { value: "24h", label: "Last 24 hours", points: 48, stepMin: 30 },
  { value: "7d", label: "Last 7 days", points: 56, stepMin: 180 },
];

export default function MetricsExplorerPage() {
  const now = useNow();
  const catalog = useFixture(() => metricsCatalog);
  const [metricKey, setMetricKey] = useState(metricsCatalog[0]?.key ?? "cpu");
  const [compareKey, setCompareKey] = useState("none");
  const [window, setWindow] = useState("24h");

  const metric = metricsCatalog.find((m) => m.key === metricKey) ?? metricsCatalog[0];
  const compare = metricsCatalog.find((m) => m.key === compareKey);
  const win = WINDOWS.find((w) => w.value === window) ?? WINDOWS[1];

  const main = useMemo(
    () => seededSeries(`ops-${metricKey}-${window}`, win.points, metric.base, metric.variance),
    [metricKey, window, metric.base, metric.variance, win.points]
  );
  const comparison = useMemo(
    () =>
      compare
        ? seededSeries(`ops-${compare.key}-${window}`, win.points, compare.base, compare.variance)
        : [],
    [compare, window, win.points]
  );

  const exportCsv = () => {
    const header = ["ts_offset_minutes", metricKey, ...(compare ? [compare.key] : [])];
    const rows = main.map((v, i) => [
      String(i * win.stepMin),
      String(v),
      ...(comparison.length > 0 ? [String(comparison[i])] : []),
    ]);
    downloadCsv(`metrics-${metricKey}-${window}.csv`, header, rows);
  };

  const last = main[main.length - 1];
  const peak = Math.max(...main);
  const avg = Math.round(main.reduce((a, b) => a + b, 0) / main.length);

  return (
    <Screen
      id="UX-OPS-007"
      breadcrumbs={[{ label: "Monitoring", href: "/monitoring" }, { label: "Metrics" }]}
      actions={
        <Button variant="secondary" icon="download" onClick={exportCsv}>
          Export CSV
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Metric" htmlFor="metric-select">
              <Select id="metric-select" value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
                {metricsCatalog.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Compare with" htmlFor="metric-compare">
              <Select id="metric-compare" value={compareKey} onChange={(e) => setCompareKey(e.target.value)}>
                <option value="none">No comparison</option>
                {metricsCatalog
                  .filter((m) => m.key !== metricKey)
                  .map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Window" htmlFor="metric-window">
              <Select id="metric-window" value={window} onChange={(e) => setWindow(e.target.value)}>
                {WINDOWS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        {catalog === null ? (
          <SkeletonTable rows={3} cols={3} />
        ) : (
          <Card
            title={metric.label}
            description={metric.description}
            footer={
              <span>
                Source: agent + nginx samples · measurement period {win.label} · last refresh{" "}
                {formatRelative(db.server.last_seen_at, now)} · missing samples: 0
              </span>
            }
          >
            <div className="overflow-x-auto">
              <Sparkline values={main} tone="accent" width={640} height={120} />
            </div>
            {comparison.length > 0 && compare && (
              <div className="mt-3 overflow-x-auto">
                <p className="mb-1 text-xs text-ink-3">{compare.label}</p>
                <Sparkline values={comparison} tone="info" width={640} height={80} />
              </div>
            )}
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-3">Now</dt>
                <dd className="font-medium tabular-nums text-ink">
                  {last}
                  {metric.unit !== "" ? ` ${metric.unit}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Peak in window</dt>
                <dd className="font-medium tabular-nums text-ink">
                  {peak}
                  {metric.unit !== "" ? ` ${metric.unit}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Average</dt>
                <dd className="font-medium tabular-nums text-ink">
                  {avg}
                  {metric.unit !== "" ? ` ${metric.unit}` : ""}
                </dd>
              </div>
            </dl>
          </Card>
        )}

        <Callout tone="info" title="Unavailability is honest">
          If the agent stops reporting, this explorer shows “Unavailable” for the affected
          metric — it never substitutes zero, and the window shows when samples stopped.
        </Callout>
      </div>
    </Screen>
  );
}
