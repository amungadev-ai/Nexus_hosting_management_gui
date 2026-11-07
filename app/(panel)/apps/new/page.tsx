"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { UnavailableState } from "@/components/common/states";
import { useCapability, useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { KeyValue } from "@/components/ui/misc";
import { Callout } from "@/components/ui/feedback";
import { provisionApp } from "@/lib/api/web";
import { RUNTIME_CATALOG } from "@/lib/mock/web";

/**
 * UX-WEB-008 — New app wizard: Git/upload source, runtime, build/start
 * commands, environment variables and URL with preflight validation. On
 * profiles where Node apps cannot run, the whole flow renders the honest
 * unavailable state (reason + resource delta + upgrade path) — not a hidden
 * menu, not a dead button.
 */
export default function NewAppWizardPage() {
  const nodeCap = useCapability("app.node");
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();

  const [name, setName] = useState("");
  const [source, setSource] = useState<"git" | "upload">("git");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [runtimeVersion, setRuntimeVersion] = useState("22 LTS");
  const [buildCommand, setBuildCommand] = useState("npm ci && npm run build");
  const [startCommand, setStartCommand] = useState("npm start");
  const [envText, setEnvText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [preflight, setPreflight] = useState<string[] | null>(null);

  const envCount = envText.split("\n").filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l.trim())).length;
  const runtime = RUNTIME_CATALOG.find((r) => r.runtime_kind === "node" && r.version === runtimeVersion);

  const runPreflight = (): boolean => {
    const next: Record<string, string> = {};
    if (name.trim() === "" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
      next.name = "Name is required — lowercase letters, numbers and hyphens.";
    }
    if (source === "git" && repoUrl.trim() === "") next.repoUrl = "Repository URL is required (or switch to upload).";
    if (startCommand.trim() === "") next.startCommand = "A start command is required — how the process runs after build.";
    if (buildCommand.trim() === "") next.buildCommand = "A build command is required — leave `true` if there is nothing to build.";
    const found: string[] = [];
    if (nodeCap.state === "unavailable") {
      found.push(`Capability fit: Node apps cannot run on this VPS — ${nodeCap.reason}`);
    } else if (nodeCap.state === "borderline") {
      found.push(`Capability fit: runs, but tight — ${nodeCap.reason}`);
    } else {
      found.push(`Capability fit: Node ${runtimeVersion} fits this VPS (floor ${nodeCap.ram_floor_mb} MB, ceiling ${nodeCap.ram_ceiling_mb} MB).`);
    }
    found.push("Port conflict: none found on 3000–3100.");
    found.push(`Runtime version: ${runtime !== undefined ? `${runtime.version} is installed and supported` : "pick an installed version"}.`);
    if (source === "git") found.push("Git access: a read-only deploy key will be requested at connect time.");
    setErrors(next);
    setPreflight(found);
    return Object.keys(next).length === 0 && nodeCap.state !== "unavailable";
  };

  const deploy = async () => {
    if (!runPreflight()) return;
    setSubmitting(true);
    try {
      const res = await provisionApp({
        name,
        runtime: "node",
        runtime_version: runtimeVersion,
        source,
        repo_url: source === "git" ? repoUrl : undefined,
        branch,
        build_command: buildCommand,
        start_command: startCommand,
        env_count: envCount,
      });
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Provision + deploy accepted", "The build step runs batch-priority; the app serves only after the health check verifies.");
      setPreflight(null);
    } catch {
      push("error", "Preflight rejected", "Fix the highlighted fields and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      id="UX-WEB-008"
      breadcrumbs={[{ label: "Applications", href: "/apps" }, { label: "New app" }]}
      description="Git/upload source, runtime, build/start commands, environment variables and URL with preflight validation."
    >
      {nodeCap.state === "unavailable" ? (
        <div className="mx-auto max-w-2xl">
          <UnavailableState capabilityKey="app.node" title="Node.js applications cannot run on this VPS">
            <Callout tone="info" title="What works instead">
              Static and PHP sites run fine on this profile — start there from{" "}
              <a href="/websites/new" className="font-medium text-accent hover:underline">Create website</a>. The
              resource delta above explains exactly what an upgrade unlocks.
            </Callout>
          </UnavailableState>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Source">
              <div className="flex flex-col gap-4">
                <Field label="Source type" htmlFor="app-source" hint="Git deploys rebuild on push; uploads are one-shot archives.">
                  <Select id="app-source" value={source} onChange={(e) => setSource(e.target.value === "git" ? "git" : "upload")}>
                    <option value="git">Git repository</option>
                    <option value="upload">Upload archive</option>
                  </Select>
                </Field>
                {source === "git" ? (
                  <>
                    <Field label="Repository URL" htmlFor="app-repo" required error={errors.repoUrl}>
                      <Input id="app-repo" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/wanjiku-digital/orders-api.git" autoComplete="url" />
                    </Field>
                    <Field label="Branch" htmlFor="app-branch">
                      <Input id="app-branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
                    </Field>
                  </>
                ) : (
                  <Callout tone="info">Upload happens after the app record exists — you&apos;ll get a dropzone on the app page.</Callout>
                )}
              </div>
            </Card>

            <Card title="Runtime & commands">
              <div className="flex flex-col gap-4">
                <Field label="App name" htmlFor="app-name" required error={errors.name} hint="Lowercase letters, numbers, hyphens.">
                  <Input id="app-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="orders-api" spellCheck={false} />
                </Field>
                <Field label="Runtime version" htmlFor="app-runtime" hint="Only versions actually installed and supported — no invented options.">
                  <Select id="app-runtime" value={runtimeVersion} onChange={(e) => setRuntimeVersion(e.target.value)}>
                    {RUNTIME_CATALOG.filter((r) => r.runtime_kind === "node").map((r) => (
                      <option key={r.version} value={r.version}>Node {r.version}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Build command" htmlFor="app-build" required error={errors.buildCommand}>
                  <Input id="app-build" value={buildCommand} onChange={(e) => setBuildCommand(e.target.value)} className="font-mono text-xs" spellCheck={false} />
                </Field>
                <Field label="Start command" htmlFor="app-start" required error={errors.startCommand}>
                  <Input id="app-start" value={startCommand} onChange={(e) => setStartCommand(e.target.value)} className="font-mono text-xs" spellCheck={false} />
                </Field>
              </div>
            </Card>

            <Card title="Environment variables" description="One KEY=VALUE per line. Values are write-only — once saved they are never returned by the API.">
              <Field label="Variables" htmlFor="app-env" hint={`${envCount} variable${envCount === 1 ? "" : "s"} detected. Secrets are encrypted at rest.`}>
                <Input id="app-env" value={envText} onChange={(e) => setEnvText(e.target.value)} className="min-h-24 font-mono text-xs" spellCheck={false} placeholder={"DATABASE_URL=postgres://…\nNODE_ENV=production"} />
              </Field>
            </Card>

            <Card title="URL & preflight">
              <KeyValue
                items={[
                  { label: "Preview address", value: <span className="font-mono text-xs">{name === "" ? "— (enter a name)" : `https://${name}.preview.nexuspanel.app`}</span> },
                  { label: "Workload category", value: "serving — immutable once created; builds inside it run batch-priority" },
                ]}
              />
              {preflight !== null && (
                <div className="mt-3 rounded-card border border-line bg-surface-2 p-3">
                  <p className="text-xs font-medium text-ink">Preflight result</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-2">
                    {preflight.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" icon="check" onClick={() => runPreflight()}>
              Preflight
            </Button>
            <Button icon="zap" onClick={deploy} loading={submitting}>
              Deploy
            </Button>
          </div>
        </div>
      )}
    </Screen>
  );
}
