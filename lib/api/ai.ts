import { db } from "@/lib/mock/data";
import { operations } from "@/lib/operations";
import type { Operation } from "@/lib/types";

/**
 * AI-module API client (§4.18). v1 = read-only diagnosis + approval-gated
 * proposed actions. AI inference is a BATCH workload ("AI is queued behind
 * site traffic"); the AI never claims success before verification.
 */

const ACTOR = { actor_id: db.currentUser, organization_id: db.currentOrganization } as const;

/** Ask the assistant a question — batch operation, yields to site traffic. */
export function submitAiAnalyze(question: string): Operation {
  return operations.submit({
    kind: "ai.analyze",
    title: `AI analysis — “${question.slice(0, 48)}${question.length > 48 ? "…" : ""}”`,
    resource_ref: { type: "ai_conversation", id: "aic_current" },
    workload_category: "batch",
    yields_once: true,
    step_titles: [
      "Collect permitted evidence (metrics, redacted logs)",
      "Redact secrets and tenant data",
      "Run diagnosis (external LLM, batch)",
      "Compose answer with citations",
    ],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Apply a suggested remediation — goes through plan/approval/apply. */
export function submitAiRemediation(planId: string, title: string): Operation {
  return operations.submit({
    kind: "ai.remediation",
    title: `AI remediation — ${title}`,
    resource_ref: { type: "ai_plan", id: planId, name: title },
    workload_category: "batch",
    yields_once: true,
    step_titles: [
      "Bind plan hash and approval",
      "Validate policy again at execution",
      "Execute typed steps",
      "Verify observed results",
    ],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Stop an in-flight AI run at the next safe boundary (by plan id). */
export function stopAiRun(planId: string): Operation | undefined {
  const live = operations
    .list()
    .find(
      (op) =>
        op.kind === "ai.remediation" &&
        op.resource_ref.type === "ai_plan" &&
        op.resource_ref.id === planId &&
        op.status !== "succeeded" &&
        op.status !== "failed" &&
        op.status !== "cancelled"
    );
  if (live === undefined) return undefined;
  return operations.cancel(live.id);
}
