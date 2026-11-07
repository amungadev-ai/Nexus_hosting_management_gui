"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/mock/data";
import { formatMoney, formatDateTime } from "@/lib/format";
import { useOperationStream, useToast } from "@/components/providers";
import { operations } from "@/lib/operations";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/feedback";
import { CommercialGate, useLoaded, LoadedTable, PaymentStatePill, ProviderChip, ReconChip } from "@/components/commercial/shared";

const STATES = ["all", "pending", "confirmed", "failed", "expired", "unmatched"] as const;

export default function PaymentHistoryPage() {
  const { push } = useToast();
  const { setFocusedId, setTrayOpen } = useOperationStream();
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof STATES)[number]>("all");
  const { loading, data } = useLoaded(() => db.payments);

  const rows = (data ?? []).filter((p) => {
    if (filter === "all") return true;
    if (filter === "unmatched") return p.reconciliation_state !== "matched";
    return p.state === filter;
  });

  const exportPayments = () => {
    const op = operations.submit({
      kind: "payment.export",
      title: "Export payment history (CSV)",
      resource_ref: { type: "organization", id: db.currentOrganization },
      workload_category: "batch",
      step_titles: ["Collect payments", "Redact phone numbers", "Package CSV"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    setFocusedId(op.id);
    setTrayOpen(true);
    push("info", "Export submitted", "Payment references are exported; phone numbers stay masked.");
  };

  return (
    <Screen
      id="UX-COM-016"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Payment history" }]}
      actions={
        <>
          <Button variant="secondary" icon="download" onClick={exportPayments}>Export</Button>
          <Button variant="ghost" onClick={() => router.push("/commercial/payments/reconcile")}>Reconcile unmatched</Button>
        </>
      }
    >
      <CommercialGate>
        <div className="mb-3 max-w-xs">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as (typeof STATES)[number])} aria-label="Filter payments by state">
            {STATES.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All payments" : s === "unmatched" ? "Reconciliation: unmatched" : `State: ${s}`}</option>
            ))}
          </Select>
        </div>
        <LoadedTable loading={loading}>
          <DataTable
            caption="Payments — async-first state machine (pending → confirmed | failed | expired | reversed)"
            rowKey={(p) => p.id}
            rows={rows}
            onRowClick={(p) => { if (p.state === "pending" || p.state === "initiated") router.push(`/commercial/payments/${p.id}/pending`); }}
            columns={[
              { key: "provider_reference", header: "Reference", className: "sticky left-0 bg-surface", render: (p) => (p.state === "pending" || p.state === "initiated" ? <Link href={`/commercial/payments/${p.id}/pending`} className="font-mono text-xs text-accent hover:underline">{p.provider_reference}</Link> : <span className="font-mono text-xs">{p.provider_reference}</span>) },
              { key: "provider", header: "Provider", render: (p) => <ProviderChip provider={p.provider} /> },
              { key: "state", header: "State", render: (p) => <PaymentStatePill state={p.state} /> },
              { key: "reconciliation_state", header: "Reconciliation", render: (p) => <ReconChip state={p.reconciliation_state} /> },
              { key: "amount", header: "Amount", render: (p) => formatMoney(p.amount) },
              { key: "invoice_id", header: "Invoice", render: (p) => <Link href="/commercial/invoices" className="text-accent hover:underline">{db.invoices.find((i) => i.id === p.invoice_id)?.invoice_number ?? p.invoice_id}</Link> },
              { key: "created_at", header: "Created", render: (p) => <span className="whitespace-nowrap text-xs text-ink-3">{formatDateTime(p.created_at)}</span> },
            ]}
            emptyState={<EmptyState icon="credit-card" title="No payments match" body="Try a different filter — payments appear here the moment an STK push is sent." />}
          />
        </LoadedTable>
        <p className="mt-3 text-xs text-ink-3">
          Pending payments open the M-Pesa waiting screen; duplicate callbacks resolve idempotently and never double-credit.
        </p>
      </CommercialGate>
    </Screen>
  );
}
