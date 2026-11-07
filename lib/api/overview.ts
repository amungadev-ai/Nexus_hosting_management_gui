import type { ApprovalRequest, Operation } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { ok, withLatency } from "@/lib/api/core";
import { operations } from "@/lib/operations";

/**
 * Overview-module API client (mock layer). Mutations follow the Stage 6
 * contract: the durable result is an OPERATION (202 + operation resource),
 * the toast only acknowledges, and nothing is ever marked complete
 * client-side. Approval decisions attach to an operation that already
 * exists — the approval does not submit a new one.
 */

/** POST /operations/{id}/retry — a retry is a new attempt, not a duplicate. */
export function retryOperation(op: Operation): Operation {
  return operations.submit({
    kind: op.kind,
    title: `Retry — ${op.title}`,
    resource_ref: op.resource_ref,
    workload_category: op.workload_category,
    step_titles: op.steps.map((s) => s.title),
    actor_id: db.currentUser,
    organization_id: db.currentOrganization,
    error: op.error,
  });
}

/** POST /operations/{id}/cancel — best-effort; never promises reversal. */
export function cancelOperation(id: string): void {
  operations.cancel(id);
}

export type ApprovalDecision = "approved" | "rejected";

export interface DecisionRecord {
  id: string;
  decision: ApprovalDecision;
  decided_at: string;
  decided_by: string;
  note: string | null;
}

/**
 * POST /plans/{id}/approve | /reject — bound to the approval, its policy and
 * the step-up token the caller obtained via requestStepUp("approval.decide").
 * The linked operation proceeds (or is rejected) server-side; the UI never
 * pretends the underlying job finished.
 */
export async function decideApproval(
  approval: ApprovalRequest,
  decision: ApprovalDecision,
  note?: string
) {
  return withLatency(() => {
    const record: DecisionRecord = {
      id: approval.id,
      decision,
      decided_at: new Date().toISOString(),
      decided_by: db.currentUser,
      note: note?.trim() ? note.trim() : null,
    };
    return ok(record);
  }, 240);
}
