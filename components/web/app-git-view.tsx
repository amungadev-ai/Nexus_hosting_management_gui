"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { TableCard } from "@/components/ui/table";
import { Field, Input } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { EmptyState, Callout } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/code";
import { connectGit, disconnectGit } from "@/lib/api/web";
import { webGitConnections, type GitConnectionFixture } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";

/** UX-WEB-015 — Git connections: repo, branch, webhook and deploy-key permissions. */
export function AppGitView({ appId }: { appId: string }) {
  const app = useMemo(() => db.applications.find((a) => a.id === appId), [appId]);
  const connections = useMemo(() => webGitConnections.filter((g) => g.app_id === appId), [appId]);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId, list } = useOperationStream();
  const [connectOpen, setConnectOpen] = useState(false);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [repoError, setRepoError] = useState<string | undefined>(undefined);
  const [disconnectTarget, setDisconnectTarget] = useState<GitConnectionFixture | null>(null);
  const [busy, setBusy] = useState(false);

  const runningOp = list.find(
    (o) => o.kind.startsWith("app.git.") && o.status !== "succeeded" && o.status !== "failed"
  );

  if (app === undefined) {
    return (
      <Screen id="UX-WEB-015" breadcrumbs={[{ label: "Applications", href: "/apps" }]}>
        <NotFoundInline what="application" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Applications", href: "/apps" },
    { label: app.name, href: `/apps/${app.id}` },
    { label: "Git" },
  ];

  const doConnect = async () => {
    if (!/^https?:\/\/.+/.test(repo.trim())) {
      setRepoError("Enter an https:// repository URL.");
      return;
    }
    setRepoError(undefined);
    setBusy(true);
    try {
      const res = await connectGit(app.name, repo.trim());
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Connect accepted", "A read-only deploy key is requested and a webhook installed — the panel can clone, never push.");
      setConnectOpen(false);
      setRepo("");
    } catch {
      push("error", "Connect was not accepted", "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const doDisconnect = async () => {
    if (disconnectTarget === null) return;
    try {
      const res = await disconnectGit(app.name, disconnectTarget.repository_ref);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("info", "Disconnect accepted", `${disconnectTarget.repository_ref}: deploy key revoked, webhook removed.`);
    } catch {
      push("error", "Disconnect was not accepted", "Try again — the connection is untouched.");
    } finally {
      setDisconnectTarget(null);
    }
  };

  return (
    <Screen
      id="UX-WEB-015"
      breadcrumbs={crumbs}
      actions={
        <Button icon="git-branch" onClick={() => setConnectOpen(true)}>
          Connect
        </Button>
      }
    >
      {runningOp !== undefined && (
        <div className="mb-4">
          <PendingState operation={runningOp} />
        </div>
      )}

      {connections.length === 0 ? (
        <EmptyState
          icon="git-branch"
          title="No repositories connected"
          body="Connect a Git repository to deploy on push. The panel requests a read-only deploy key — it can clone your code, never push to it."
          action={{ label: "Connect a repository", onClick: () => setConnectOpen(true) }}
        />
      ) : (
        <TableCard<GitConnectionFixture>
          title="Connected repositories"
          caption="Repo, branch, webhook and deploy-key permissions"
          rowKey={(g) => g.id}
          columns={[
            { key: "repository_ref", header: "Repository", render: (g) => <span className="font-mono text-xs">{g.provider}/{g.repository_ref}</span> },
            { key: "branch", header: "Branch", render: (g) => <Chip tone="neutral">{g.branch}</Chip> },
            { key: "deploy_key_permissions", header: "Deploy key", render: (g) => <Chip tone="success">{g.deploy_key_permissions}</Chip> },
            {
              key: "webhook_url",
              header: "Webhook",
              render: (g) => (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <span className="max-w-56 truncate font-mono text-xs text-ink-2">{g.webhook_url}</span>
                  <CopyButton text={g.webhook_url} label="Copy" />
                </span>
              ),
            },
            { key: "last_deployed_sha", header: "Last deploy", render: (g) => <span className="font-mono text-xs">{g.last_deployed_sha}</span> },
            {
              key: "actions",
              header: "Actions",
              render: (g) => (
                <Button size="sm" variant="ghost" onClick={() => setDisconnectTarget(g)}>
                  Disconnect
                </Button>
              ),
            },
          ]}
          rows={connections}
        />
      )}

      <Callout tone="info" title="Push-to-deploy" className="mt-4">
        Pushes to the connected branch create a deployment automatically — the build runs batch-priority and
        the release only swaps after the health check verifies.
      </Callout>

      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title="Connect a repository"
        description="The panel requests a scoped read-only deploy key — never write access."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConnectOpen(false)}>Cancel</Button>
            <Button onClick={doConnect} loading={busy}>Connect</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Repository URL" htmlFor="git-repo" required error={repoError}>
            <Input id="git-repo" value={repo} onChange={(e) => setRepo(e.target.value)} className="font-mono text-xs" placeholder="https://github.com/wanjiku-digital/orders-api.git" autoComplete="url" />
          </Field>
          <Field label="Branch" htmlFor="git-branch" hint="Pushes to this branch deploy automatically.">
            <Input id="git-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className="font-mono text-xs" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={disconnectTarget !== null}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={doDisconnect}
        title="Disconnect repository"
        confirmLabel="Disconnect"
        body={
          <>
            Disconnect <span className="font-mono">{disconnectTarget?.repository_ref}</span>? The deploy key is
            revoked and the webhook removed. Existing releases keep running; pushes no longer deploy.
          </>
        }
      />
    </Screen>
  );
}
