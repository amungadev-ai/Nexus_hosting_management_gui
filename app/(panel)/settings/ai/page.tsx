"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Callout, SkeletonText } from "@/components/ui/feedback";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/overlay";
import { SecretField } from "@/components/ui/code";
import { Icon } from "@/components/ui/icons";
import { useCapability, useToast } from "@/components/providers";
import { useAiSettings } from "@/components/ai/ai-state";
import { AI_PROVIDERS } from "@/lib/mock/ai";

/**
 * UX-AI-005 /settings/ai — AI settings and consent.
 * Provider selection, model, API key (DS-008 one-time reveal), retention,
 * read-only scopes and opt-in. Saving the key is the borderline→available
 * moment: ai.diagnostics is borderline ("needs an API key") on Nano/Starter
 * and flips to available for the next capability read. Without a key the
 * page shows the honest UX-AI-007 needs-key state and links back to
 * /assistant. Like /settings/profile, changes apply immediately — there is
 * no separate save step.
 */

const RETENTION_OPTIONS = [
  { value: "30d", label: "Keep analysis outputs for 30 days" },
  { value: "90d", label: "Keep analysis outputs for 90 days" },
  { value: "keep", label: "Keep until I delete them" },
];

const AI_SCOPES = ["metrics.read", "logs.read (redacted)", "state.read", "workload.usage.read"];

export default function AiSettingsPage() {
  const { push } = useToast();
  const cap = useCapability("ai.diagnostics");
  const ai = useAiSettings();

  const [keyDraft, setKeyDraft] = useState("");
  const [enteringKey, setEnteringKey] = useState(false);
  const [justSavedKey, setJustSavedKey] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  if (!ai.ready) {
    return (
      <Screen id="UX-AI-005" breadcrumbs={[{ label: "Settings" }, { label: "AI" }]}>
        <SkeletonText lines={6} />
      </Screen>
    );
  }

  const provider = AI_PROVIDERS.find((p) => p.id === ai.providerId) ?? AI_PROVIDERS[0];
  const model = provider.models.includes(ai.modelId) ? ai.modelId : provider.models[0];

  const changeProvider = (id: string) => {
    ai.setProvider(id);
    const next = AI_PROVIDERS.find((p) => p.id === id);
    if (next !== undefined && !next.models.includes(ai.modelId)) {
      ai.setModel(next.models[0]);
    }
  };

  const saveKey = () => {
    const key = keyDraft.trim();
    if (key === "") return;
    ai.saveKey(key);
    ai.setOptOut(false);
    setKeyDraft("");
    setEnteringKey(false);
    setJustSavedKey(true);
    push(
      "success",
      "AI diagnostics enabled",
      "ai.diagnostics moves from Borderline to Available for the next capability read — analysis runs as a low-priority batch workload."
    );
  };

  const removeKey = () => {
    ai.removeKey();
    setRemoveOpen(false);
    setJustSavedKey(false);
    push("info", "API key removed", "The assistant cannot run analysis until a new key is added. Reports and history are kept.");
  };

  const toggleConsent = (enabled: boolean) => {
    ai.setOptOut(!enabled);
    push(
      enabled ? "success" : "info",
      enabled ? "AI enabled" : "AI disabled",
      enabled
        ? "The assistant can read permitted evidence and propose typed actions — you approve everything."
        : "The assistant stops proposing and analyzing. Reports and history stay available."
    );
  };

  return (
    <Screen
      id="UX-AI-005"
      breadcrumbs={[{ label: "Settings" }, { label: "AI" }]}
      description="Provider selection, model, API key, retention, scopes and opt-in. Changes apply immediately — the AI proposes, you approve, and the policy engine validates every action."
      actions={
        <ButtonLink href="/assistant" variant="secondary" icon="bot">
          Open AI assistant
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Capability line — the honest borderline → available story */}
        <Card title="AI diagnostics capability" description={`Capability key ai.diagnostics · ${cap.state === "available" ? "available on this VPS" : cap.state === "borderline" ? "borderline — it runs, with one missing prerequisite" : "not available on this VPS"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={cap.state === "unavailable" ? "unavailable" : justSavedKey || ai.keyConfigured ? "available" : "borderline"} />
            {cap.state === "borderline" && (
              <>
                <span aria-hidden="true" className="text-ink-3">→</span>
                <span className="flex items-center gap-1.5 text-xs text-ink-2">
                  <Icon name="arrow-right" size={12} />
                  Available once the API key below is saved
                </span>
              </>
            )}
          </div>
          {justSavedKey && (
            <Callout tone="success" title="AI diagnostics enabled" className="mt-3">
              ai.diagnostics: Borderline → Available. Analysis runs as a low-priority batch
              workload against your provider; it queues behind site traffic and yields — that is
              the normal batch behavior, not an error.
            </Callout>
          )}
          {cap.state === "unavailable" && (
            <Callout tone="warning" className="mt-3">
              {cap.reason ?? "This VPS cannot run AI diagnostics."} No API key changes that — the
              capability set comes from the installer&apos;s signed records.
            </Callout>
          )}
        </Card>

        {/* UX-AI-007 needs-key state, with the way back to the assistant */}
        {!ai.keyConfigured && cap.state !== "unavailable" && (
          <Callout tone="warning" title="AI diagnostics require an LLM API key">
            {cap.reason ??
              "AI diagnostics run as a batch workload against an external LLM API. Add an API key in Settings → AI to enable it."}{" "}
            Add one below — no hardware upgrade is needed.
            <div className="mt-2">
              <ButtonLink href="/assistant" variant="secondary" size="sm" icon="arrow-right">
                Back to the AI assistant
              </ButtonLink>
            </div>
          </Callout>
        )}

        <Card title="Provider and model" description="Which LLM the assistant uses for diagnosis. Bring-your-own route keeps data on your chosen path.">
          <div className="flex flex-col gap-4">
            <Field label="Provider" htmlFor="ai-provider" hint="The key must match the provider — a mismatched key fails validation at the first analysis.">
              <Select id="ai-provider" value={provider.id} onChange={(e) => changeProvider(e.target.value)}>
                {AI_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Model" htmlFor="ai-model" hint="Diagnostic summaries are composed by this model; the panel validates its output before showing evidence-cited answers.">
              <Select id="ai-model" value={model} onChange={(e) => ai.setModel(e.target.value)}>
                {provider.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card
          title="API key"
          description="One-time reveal (DS-008): masked by default, unrecoverable from the UI once hidden, never logged."
        >
          {!ai.keyConfigured || enteringKey ? (
            <div className="flex flex-col gap-3">
              <Field
                label="LLM API key"
                htmlFor="ai-key"
                hint="Prototype: the key stays in this browser only and is never sent anywhere. In production it is stored server-side, write-only."
              >
                <Input
                  id="ai-key"
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button icon="key" onClick={saveKey} disabled={keyDraft.trim() === ""}>
                  Save key
                </Button>
                {enteringKey && (
                  <Button variant="ghost" onClick={() => setEnteringKey(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <SecretField value={ai.key ?? ""} label="LLM API key" />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon="refresh" onClick={() => setEnteringKey(true)}>
                  Replace key
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoveOpen(true)}>
                  Revoke key
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card title="Consent, retention and scopes">
          <div className="flex flex-col gap-4">
            <Switch
              checked={!ai.optOut}
              onChange={toggleConsent}
              label="Enable AI diagnostics (opt-in)"
            />
            <p className="text-xs text-ink-2">
              The assistant reads only permitted evidence — metrics, redacted logs and observed
              state — and proposes typed actions. It never runs privileged changes by itself:
              you approve, the policy engine validates again at execution, and every action is
              audited.
            </p>
            <Field label="Retention" htmlFor="ai-retention" hint="How long analysis outputs (answers and reports) are kept.">
              <Select id="ai-retention" value={ai.retention} onChange={(e) => ai.setRetention(e.target.value)}>
                {RETENTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
            <div>
              <p className="text-xs font-medium text-ink-2">Assistant scopes — read-only, always</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {AI_SCOPES.map((s) => (
                  <Chip key={s} tone="neutral">
                    <Icon name="shield" size={10} />
                    {s}
                  </Chip>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                No mutation scopes are ever granted to the assistant. If a proposed action is
                approved, it executes as your own audited operation, not as an AI privilege.
              </p>
            </div>
            <p className="text-xs text-ink-3">
              Questions about what the assistant may read? See{" "}
              <Link href="/help" className="text-accent hover:underline">Help — What can my VPS run?</Link>
            </p>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={removeKey}
        title="Remove the LLM API key?"
        confirmLabel="Remove key"
        body={
          <span>
            The assistant will stop running analysis until a new key is added — the workspace
            shows the honest needs-key state instead of pretending to work. Reports and run
            history are kept.
          </span>
        }
      />
    </Screen>
  );
}
