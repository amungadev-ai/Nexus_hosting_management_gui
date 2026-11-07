import type {
  Operation,
  OperationEvent,
  OperationStatus,
  WorkloadCategory,
} from "@/lib/types";
import { newId, requestId } from "@/lib/api/core";

/**
 * Async-operation engine — the client-side stand-in for the Stage 6
 * "202 Accepted + operation resource + resumable SSE stream" pattern.
 *
 * Every mutation in the prototype goes through operations.submit(): the UI
 * immediately shows the operation tray entry (DS-011), the batch queue
 * indicator reacts (DS-023), and screens can subscribe to the event stream.
 * Batch workloads queue under serving contention and may yield — exactly the
 * behavior the honest-state rules require ("queued, will run when idle").
 */

export interface SubmitSpec {
  kind: string;
  title: string;
  resource_ref: { type: string; id: string; name?: string };
  workload_category: WorkloadCategory;
  step_titles: string[];
  /** Simulated terminal outcome — defaults to "succeeded". */
  outcome?: OperationStatus; // succeeded | failed | partially_succeeded | needs_attention
  /** Milliseconds per step (prototype speeds real operations up). */
  step_ms?: number;
  /** For batch ops: emit a batch.yielded event mid-run. */
  yields_once?: boolean;
  error?: { code: string; detail: string; retryable: boolean };
  partial?: { step_key: string; outcome: string; note: string }[];
  actor_id: string;
  organization_id: string;
}

type Listener = (op: Operation) => void;

const TERMINAL: OperationStatus[] = [
  "succeeded",
  "failed",
  "partially_succeeded",
  "cancelled",
  "rejected",
  "partially_compensated",
  "needs_attention",
];

export function isTerminal(status: OperationStatus): boolean {
  return TERMINAL.includes(status);
}

export class OperationEngine {
  private ops = new Map<string, Operation>();
  private events = new Map<string, OperationEvent[]>();
  private listeners = new Set<Listener>();
  private counters = new Map<string, number>();
  private seeded = false;

  list(): Operation[] {
    return [...this.ops.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  get(id: string): Operation | undefined {
    return this.ops.get(id);
  }

  /** Resumable SSE replay: events after Last-Event-ID (Stage 6 §5.3). */
  eventsFor(operationId: string, lastEventId?: string | null): OperationEvent[] {
    const all = this.events.get(operationId) ?? [];
    if (!lastEventId) return all;
    const idx = all.findIndex((e) => e.id === lastEventId);
    return idx >= 0 ? all.slice(idx + 1) : all;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(op: Operation, event: OperationEvent["event"], data: OperationEvent["data"]) {
    const n = (this.counters.get(op.id) ?? 0) + 1;
    this.counters.set(op.id, n);
    const evt: OperationEvent = {
      id: `opevt_01J${op.id.slice(-6)}${String(n).padStart(2, "0")}`,
      event,
      operation_id: op.id,
      data,
    };
    const list = this.events.get(op.id) ?? [];
    list.push(evt);
    this.events.set(op.id, list);
  }

  private notify(op: Operation) {
    for (const fn of this.listeners) fn({ ...op, steps: op.steps.map((s) => ({ ...s })) });
  }

  private setStatus(op: Operation, status: OperationStatus, eventType: string) {
    op.status = status;
    const now = new Date().toISOString();
    if (status === "running" && !op.started_at) op.started_at = now;
    if (isTerminal(status)) {
      op.finished_at = now;
      op.last_verified_at = status === "succeeded" ? now : undefined;
    }
    this.emit(op, isTerminal(status) ? "operation.completed" : "operation.updated", {
      event_type: eventType,
      status,
      occurred_at: now,
      progress: { completed_steps: op.progress.completed_steps, total_steps: op.progress.total_steps },
    });
    this.notify(op);
  }

  submit(spec: SubmitSpec): Operation {
    const now = new Date().toISOString();
    const op: Operation = {
      id: newId("op"),
      kind: spec.kind,
      title: spec.title,
      status: "pending",
      workload_category: spec.workload_category,
      actor_id: spec.actor_id,
      organization_id: spec.organization_id,
      resource_ref: spec.resource_ref,
      steps: spec.step_titles.map((title, i) => ({
        key: `step_${i + 1}`,
        title,
        status: "pending",
      })),
      progress: { completed_steps: 0, total_steps: spec.step_titles.length },
      batch:
        spec.workload_category === "batch"
          ? { queue_position: 1 + Math.floor(Math.random() * 3), low_priority: true }
          : undefined,
      created_at: now,
      correlation_id: requestId(),
      error: spec.error,
      partial: spec.partial,
    };
    this.ops.set(op.id, op);
    this.emit(op, "operation.updated", {
      event_type: "operation.accepted",
      status: "pending",
      occurred_at: now,
      progress: { completed_steps: 0, total_steps: op.progress.total_steps },
    });
    this.notify(op);
    this.schedule(op, spec);
    return op;
  }

  /** Hydrate seeded (historical) operations; non-terminal ones continue. */
  seed(seedOps: Operation[]) {
    if (this.seeded) return;
    this.seeded = true;
    for (const op of seedOps) {
      this.ops.set(op.id, { ...op, steps: op.steps.map((s) => ({ ...s })) });
      this.counters.set(op.id, 0);
      if (!isTerminal(op.status)) {
        const running = op.status === "running";
        this.schedule(
          this.ops.get(op.id)!,
          {
            kind: op.kind,
            title: op.title,
            resource_ref: op.resource_ref,
            workload_category: op.workload_category,
            step_titles: op.steps.map((s) => s.title),
            actor_id: op.actor_id,
            organization_id: op.organization_id,
          },
          running ? 0 : 1200
        );
      }
    }
  }

  private schedule(op: Operation, spec: SubmitSpec, initialDelayMs?: number) {
    const stepMs = spec.step_ms ?? 700;
    const total = op.steps.length;
    let i = op.progress.completed_steps;
    const advancing = op.status === "running";
    if (!advancing) {
      window.setTimeout(() => {
        if (op.status === "cancelled") return;
        this.setStatus(op, "validating", "operation.validating");
        window.setTimeout(() => {
          if (op.status === "cancelled") return;
          this.setStatus(op, "queued", "operation.queued");
          window.setTimeout(() => {
            if (op.status === "cancelled") return;
            if (op.batch) op.batch.queue_position = undefined;
            this.setStatus(op, "running", "operation.running");
            tick();
          }, stepMs);
        }, stepMs);
      }, initialDelayMs ?? stepMs);
    } else {
      window.setTimeout(() => tick(), stepMs);
    }

  const tick = (): void => {
      if (op.status === "cancelled") return;
      if (i >= total) {
        this.setStatus(op, "verifying", "operation.verifying");
        window.setTimeout(() => {
          if (op.status === "cancelled") return;
          const outcome = spec.outcome ?? "succeeded";
          if (outcome === "failed" && spec.error) {
            this.setStatus(op, "failed", "operation.failed");
          } else if (outcome === "partially_succeeded" || outcome === "needs_attention") {
            this.setStatus(op, outcome, `operation.${outcome}`);
          } else {
            this.setStatus(op, "succeeded", "operation.succeeded");
          }
        }, stepMs);
        return;
      }
      const step = op.steps[i];
      step.status = "running";
      step.occurred_at = new Date().toISOString();
      this.emit(op, "operation.updated", {
        event_type: "step.started",
        step_key: step.key,
        attempt: 1,
        status: "running",
        occurred_at: step.occurred_at,
        progress: { completed_steps: i, total_steps: total },
      });
      this.notify(op);
      window.setTimeout(() => {
        if (op.status === "cancelled") return;
        // Batch yielding: a serving workload grabbed the CPU; the batch job
        // yields and resumes — surfaced as events, never as an error (DS-023).
        if (spec.yields_once && i === Math.max(0, total - 2) && !op.batch?.yielded) {
          if (op.batch) op.batch.yielded = true;
          this.emit(op, "operation.updated", {
            event_type: "batch.yielded",
            status: "running",
            occurred_at: new Date().toISOString(),
            progress: { completed_steps: i, total_steps: total },
            payload_redacted: { reason: "serving workload contention" },
          });
          this.notify(op);
          window.setTimeout(() => {
            this.emit(op, "operation.updated", {
              event_type: "batch.resumed",
              status: "running",
              occurred_at: new Date().toISOString(),
              progress: { completed_steps: i, total_steps: total },
            });
            this.notify(op);
          }, stepMs);
        }
        step.status = "succeeded";
        i += 1;
        op.progress.completed_steps = i;
        this.emit(op, "operation.updated", {
          event_type: "step.succeeded",
          step_key: step.key,
          status: "succeeded",
          occurred_at: new Date().toISOString(),
          progress: { completed_steps: i, total_steps: total },
        });
        this.notify(op);
        window.setTimeout(tick, stepMs / 2);
      }, stepMs);
    }
  }

  /** Best-effort cancel (Stage 6 §5.1). */
  cancel(id: string): Operation | undefined {
    const op = this.ops.get(id);
    if (!op || isTerminal(op.status)) return op;
    this.setStatus(op, "cancelled", "operation.cancelled");
    return op;
  }
}

/** Browser singleton — providers subscribe on mount. */
export const operations = new OperationEngine();
