"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/mock/data";
import { formatMoney, formatDateTime, maskPhone, formatRelative } from "@/lib/format";
import { useNow, useToast } from "@/components/providers";
import { cancelPendingPayment, findPayment, invoiceById, retryPayment, updatePaymentState } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { PaymentPendingBanner } from "@/components/common/payment-banner";
import { NotFoundInline } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { KeyValue, ProgressStable } from "@/components/commercial/payment-pending-parts";
import { Callout } from "@/components/ui/feedback";
import { PaymentStatePill, ProviderChip, ReconChip } from "@/components/commercial/shared";

export function PaymentPendingView({ paymentId }: { paymentId: string }) {
  const { push } = useToast();
  const now = useNow(1000);
  const router = useRouter();
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick((t) => t + 1);

  const payment = findPayment(paymentId);
  if (!payment) {
    return (
      <Screen id="UX-COM-015" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Payment history", href: "/commercial/payments" }]}>
        <NotFoundInline what="payment" />
      </Screen>
    );
  }
  const invoice = invoiceById(payment.invoice_id);
  const windowEnds = new Date(new Date(payment.created_at).getTime() + 5 * 60 * 1000);
  const pending = payment.state === "pending" || payment.state === "initiated";
  const elapsedPct = Math.min(100, Math.max(0, ((now.getTime() - new Date(payment.created_at).getTime()) / (5 * 60 * 1000)) * 100));

  const simulate = (state: "confirmed" | "failed" | "expired") => {
    try {
      updatePaymentState(payment.id, state, state === "confirmed" ? { receipt: `QK${Math.random().toString(36).slice(2, 10).toUpperCase()}` } : undefined);
      push(
        state === "confirmed" ? "success" : "info",
        state === "confirmed" ? "Payment received. Your subscription is active." : state === "failed" ? "Payment failed" : "Payment expired",
        state === "confirmed"
          ? "The invoice is marked paid and the entitlement updated."
          : state === "failed"
            ? "The request was cancelled — you can retry with a new STK push."
            : "No callback arrived within the 5-minute window; we are checking with M-Pesa."
      );
      refresh();
    } catch (e) {
      push("error", "Callback rejected", e instanceof Error ? e.message : "This payment is already resolved (idempotent duplicate callback).");
    }
  };

  return (
    <Screen
      id="UX-COM-015"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Payment history", href: "/commercial/payments" }, { label: payment.provider_reference }]}
      actions={
        pending ? (
          <Button variant="secondary" onClick={() => { cancelPendingPayment(payment.id); push("info", "Payment cancelled", "The STK request was cancelled — no money moved."); refresh(); }}>Cancel payment</Button>
        ) : (
          <Button variant="secondary" onClick={() => { try { const p = retryPayment(payment.id); push("info", "Retry started", "A new STK push was sent with a new idempotency key."); router.push(`/commercial/payments/${p.id}/pending`); } catch (e) { push("error", "Cannot retry", e instanceof Error ? e.message : "Resolve the pending payment first."); } }}>Try again</Button>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PaymentPendingBanner
            payment={payment}
            onRetry={
              payment.state === "failed" || payment.state === "expired"
                ? () => {
                    try {
                      const p = retryPayment(payment.id);
                      router.push(`/commercial/payments/${p.id}/pending`);
                    } catch (e) {
                      push("error", "Cannot retry", e instanceof Error ? e.message : "Wait for the pending payment to resolve.");
                    }
                  }
                : undefined
            }
          />
          <div className="mt-4">
            <KeyValue
              items={[
                { label: "Amount", value: formatMoney(payment.amount) },
                { label: "Provider", value: <ProviderChip provider={payment.provider} /> },
                { label: "State", value: <PaymentStatePill state={payment.state} /> },
                { label: "Reconciliation", value: <ReconChip state={payment.reconciliation_state} /> },
                { label: "Phone (STK push)", value: payment.phone_number ? `${maskPhone(payment.phone_number)} — enter the PIN on your phone, not in the browser` : "—" },
                { label: "Provider reference", value: payment.provider_reference, mono: true },
                { label: "Invoice", value: invoice ? <Link href="/commercial/invoices" className="text-accent hover:underline">{invoice.invoice_number}</Link> : payment.invoice_id },
              ]}
              columns={2}
            />
          </div>
        </div>

        <Card title="Prototype demo controls" description="Stand in for the signed Daraja callback (POST /integrations/payments/mpesa/callback)">
          <p className="text-sm text-ink-2">
            Mobile money resolves in 10 s–2 min. The UI holds the pending state — it never fakes instant success. Use the buttons to simulate the callback outcome.
          </p>
          <CardSection>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={() => simulate("confirmed")} disabled={!pending}>Simulate: customer entered PIN</Button>
              <Button size="sm" variant="secondary" onClick={() => simulate("expired")} disabled={!pending}>Simulate: let it expire</Button>
              <Button size="sm" variant="secondary" onClick={() => simulate("failed")} disabled={!pending}>Simulate: customer cancelled</Button>
            </div>
            {pending && (
              <div className="mt-3">
                <ProgressStable value={elapsedPct} label={`STK window — request expires ${formatRelative(windowEnds.toISOString(), now)}`} />
              </div>
            )}
            {!pending && (
              <Callout tone="info" className="mt-3">
                This payment is {payment.state} — terminal. Duplicate callbacks are acknowledged idempotently (200) and change nothing.
              </Callout>
            )}
          </CardSection>
        </Card>
      </div>

      <Card title="Payment events" className="mt-4" description="Append-only transition log (commercial.payment_events)">
        <ol className="flex flex-col gap-2">
          {payment.events.map((e, i) => (
            <li key={`${e.event_type}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-control bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-2">{e.event_type}</span>
              <span className="text-ink-2">{e.from_state ?? "—"} → {e.to_state}</span>
              <span className="text-xs text-ink-3">{formatDateTime(e.occurred_at)}</span>
            </li>
          ))}
        </ol>
        <CardSection>
          <ButtonLink href="/activity" variant="ghost" size="sm">Open the activity center</ButtonLink>
        </CardSection>
      </Card>
      <span className="hidden">{tick}</span>
    </Screen>
  );
}
