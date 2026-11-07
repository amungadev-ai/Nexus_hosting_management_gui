"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { NotFoundInline } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { TableCard } from "@/components/ui/table";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { EmptyState, Callout } from "@/components/ui/feedback";
import { restartApp, scaleProcess } from "@/lib/api/web";
import { webProcesses, type ProcessFixture } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";

/** UX-WEB-014 — Processes and workers: states, restart policy, queue workers. */
export function AppProcessesView({ appId }: { appId: string }) {
  const app = useMemo(() => db.applications.find((a) => a.id === appId), [appId]);
  const processes = useMemo(() => webProcesses.filter((p) => p.app_id === appId), [appId]);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [scaleTarget, setScaleTarget] = useState<ProcessFixture | null>(null);
  const [replicas, setReplicas] = useState("2");
  const [busy, setBusy] = useState<string | null>(null);

  if (app === undefined) {
    return (
      <Screen id="UX-WEB-014" breadcrumbs={[{ label: "Applications", href: "/apps" }]}>
        <NotFoundInline what="application" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Applications", href: "/apps" },
    { label: app.name, href: `/apps/${app.id}` },
    { label: "Processes" },
  ];

  const doRestart = async (name: string) => {
    setBusy(name);
    try {
      const res = await restartApp(app.name, name);
      setTray(res.operation.id);
      push("success", "Restart accepted", `${name} restarts gracefully — health is verified before completion.`);
    } catch {
      push("error", "Restart was not accepted", "Try again.");
    } finally {
      setBusy(null);
    }
  };

  function setTray(id: string) {
    setFocusedId(id);
    setTrayOpen(true);
  }

  const doScale = async () => {
    if (scaleTarget === null) return;
    const n = Number.parseInt(replicas, 10);
    if (Number.isNaN(n) || n < 1 || n > 4) {
      push("error", "Invalid replica count", "Between 1 and 4 replicas fit this VPS capability record.");
      return;
    }
    try {
      const res = await scaleProcess(app.name, scaleTarget.name, n);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Scale accepted", `${scaleTarget.name} scales to ${n} replica${n === 1 ? "" : "s"} — each replica is health-checked.`);
      setScaleTarget(null);
    } catch {
      push("error", "Scale was not accepted", "Try again.");
    }
  };

  return (
    <Screen id="UX-WEB-014" breadcrumbs={crumbs}>
      {app.category === "batch" && (
        <Callout tone="info" title="Batch workload — processes yield to site traffic">
          This app is a batch workload (category immutable at creation). Its workers run low-priority and
          queue when your websites are busy — that is the design, not a failure.
        </Callout>
      )}

      {processes.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon="cpu"
          title="No processes recorded"
          body="Processes appear after the first successful deploy."
          action={{ label: "Open app", href: `/apps/${app.id}` }}
        />
      ) : (
        <TableCard<ProcessFixture>
          className="mt-4"
          title="Processes & workers"
          caption="Process states, restart policy and queue workers"
          rowKey={(p) => p.id}
          columns={[
            { key: "name", header: "Process", render: (p) => <span className="font-medium">{p.name}</span> },
            { key: "command", header: "Command", render: (p) => <span className="font-mono text-xs">{p.command}</span> },
            { key: "replicas", header: "Replicas", sortable: true, render: (p) => <span className="tabular-nums">×{p.replicas}</span> },
            { key: "state", header: "State", render: (p) => <StatusPill status={p.state === "running" ? "running" : p.state === "stopped" ? "offline" : "pending"} /> },
            { key: "restart_policy", header: "Restart policy", render: (p) => <Chip tone="neutral">{p.restart_policy}</Chip> },
            { key: "note", header: "Notes", render: (p) => <span className="max-w-72 text-xs text-ink-2">{p.note}</span> },
            {
              key: "actions",
              header: "Actions",
              render: (p) => (
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" loading={busy === p.name} onClick={() => doRestart(p.name)}>
                    Restart
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setScaleTarget(p); setReplicas(String(p.replicas)); }}>
                    Scale
                  </Button>
                </span>
              ),
            },
          ]}
          rows={processes}
        />
      )}

      <Card title="Restart policy" className="mt-4">
        <p className="text-sm text-ink-2">
          <span className="font-mono text-xs">on-failure</span> restarts the process if it exits non-zero or is
          OOM-killed, with exponential backoff. Restarts are operations — the panel never shows the process as
          healthy before the post-restart health check passes.
        </p>
      </Card>

      <Modal
        open={scaleTarget !== null}
        onClose={() => setScaleTarget(null)}
        title={`Scale ${scaleTarget?.name ?? ""}`}
        description="Replicas share the app's memory ceiling — scaling up divides the ceiling per process."
        footer={
          <>
            <Button variant="secondary" onClick={() => setScaleTarget(null)}>Cancel</Button>
            <Button onClick={doScale}>Apply scale</Button>
          </>
        }
      >
        <Field label="Replicas" htmlFor="scale-count" hint="1–4 replicas fit this VPS capability record.">
          <Input id="scale-count" value={replicas} onChange={(e) => setReplicas(e.target.value)} inputMode="numeric" className="font-mono" />
        </Field>
      </Modal>
    </Screen>
  );
}
