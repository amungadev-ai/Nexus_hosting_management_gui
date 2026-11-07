"use client";

import React, { useState } from "react";
import { findServiceInstance, templateForKey, TRANSFORM_RUNS, TRANSFORM_SIZES } from "@/lib/mock/services";
import { useCapability, useOperationStream, useSession, useToast } from "@/components/providers";
import { applyTransformConfig } from "@/lib/api/services";
import { ApiError } from "@/lib/api/core";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine, NotFoundInline, PendingState } from "@/components/common/states";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { Switch } from "@/components/ui/form";
import { KeyValue } from "@/components/ui/misc";
import { formatDuration, formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";
import type { Operation } from "@/lib/types";
import type { TransformRun } from "@/lib/mock/services";

/** UX-SVC-005 — Transform pipeline: named sizes, on-the-fly vs pre-transform, batch runs. */
export default function TransformView({ instanceId }: { instanceId: string }) {
  const instance = findServiceInstance(instanceId);
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();
  const cap = useCapability("service.transform");
  const now = useNow();
  const [onTheFly, setOnTheFly] = useState(true);
  const [pendingOp, setPendingOp] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);

  if (instance === undefined || templateForKey(instance.template_key)?.category !== "transform") {
    return (
      <Screen id="UX-SVC-005" breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: "Transform" }]}>
        <NotFoundInline what="transform pipeline" />
      </Screen>
    );
  }

  const apply = async () => {
    setBusy(true);
    try {
      const res = await applyTransformConfig(instance);
      setPendingOp(res.data.operation);
      push("success", "Transform rules submitted", "The pipeline re-validates and purges its cache — your sites stay responsive throughout.");
      setTrayOpen(true);
    } catch (e) {
      push("error", "Apply failed", e instanceof ApiError ? e.problem.detail : "Try again or contact support.");
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<TransformRun>[] = [
    { key: "rule", header: "Rule", render: (r) => <span className="min-w-48">{r.rule}</span> },
    { key: "source", header: "Source", render: (r) => <span className="break-all font-mono text-xs text-ink-2">{r.source}</span> },
    { key: "images", header: "Images", render: (r) => <span className="tabular-nums">{r.images}</span> },
    {
      key: "status",
      header: "State",
      render: (r) => (
        <span className="flex items-center gap-2">
          <Chip tone={r.status === "succeeded" ? "success" : r.status === "queued" ? "info" : "accent"}>
            {r.status === "queued" ? `queued · position ${r.queue_position ?? 1}` : r.status}
          </Chip>
          {r.status !== "succeeded" && <Chip tone="info">batch</Chip>}
        </span>
      ),
    },
    {
      key: "duration_seconds",
      header: "Duration",
      render: (r) => (r.duration_seconds === null ? "—" : formatDuration(r.duration_seconds)),
    },
    { key: "started_at", header: "Started", render: (r) => <span className="whitespace-nowrap">{formatRelative(r.started_at, now)}</span> },
  ];

  return (
    <Screen
      id="UX-SVC-005"
      breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: instance.name }]}
      actions={
        <>
          <Button icon="zap" loading={busy} onClick={() => void apply()} disabled={cap.state === "unavailable"}>
            Apply rules
          </Button>
          <ButtonLink href="/monitoring/batch" variant="secondary">
            View batch queue
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">imgproxy {instance.version}</Chip>
          <Chip tone="info">batch workload</Chip>
          <span className="font-mono text-xs text-ink-2">{instance.hostname}</span>
          <LiveStatusLine at={instance.usage.updated_at} label="Pipeline health" />
        </div>

        <Callout tone="info" title="Transforms run when the server is idle">
          Transforms will run when the server is idle. Under site traffic, they queue. Your sites stay responsive —
          queued is the normal state, never a failure.
        </Callout>

        <AllocationStrip usage={instance.usage} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Named sizes" description="Pre-generated variants; storage cost is estimated per 1,000 source images.">
            <ul className="flex list-none flex-col gap-2 p-0">
              {TRANSFORM_SIZES.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-2 border-b border-line pb-2 last:border-b-0">
                  <span className="text-sm font-medium text-ink">
                    {s.name} <span className="font-normal text-ink-2">· {s.width}×{s.height}</span>
                  </span>
                  <span className="text-xs tabular-nums text-ink-3">≈ {s.est_storage_mb_per_1000} MB / 1k images</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Mode and cache">
            <div className="flex flex-col gap-4">
              <Switch
                checked={onTheFly}
                onChange={setOnTheFly}
                label="On-the-fly transformation via URL params"
              />
              {onTheFly && (
                <Callout tone="warning" title="Cache on-the-fly results">
                  On-the-fly transforms cost CPU per request. Keep the transform cache warm (default 7 days) or
                  pre-generate the named sizes instead on busy sites.
                </Callout>
              )}
              <KeyValue
                items={[
                  { label: "Cache policy", value: "public, max-age 7d, stale-while-revalidate" },
                  { label: "CPU allocation", value: "cpu.weight 10 · cpu.max 50% of cores (batch)" },
                  { label: "Yielded in last 24h", value: `${formatDuration(instance.usage.throttled_seconds_24h)} — yielding to site traffic is normal` },
                ]}
              />
            </div>
          </Card>
        </div>

        {pendingOp !== null && <PendingState operation={pendingOp} />}

        <DataTable
          caption="Recent transform runs"
          columns={columns}
          rows={TRANSFORM_RUNS}
          rowKey={(r) => r.id}
          emptyState={<Callout tone="info">No runs yet — transforms start when a site requests a size or a batch is queued.</Callout>}
        />
      </div>
    </Screen>
  );
}
