"use client";

import React, { useState } from "react";
import Link from "next/link";
import { subscriptions } from "@/lib/mock/commercial";
import { formatMoney, formatDate } from "@/lib/format";
import { useToast } from "@/components/providers";
import { adjustSubscriptionPrice, cancelSubscription } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { KeyValue } from "@/components/ui/misc";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { CommercialGate } from "@/components/commercial/shared";

export default function SubscriptionsPage() {
  const { push } = useToast();
  const sub = subscriptions[0];
  const [cancelOpen, setCancelOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [price, setPrice] = useState(sub ? (sub.price.amount_minor / 100).toFixed(2) : "");
  if (!sub) {
    return (
      <Screen id="UX-COM-010" breadcrumbs={[{ label: "Home", href: "/" }]}>
        <EmptyState icon="refresh" title="No subscriptions" body="Subscriptions appear when a plan is purchased." />
      </Screen>
    );
  }
  const vatMinor = Math.round(sub.price.amount_minor * sub.vat_rate);
  const totalMinor = sub.price.amount_minor + vatMinor;

  return (
    <Screen
      id="UX-COM-010"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Subscriptions" }]}
      actions={
        <>
          <Button variant="secondary" onClick={() => { setPrice((sub.price.amount_minor / 100).toFixed(2)); setAdjustOpen(true); }}>Adjust</Button>
          <Button variant="destructive" disabled={sub.status !== "active"} onClick={() => setCancelOpen(true)}>Cancel subscription</Button>
        </>
      }
    >
      <CommercialGate>
        <Card title={`${sub.plan_name} plan — ${sub.id}`} description="Billing-authorized surface. Plan, renewals, state and grace periods.">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={sub.status === "active" ? "success" : sub.status === "cancel_scheduled" ? "warning" : "neutral"}>
              {sub.status === "active" ? "Active" : sub.status === "cancel_scheduled" ? "Cancels at period end" : "Cancelled"}
            </Chip>
          </div>
          <CardSection>
            <KeyValue
              items={[
                { label: "Plan price", value: `${formatMoney(sub.price)}/month` },
                { label: "VAT (16% Kenya)", value: formatMoney({ amount_minor: vatMinor, currency: "KES" }) },
                { label: "Total due monthly", value: formatMoney({ amount_minor: totalMinor, currency: "KES" }) },
                { label: "Current period", value: `from ${formatDate(sub.period_start)}` },
                { label: "Next billing date", value: formatDate(sub.next_billing_at) },
                ...(sub.cancel_effective_at ? [{ label: "Cancels on", value: formatDate(sub.cancel_effective_at) }] : []),
              ]}
              columns={2}
            />
          </CardSection>
          <CardSection>
            <p className="text-sm text-ink-2">
              Renewal auto-generates the next invoice; entitlements follow the explicit grace and retention policies — the panel never silently clamps service.{" "}
              <Link href="/commercial/invoices" className="text-accent hover:underline">View invoices</Link>
            </p>
          </CardSection>
        </Card>
        <Callout tone="info" className="mt-4">
          Plan price changes take effect on the next renewal — the current period keeps its agreed price.
        </Callout>

        <Modalless adjustOpen={adjustOpen} setAdjustOpen={setAdjustOpen} price={price} setPrice={setPrice} subId={sub.id} onSaved={() => push("success", "Plan price updated", "The new price applies from the next renewal.")} />

        <ConfirmDialog
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          onConfirm={() => {
            try {
              cancelSubscription(sub.id);
              push("info", "Cancellation scheduled", `The subscription ends on ${formatDate(sub.next_billing_at)} — no further invoices are generated.`);
            } catch {
              push("error", "Cannot cancel", "The subscription is not in an active state.");
            }
          }}
          title={`Cancel the ${sub.plan_name} subscription`}
          body={`This schedules cancellation of subscription ${sub.id} at the end of the current period (${formatDate(sub.next_billing_at)}). Sites keep running until then; after closure, data follows the retention policy.`}
          confirmLabel="Cancel subscription"
          destructive
          typedConfirmation="CANCEL"
        />
      </CommercialGate>
    </Screen>
  );
}

function Modalless(props: { adjustOpen: boolean; setAdjustOpen: (v: boolean) => void; price: string; setPrice: (v: string) => void; subId: string; onSaved: () => void }) {
  const { adjustOpen, setAdjustOpen, price, setPrice, subId, onSaved } = props;
  return (
    <Modal
      open={adjustOpen}
      onClose={() => setAdjustOpen(false)}
      title="Adjust plan price"
      description="Applies from the next renewal. KES, before 16% VAT."
      footer={<><Button variant="secondary" onClick={() => setAdjustOpen(false)}>Cancel</Button><Button onClick={() => { adjustSubscriptionPrice(subId, Math.round(parseFloat(price || "0") * 100)); onSaved(); setAdjustOpen(false); }}>Save price</Button></>}
    >
      <Field label="New monthly price (KES)" htmlFor="sub-price" required hint="Invoicing adds 16% Kenya VAT on top.">
        <Input id="sub-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
    </Modal>
  );
}
