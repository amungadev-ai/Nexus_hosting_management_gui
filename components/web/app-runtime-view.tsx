"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { KeyValue } from "@/components/ui/misc";
import { Callout } from "@/components/ui/feedback";
import { updateRuntime } from "@/lib/api/web";
import { RUNTIME_CATALOG } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";
import { formatMb } from "@/lib/format";

/**
 * UX-WEB-013 — Runtime configuration: supported versions (only actually
 * installed ones — no invented options), startup command, ports and limits.
 */
export function AppRuntimeView({ appId }: { appId: string }) {
  const app = useMemo(() => db.applications.find((a) => a.id === appId), [appId]);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId, list } = useOperationStream();
  const [version, setVersion] = useState(app?.runtime_version ?? "");
  const [startCommand, setStartCommand] = useState("node dist/main.js");
  const [port, setPort] = useState("3000");
  const [memoryCeiling, setMemoryCeiling] = useState("512");
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const runningOp = list.find((o) => o.kind === "app.runtime.update" && o.status !== "succeeded" && o.status !== "failed");
  const catalog = useMemo(
    () => RUNTIME_CATALOG.filter((r) => r.runtime_kind === app?.runtime),
    [app]
  );
  const changed = app !== undefined && version !== app.runtime_version;

  if (app === undefined) {
    return (
      <Screen id="UX-WEB-013" breadcrumbs={[{ label: "Applications", href: "/apps" }]}>
        <NotFoundInline what="application" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Applications", href: "/apps" },
    { label: app.name, href: `/apps/${app.id}` },
    { label: "Runtime" },
  ];

  const doSave = async () => {
    if (startCommand.trim() === "") {
      setError("The start command is required — it is how the process boots.");
      return;
    }
    const portNum = Number.parseInt(port, 10);
    if (Number.isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      setError("Port must be a number between 1024 and 65535.");
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      const res = await updateRuntime(app.name, version);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Runtime update accepted", `${app.name} rebuilds with ${version} and re-releases only after the health check passes.`);
    } catch {
      push("error", "Save was not accepted", "Try again — the current runtime keeps running.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      id="UX-WEB-013"
      breadcrumbs={crumbs}
      actions={
        <Button icon="check" onClick={doSave} loading={saving}>
          Save
        </Button>
      }
    >
      {runningOp !== undefined && (
        <div className="mb-4">
          <PendingState operation={runningOp} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Runtime version" description="Only versions actually installed and supported on this server are listed.">
          <Field label="Version" htmlFor="rt-version" hint={changed ? `Changing from ${app.runtime_version} to ${version} triggers a rebuild + release.` : "Unchanged — no rebuild will run."}>
            <Select id="rt-version" value={version} onChange={(e) => setVersion(e.target.value)}>
              {catalog.map((r) => (
                <option key={r.version} value={r.version}>
                  {r.runtime_kind === "node" ? "Node" : r.runtime_kind === "php" ? "PHP" : "Python"} {r.version} ({r.support_state})
                </option>
              ))}
            </Select>
          </Field>
          <Callout tone="info" className="mt-3">
            Version list comes from the installed runtime catalog (GET /runtimes/catalog) — the panel never
            offers a version the agent cannot actually install.
          </Callout>
        </Card>

        <Card title="Startup & ports">
          <div className="flex flex-col gap-4">
            <Field label="Start command" htmlFor="rt-start" required>
              <Input id="rt-start" value={startCommand} onChange={(e) => setStartCommand(e.target.value)} className="font-mono text-xs" spellCheck={false} />
            </Field>
            <Field label="Listen port" htmlFor="rt-port" required hint="The reverse proxy routes the app hostname to this port.">
              <Input id="rt-port" value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" className="font-mono text-xs" />
            </Field>
            {error !== undefined && (
              <p role="alert" className="text-xs text-danger">{error}</p>
            )}
          </div>
        </Card>

        <Card title="Limits" description="Allocation is a ceiling, not a reservation — the workload may use up to this much.">
          <div className="flex flex-col gap-4">
            <Field label="Memory ceiling (MB)" htmlFor="rt-mem" hint={`Current usage ${formatMb(app.usage.ram_mb.current)} · typical ${formatMb(app.usage.ram_mb.typical)} · peak ${formatMb(app.usage.ram_mb.peak)}.`}>
              <Input id="rt-mem" value={memoryCeiling} onChange={(e) => setMemoryCeiling(e.target.value)} inputMode="numeric" className="font-mono text-xs" />
            </Field>
            <Callout tone="warning" title="Hitting the ceiling restarts the process">
              If the app reaches memory.max it is OOM-killed and restarted. 1 OOM kill was recorded in the
              last 7 days for this app — consider raising the ceiling (within the VPS capability record) or
              reducing usage.
            </Callout>
            <KeyValue
              items={[
                { label: "CPU weight", value: "100 (serving) — batch workloads get 10 and yield under contention" },
                { label: "Applied via", value: <span className="font-mono text-xs">POST /resources/{app.id}/limits → operation resource.limit.update</span> },
              ]}
            />
          </div>
        </Card>
      </div>
    </Screen>
  );
}
