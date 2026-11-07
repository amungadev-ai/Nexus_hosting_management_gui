"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { TableCard } from "@/components/ui/table";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { EmptyState, Callout } from "@/components/ui/feedback";
import { SecretField } from "@/components/ui/code";
import { updateEnvVars } from "@/lib/api/web";
import { webEnvVars, type EnvVarFixture } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";
import { formatRelative } from "@/lib/format";

/**
 * UX-WEB-012 — Environment variables: scoped secrets with paste/import .env,
 * duplicate validation, masked display (DS-008) and write-only values.
 */
interface ParsedVar {
  key: string;
  value: string;
  isSecret: boolean;
}
function parseEnvText(text: string): { parsed: ParsedVar[]; errors: { line: number; message: string }[] } {
  const parsed: ParsedVar[] = [];
  const errors: { line: number; message: string }[] = [];
  const seen = new Set<string>();
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const eq = line.indexOf("=");
    if (eq <= 0) {
      errors.push({ line: i + 1, message: "not KEY=VALUE" });
      return;
    }
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      errors.push({ line: i + 1, message: `invalid key "${key}"` });
      return;
    }
    if (seen.has(key)) {
      errors.push({ line: i + 1, message: `duplicate key "${key}"` });
      return;
    }
    seen.add(key);
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed.push({ key, value, isSecret: /SECRET|TOKEN|PASSWORD|URL|KEY/i.test(key) });
  });
  return { parsed, errors };
}

export function AppEnvView({ appId }: { appId: string }) {
  const app = useMemo(() => db.applications.find((a) => a.id === appId), [appId]);
  const vars = useMemo(() => webEnvVars, []);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId, list } = useOperationStream();
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSecret, setEditSecret] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [saving, setSaving] = useState(false);

  const runningOp = list.find((o) => o.kind === "app.environment.update" && o.status !== "succeeded" && o.status !== "failed");

  if (app === undefined) {
    return (
      <Screen id="UX-WEB-012" breadcrumbs={[{ label: "Applications", href: "/apps" }]}>
        <NotFoundInline what="application" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Applications", href: "/apps" },
    { label: app.name, href: `/apps/${app.id}` },
    { label: "Environment" },
  ];

  const importParsed = parseEnvText(importText);
  const dupes = vars.filter((v) => importParsed.parsed.some((p) => p.key === v.key));

  const doSave = async (keys: string[]) => {
    setSaving(true);
    try {
      const res = await updateEnvVars(app.name, keys);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Environment update accepted", `${keys.length} variable${keys.length === 1 ? "" : "s"} — values are encrypted at rest and the process restarts to pick them up.`);
      setEditOpen(false);
      setImportOpen(false);
    } catch {
      push("error", "Update was not accepted", "Fix the values and try again — nothing changed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      id="UX-WEB-012"
      breadcrumbs={crumbs}
      actions={
        <>
          <Button variant="secondary" icon="download" onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button
            icon="plus"
            onClick={() => {
              setEditKey(null);
              setEditValue("");
              setEditSecret(false);
              setEditOpen(true);
            }}
          >
            Edit
          </Button>
        </>
      }
    >
      {runningOp !== undefined && (
        <div className="mb-4">
          <PendingState operation={runningOp} />
        </div>
      )}

      <Callout tone="info" title="Secrets are write-only">
        Values marked secret are encrypted at rest and never returned by the API after persistence — the
        masked display below is the only view. They are also redacted from job logs.
      </Callout>

      {vars.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon="key"
          title="No environment variables"
          body="Add configuration like DATABASE_URL or NODE_ENV. Paste a .env file to import many at once — duplicates are rejected before anything is saved."
          action={{ label: "Import .env", onClick: () => setImportOpen(true) }}
        />
      ) : (
        <TableCard<EnvVarFixture>
          className="mt-4"
          title={`Variables — ${app.name}`}
          caption="Scoped secrets with masked display"
          rowKey={(v) => v.key}
          columns={[
            { key: "key", header: "Key", sortable: true, render: (v) => <span className="font-mono text-xs font-medium">{v.key}</span> },
            {
              key: "value",
              header: "Value",
              render: (v) =>
                v.is_secret ? (
                  <span className="font-mono text-xs text-ink-3">•••••••• (write-only)</span>
                ) : (
                  <span className="font-mono text-xs">{v.value}</span>
                ),
            },
            { key: "is_secret", header: "Scope", render: (v) => <Chip tone={v.is_secret ? "warning" : "neutral"}>{v.is_secret ? "secret" : "plain"}</Chip> },
            { key: "set_at", header: "Set", render: (v) => <span className="whitespace-nowrap text-xs text-ink-2">{formatRelative(v.set_at)} by {v.set_by}</span> },
            {
              key: "actions",
              header: "Actions",
              render: (v) => (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="edit"
                  onClick={() => {
                    setEditKey(v.key);
                    setEditValue(v.value ?? "");
                    setEditSecret(v.is_secret);
                    setEditOpen(true);
                  }}
                >
                  <span>{v.is_secret ? "Rotate" : "Edit"}</span>
                </Button>
              ),
            },
          ]}
          rows={vars}
        />
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editKey === null ? "Add variable" : `Update ${editKey}`}
        description="Values are write-only: after saving, the API never returns them."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              loading={saving}
              onClick={() => {
                const key = editKey ?? "";
                if (key === "" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
                  push("error", "Invalid key", "Use letters, numbers and underscores.");
                  return;
                }
                doSave([key === "" ? "NEW_VAR" : key]);
              }}
            >
              Save {editSecret ? "(encrypts value)" : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {editKey !== null && (
            <p className="text-sm text-ink-2">
              Key <span className="font-mono">{editKey}</span> {editSecret ? "— value will be encrypted and never shown again." : ""}
            </p>
          )}
          {editKey === null && (
            <Field label="Key" htmlFor="env-key" required>
              <Input id="env-key" defaultValue="" className="font-mono text-xs" spellCheck={false} placeholder="CACHE_TTL_SECONDS" />
            </Field>
          )}
          <Field label="Value" htmlFor="env-value" required hint={editSecret ? "Write-only: never returned after saving, redacted from logs." : undefined}>
            <Input id="env-value" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="font-mono text-xs" spellCheck={false} />
          </Field>
          <Switch checked={editSecret} onChange={(v) => setEditSecret(v)} label={<span>Treat as secret<span className="block text-xs font-normal text-ink-3">Encrypt at rest, mask in the UI, redact from logs.</span></span>} />
          {editSecret && editValue !== "" && <SecretField value={editValue} label="Preview (before save)" />}
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import .env"
        size="lg"
        description="Parses KEY=VALUE with quotes, comments and newlines. Duplicate and invalid keys are rejected — nothing is saved until the preview is clean."
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              loading={saving}
              disabled={importParsed.parsed.length === 0 || importParsed.errors.length > 0 || dupes.length > 0}
              onClick={() => doSave(importParsed.parsed.map((p) => p.key))}
            >
              Import {importParsed.parsed.length} variable{importParsed.parsed.length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label=".env content" htmlFor="env-import">
            <Textarea id="env-import" value={importText} onChange={(e) => setImportText(e.target.value)} className="font-mono text-xs" rows={6} spellCheck={false} placeholder={"# comment\nNODE_ENV=production\nDATABASE_URL=\"postgres://…\""} />
          </Field>
          {importParsed.errors.length > 0 && (
            <Callout tone="danger" title="Validation errors — nothing will be imported">
              <ul className="list-disc pl-4">
                {importParsed.errors.map((e) => (
                  <li key={e.line}>Line {e.line}: {e.message}</li>
                ))}
              </ul>
            </Callout>
          )}
          {dupes.length > 0 && (
            <Callout tone="warning" title="Duplicates with existing variables">
              {dupes.map((d) => d.key).join(", ")} already exist — importing would overwrite them.
            </Callout>
          )}
          {importParsed.parsed.length > 0 && importParsed.errors.length === 0 && (
            <div>
              <p className="text-xs font-medium text-ink">Preview — names only, values masked:</p>
              <ul className="mt-1 flex list-none flex-wrap gap-1.5 p-0">
                {importParsed.parsed.map((p) => (
                  <li key={p.key}>
                    <Chip tone={p.isSecret ? "warning" : "neutral"}>
                      {p.key} = ••••••
                    </Chip>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-ink-3">Values are never echoed back by the parse endpoint — no accidental analytics.</p>
            </div>
          )}
        </div>
      </Modal>
    </Screen>
  );
}
