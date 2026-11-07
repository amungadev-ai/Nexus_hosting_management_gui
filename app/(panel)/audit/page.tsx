"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { StatusPill } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/form";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/code";
import { useNow, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { downloadCsv } from "@/lib/api/ops";
import { formatUtc } from "@/lib/format";
import type { AuditEvent } from "@/lib/types";

/**
 * UX-OPS-016 /audit — immutable audit trail in UTC with the hash chain:
 * each record hashes the previous, tampering breaks the chain. Filters on
 * action/outcome; export is wired. The fixture hashes are abbreviated, so cryptographic verification is unavailable.
 */
export default function AuditTrailPage() {
  const now = useNow();
  const { push } = useToast();
  const rows = useFixture(() => db.audit);
  const [action, setAction] = useState("all");
  const [outcome, setOutcome] = useState("all");

  const actions = useMemo(() => [...new Set((rows ?? []).map((r) => r.action))], [rows]);
  const filtered = useMemo(
    () => (rows ?? []).filter((r) => (action === "all" || r.action === action) && (outcome === "all" || r.outcome === outcome)),
    [rows, action, outcome]
  );

  const exportCsv = () => {
    downloadCsv(
      "audit-trail.csv",
      ["id", "occurred_at_utc", "action", "actor", "resource", "outcome", "previous_hash", "record_hash"],
      filtered.map((r) => [
        r.id,
        r.occurred_at,
        r.action,
        r.actor_label,
        `${r.resource.type}:${r.resource.id}`,
        r.outcome,
        r.previous_hash,
        r.record_hash,
      ])
    );
  };

  return (
    <Screen
      id="UX-OPS-016"
      breadcrumbs={[{ label: "Audit" }]}
      actions={
        <>
          <Button variant="secondary" icon="download" onClick={exportCsv}>
            Export
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="Audit evidence preview — not cryptographically verified">
          This prototype shows UTC audit events with shortened illustrative hash values. Full hashes and signed server evidence are unavailable, so the UI cannot verify chain integrity. Exporting the rows does not certify their authenticity.
        </Callout>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Filter by action" htmlFor="audit-action">
            <Select id="audit-action" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Filter by outcome" htmlFor="audit-outcome">
            <Select id="audit-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="all">All outcomes</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="denied">Denied</option>
            </Select>
          </Field>
        </div>

        {rows === null ? (
          <SkeletonTable rows={6} cols={6} />
        ) : (
          <DataTable<AuditEvent>
            caption="Audit trail — actor, action, target and hash chain (UTC)"
            rowKey={(r) => r.id}
            rows={filtered}
            columns={[
              { key: "occurred_at", header: "When (UTC)", render: (r) => formatUtc(r.occurred_at), className: "sticky left-0 bg-surface whitespace-nowrap" },
              { key: "action", header: "Action", render: (r) => <span className="font-mono text-xs">{r.action}</span> },
              { key: "actor_label", header: "Actor" },
              {
                key: "resource",
                header: "Target",
                render: (r) => (
                  <span className="text-xs">
                    {r.resource.name ?? r.resource.id} <span className="text-ink-3">({r.resource.type})</span>
                  </span>
                ),
              },
              {
                key: "outcome",
                header: "Outcome",
                render: (r) => (
                  <StatusPill status={r.outcome === "succeeded" ? "succeeded" : r.outcome === "failed" ? "failed" : "failed"} />
                ),
              },
              {
                key: "hashes",
                header: "Hash chain",
                render: (r) => (
                  <span className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-ink-3">
                    <span title="previous hash">←{r.previous_hash}</span>
                    <span title="record hash" className="text-ink-2">{r.record_hash}</span>
                    <CopyButton text={`${r.previous_hash} → ${r.record_hash}`} label="Copy hashes" />
                  </span>
                ),
              },
            ]}
          />
        )}
        <p className="text-xs text-ink-3">
          Showing {filtered.length} of {(rows ?? []).length} records · relative ages like{" "}
          {rows !== null && rows.length > 0 ? `“${rows[0].id}”` : "—"} map to the timestamps above in your local timezone.
        </p>
      </div>
    </Screen>
  );
}
