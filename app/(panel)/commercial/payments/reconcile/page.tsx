"use client";

import React, { useState } from "react";
import { db } from "@/lib/mock/data";
import { reconciliationNotes } from "@/lib/mock/commercial";
import { formatMoney, formatDateTime } from "@/lib/format";
import { useToast } from "@/components/providers";
import { proposeReconciliationMatch, reconciliationNoteFor } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { ReconChip } from "@/components/commercial/shared";
import { CommercialGate, useRefresh } from "@/components/commercial/shared";

export default function ReconciliationPage() {
  const { push } = useToast();
  const [refresh, bump] = useRefresh();
  const [proposeId, setProposeId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const unmatched = db.payments.filter((p) => p.reconciliation_state === "unmatched");
  const manual = db.payments.filter((p) => p.reconciliation_state === "manual");
  const target = proposeId ? db.payments.find((p) => p.id === proposeId) : undefined;
  const targetInvoice = target ? db.invoices.find((i) => i.id === target.invoice_id) : undefined;
  const mismatch = target && targetInvoice ? target.amount.amount_minor - targetInvoice.total.amount_minor : 0;

  const propose = () => {
    if (target && note.trim().length < 8) {
      push("error", "Note required", "Describe why this match should be accepted — the reviewer reads it.");
      return;
    }
    if (target) {
      proposeReconciliationMatch(target.id, note.trim());
      push("info", "Match proposed", "An administrator will review it within 24 hours — the panel never auto-matches mismatched amounts.");
      setProposeId(null);
      setNote("");
      bump();
    }
  };

  return (
    <Screen id="UX-COM-017" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Payment reconciliation" }]}>
      <CommercialGate>
        <Callout tone="info" className="mb-4">
          Manual reconciliation is admin-only. Unmatched callbacks (webhook received, no matching invoice) and late-resolved payments land here.
        </Callout>
        <Card title="Reconciliation queue" description="Payments the panel could not match automatically">
          <DataTable
            caption="Unmatched payment callbacks"
            rowKey={(p) => p.id}
            rows={refresh >= 0 ? unmatched : []}
            columns={[
              { key: "provider_reference", header: "Reference", render: (p) => <span className="font-mono text-xs">{p.provider_reference}</span> },
              { key: "amount", header: "Received", render: (p) => formatMoney(p.amount) },
              { key: "phone", header: "Payer", render: (p) => (p.phone_number ? <span className="font-mono text-xs">{p.phone_number}</span> : "—") },
              { key: "invoice_id", header: "Candidate invoice", render: (p) => { const inv = db.invoices.find((i) => i.id === p.invoice_id); return inv ? `${inv.invoice_number} (${formatMoney(inv.total)}, ${inv.state})` : "—"; } },
              { key: "created_at", header: "Received", render: (p) => <span className="whitespace-nowrap text-xs text-ink-3">{formatDateTime(p.created_at)}</span> },
              { key: "actions", header: " ", render: (p) => <Button size="sm" onClick={() => { setProposeId(p.id); setNote(reconciliationNoteFor(p.id) ?? ""); }}>Propose match…</Button> },
            ]}
            emptyState={<EmptyState icon="check-circle" title="Queue is clear" body="No unmatched payment callbacks right now. New ones appear within seconds of the webhook." />}
          />
        </Card>

        {manual.length > 0 && (
          <Card title="Flagged for manual review" className="mt-4">
            <DataTable
              caption="Payments proposed for manual match"
              rowKey={(p) => p.id}
              rows={manual}
              columns={[
                { key: "provider_reference", header: "Reference", render: (p) => <span className="font-mono text-xs">{p.provider_reference}</span> },
                { key: "state", header: "State", render: (p) => <ReconChip state={p.reconciliation_state} /> },
                { key: "amount", header: "Amount", render: (p) => formatMoney(p.amount) },
                { key: "note", header: "Review note", render: (p) => <span className="text-xs text-ink-2">{reconciliationNoteFor(p.id) ?? "—"}</span> },
              ]}
            />
          </Card>
        )}

        <Modal
          open={target !== undefined}
          onClose={() => setProposeId(null)}
          title="Propose match to invoice"
          description="The panel never auto-matches mismatched amounts or void invoices — a person decides."
          footer={<><Button variant="secondary" onClick={() => setProposeId(null)}>Cancel</Button><Button onClick={propose}>Submit proposal</Button></>}
        >
          {target && (
            <div className="flex flex-col gap-4">
              <div className="rounded-control bg-surface-2 p-3 text-sm">
                <p className="font-medium text-ink">{target.provider_reference}</p>
                <p className="mt-1 text-ink-2">
                  Received {formatMoney(target.amount)} from {target.phone_number ?? "unknown payer"} — candidate invoice{" "}
                  {targetInvoice ? `${targetInvoice.invoice_number} with total ${formatMoney(targetInvoice.total)} (state: ${targetInvoice.state})` : "none"}.
                </p>
                {mismatch !== 0 && (
                  <p className={`mt-1 font-medium ${mismatch > 0 ? "text-warning" : "text-danger"}`}>
                    Amount differs by {formatMoney({ amount_minor: Math.abs(mismatch), currency: "KES" })} {mismatch > 0 ? "(overpaid)" : "(underpaid)"}.
                  </p>
                )}
                {targetInvoice?.state === "void" && <p className="mt-1 font-medium text-danger">The candidate invoice is void — the reviewer must decide, not the panel.</p>}
              </div>
              <Field label="Review note" htmlFor="rec-note" required hint="Shown to the administrator who reviews this within 24 hours.">
                <Textarea id="rec-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer paid the September Growth plan from +254733998877; 30.00 short of the invoiced total." />
              </Field>
              <Callout tone="warning" title="Honest timeline">
                We received a payment notification we couldn&apos;t match to an invoice. An administrator will review it within 24 hours — this proposal only flags it for that review.
              </Callout>
            </div>
          )}
        </Modal>
      </CommercialGate>
    </Screen>
  );
}
