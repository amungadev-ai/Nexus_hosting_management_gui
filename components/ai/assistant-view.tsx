"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { PendingState, UnavailableState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Callout, ErrorBlock, SkeletonText } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icons";
import { useCapability, useNow, useOperationStream, useToast } from "@/components/providers";
import { useAiSettings } from "@/components/ai/ai-state";
import { db } from "@/lib/mock/data";
import {
  aiRemediationHistory,
  assistantPrompts,
  diagnosticReports,
} from "@/lib/mock/ai";
import { submitAiAnalyze } from "@/lib/api/ai";
import { formatRelative } from "@/lib/format";
import type { Operation } from "@/lib/types";

/**
 * UX-AI-001 /assistant — AI assistant workspace (DS-017).
 *
 * In-page states required by the registry:
 * - UX-AI-006 first-run: welcome/onboarding card until the first analysis run.
 * - UX-AI-007 needs-key: honest callout (capability reason + Configure link)
 *   while no LLM API key is set, and the opt-out state after "Disable AI".
 * - Capability gate: ai.diagnostics unavailable → UnavailableState with the
 *   installer's reason; never a dead control.
 *
 * Asking submits ai.analyze — a BATCH operation that queues behind site
 * traffic and yields once (DS-023). Answers render only after the operation
 * reaches succeeded: no fabricated success while the job is pending.
 */

interface AskEntry {
  opId: string;
  question: string;
  promptId: string | null;
  scopeLabel: string | null;
}

const FALLBACK_ANSWER = {
  headline: "No permitted evidence answers this question yet",
  body: "In this prototype the assistant answers only from its evidence-cited demo set (metrics, redacted logs and state it is allowed to read). Nothing was invented to fill the gap. Try one of the suggested questions — each maps to real fixture evidence.",
  citations: [] as string[],
};

interface AnswerView {
  headline: string;
  body: string;
  citations: string[];
  action?: { label: string; href: string };
}

/** Map a free-text question onto the canned evidence-backed answer set. */
function matchPromptId(question: string): string | null {
  const q = question.toLowerCase();
  if (/(backup|verif|restore|snapshot)/.test(q)) return "p3";
  if (/(team-cloud|team cloud|nextcloud|health|8080|refused)/.test(q)) return "p2";
  if (/(closest|limit|ceiling|headroom|which workload|tightest|throttl)/.test(q)) return "p4";
  if (/(memory|ram|oom|cache|orders-api|orders api)/.test(q)) return "p1";
  return null;
}

export function AssistantWorkspace() {
  const { push } = useToast();
  const { list: ops } = useOperationStream();
  const cap = useCapability("ai.diagnostics");
  const ai = useAiSettings();
  const suggested = useSuggestedPrompts();

  const [question, setQuestion] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [asks, setAsks] = useState<AskEntry[]>([]);

  if (!ai.ready) {
    return (
      <Screen id="UX-AI-001" breadcrumbs={[{ label: "AI assistant" }]}>
        <SkeletonText lines={6} />
      </Screen>
    );
  }

  const scopeOptions = [
    ...db.websites.map((w) => ({ value: w.id, label: `Website · ${w.name}` })),
    ...db.applications.map((a) => ({ value: a.id, label: `Application · ${a.name}` })),
    ...db.serviceInstances.map((s) => ({ value: s.id, label: `Service · ${s.name}` })),
  ];
  const scopeName = scopeOptions.find((o) => o.value === scopeId)?.label ?? null;

  const ask = (raw: string) => {
    const q = raw.trim();
    if (q === "") return;
    const promptId = matchPromptId(q);
    const op = submitAiAnalyze(q);
    setAsks((prev) => [{ opId: op.id, question: q, promptId, scopeLabel: scopeName }, ...prev]);
    setQuestion("");
    ai.markRun();
    push(
      "info",
      "AI analysis queued",
      "It runs as a batch job when your websites are idle — usually within minutes. Track it in the operation tray."
    );
  };

  const disableAi = () => {
    ai.setOptOut(true);
    push("info", "AI disabled", "The assistant is turned off for this account. Reports and runs stay available; re-enable it in Settings → AI.");
  };

  const gate = (() => {
    if (ai.optOut) {
      return (
        <Card
          title="AI is turned off"
          description="You disabled the assistant, so it will not read evidence or propose actions. Nothing was deleted — diagnostic reports and run history stay available."
        >
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/settings/ai" icon="settings">Re-enable AI</ButtonLink>
          </div>
        </Card>
      );
    }
    if (cap.state === "unavailable") {
      return <UnavailableState capabilityKey="ai.diagnostics" />;
    }
    if (!ai.keyConfigured) {
      // UX-AI-007 — honest needs-key state: capability reason + upgrade path.
      return (
        <Card
          title="AI diagnostics require an LLM API key"
          description="Without a key the assistant cannot run analysis — and it will not pretend to."
        >
          <Callout tone="info" className="mb-3">
            {cap.reason ??
              "AI diagnostics run as a batch workload against an external LLM API. Add an API key in Settings → AI to enable it."}{" "}
            No hardware upgrade is needed — the key is the only missing piece.
          </Callout>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/settings/ai" icon="key">Configure</ButtonLink>
            <Button variant="ghost" onClick={disableAi}>Disable AI</Button>
          </div>
        </Card>
      );
    }
    return null;
  })();

  const workspaceUnlocked = gate === null;

  return (
    <Screen
      id="UX-AI-001"
      breadcrumbs={[{ label: "AI assistant" }]}
      actions={
        <ButtonLink href="/settings/ai" variant="secondary" icon="settings">
          AI settings
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-4">
        {gate}

        {workspaceUnlocked && ai.hasRun === false && (
          // UX-AI-006 — first-run onboarding card, shown until the first run.
          <Card title="Welcome — AI can diagnose and propose; you approve; the policy engine decides">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-2">
              <li>Ask a question — the assistant collects only permitted evidence: metrics, redacted logs and observed state.</li>
              <li>Analysis runs as a low-priority batch job. It queues behind site traffic and yields — this is normal, not a failure.</li>
              <li>You get an evidence-cited answer and typed suggested actions with confidence levels.</li>
              <li>Nothing changes without your approval — you review the impact, the policy engine validates again at execution, and every action is audited.</li>
            </ol>
          </Card>
        )}

        {workspaceUnlocked && cap.state === "borderline" && (
          <Callout tone="info">
            ai.diagnostics is borderline on this VPS: with your API key configured, analysis runs
            as a low-priority batch workload. The next capability read reports it Available.
          </Callout>
        )}

        {workspaceUnlocked && (
          <Card title="Ask the assistant">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
              className="flex flex-col gap-3"
            >
              <Field
                label="Your question"
                htmlFor="assistant-question"
                hint="Answered from permitted evidence only — metrics, redacted logs and observed state."
              >
                <Input
                  id="assistant-question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <div className="flex flex-wrap items-end gap-3">
                <Field
                  label="Attach resource (optional)"
                  htmlFor="assistant-scope"
                  className="min-w-56 flex-1"
                  hint="Scopes the analysis to one resource."
                >
                  <Select id="assistant-scope" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                    <option value="">Whole workspace</option>
                    {scopeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" icon="bot" disabled={question.trim() === ""}>Ask</Button>
              </div>
            </form>

            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-medium text-ink-2">
                Suggested questions — drawn from your incidents and recommendations
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggested.map((s) => {
                  const prompt = assistantPrompts.find((p) => p.id === s.promptId);
                  if (prompt === undefined) return null;
                  return (
                    <button
                      key={s.promptId}
                      type="button"
                      onClick={() => ask(prompt.prompt)}
                      title={s.source}
                      className="max-w-full rounded-control border border-line bg-surface px-3 py-2 text-left text-xs text-ink hover:border-accent"
                    >
                      <span className="block font-medium">{prompt.prompt}</span>
                      <span className="mt-0.5 block text-ink-3">{s.source}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {asks.map((entry) => {
          const op = ops.find((o) => o.id === entry.opId);
          if (op === undefined) return null;
          return <AskResult key={entry.opId} entry={entry} op={op} onRetry={() => ask(entry.question)} />;
        })}

        {workspaceUnlocked === false && asks.length === 0 && (
          <p className="text-sm text-ink-2">
            Asking is unavailable right now — the reasons above explain why. The read-only
            history below stays available.
          </p>
        )}

        <ReportsSection />
        <HistorySection />
      </div>
    </Screen>
  );
}

/** Fixture-backed suggested questions, each tied to live demo data titles. */
function useSuggestedPrompts(): { promptId: string; source: string }[] {
  const incident = db.incidents.find((i) => i.id === "inc_01JINC01");
  const ramRec = db.recommendations.find((r) => r.id === "rec_01JREC01");
  const diskRec = db.recommendations.find((r) => r.id === "rec_01JREC02");
  const teamCloud = db.serviceInstances.find((s) => s.id === "svc_01JNEXT03");
  return [
    { promptId: "p1", source: `Open incident · ${incident?.title ?? "orders-api memory pressure"}` },
    { promptId: "p2", source: `Degraded service · ${teamCloud?.name ?? "team-cloud"} failing health checks` },
    { promptId: "p3", source: "Backup verification · wanjiku-blog checksum failed (Nov 6)" },
    {
      promptId: "p4",
      source: `Recommendation · ${ramRec?.title ?? diskRec?.title ?? "orders-api peak RAM above 80%"}`,
    },
  ];
}

/**
 * One asked question, rendered honestly against its ai.analyze operation:
 * pending/queued → DS-016 pending state (no fake answer), failed → safe
 * error + retry, succeeded → the evidence-cited canned answer card.
 */
function AskResult({
  entry,
  op,
  onRetry,
}: {
  entry: AskEntry;
  op: Operation;
  onRetry: () => void;
}) {
  const now = useNow();
  const { setTrayOpen, setFocusedId } = useOperationStream();

  if (op.status === "failed" || op.status === "cancelled" || op.status === "rejected") {
    return (
      <ErrorBlock
        code={op.error?.code ?? "AI_ANALYSIS_FAILED"}
        detail={
          op.error?.detail ??
          "The analysis did not complete, so there is no answer to show. Your question is kept so you can retry it."
        }
        correlationId={op.correlation_id}
        onRetry={onRetry}
      />
    );
  }

  if (op.status !== "succeeded") {
    return (
      <PendingState operation={op}>
        <p className="text-sm text-ink-2">
          Question: <span className="font-medium text-ink">{entry.question}</span>
          {entry.scopeLabel !== null && ` — scoped to ${entry.scopeLabel}`}
        </p>
      </PendingState>
    );
  }

  const prompt = entry.promptId === null ? undefined : assistantPrompts.find((p) => p.id === entry.promptId);
  const answer: AnswerView = prompt?.answer ?? FALLBACK_ANSWER;
  const actionHref = prompt?.answer.action?.href;
  const actionLabel = prompt?.answer.action?.label;

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Icon name="bot" size={16} className="text-accent" />
          {answer.headline}
        </span>
      }
      footer={
        <span>
          Verified{" "}
          {op.last_verified_at !== undefined ? formatRelative(op.last_verified_at, now) : "just now"} ·
          evidence redacted · operation <span className="font-mono">{op.id}</span>
        </span>
      }
    >
      <p className="text-sm text-ink-2">
        You asked: <span className="font-medium text-ink">{entry.question}</span>
        {entry.scopeLabel !== null && (
          <Chip tone="neutral" className="ml-2">Scoped to {entry.scopeLabel}</Chip>
        )}
      </p>
      <p className="mt-2 text-sm text-ink">{answer.body}</p>

      {prompt !== undefined && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-2">Evidence citations</p>
          <ul className="mt-1.5 flex list-none flex-col gap-1 p-0">
            {answer.citations.map((c) => (
              <li key={c} className="flex items-start gap-1.5 text-xs text-ink-2">
                <Icon name="file-text" size={12} className="mt-0.5 shrink-0 text-ink-3" />
                <span className="min-w-0 font-mono">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {prompt === undefined && (
        <Callout tone="info" className="mt-3">
          This prototype ships a canned, evidence-backed answer set — it never improvises.
          Pick a suggested question to see a full cited answer.
        </Callout>
      )}

      {actionHref !== undefined && actionLabel !== undefined && (
        <div className="mt-3">
          <ButtonLink href={actionHref} variant="secondary" size="sm" icon="arrow-right">
            {actionLabel}
          </ButtonLink>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-ink-3">
        <button
          type="button"
          onClick={() => {
            setFocusedId(op.id);
            setTrayOpen(true);
          }}
          className="rounded-control p-1 text-xs font-medium text-accent hover:underline"
        >
          View operation timeline
        </button>
        <span>Batch job — queued behind site traffic, yields when serving workloads need the CPU.</span>
      </div>
    </Card>
  );
}

function ReportsSection() {
  const now = useNow();
  return (
    <section aria-label="Diagnostic reports" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink">
        Diagnostic reports ({diagnosticReports.length})
      </h2>
      {diagnosticReports.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            No reports yet. Run an analysis above — every completed diagnosis lands here as a
            read-only, evidence-cited report.
          </p>
        </Card>
      ) : (
        diagnosticReports.map((report) => {
          const incident =
            report.incident_id === null
              ? undefined
              : db.incidents.find((i) => i.id === report.incident_id);
          return (
            <Card
              key={report.id}
              title={
                <Link
                  href={`/assistant/diagnostics/${report.id}`}
                  className="font-semibold text-accent hover:underline"
                >
                  {report.title}
                </Link>
              }
              description={report.diagnosis}
              actions={
                <ButtonLink
                  href={`/assistant/diagnostics/${report.id}`}
                  variant="secondary"
                  size="sm"
                  icon="arrow-right"
                >
                  Open report
                </ButtonLink>
              }
              footer={
                <span>
                  {formatRelative(report.created_at, now)} · {report.context_scope} ·{" "}
                  {report.findings.length} finding{report.findings.length === 1 ? "" : "s"}
                  {incident !== undefined && (
                    <>
                      {" "}· incident{" "}
                      <Link href={`/incidents/${incident.id}`} className="text-accent hover:underline">
                        {incident.title}
                      </Link>
                    </>
                  )}
                </span>
              }
            />
          );
        })
      )}
    </section>
  );
}

function HistorySection() {
  const now = useNow();
  if (aiRemediationHistory.length === 0) return null;
  return (
    <section aria-label="Recent remediation activity" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink">Recent remediation activity</h2>
      <Card>
        <ol className="flex list-none flex-col gap-3 p-0">
          {aiRemediationHistory.map((h) => {
            const reportExists = diagnosticReports.some((r) => r.id === h.report_id);
            return (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <StatusPill
                  status={
                    h.status === "succeeded" ? "succeeded" : h.status === "failed" ? "failed" : "awaiting_approval"
                  }
                />
                <span className="min-w-0 text-sm text-ink">{h.action}</span>
                <span className="text-xs text-ink-3">
                  {h.actor} · {formatRelative(h.occurred_at, now)} ·{" "}
                  {reportExists ? (
                    <Link href={`/assistant/diagnostics/${h.report_id}`} className="text-accent hover:underline">
                      report {h.report_id}
                    </Link>
                  ) : (
                    <span title="This report has been archived and is no longer linked in the demo set.">
                      report {h.report_id} (archived)
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 border-t border-line pt-2 text-xs text-ink-3">
          Every AI-proposed action is audited: proposals, approvals and executions are recorded
          with actor, time and outcome.
        </p>
      </Card>
    </section>
  );
}
