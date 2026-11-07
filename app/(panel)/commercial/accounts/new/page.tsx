"use client";

import React, { useState } from "react";
import { hostingPackages, customers } from "@/lib/mock/commercial";
import { formatMoney } from "@/lib/format";
import { useOperationStream, useToast } from "@/components/providers";
import { createHostingAccount } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { Stepper } from "@/components/ui/nav";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { KeyValue } from "@/components/ui/misc";
import { Callout } from "@/components/ui/feedback";
import { PendingState } from "@/components/common/states";
import { operations } from "@/lib/operations";
import { CommercialGate } from "@/components/commercial/shared";

const STEPS = ["Customer", "Package", "Review & provision"];

export default function AccountCreationWizardPage() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [existing, setExisting] = useState("");
  const [pkgId, setPkgId] = useState("pkg_01JSTART");
  const [region, setRegion] = useState("nairobi-01");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opId, setOpId] = useState<string | null>(null);

  const effectiveName = name.trim() !== "" ? name.trim() : existing;
  const pkg = hostingPackages.find((p) => p.id === pkgId);

  const provision = () => {
    setBusy(true);
    try {
      const { operation_id } = createHostingAccount({ customer_name: effectiveName, contact_email: email.trim() || "owner@example.co.ke", package_id: pkgId, region });
      setOpId(operation_id);
      push("success", "Provisioning submitted", "The account is provisioning — progress is in the operation tray.");
      setFocusedId(operation_id);
      setTrayOpen(true);
    } catch {
      push("error", "Cannot provision", "Choose a published package and a customer name.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen id="UX-COM-003" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Hosting accounts", href: "/commercial/accounts" }]}>
      <CommercialGate>
        <Stepper steps={STEPS} current={step} className="mb-4" />
        {opId !== null && (
          <div className="mb-4">
            <PendingState operation={operations.get(opId)!}>
              <ButtonLink href="/commercial/accounts" size="sm" variant="secondary">Back to accounts</ButtonLink>
            </PendingState>
          </div>
        )}
        {step === 0 && (
          <Card title="Customer" description="Pick an existing customer or create a new one">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Existing customer" htmlFor="w-existing" hint="Optional — leave blank to create a new customer.">
                <Select id="w-existing" value={existing} onChange={(e) => setExisting(e.target.value)}>
                  <option value="">New customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Customer name" htmlFor="w-name" required hint="Used as the account slug.">
                <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mama Mboga Fresh" />
              </Field>
              <Field label="Contact email" htmlFor="w-email" required>
                <Input id="w-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.co.ke" />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => setStep(1)} disabled={effectiveName === ""}>Continue</Button>
            </div>
          </Card>
        )}
        {step === 1 && (
          <Card title="Package" description="Resource quotas and price (KES, before 16% VAT)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {hostingPackages.filter((p) => p.status === "published").map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPkgId(p.id)}
                  aria-pressed={pkgId === p.id}
                  className={`rounded-card border p-4 text-left ${pkgId === p.id ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"}`}
                >
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="mt-1 text-sm text-ink-2">{formatMoney(p.price)}/mo</p>
                  <p className="mt-1 text-xs text-ink-3">{p.resources.websites} sites · {p.resources.disk_gb} GB · {p.resources.mailboxes} mailboxes</p>
                </button>
              ))}
            </div>
            <Field label="Region / server" htmlFor="w-region" className="mt-4">
              <Select id="w-region" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="nairobi-01">nairobi-01 (Leaseweb VPS, Nairobi route)</option>
              </Select>
            </Field>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={() => setStep(2)}>Continue</Button>
            </div>
          </Card>
        )}
        {step === 2 && (
          <Card title="Review" description="Impact preview before the durable provisioning job">
            <KeyValue
              items={[
                { label: "Customer", value: effectiveName },
                { label: "Package", value: pkg ? `${pkg.name} — ${formatMoney(pkg.price)}/mo + 16% VAT` : "—" },
                { label: "Region", value: region },
                { label: "Initial state", value: "Provisioning (operation verifies before the account is active)" },
              ]}
              columns={2}
            />
            <Callout tone="info" className="mt-4">
              Capacity is reserved at submit time; the account stays “provisioning” until the operation verifies health.
            </Callout>
            <div className="mt-4 flex flex-col gap-3">
              <Checkbox checked={approved} onChange={setApproved} label="I have reviewed the customer, package and limits" />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button icon="plus" loading={busy} disabled={!approved || pkg?.status !== "published"} onClick={provision}>Provision account</Button>
              </div>
            </div>
          </Card>
        )}
      </CommercialGate>
    </Screen>
  );
}
