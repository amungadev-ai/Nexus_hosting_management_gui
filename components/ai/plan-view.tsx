"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { ConfirmDialog, ImpactReview } from "@/components/ui/overlay";
import { DiffViewer, KeyValue } from "@/components/ui/misc";
import { Icon } from "@/components/ui/icons";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { aiPlans, aiRuns, diagnosticReports, type AiPlan } from "@/lib/mock/ai";
import { submitAiRemediation } from "@/lib/api/ai";
import { formatRelative } from "@/lib/format";

/**
 * UX-AI-003 /assistant/plans/:plan — AI proposed change (DS-017).
 * Exact actions, risks, impact and policy checks: AI proposes, user
 * approves, the policy engine validates again — no silent mutations.
 * v1 is read-only diagnosis + proposed-action approval; plans cannot be
 * edited here (that is stated honestly, not shown as a dead button).
 */

const RISK_META: Record<AiPlan["risk"], { tone: "success" | "warning" | "danger"; label: string }> = {
  low: { tone: "success", label: "Low risk" },
  medium: { tone: "warning", label: "Medium risk" },
  high: { tone: "danger", label: "High risk" },
};

export function PlanView({ planId }: { planId: string }) {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, list: ops } = useOperationStream();
  const plan = aiPlans.find((p) => p.id === planId);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [opId, setOpId] = useState<string | null>(null);

  if (plan === undefined) {
    return (
      <Screen
        id="UX-AI-003"
        breadcrumbs={[{ label: "AI assistant", href: "/assistant" }, { label: "Not found" }]}
      >
        <NotFoundInline what="AI plan" />
      </Screen>
    );
  }

  const relatedReport = diagnosticReports.find((r) =>
    r.findings.some((f) => f.suggested_action !== null && f.suggested_action.plan_id === plan.id)
  );
  const relatedRun = aiRuns.find((r) => r.plan_id === plan.id);
  const op = opId === null ? undefined : ops.find((o) => o.id === opId);

  const approve = () => {
    const submitted = submitAiRemediation(plan.id, plan.title);
    setOpId(submitted.id);
    setReviewOpen(false);
    push(
      "success",
      "Plan approved and submitted",
      `${plan.title} — the policy engine validates again at execution; track it in the operation tray.`
    );
    setTrayOpen(true);
  };

  const dismiss = () => {
    setDismissOpen(false);
    setDismissed(true);
    push("info", "Plan dismissed", `${plan.title} — nothing was executed. The diagnostic report stays available.`);
  };

  return (
    <Screen
      id="UX-AI-003"
      breadcrumbs={[{ label: "AI assistant", href: "/assistant" }, { label: plan.id }]}
      actions={
        <>
          <Button variant="ghost" onClick={() => setDismissOpen(true)} disabled={dismissed}>
            Dismiss
          </Button>
          <Button icon="shield" onClick={() => setReviewOpen(true)} disabled={dismissed}>
            Review impact &amp; approve
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Card
          title={
            <span className="flex flex-wrap items-center gap-2">
              <Icon name="bot" size={16} className="text-accent" />
              {plan.title}
            </span>
          }
          description={`Operation kinds: ${plan.operation_kind}`}
          actions={<Chip tone={RISK_META[plan.risk].tone}>{RISK_META[plan.risk].label}</Chip>}
          footer={
            <span>
              Plan <span className="font-mono">{plan.id}</span> · approval is recorded in the
              audit trail
              {relatedReport !== undefined && (
                <>
                  {" "}· from report{" "}
                  <Link
                    href={`/assistant/diagnostics/${relatedReport.id}`}
                    className="text-accent hover:underline"
                  >
                    {relatedReport.title}
                  </Link>
                </>
              )}
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            {plan.permission_check.allowed ? (
              <Callout tone="success" title="Policy pre-check passed">
                {plan.permission_check.reason}. {plan.policy_note}
              </Callout>
            ) : (
              <Callout tone="danger" title="Policy pre-check blocked">
                {plan.permission_check.reason}. {plan.policy_note}
              </Callout>
            )}
            <Callout tone="info" title="Read-only in v1">
              v1 ships read-only diagnostics plus proposed-action approval (NP-AI-012) — plans
              cannot be edited here; you approve or dismiss as-is. Typed plan editing and
              autonomous execution arrive in v4+.
            </Callout>
          </div>
        </Card>

        <Card title="Steps" description="What will run, in order — each step is typed and verified">
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            {plan.steps.map((step) => (
              <li key={step.order} className="text-sm">
                <span className="font-mono text-xs text-ink-2">{step.action}</span>
                <span className="mt-0.5 block text-ink-2">{step.detail}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Expected impact and prerequisites">
          <KeyValue
            items={[
              { label: "Before", value: plan.impact.before },
              { label: "After", value: plan.impact.after },
              { label: "Affected resources", value: plan.impact.affected.join(", ") },
              { label: "Downtime estimate", value: plan.impact.downtime },
              { label: "Reversibility", value: plan.impact.reversibility },
              { label: "Prerequisites checked", value: plan.permission_check.reason },
            ]}
          />
          {plan.diff.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-ink-2">Change diff (values are not secrets — secrets stay redacted)</p>
              <DiffViewer hunks={plan.diff} />
            </div>
          )}
        </Card>

        {relatedRun !== undefined && (
          <Card
            title="Execution"
            description={relatedRun.title}
            actions={
              <ButtonLink href={`/assistant/runs/${relatedRun.id}`} variant="secondary" size="sm" icon="arrow-right">
                Open run timeline
              </ButtonLink>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                status={
                  relatedRun.status === "succeeded"
                    ? "succeeded"
                    : relatedRun.status === "running"
                      ? "running"
                      : relatedRun.status === "failed"
                        ? "failed"
                        : relatedRun.status === "stopped"
                          ? "cancelled"
                          : "awaiting_approval"
                }
              />
              <span className="text-sm text-ink-2">
                {relatedRun.status === "awaiting_approval"
                  ? "Awaiting second-person approval — nothing has executed yet."
                  : relatedRun.status === "succeeded"
                    ? "Executed and verified."
                    : "In progress or stopped — see the run timeline for the honest stage."}
              </span>
            </div>
          </Card>
        )}

        {dismissed && (
          <Card title="Plan dismissed" description="No changes were made. The plan and its report stay available for reference.">
            <Button variant="secondary" size="sm" onClick={() => setDismissed(false)}>
              Reopen plan
            </Button>
          </Card>
        )}

        {op !== undefined && (
          <div className="flex flex-col gap-2">
            <PendingState operation={op} />
            {op.status === "succeeded" && (
              <Callout tone="success" title="Applied and verified">
                Postcondition checks passed {op.last_verified_at !== undefined && formatRelative(op.last_verified_at, now)}.
                The full audit record is in{" "}
                <Link href="/activity" className="text-accent hover:underline">Activity</Link>.
              </Callout>
            )}
            {(op.status === "failed" || op.status === "cancelled" || op.status === "rejected") && (
              <Callout tone="danger" title="The execution did not complete">
                {op.error?.detail ?? "The operation stopped before verification — nothing is claimed as fixed."}{" "}
                Correlation ID <span className="font-mono">{op.correlation_id}</span>.
              </Callout>
            )}
          </div>
        )}

        <p className="text-xs text-ink-3">
          The AI never runs privileged actions silently: approval here is recorded, the policy
          engine re-validates at execution, and the run is audited end to end.
        </p>
      </div>

      <ImpactReview
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={approve}
        title={plan.title}
        impact={{
          before: plan.impact.before,
          after: plan.impact.after,
          affectedResources: plan.impact.affected,
          downtimeEstimate: plan.impact.downtime,
          reversibility: plan.impact.reversibility,
        }}
        diff={plan.diff.length > 0 ? plan.diff : undefined}
        submitLabel="Approve and apply"
      >
        <p>
          Typed plan <span className="font-mono">{plan.id}</span> ({plan.operation_kind}). The
          policy engine validates again at execution — approval here is not a bypass.
        </p>
      </ImpactReview>

      <ConfirmDialog
        open={dismissOpen}
        onClose={() => setDismissOpen(false)}
        onConfirm={dismiss}
        title="Dismiss this AI plan?"
        confirmLabel="Dismiss plan"
        body={
          <span>
            <span className="font-medium text-ink">{plan.title}</span> will be marked dismissed —
            nothing has executed, so there is nothing to undo. You can reopen it on this page.
          </span>
        }
      />
    </Screen>
  );
}
