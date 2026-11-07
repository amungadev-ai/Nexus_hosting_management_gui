"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/common/screen";
import { NotFoundInline } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { TableCard } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { rollbackDeployment } from "@/lib/api/web";
import { deploymentsForApp, type DeploymentFixture } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";
import { formatRelative, formatDateTime } from "@/lib/format";

/**
 * UX-WEB-010 — Deployment history: commit, actor, health and rollback
 * eligibility. Compare shows a side-by-side of two selected deploys; rollback
 * confirms the exact target and submits a tracked operation.
 */
export function AppDeploymentsView({ appId }: { appId: string }) {
  const app = useMemo(() => db.applications.find((a) => a.id === appId), [appId]);
  const deployments = useMemo(() => deploymentsForApp(appId), [appId]);
  const router = useRouter();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<DeploymentFixture | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  if (app === undefined) {
    return (
      <Screen id="UX-WEB-010" breadcrumbs={[{ label: "Applications", href: "/apps" }]}>
        <NotFoundInline what="application" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Applications", href: "/apps" },
    { label: app.name, href: `/apps/${app.id}` },
    { label: "Deployments" },
  ];

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id]));
  };

  const a = deployments.find((d) => d.id === selected[0]);
  const b = deployments.find((d) => d.id === selected[1]);

  const doRollback = async () => {
    if (rollbackTarget === null) return;
    setRollingBack(true);
    try {
      const res = await rollbackDeployment(app.name, rollbackTarget.commit_sha);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Rollback accepted", `${app.name} will serve ${rollbackTarget.commit_sha} again once the job verifies the health check. The failed release is retained.`);
    } catch {
      push("error", "Rollback was not accepted", "Try again — the current release keeps serving.");
    } finally {
      setRollingBack(false);
      setRollbackTarget(null);
    }
  };

  const canRollbackTo = (d: DeploymentFixture) => d.status === "succeeded";

  return (
    <Screen
      id="UX-WEB-010"
      breadcrumbs={crumbs}
      actions={
        <Button
          variant="secondary"
          icon="list"
          disabled={selected.length !== 2}
          onClick={() => setCompareOpen(true)}
        >
          {selected.length === 2 ? "Compare selected" : "Select two to compare"}
        </Button>
      }
    >
      {deployments.length === 0 ? (
        <EmptyState
          icon="upload"
          title="No deployments yet"
          body="Every deploy is a tracked job with a verified health check. Deploy from Git or upload an archive to create the first release."
          action={{ label: "Open app to deploy", href: `/apps/${app.id}` }}
        />
      ) : (
        <TableCard<DeploymentFixture>
          title="Deployment history"
          caption="Commit, actor, logs, health and rollback eligibility"
          rowKey={(d) => d.id}
          columns={[
            {
              key: "commit_sha",
              header: "Commit",
              render: (d) => (
                <Link href={`/apps/${app.id}/deployments/${d.id}`} className="min-w-0 text-accent hover:underline">
                  <span className="font-mono text-xs">{d.commit_sha}</span>
                  <span className="block max-w-64 truncate text-xs text-ink">{d.commit_message}</span>
                </Link>
              ),
            },
            {
              key: "source",
              header: "Source",
              render: (d) => <Chip tone="neutral">{d.source === "git" ? `git ${d.branch}` : "upload"}</Chip>,
            },
            { key: "actor_label", header: "Actor", render: (d) => <span className="whitespace-nowrap text-xs text-ink-2">{d.actor_label}</span> },
            {
              key: "status",
              header: "Result",
              render: (d) => (
                <span className="flex flex-wrap items-center gap-2">
                  <StatusPill status={d.status === "succeeded" ? "succeeded" : "failed"} />
                  {d.status === "succeeded" && <Chip tone={d.health_after === "healthy" ? "success" : "warning"}>{d.health_after}</Chip>}
                </span>
              ),
            },
            {
              key: "created_at",
              header: "When",
              sortable: true,
              render: (d) => (
                <span className="whitespace-nowrap text-xs text-ink-2">
                  {formatRelative(d.created_at)}
                  <span className="block">{formatDateTime(d.created_at)}</span>
                </span>
              ),
            },
            {
              key: "rollback",
              header: "Rollback",
              render: (d) =>
                canRollbackTo(d) ? (
                  <Button size="sm" variant="ghost" onClick={() => setRollbackTarget(d)}>
                    Roll back to this
                  </Button>
                ) : (
                  <span className="text-xs text-ink-3">Not eligible — failed release</span>
                ),
            },
            {
              key: "select",
              header: "Compare",
              render: (d) => (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(d.id)}
                    onChange={() => toggleSelect(d.id)}
                    aria-label={`Select ${d.commit_sha} for comparison`}
                    className="h-4 w-4 accent-accent"
                  />
                  select
                </label>
              ),
            },
          ]}
          rows={deployments}
        />
      )}

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Compare deployments"
        size="lg"
        description="Artifact and commit differences between the two selected deploys."
        footer={<Button variant="secondary" onClick={() => setCompareOpen(false)}>Close</Button>}
      >
        <KeyValue
          columns={2}
          items={[
            { label: "Commit A", value: <span className="font-mono text-xs">{a?.commit_sha ?? "—"}</span> },
            { label: "Commit B", value: <span className="font-mono text-xs">{b?.commit_sha ?? "—"}</span> },
            { label: "Message A", value: a?.commit_message ?? "—" },
            { label: "Message B", value: b?.commit_message ?? "—" },
            { label: "Artifact A", value: <span className="font-mono text-xs">{a?.artifact_digest ?? "—"}</span> },
            { label: "Artifact B", value: <span className="font-mono text-xs">{b?.artifact_digest ?? "—"}</span> },
            { label: "Result A", value: a?.status ?? "—" },
            { label: "Result B", value: b?.status ?? "—" },
          ]}
        />
      </Modal>

      <ConfirmDialog
        open={rollbackTarget !== null}
        onClose={() => setRollbackTarget(null)}
        onConfirm={doRollback}
        title={`Roll back ${app.name} to ${rollbackTarget?.commit_sha ?? ""}`}
        confirmLabel={`Roll back to ${rollbackTarget?.commit_sha ?? ""}`}
        body={
          <>
            <p>
              {app.name} will serve commit <span className="font-mono">{rollbackTarget?.commit_sha}</span> (”
              {rollbackTarget?.commit_message}”) again. The current release keeps serving until the rollback
              passes its health check.
            </p>
            <p className="mt-2 text-xs text-ink-3">
              Rollback uses the retained artifact {rollbackTarget?.artifact_digest}. Expired artifacts are
              reported honestly (ARTIFACT_EXPIRED) — never guessed.
            </p>
          </>
        }
      />

      <Card title="Logs & verification" className="mt-4">
        <p className="text-sm text-ink-2">
          Build and run logs live on each deployment&apos;s detail page — open a commit above to inspect the
          timeline, errors and artifact.{" "}
          <Link href={`/apps/${app.id}/logs`} className="text-accent hover:underline">Streaming app logs</Link> are separate.
        </p>
        {selected.length === 1 && (
          <p className="mt-2 text-xs text-ink-3">One commit selected — select one more to compare.</p>
        )}
      </Card>
    </Screen>
  );
}
