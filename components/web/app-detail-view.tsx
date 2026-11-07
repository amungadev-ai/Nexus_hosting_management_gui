"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { LiveStatusLine, NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { EmptyState, Callout } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { JobLink } from "@/components/web/web-bits";
import { deployApp, restartApp } from "@/lib/api/web";
import { deploymentsForApp } from "@/lib/mock/web";
import { webProcesses } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";
import { formatMb } from "@/lib/format";
import { jobHref } from "@/lib/job-routes";

/**
 * UX-WEB-009 — Application overview: URL, build, runtime, process and recent
 * deploys with the DS-022 allocation/usage strip below the page header.
 * Actions: Deploy, Restart. Memory pressure surfaces the honest DS-028 copy.
 */
export function AppDetailView({ appId }: { appId: string }) {
  const app = useMemo(() => db.applications.find((a) => a.id === appId), [appId]);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId, list } = useOperationStream();
  const [deploying, setDeploying] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const deployments = useMemo(() => deploymentsForApp(appId), [appId]);
  const processes = useMemo(() => webProcesses.filter((p) => p.app_id === appId), [appId]);
  const appOps = useMemo(() => list.filter((o) => o.resource_ref.id === appId).slice(0, 3), [list]);

  if (app === undefined) {
    return (
      <Screen id="UX-WEB-009" breadcrumbs={[{ label: "Applications", href: "/apps" }]}>
        <NotFoundInline what="application" />
      </Screen>
    );
  }

  const healthStatus = app.status === "active" ? (app.health === "healthy" ? "healthy" : app.health === "degraded" ? "degraded" : "unknown") : "provisioning";
  const ramRatio = app.usage.ram_mb.allocated > 0 ? app.usage.ram_mb.current / app.usage.ram_mb.allocated : 0;
  const pressure = ramRatio > 0.8;

  const doDeploy = async () => {
    setDeploying(true);
    try {
      const res = await deployApp(app.id, app.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Deploy accepted", `${app.name} build is queued — the running release keeps serving traffic until the new one verifies.`);
    } catch {
      push("error", "Deploy was not accepted", "Try again — nothing changed.");
    } finally {
      setDeploying(false);
    }
  };

  const doRestart = async () => {
    setRestarting(true);
    try {
      const res = await restartApp(app.id, app.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Restart accepted", `${app.name} restarts gracefully — health is checked before completion.`);
    } catch {
      push("error", "Restart was not accepted", "Try again.");
    } finally {
      setRestarting(false);
    }
  };

  const crumbs = [
    { label: "Applications", href: "/apps" },
    { label: app.name },
  ];

  return (
    <Screen
      id="UX-WEB-009"
      breadcrumbs={crumbs}
      actions={
        <>
          <Button icon="upload" onClick={doDeploy} loading={deploying}>
            Deploy
          </Button>
          <Button variant="secondary" icon="refresh" onClick={doRestart} loading={restarting}>
            Restart
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusPill status={healthStatus} at={app.last_verified_at} />
        <Chip tone={app.category === "batch" ? "info" : "neutral"}>{app.category === "batch" ? "batch workload" : "serving"}</Chip>
        <LiveStatusLine at={app.last_verified_at} label={`Health of ${app.name}`} />
      </div>

      <AllocationStrip usage={app.usage} />

      {pressure && (
        <Callout tone="warning" title="Memory pressure" className="mt-4">
          {app.name} is using {formatMb(app.usage.ram_mb.current)} of its {formatMb(app.usage.ram_mb.allocated)} limit. If it
          hits the limit, it will be restarted. Consider upgrading or reducing usage.{" "}
          <Link href="/overview/recommendations" className="font-medium text-accent hover:underline">View the evidence</Link>
        </Callout>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Build & runtime">
          <KeyValue
            items={[
              { label: "Runtime", value: `${app.runtime === "node" ? "Node.js" : app.runtime === "php" ? "PHP" : "Python"} ${app.runtime_version}` },
              { label: "Workload category", value: app.category === "batch" ? "batch — yields to site traffic (immutable)" : "serving" },
              {
                label: "Git",
                value: (
                  <Link href={`/apps/${app.id}/git`} className="text-accent hover:underline">
                    Connected repositories
                  </Link>
                ),
              },
              {
                label: "Runtime settings",
                value: (
                  <Link href={`/apps/${app.id}/runtime`} className="text-accent hover:underline">
                    Versions, ports, limits
                  </Link>
                ),
              },
            ]}
          />
        </Card>

        <Card title="Process & recent deploys">
          <ul className="flex list-none flex-col gap-2 p-0 text-sm">
            {processes.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-ink">
                  <span className="font-mono text-xs">{p.command}</span>
                  <span className="ml-2 text-xs text-ink-2">×{p.replicas}</span>
                </span>
                <StatusPill status={p.state === "running" ? "running" : p.state === "stopped" ? "offline" : "pending"} />
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-3">
            {deployments.length === 0 ? (
              <EmptyState icon="upload" title="No deployments yet" body="Deploy to create the first release." action={{ label: "Deploy", onClick: doDeploy }} />
            ) : (
              <ul className="flex list-none flex-col gap-2 p-0">
                {deployments.slice(0, 3).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Link href={`/apps/${app.id}/deployments/${d.id}`} className="min-w-0 truncate text-accent hover:underline">
                      <span className="font-mono text-xs">{d.commit_sha}</span> {d.commit_message}
                    </Link>
                    <StatusPill status={d.status === "succeeded" ? "succeeded" : "failed"} />
                  </li>
                ))}
                <li>
                  <Link href={`/apps/${app.id}/deployments`} className="text-sm font-medium text-accent hover:underline">
                    All deployments →
                  </Link>
                </li>
              </ul>
            )}
          </div>
        </Card>

        <Card title="Operations" className="lg:col-span-2" description="Recent tracked jobs for this app — completion is only claimed once verified.">
          {appOps.length === 0 ? (
            <p className="text-sm text-ink-2">No recent operations.</p>
          ) : (
            <ul className="flex list-none flex-col gap-2 p-0">
              {appOps.map((op) => (
                <li key={op.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-b-0">
                  <span className="min-w-0 text-sm">
                    <Link href={jobHref(op.id)} className="font-medium text-accent hover:underline">{op.title}</Link>
                  </span>
                  <JobLink operationId={op.id} />
                </li>
              ))}
            </ul>
          )}
          {appOps.some((o) => o.status !== "succeeded" && o.status !== "failed" && o.status !== "cancelled") && (
            <div className="mt-3">
              {appOps
                .filter((o) => o.status !== "succeeded" && o.status !== "failed" && o.status !== "cancelled")
                .map((o) => (
                  <PendingState key={o.id} operation={o} />
                ))}
            </div>
          )}
        </Card>
      </div>
    </Screen>
  );
}
