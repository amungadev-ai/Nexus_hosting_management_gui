"use client";

import React, { useState } from "react";
import { paymentMethods } from "@/lib/mock/commercial";
import { formatDate } from "@/lib/format";
import { useOperationStream, useToast } from "@/components/providers";
import { deletePaymentMethod, savePaymentMethod, setDefaultPaymentMethod, verifyPaymentMethod } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { CommercialGate, useRefresh } from "@/components/commercial/shared";

export default function PaymentMethodsPage() {
  const { push } = useToast();
  const { setFocusedId, setTrayOpen } = useOperationStream();
  const [refresh, bump] = useRefresh();
  const [addOpen, setAddOpen] = useState(false);
  const [kind, setKind] = useState<"mpesa" | "stripe">("mpesa");
  const [phone, setPhone] = useState("");
  const [card, setCard] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);

  const add = () => {
    try {
      savePaymentMethod(kind === "mpesa" ? { kind, phone_number: phone.trim() } : { kind, card_last4: card.trim().slice(-4) || "0000" });
      push("success", "Payment method added", kind === "mpesa" ? "Verify the number with the Safaricom challenge before using it for STK pushes." : "Stored as a Stripe token reference — NexusPanel never sees card data.");
      setAddOpen(false);
      setPhone("");
      setCard("");
      bump();
    } catch (e) {
      push("error", "Cannot add method", e instanceof Error ? e.message : "Check the details and try again.");
    }
  };

  return (
    <Screen
      id="UX-COM-014"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Payment methods" }]}
      actions={<Button icon="plus" onClick={() => setAddOpen(true)}>Add method</Button>}
    >
      <CommercialGate>
        <DataTable
          caption="Managed payment methods — tokenized references only"
          rowKey={(pm) => pm.id}
          rows={refresh >= 0 ? paymentMethods : []}
          columns={[
            { key: "label", header: "Method", render: (pm) => <span className="font-medium text-ink">{pm.label}</span> },
            { key: "masked", header: "Reference", render: (pm) => <span className="font-mono text-xs">{pm.masked}</span> },
            { key: "is_default", header: "Default", render: (pm) => (pm.is_default ? <Chip tone="accent">Default</Chip> : <Button size="sm" variant="ghost" onClick={() => { setDefaultPaymentMethod(pm.id); push("success", "Default updated", "New payments default to this method."); bump(); }}>Set default</Button>) },
            { key: "verified", header: "Verified", render: (pm) => (pm.verified ? <Chip tone="success">Verified</Chip> : <Button size="sm" variant="secondary" onClick={() => { const op = verifyPaymentMethod(pm.id); setFocusedId(op.id); setTrayOpen(true); push("info", "Verification submitted", "The method is marked verified only when the operation confirms it."); }}>Verify</Button>) },
            { key: "created_at", header: "Added", render: (pm) => formatDate(pm.created_at) },
            { key: "actions", header: " ", render: (pm) => <Button size="sm" variant="ghost" onClick={() => setRemoveId(pm.id)}>Remove…</Button> },
          ]}
          emptyState={<EmptyState icon="credit-card" title="No payment methods" body="Add an M-Pesa number or a Stripe card to pay invoices. Card data is tokenized — the panel stores references only." action={{ label: "Add method", onClick: () => setAddOpen(true) }} />}
        />

        <Modal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title="Add payment method"
          footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={add}>Add</Button></>}
        >
          <div className="flex flex-col gap-4">
            <Field label="Kind" htmlFor="pm-kind" required>
              <Select id="pm-kind" value={kind} onChange={(e) => setKind(e.target.value === "stripe" ? "stripe" : "mpesa")}>
                <option value="mpesa">M-Pesa (Safaricom)</option>
                <option value="stripe">Card via Stripe</option>
              </Select>
            </Field>
            {kind === "mpesa" ? (
              <Field label="Safaricom number" htmlFor="pm-phone" required hint="International format, e.g. +254712345678.">
                <Input id="pm-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2547…" />
              </Field>
            ) : (
              <Field label="Card number (tokenized by Stripe.js)" htmlFor="pm-card" required hint="Only the last 4 digits and a token reference are stored.">
                <Input id="pm-card" value={card} onChange={(e) => setCard(e.target.value)} placeholder="4242 4242 4242 4242" />
              </Field>
            )}
          </div>
        </Modal>
        <ConfirmDialog
          open={removeId !== null}
          onClose={() => setRemoveId(null)}
          onConfirm={() => { if (removeId) { deletePaymentMethod(removeId); push("info", "Payment method removed", "It can no longer be charged."); bump(); } }}
          title="Remove payment method"
          body="The tokenized reference is deleted. Past payments and invoices keep their records."
          confirmLabel="Remove method"
          destructive
        />
      </CommercialGate>
    </Screen>
  );
}
