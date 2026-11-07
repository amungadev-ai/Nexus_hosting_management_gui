"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/form";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/misc";
import { UpgradeRecommendation } from "@/components/ui/misc";
import { useOperationStream, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { workloadUsageRows } from "@/lib/mock/ops";
import { submitLimitUpdate } from "@/lib/api/ops";
import { cx, formatMb } from "@/lib/format";

/**
 * UX-OPS-020 /monitoring/pressure — workloads near memory.max, OOM kill
 * history and upgrade recommendations (DS-028). Copy follows spec §14:
 * "using 380 MB of its 400 MB limit… consider upgrading or reducing usage".
 */
export default function MemoryPressurePage() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const rows = useFixture(() => workloadUsageRows());
  const [limitTarget, setLimitTarget] = useState<string>("");

  const pressured = useMemo(() => {
    const all = rows ?? [];
    return all
      .map((w) => ({ ...w, ratio: w.usage.ram_mb.allocated > 0 ? w.usage.ram_mb.current / w.usage.ram_mb.allocated : 0 }))
      .filter((w) => w.ratio > 0.8 || w.usage.oom_events_7d > 0)
      .sort((a, b) => b.ratio - a.ratio);
  }, [rows]);

  const target = pressured.find((p) => p.id === limitTarget) ?? pressured[0];

  const adjust = () => {
    if (!target) return;
    const op = submitLimitUpdate(target.name, target.usage.ram_mb.allocated, Math.round(target.usage.ram_mb.allocated * 1.5));
    setFocusedId(op.id);
    setTrayOpen(true);
    push("success", "Ceiling adjustment submitted", `${target.name} — the operation verifies the value was applied before succeeding.`);
  };

  return (
    <Screen
      id="UX-OPS-020"
      breadcrumbs={[{ label: "Monitoring", href: "/monitoring" }, { label: "Memory pressure" }]}
      actions={
        <ButtonLink href="/system/upgrade" variant="secondary" icon="trending-up">
          Upgrade options
        </ButtonLink>
      }
    >
      {rows === null ? (
        <SkeletonTable rows={4} cols={4} />
      ) : pressured.length === 0 ? (
        <Callout tone="success" title="No memory pressure">
          Every workload is below 80% of its memory ceiling and there are no OOM kills in
          the last 7 days.
        </Callout>
      ) : (
        <>
          <Callout tone="warning" className="mb-4" title={`${pressured.length} workload${pressured.length > 1 ? "s" : ""} near their memory limit`}>
            A workload that hits memory.max is restarted (OOM kill). Adjust the ceiling if
            the VPS has headroom, or upgrade for durable headroom.
          </Callout>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pressured.map((w) => {
              const pct = Math.round(w.ratio * 100);
              return (
                <Card key={w.id} title={w.name} description={w.kind}>
                  <div className="flex items-center gap-2">
                    <StatusPill status={w.ratio >= 0.95 ? "failed" : "degraded"} />
                    {w.usage.oom_events_7d > 0 && (
                      <span className="text-xs font-medium text-warning">
                        {w.usage.oom_events_7d} OOM kill{w.usage.oom_events_7d > 1 ? "s" : ""} (7d)
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <ProgressBar
                      value={w.usage.ram_mb.current}
                      max={w.usage.ram_mb.allocated}
                      tone={w.ratio >= 0.95 ? "danger" : "warning"}
                      showValue
                      label={`Using ${formatMb(w.usage.ram_mb.current)} of its ${formatMb(w.usage.ram_mb.allocated)} limit`}
                    />
                    <p className="mt-2 text-sm text-ink-2">
                      {w.name} is using {formatMb(w.usage.ram_mb.current)} of its{" "}
                      {formatMb(w.usage.ram_mb.allocated)} limit. If it hits the limit, it will
                      be restarted. Consider upgrading or reducing usage.
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setLimitTarget(w.id)}>
                      Adjust ceiling
                    </Button>
                    <ButtonLink size="sm" variant="ghost" href={w.href}>
                      Open workload
                    </ButtonLink>
                  </div>
                </Card>
              );
            })}
          </div>

          {target && (
            <Card title="Adjust ceiling" className="mt-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Workload" htmlFor="limit-target" className="min-w-56">
                  <Select
                    id="limit-target"
                    value={target.id}
                    onChange={(e) => setLimitTarget(e.target.value)}
                  >
                    {pressured.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className={cx("text-sm text-ink-2")}>
                  Proposed memory.max: {formatMb(Math.round(target.usage.ram_mb.allocated * 1.5))} (from{" "}
                  {formatMb(target.usage.ram_mb.allocated)}) — validated against the VPS physical
                  RAM × 1.2 rule before apply.
                </p>
                <Button onClick={adjust} icon="check">
                  Submit adjustment
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {db.recommendations.map((rec) => (
          <UpgradeRecommendation key={rec.id} recommendation={rec} />
        ))}
      </div>
    </Screen>
  );
}
