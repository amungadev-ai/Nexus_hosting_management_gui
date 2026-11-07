"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { OperationTimeline } from "@/components/common/operation-timeline";
import { Icon } from "@/components/ui/icons";
import { useOperationStream, useToast } from "@/components/providers";
import { aiPlans, aiRuns, diagnosticReports, type AiRun } from "@/lib/mock/ai";
import { stopAiRun } from "@/lib/api/ai";
import { isTerminal } from "@/lib/operations";
import { db } from "@/lib/mock/data";
import type { Operation, OperationStatus } from "@/lib/types";

/**
 * UX-AI-004 /assistant/runs/:run — AI execution timeline (DS-011).
 * Approval, job stages, observed results and rollback. The timeline is the
 * DS-011 OperationTimeline hydrated from the run fixture; the AI never
 * claims success before verification (NP-AI-008). Cost/token accounting is
 * not part of the fixture set, so it displays "Unavailable", never 0.
 */

const RUN_STATUS: Record<AiRun["status"], OperationStatus> = {
  awaiting_approval: "awaiting_approval",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  stopped: "cancelled",
};

const RUN_STEP_STATUS: Record<AiRun["steps"][number]["status"], OperationStatus> = {
  pending: "pending",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  stopped: "cancelled",
};

/** Hydrate the DS-011 timeline from the run fixture (deterministic ids). */
function runToOperation(run: AiRun): Operation {
  const plan = aiPlans.find((p) => p.id === run.plan_id);
  const completed = run.steps.filter((s) => s.status === "succeeded").length;
  return {
    id: run.id,
    kind: "ai.remediation",
    title: run.title,
    status: RUN_STATUS[run.status],
    workload_category: "batch",
    actor_id: db.currentUser,
    organization_id: db.currentOrganization,
    resource_ref: { type: "ai_plan", id: run.plan_id, name: plan?.title },
    steps: run.steps.map((s, i) => ({
      key: `step_${i + 1}`,
      title: `${s.title} — ${s.note}`,
      status: RUN_STEP_STATUS[s.status],
    })),
    progress: { completed_steps: completed, total_steps: run.steps.length },
    batch: { low_priority: true, yielded: run.status === "succeeded" ? true : undefined },
    created_at: run.created_at,
    correlation_id: `req_${run.id.replace(/^arun_/, "")}`,
  };
}

export function RunView({ runId }: { runId: string }) {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const run = aiRuns.find((r) => r.id === runId);
  const [stopRequested, setStopRequested] = useState(false);

  const operation = useMemo(() => (run === undefined ? undefined : runToOperation(run)), [run]);

  if (run === undefined || operation === undefined) {
    return (
      <Screen
        id="UX-AI-004"
        breadcrumbs={[{ label: "AI assistant", href: "/assistant" }, { label: "Not found" }]}
      >
        <NotFoundInline what="AI run" />
      </Screen>
    );
  }

  const plan = aiPlans.find((p) => p.id === run.plan_id);
  const report = diagnosticReports.find((r) =>
    r.findings.some((f) => f.suggested_action !== null && f.suggested_action.plan_id === run.plan_id)
  );

  // A live operation for the same plan submitted during this session — the
  // fixture timeline is the demo record; the live op is the real progress.
  const liveOp = list.find(
    (o) =>
      o.kind === "ai.remediation" &&
      o.resource_ref.type === "ai_plan" &&
      o.resource_ref.id === run.plan_id &&
      !isTerminal(o.status)
  );

  const stop = () => {
    if (liveOp === undefined) return;
    stopAiRun(run.plan_id);
    setStopRequested(true);
    push(
      "info",
      "Stop requested",
      "The run stops at the next safe boundary — executed steps roll back before escalation."
    );
    setFocusedId(liveOp.id);
    setTrayOpen(true);
  };

  return (
    <Screen
      id="UX-AI-004"
      breadcrumbs={[{ label: "AI assistant", href: "/assistant" }, { label: run.id }]}
      actions={
        <>
          <ButtonLink href="/activity" variant="secondary" icon="list">
            Monitor in Activity
          </ButtonLink>
          {liveOp !== undefined && (
            <Button variant="ghost" icon="pause" onClick={stop}>
              Stop if safe
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="Prototype — fixture run, and the AI never claims success before verification">
          This run record comes from the demo dataset (NP-AI-008): stages advance only when the
          result is actually observed, and a run that fails or stops never displays as successful.
          If a live operation for this plan is submitted during your session, its progress is
          tracked separately below the timeline.
        </Callout>

        {stopRequested && (
          <Callout tone="warning" title="Stop requested at the next safe boundary">
            The executed prefix rolls back before escalation — the ceiling is restored and the
            process restarted if needed. Watch the operation tray for the honest stage.
          </Callout>
        )}

        <OperationTimeline operation={operation} />

        <Card title="Inputs — what data was analyzed" description="Recorded, redacted inputs the run was allowed to read">
          <ul className="flex list-none flex-col gap-1.5 p-0">
            {run.inputs.map((input) => (
              <li key={input} className="flex items-start gap-1.5 text-sm text-ink-2">
                <Icon name="file-text" size={14} className="mt-0.5 shrink-0 text-ink-3" />
                <span className="min-w-0">{input}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-3">
            <KeyValue
              items={[
                ...(report !== undefined
                  ? [
                      {
                        label: "Diagnostic report",
                        value: (
                          <Link href={`/assistant/diagnostics/${report.id}`} className="text-accent hover:underline">
                            {report.title}
                          </Link>
                        ),
                      },
                      { label: "Evidence scope", value: report.context_scope },
                    ]
                  : [{ label: "Diagnostic report", value: "Not linked in the fixture set" }]),
                ...(plan !== undefined
                  ? [
                      {
                        label: "Typed plan",
                        value: (
                          <Link href={`/assistant/plans/${plan.id}`} className="text-accent hover:underline">
                            {plan.title}
                          </Link>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </Card>

        <Card title="Outputs — observed results and rollback">
          <KeyValue
            items={[
              { label: "Observed result", value: run.observed },
              { label: "Rollback", value: run.rollback },
              {
                label: "Cost & token usage",
                value: "Unavailable — cost and token accounting is not recorded in this prototype's fixtures, so it is never shown as 0.",
              },
            ]}
          />
          {run.status === "awaiting_approval" && (
            <Callout tone="warning" className="mt-3" title="Nothing has executed yet">
              The plan is bound to a hash and a second-person approval is pending. No changes have
              been made to any workload — the approval expires and the run stops cleanly if it is
              not granted.
            </Callout>
          )}
        </Card>

        {liveOp !== undefined && (
          <Card
            title="Live operation in this session"
            description={`A live ai.remediation operation for this plan is ${liveOp.status.replace(/_/g, " ")}.`}
            actions={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFocusedId(liveOp.id);
                  setTrayOpen(true);
                }}
              >
                View progress
              </Button>
            }
          />
        )}

        <p className="text-xs text-ink-3">
          Run <span className="font-mono">{run.id}</span> · plan{" "}
          <span className="font-mono">{run.plan_id}</span> · every stage, approval and rollback is
          recorded in the{" "}
          <Link href="/audit" className="text-accent hover:underline">audit trail</Link>.
        </p>
      </div>
    </Screen>
  );
}
