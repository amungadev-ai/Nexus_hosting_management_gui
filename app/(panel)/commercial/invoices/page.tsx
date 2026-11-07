"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/mock/data";
import { invoiceLineItems } from "@/lib/mock/commercial";
import { formatMoney, formatDate } from "@/lib/format";
import { useOperationStream, useToast } from "@/components/providers";
import { initiateMpesaPayment } from "@/lib/api/commercial";
import { operations } from "@/lib/operations";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { Modal } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/form";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { CommercialGate, useLoaded, LoadedTable, InvoiceStatePill, useRefresh } from "@/components/commercial/shared";
import type { Invoice } from "@/lib/types";

export default function InvoicesPage() {
  const { push } = useToast();
  const { setFocusedId, setTrayOpen } = useOperationStream();
  const router = useRouter();
  const [refresh, bump] = useRefresh();
  const { loading, data } = useLoaded(() => db.invoices);
  const [openId, setOpenId] = useState<string | null>(null);
  const [phone, setPhone] = useState("+254712345678");
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  const invoice = openId ? db.invoices.find((i) => i.id === openId) : undefined;
  const open = (i: Invoice) => { setOpenId(i.id); setError(null); };

  const pay = (inv: Invoice) => {
    try {
      const p = initiateMpesaPayment(inv.id, phone);
      push("info", "STK push sent", "Check your phone — enter the M-Pesa PIN to complete the payment.");
      setOpenId(null);
      router.push(`/commercial/payments/${p.id}/pending`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "The payment could not be initiated.";
      const code = (e as { problem?: { code?: string } }).problem?.code ?? "PAYMENT_ERROR";
      setError(`${code} — ${detail}`);
    }
  };

  const exportInvoices = () => {
    const op = operations.submit({
      kind: "invoice.export",
      title: "Export invoices (CSV)",
      resource_ref: { type: "organization", id: db.currentOrganization },
      workload_category: "batch",
      step_titles: ["Collect invoices", "Package CSV", "Verify checksum"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    setFocusedId(op.id);
    setTrayOpen(true);
    push("info", "Export submitted", "The CSV appears in the operation tray when it verifies.");
  };

  return (
    <Screen
      id="UX-COM-011"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Invoices and payments" }]}
      actions={
        <>
          <Button variant="secondary" icon="download" onClick={exportInvoices}>Export</Button>
          <Button variant="ghost" onClick={() => router.push("/commercial/payments")}>Payment history</Button>
        </>
      }
    >
      <CommercialGate>
        <LoadedTable loading={loading}>
          <DataTable
            caption="Invoices — amounts include 16% Kenya VAT"
            rowKey={(i) => i.id}
            rows={refresh >= 0 ? (data ?? []) : []}
            onRowClick={open}
            columns={[
              { key: "invoice_number", header: "Invoice", className: "sticky left-0 bg-surface", render: (i) => <button type="button" onClick={() => open(i)} className="font-mono text-xs text-accent hover:underline">{i.invoice_number}</button>, sortable: true },
              { key: "state", header: "State", render: (i) => <InvoiceStatePill state={i.state} /> },
              { key: "total", header: "Total", render: (i) => formatMoney(i.total) },
              { key: "due_at", header: "Due", render: (i) => formatDate(i.due_at) },
              { key: "overdue", header: " ", render: (i) => (i.state === "open" && new Date(i.due_at).getTime() < now.getTime() ? <span className="rounded-control bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning">Overdue</span> : null) },
            ]}
            emptyState={<EmptyState icon="file-text" title="No invoices yet" body="Invoices are generated at subscription renewal or plan change." />}
          />
        </LoadedTable>

        <Modal
          open={invoice !== undefined}
          onClose={() => setOpenId(null)}
          title={invoice ? `Invoice ${invoice.invoice_number}` : "Invoice"}
          description={invoice ? `Period ${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)} · due ${formatDate(invoice.due_at)}` : undefined}
          footer={
            invoice ? (
              <>
                <Button variant="secondary" onClick={() => setOpenId(null)}>Close</Button>
                {invoice.state === "open" ? (
                  <Button icon="credit-card" onClick={() => pay(invoice)}>Pay with M-Pesa</Button>
                ) : (
                  <Button variant="secondary" disabled onClick={() => undefined}>{invoice.state === "paid" ? "Paid — no action" : invoice.state === "void" ? "Void — cannot be paid" : "Not payable"}</Button>
                )}
              </>
            ) : null
          }
        >
          {invoice && (
            <div className="flex flex-col gap-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-2">
                    <th scope="col" className="py-1.5">Line item</th>
                    <th scope="col" className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoiceLineItems.filter((l) => l.invoice_id === invoice.id).map((l) => (
                    <tr key={l.description}>
                      <td className="py-1.5 text-ink">{l.description}</td>
                      <td className="py-1.5 text-right tabular-nums text-ink">{formatMoney(l.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 text-ink-2">Subtotal</td>
                    <td className="py-1.5 text-right tabular-nums text-ink">{formatMoney(invoice.amount)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-ink-2">VAT (16%)</td>
                    <td className="py-1.5 text-right tabular-nums text-ink">{formatMoney(invoice.tax)}</td>
                  </tr>
                  <tr className="border-t border-line font-medium">
                    <td className="py-1.5 text-ink">Total</td>
                    <td className="py-1.5 text-right tabular-nums text-ink">{formatMoney(invoice.total)}</td>
                  </tr>
                </tbody>
              </table>
              {invoice.state === "open" && (
                <Field label="Safaricom number for the STK push" htmlFor="inv-phone" required hint="You'll receive a prompt on your phone; payment is only complete after you enter the M-Pesa PIN.">
                  <Input id="inv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
              )}
              {error !== null && <Callout tone="danger" title="Payment could not be started">{error}</Callout>}
              {invoice.state === "open" && (
                <p className="text-xs text-ink-3">
                  A payment for this invoice may already be pending (409 PAYMENT_PENDING). <Link href="/commercial/payments" className="text-accent hover:underline">Check payment history</Link>.
                </p>
              )}
            </div>
          )}
        </Modal>
        <span className="hidden">{refresh}</span>
      </CommercialGate>
    </Screen>
  );
}
