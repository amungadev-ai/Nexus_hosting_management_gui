"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Stepper } from "@/components/ui/nav";
import { Field, Input, Select } from "@/components/ui/form";
import { Callout } from "@/components/ui/feedback";
import { useOperationStream, useToast } from "@/components/providers";
import { EVENT_TAXONOMY } from "@/lib/mock/automation";
import { submitWorkflowPublish } from "@/lib/api/automation";
import type { Operation } from "@/lib/types";

/**
 * UX-AUTO-002 /automation/workflows/new — triggers, steps, approvals and
 * dry-run (DS-006 wizard flavor). Drafts are kept in state during navigation.
 */
const STEPS = ["Trigger", "Steps", "Approvals", "Dry-run & publish"];

export default function WorkflowBuilderPage() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("event");
  const [event, setEvent] = useState("website.deployment.failed");
  const [cron, setCron] = useState("0 2 * * *");
  const [steps, setSteps] = useState<{ kind: string; detail: string }[]>([{ kind: "notify", detail: "Email Jane via Resend" }]);
  const [secondPerson, setSecondPerson] = useState(false);
  const [draftOp, setDraftOp] = useState<Operation | null>(null);

  const allEvents = EVENT_TAXONOMY.flatMap((g) => g.events);
  const label = name.trim() || "Untitled workflow";

  const run = (dryRun: boolean) => {
    const op = submitWorkflowPublish(label, dryRun);
    setFocusedId(op.id);
    setTrayOpen(true);
    if (!dryRun) {
      push("success", "Workflow published", `${label} — the trigger is armed once the operation verifies.`);
    } else {
      push("info", "Dry-run started", `${label} — results land in the operation tray.`);
    }
    setDraftOp(op);
  };

  return (
    <Screen
      id="UX-AUTO-002"
      breadcrumbs={[{ label: "Automation", href: "/automation" }, { label: "Workflow builder" }]}
      actions={
        <Button variant="secondary" icon="zap" onClick={() => run(true)} disabled={name.trim() === ""}>
          Dry-run
        </Button>
      }
    >
      <Stepper steps={STEPS} current={step} className="mb-4" />

      {draftOp !== null && (
        <div className="mb-4">
          <PendingState operation={draftOp}>
            <p className="text-sm text-ink-2">
              {draftOp.kind === "automation.workflow.dryrun"
                ? "The dry-run executed each step in shadow mode — nothing was sent to customers."
                : "Published — the trigger is live once verification completes."}
            </p>
          </PendingState>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title="1 · Trigger">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Workflow name" htmlFor="wf-name" required>
                <Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deploy failure escalation" />
              </Field>
              <Field label="Trigger type" htmlFor="wf-trigger">
                <Select id="wf-trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                  <option value="event">Event (webhook taxonomy)</option>
                  <option value="schedule">Schedule (cron)</option>
                  <option value="manual">Manual run</option>
                </Select>
              </Field>
              {trigger === "event" && (
                <Field label="Event" htmlFor="wf-event" className="sm:col-span-2">
                  <Select id="wf-event" value={event} onChange={(e) => setEvent(e.target.value)}>
                    {allEvents.map((ev) => (
                      <option key={ev} value={ev}>
                        {ev}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {trigger === "schedule" && (
                <Field label="Cron expression" htmlFor="wf-cron" className="sm:col-span-2" hint="Africa/Nairobi; stored in UTC.">
                  <Input id="wf-cron" value={cron} onChange={(e) => setCron(e.target.value)} className="font-mono" />
                </Field>
              )}
            </div>
          </Card>

          <Card title="2 · Steps" description="Typed actions only — no arbitrary shell. Each step names its exact effect.">
            <ul className="flex list-none flex-col gap-2 p-0">
              {steps.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line p-3">
                  <div className="min-w-0">
                    <Chip tone="accent">{s.kind}</Chip>{" "}
                    <span className="text-sm text-ink">{s.detail}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remove step ${i + 1}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon="plus" onClick={() => setSteps((p) => [...p, { kind: "notify", detail: "In-app notification to the owner" }])}>
                Add notification
              </Button>
              <Button variant="secondary" size="sm" icon="plus" onClick={() => setSteps((p) => [...p, { kind: "webhook", detail: "POST to a webhook endpoint" }])}>
                Add webhook
              </Button>
              <Button variant="secondary" size="sm" icon="plus" onClick={() => setSteps((p) => [...p, { kind: "approval", detail: "Require owner approval before continuing" }])}>
                Add approval gate
              </Button>
            </div>
          </Card>

          <Card title="3 · Approvals & policy">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={secondPerson}
                onChange={(e) => setSecondPerson(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-accent"
              />
              <span>
                Require second-person approval before the workflow mutates anything
                <span className="mt-0.5 block text-xs text-ink-2">
                  The policy engine validates permissions again at execution — a workflow
                  never widens what the actor could do by hand.
                </span>
              </span>
            </label>
          </Card>
        </div>

        <Card title="4 · Dry-run & publish" description="Dry-run executes in shadow mode; publish arms the trigger.">
          <Callout tone="info" title={label}>
            {trigger === "event" && <>On <span className="font-mono text-xs">{event}</span>, run {steps.length} step{steps.length === 1 ? "" : "s"}.</>}
            {trigger === "schedule" && <>Every <span className="font-mono text-xs">{cron}</span>, run {steps.length} step{steps.length === 1 ? "" : "s"}.</>}
            {trigger === "manual" && <>Run {steps.length} step{steps.length === 1 ? "" : "s"} when a human presses Run.</>}
            {secondPerson && " Second-person approval is required before mutating steps."}
          </Callout>
          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={() => run(false)} disabled={name.trim() === "" || steps.length === 0}>
              Publish workflow
            </Button>
            <Button variant="secondary" onClick={() => run(true)} disabled={name.trim() === "" || steps.length === 0}>
              Dry-run first
            </Button>
            <ButtonLink href="/automation" variant="ghost" size="sm">
              Back to automation overview
            </ButtonLink>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Draft kept while you navigate within this page. Steps are typed platform actions —
            the builder never runs raw shell commands (AI + workflows alike).
          </p>
        </Card>
      </div>

      {step !== 0 && (
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" size="sm" icon="chevron-left" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </Button>
          {step < 3 && (
            <Button size="sm" onClick={() => setStep((s) => Math.min(3, s + 1))}>
              Continue
            </Button>
          )}
        </div>
      )}
    </Screen>
  );
}
