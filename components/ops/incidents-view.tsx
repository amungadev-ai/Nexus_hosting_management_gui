"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { NotFoundInline } from "@/components/common/states";
import { KeyValue } from "@/components/ui/misc";
import { useNow, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { incidentEvents } from "@/lib/mock/ops";
import { formatRelative, formatUtc } from "@/lib/format";
import type { Incident } from "@/lib/types";
import type { IncidentEvent } from "@/lib/mock/ops";

/**
 * UX-OPS-011 /incidents/:incident — evidence, runbook, actions, postmortem.
 * Entry point of FLOW-010: AI-guided remediation links to the diagnostics report.
 */

const KIND_META: Record<IncidentEvent["kind"], { label: string; tone: "info" | "warning" | "success" | "neutral" }> = {
  alert: { label: "Alert", tone: "warning" },
  diagnosis: { label: "AI diagnosis", tone: "info" },
  action: { label: "Action", tone: "info" },
  note: { label: "Note", tone: "neutral" },
  state: { label: "State", tone: "success" },
};

export function IncidentDetail({ incidentId }: { incidentId: string }) {
  const now = useNow();
  const { push } = useToast();
  const incident: Incident | undefined = db.incidents.find((i) => i.id === incidentId);
  const [acked, setAcked] = useState(false);
  const events = incidentEvents.filter((e) => e.incident_id === incidentId);

  if (incident === undefined) {
    return (
      <Screen id="UX-OPS-011" breadcrumbs={[{ label: "Incidents", href: "/incidents" }, { label: "Not found" }]}>
        <NotFoundInline what="incident" />
      </Screen>
    );
  }

  const state = acked && incident.state === "open" ? "acknowledged" : incident.state;

  return (
    <Screen
      id="UX-OPS-011"
      breadcrumbs={[{ label: "Incidents", href: "/incidents" }, { label: incident.id }]}
      actions={
        incident.state === "open" && !acked ? (
          <Button
            icon="check"
            onClick={() => {
              setAcked(true);
              push("info", "Incident acknowledged", `${incident.title} — resolution still pending.`);
            }}
          >
            Acknowledge
          </Button>
        ) : incident.state !== "resolved" ? (
          <Button
            icon="check-circle"
            onClick={() =>
              push("info", "Resolve needs verification", "Resolve only after the fix is verified — check the runbook steps first.")
            }
          >
            Resolve
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={incident.severity === "critical" ? "failed" : incident.severity === "major" ? "degraded" : "unknown"} />
            <StatusPill status={state === "open" ? "open" : state === "acknowledged" ? "pending" : "succeeded"} />
            <span className="font-mono text-xs text-ink-3">{incident.id}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-ink">{incident.title}</h2>
          <p className="mt-1 text-sm text-ink-2">{incident.summary}</p>
          <div className="mt-4">
            <KeyValue
              items={[
                { label: "Started (UTC)", value: formatUtc(incident.started_at) },
                { label: "Started (relative)", value: formatRelative(incident.started_at, now) },
                ...(incident.resolved_at !== undefined
                  ? [{ label: "Resolved (UTC)", value: formatUtc(incident.resolved_at) }]
                  : []),
                { label: "Affected", value: incident.affected.join(", ") },
              ]}
            />
          </div>
        </Card>

        {/* AI remediation entry (FLOW-010) */}
        {incident.id === "inc_01JINC01" && (
          <Callout tone="info" title="AI diagnostics available">
            A read-only diagnostic report proposes typed actions — you approve, the policy
            engine validates, the job executes.
            <div className="mt-2">
              <ButtonLink href="/assistant/diagnostics/rep_01JMEM01" variant="secondary" size="sm" icon="bot">
                Open AI diagnostic report
              </ButtonLink>
            </div>
          </Callout>
        )}

        <Card title="Runbook" description="Safe checks to run before changing anything">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-2">
            <li>Confirm the workload is actually constrained: check its allocation strip (peak vs ceiling).</li>
            <li>Look for the trigger: deploy, traffic spike, or a cache without eviction.</li>
            <li>Safe mitigation: restart the workload (brief downtime, no data loss).</li>
            <li>Durable fix: raise memory.max (only if the VPS has headroom) or reduce usage.</li>
            <li>Verify: watch memory.current fall and stay below 80% for 30 minutes.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href="/monitoring/pressure" variant="secondary" size="sm">
              Memory pressure view
            </ButtonLink>
            <ButtonLink href="/monitoring/logs" variant="secondary" size="sm">
              Related logs
            </ButtonLink>
          </div>
        </Card>

        <Card title="Timeline" description="Related events, newest last">
          {events.length === 0 ? (
            <p className="text-sm text-ink-2">No related events recorded yet.</p>
          ) : (
            <ol className="flex list-none flex-col gap-3 p-0">
              {events.map((e) => {
                const meta = KIND_META[e.kind];
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-0.5 shrink-0">
                      <StatusPill status={meta.tone === "warning" ? "degraded" : meta.tone === "info" ? "pending" : meta.tone === "success" ? "succeeded" : "unknown"} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        <span className="font-medium">{meta.label}</span> · {e.actor}
                      </p>
                      <p className="text-sm text-ink-2">{e.text}</p>
                      <p className="text-xs text-ink-3">{formatUtc(e.occurred_at)} · {formatRelative(e.occurred_at, now)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {incident.state === "resolved" && (
          <Card title="Postmortem summary">
            <p className="text-sm text-ink-2">
              Existing certificate remained valid throughout the rate-limit window — renewal
              retried after it lifted. No customer impact. Follow-up: certificate renewals
              now back off with jitter before hitting provider limits.
            </p>
          </Card>
        )}

        <p className="text-xs text-ink-3">
          Evidence is scoped and redacted. Correlating operations are in{" "}
          <Link href="/activity" className="text-accent hover:underline">Activity</Link>; the
          audit trail records every action taken on this incident.
        </p>
      </div>
    </Screen>
  );
}
