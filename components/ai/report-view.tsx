"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { ImpactReview } from "@/components/ui/overlay";
import { Icon } from "@/components/ui/icons";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { aiPlans, aiRemediationHistory, diagnosticReports, type AiPlan, type Finding } from "@/lib/mock/ai";
import { submitAiRemediation } from "@/lib/api/ai";
import { formatRelative, formatUtc } from "@/lib/format";
import type { Operation } from "@/lib/types";

/**
 * UX-AI-002 /assistant/diagnostics/:report — AI diagnostic report.
 * Read-only evidence, uncertainty and likely causes (DS-017). Each finding
 * carries evidence lines, a confidence chip and an optional typed suggested
 * action: "Review impact" opens the DS-009 ImpactReview, and applying
 * submits an ai.remediation batch operation — the AI proposes, the user
 * approves, every action is audited. Nothing is applied autonomously.
 */

const CONFIDENCE_META: Record<Finding["confidence"], { tone: "success" | "warning" | "neutral"; label: string }> = {
  high: { tone: "success", label: "High confidence" },
  medium: { tone: "warning", label: "Medium confidence" },
  low: { tone: "neutral", label: "Low confidence" },
};

const RISK_META: Record<"low" | "medium" | "high", { tone: "success" | "warning" | "danger"; label: string }> = {
  low: { tone: "success", label: "Low risk" },
  medium: { tone: "warning", label: "Medium risk" },
  high: { tone: "danger", label: "High risk" },
};

const EVIDENCE_TYPE_LABEL: Record<Finding["evidence"][number]["type"], string> = {
  metric: "Metric",
  log: "Log (redacted)",
  state: "Observed state",
};

export function ReportView({ reportId }: { reportId: string }) {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const report = diagnosticReports.find((r) => r.id === reportId);

  const [impactFindingId, setImpactFindingId] = useState<string | null>(null);
  const [appliedOps, setAppliedOps] = useState<Record<string, string>>({});

  if (report === undefined) {
    return (
      <Screen
        id="UX-AI-002"
        breadcrumbs={[{ label: "AI assistant", href: "/assistant" }, { label: "Not found" }]}
      >
        <NotFoundInline what="diagnostic report" />
      </Screen>
    );
  }

  const impactFinding =
    impactFindingId === null ? undefined : report.findings.find((f) => f.id === impactFindingId);
  const impactPlan =
    impactFinding?.suggested_action === null || impactFinding === undefined
      ? undefined
      : aiPlans.find((p) => p.id === impactFinding.suggested_action?.plan_id);
  const history = aiRemediationHistory.filter((h) => h.report_id === report.id);

  const applyRemediation = (finding: Finding, plan: AiPlan) => {
    const op = submitAiRemediation(plan.id, plan.title);
    setAppliedOps((prev) => ({ ...prev, [finding.id]: op.id }));
    setImpactFindingId(null);
    push(
      "success",
      "Remediation submitted",
      `${plan.title} — approval recorded. The policy engine validates again at execution; track it in the operation tray.`
    );
    setTrayOpen(true);
  };

  const exportReport = () => {
    const lines = [
      `NexusPanel AI diagnostic report — ${report.title}`,
      `Report ID: ${report.id}`,
      `Generated (UTC): ${formatUtc(report.created_at)}`,
      `Evidence scope: ${report.context_scope}`,
      report.incident_id !== null ? `Related incident: ${report.incident_id}` : "Related incident: none",
      "",
      "DIAGNOSIS",
      report.diagnosis,
      "",
      "UNCERTAINTY",
      report.uncertainty,
      "",
      "FINDINGS",
      ...report.findings.flatMap((f, i) => [
        `${i + 1}. ${f.title} (confidence: ${f.confidence})`,
        f.detail,
        ...f.evidence.map((e) => `   evidence [${e.type}] ${e.ref} — ${e.summary}`),
        f.suggested_action !== null
          ? `   suggested action: ${f.suggested_action.label} (risk: ${f.suggested_action.risk}, plan: ${f.suggested_action.plan_id})`
          : "   suggested action: none — informational finding",
        "",
      ]),
      "Suggestions are not autonomous changes — every action is reviewed by a human and audited.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Screen
      id="UX-AI-002"
      breadcrumbs={[{ label: "AI assistant", href: "/assistant" }, { label: report.id }]}
      actions={
        <Button variant="secondary" icon="download" onClick={exportReport}>
          Export
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Card
          title={
            <span className="flex flex-wrap items-center gap-2">
              <Icon name="bot" size={16} className="text-accent" />
              {report.title}
            </span>
          }
          description={report.diagnosis}
          footer={
            <span>
              Generated {formatRelative(report.created_at, now)} ({formatUtc(report.created_at)}) ·
              evidence scope: {report.context_scope}
              {report.incident_id !== null && (
                <>
                  {" "}· related incident{" "}
                  <Link href={`/incidents/${report.incident_id}`} className="text-accent hover:underline">
                    {report.incident_id}
                  </Link>
                </>
              )}
            </span>
          }
        >
          <Callout tone="warning" title="Uncertainty — read this before acting">
            {report.uncertainty}
          </Callout>
          <Callout tone="info" className="mt-2" title="Suggestions, not autonomous changes">
            The AI proposes; you review the impact and approve; the policy engine validates again
            at execution. Nothing in this report changes your workloads by itself — and every
            action is audited.
          </Callout>
        </Card>

        <section aria-label="Findings" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">
            Findings ({report.findings.length})
          </h2>
          {report.findings.map((finding) => {
            const plan =
              finding.suggested_action === null
                ? undefined
                : aiPlans.find((p) => p.id === finding.suggested_action?.plan_id);
            const opId = appliedOps[finding.id];
            const confidence = CONFIDENCE_META[finding.confidence];
            return (
              <Card
                key={finding.id}
                title={finding.title}
                description={finding.detail}
                actions={<Chip tone={confidence.tone}>{confidence.label}</Chip>}
              >
                <div className="rounded-control border border-line bg-surface-2 p-3">
                  <p className="text-xs font-medium text-ink-2">Evidence</p>
                  <ul className="mt-1.5 flex list-none flex-col gap-1.5 p-0">
                    {finding.evidence.map((e) => (
                      <li key={e.ref} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <Chip tone="neutral">{EVIDENCE_TYPE_LABEL[e.type]}</Chip>
                        <span className="font-mono text-ink-2">{e.ref}</span>
                        <span className="min-w-0 text-ink">{e.summary}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {finding.suggested_action !== null && (
                  <div className="mt-3 rounded-control border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 text-sm font-medium text-ink">
                        Suggested action — {finding.suggested_action.label}
                      </p>
                      <Chip tone={RISK_META[finding.suggested_action.risk].tone}>
                        {RISK_META[finding.suggested_action.risk].label}
                      </Chip>
                    </div>
                    {plan !== undefined && (
                      <p className="mt-1 text-xs text-ink-3">
                        Typed plan <span className="font-mono">{plan.id}</span> · {plan.operation_kind}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {plan !== undefined && (
                        <>
                          <Button
                            size="sm"
                            icon="shield"
                            onClick={() => setImpactFindingId(finding.id)}
                          >
                            Review impact
                          </Button>
                          <ButtonLink
                            href={`/assistant/plans/${plan.id}`}
                            variant="secondary"
                            size="sm"
                          >
                            View plan
                          </ButtonLink>
                        </>
                      )}
                      {plan === undefined && (
                        <Callout tone="warning">
                          The typed plan for this action ({finding.suggested_action.plan_id}) is not
                          in this prototype&apos;s fixture set, so it cannot be applied here.
                        </Callout>
                      )}
                    </div>
                    {opId !== undefined && (
                      <AppliedOutcome opId={opId} />
                    )}
                  </div>
                )}

                {finding.suggested_action === null && (
                  <p className="mt-3 text-xs text-ink-3">
                    Informational finding — no action is proposed; it explains what already happened.
                  </p>
                )}
              </Card>
            );
          })}
        </section>

        {history.length > 0 && (
          <Card title="Audit trail for this report" description="Proposals, approvals and executions are recorded with actor and outcome.">
            <ol className="flex list-none flex-col gap-2 p-0">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    status={h.status === "succeeded" ? "succeeded" : h.status === "failed" ? "failed" : "awaiting_approval"}
                  />
                  <span className="min-w-0 text-sm text-ink">{h.action}</span>
                  <span className="text-xs text-ink-3">
                    {h.actor} · {formatRelative(h.occurred_at, now)}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        )}

        <p className="text-xs text-ink-3">
          Read-only report — the underlying evidence stays redacted. Correlating operations appear
          in <Link href="/activity" className="text-accent hover:underline">Activity</Link>.
        </p>
      </div>

      {impactFinding !== undefined &&
        impactFinding.suggested_action !== null &&
        impactPlan !== undefined && (
          <ImpactReview
            open
            onClose={() => setImpactFindingId(null)}
            onSubmit={() => applyRemediation(impactFinding, impactPlan)}
            title={impactFinding.suggested_action.label}
            impact={{
              before: impactFinding.suggested_action.before,
              after: impactFinding.suggested_action.after,
              affectedResources: impactFinding.suggested_action.affected,
              downtimeEstimate: impactFinding.suggested_action.downtime,
              reversibility: impactFinding.suggested_action.reversibility,
            }}
            diff={impactPlan.diff.length > 0 ? impactPlan.diff : undefined}
            submitLabel="Approve and apply"
          >
            <p>
              Typed plan <span className="font-mono">{impactPlan.id}</span> — the policy engine
              validates this plan again at execution; approval here is not a bypass.
            </p>
          </ImpactReview>
        )}
    </Screen>
  );
}

/** Tracks the remediation operation a finding kicked off — honest states only. */
function AppliedOutcome({ opId }: { opId: string }) {
  const { list } = useOperationStream();
  const op: Operation | undefined = list.find((o) => o.id === opId);
  if (op === undefined) return null;
  if (op.status === "failed" || op.status === "cancelled" || op.status === "rejected") {
    return (
      <Callout tone="danger" className="mt-3" title="The remediation did not complete">
        {op.error?.detail ?? "The operation stopped before it could be verified. Nothing is claimed as fixed."}
      </Callout>
    );
  }
  if (op.status !== "succeeded") {
    return (
      <div className="mt-3">
        <PendingState operation={op} />
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <StatusPill status="succeeded" at={op.last_verified_at} />
      <span className="text-xs text-ink-2">
        Verified — postcondition checks passed. Track it in{" "}
        <Link href="/activity" className="text-accent hover:underline">Activity</Link>.
      </span>
    </div>
  );
}
