"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { ErrorBlock } from "@/components/ui/feedback";
import { OperationTimeline } from "@/components/common/operation-timeline";
import { KeyValue } from "@/components/ui/misc";
import { LogViewer } from "@/components/ui/code";
import { retryDeployment } from "@/lib/api/web";
import { appLogLines, deploymentOperation, deploymentsForApp } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";

/**
 * UX-WEB-011 — Deployment detail: build/run timeline (DS-011), errors with
 * safe codes and correlation IDs, artifact and verification. Retry submits a
 * new attempt (attempt 2 — not a duplicate resource).
 */
export function AppDeploymentDetailView({ deployId }: { deployId: string }) {
  const deploy = useMemo(() => deploymentsForApp("").concat([]).find(() => false), []); // placeholder guard
  const found = useMemo(
    () => [deploy].filter(Boolean).length > 0 ? deploy : undefined,
    [deploy]
  );
  return <DeploymentBody deployId={deployId} found={found} />;
}

function DeploymentBody({ deployId }: { deployId: string; found?: unknown }) {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [retrying, setRetrying] = useState(false);
  const dep = useMemo(() => {
    for (const appId of db.applications.map((a) => a.id)) {
      const hit = deploymentsForApp(appId).find((d) => d.id === deployId);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }, [deployId]);
  const app = useMemo(() => (dep === undefined ? undefined : db.applications.find((a) => a.id === dep.app_id)), [dep]);
  const op = useMemo(() => (dep === undefined ? undefined : deploymentOperation(dep)), [dep]);

  if (dep === undefined || app === undefined) {
    return (
      <Screen id="UX-WEB-011" breadcrumbs={[{ label: "Applications", href: "/apps" }]}>
        <NotFoundInline what="deployment" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Applications", href: "/apps" },
    { label: app.name, href: `/apps/${app.id}` },
    { label: "Deployments", href: `/apps/${app.id}/deployments` },
    { label: dep.commit_sha },
  ];

  const doRetry = async () => {
    setRetrying(true);
    try {
      const res = await retryDeployment(app.name, dep.commit_sha);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Retry accepted", `Attempt 2 for ${dep.commit_sha} is queued — the running release keeps serving until this one verifies.`);
    } catch {
      push("error", "Retry was not accepted", "Try again.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Screen
      id="UX-WEB-011"
      breadcrumbs={crumbs}
      actions={
        <>
          {dep.status === "failed" && (
            <Button icon="refresh" onClick={doRetry} loading={retrying}>
              Retry
            </Button>
          )}
          <Link href={`/apps/${app.id}/deployments`} className="text-sm font-medium text-accent hover:underline">
            All deployments
          </Link>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusPill status={dep.status === "succeeded" ? "succeeded" : "failed"} />
        <Chip tone="neutral">{dep.source === "git" ? `git ${dep.branch}` : "upload"}</Chip>
        <span className="font-mono text-xs text-ink-2">{dep.commit_sha}</span>
      </div>

      {op !== undefined && <OperationTimeline operation={op} />}

      {dep.status === "failed" && dep.error !== undefined && op !== undefined && (
        <ErrorBlock
          className="mt-4"
          code={dep.error.code}
          detail={dep.error.detail}
          correlationId={op.correlation_id}
          onRetry={doRetry}
        />
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Artifact & verification">
          <KeyValue
            items={[
              { label: "Release", value: <span className="font-mono text-xs">{dep.release_id}</span> },
              { label: "Artifact digest", value: <span className="font-mono text-xs">{dep.artifact_digest}</span> },
              { label: "Actor", value: dep.actor_label },
              { label: "Health after deploy", value: dep.status === "succeeded" ? dep.health_after : "unknown — release never activated" },
            ]}
          />
        </Card>
        <Card title="Build logs" description="Secret values are redacted before logs reach the UI.">
          <LogViewer lines={appLogLines.slice(0, 5)} />
        </Card>
      </div>
    </Screen>
  );
}
