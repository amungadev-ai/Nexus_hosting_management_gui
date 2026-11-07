"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Callout } from "@/components/ui/feedback";
import { Stepper } from "@/components/ui/nav";
import { addDomain } from "@/lib/api/dns";
import { db } from "@/lib/mock/data";
import { isTerminal } from "@/lib/operations";

/**
 * UX-DNS-002 — Domain onboarding wizard. FLOW-004's nine-screen authoritative
 * sequence is reframed for v1 as DNS guidance mode: enter the domain, verify
 * ownership with a TXT record, keep DNS at your registrar.
 */
const STEPS = ["Domain", "Ownership", "DNS mode", "Activate"];

export default function DomainNewPage() {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [intendedSite, setIntendedSite] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [opId, setOpId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const operation = useMemo(() => (opId === null ? undefined : list.find((o) => o.id === opId)), [opId, list]);
  const valid = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name.trim());

  const activate = async () => {
    if (!valid) {
      setError("Enter a valid domain name, e.g. myshop.co.ke.");
      setStep(0);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const res = await addDomain({ name: name.trim(), intended_site: intendedSite });
      setOpId(res.operation.id);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Domain submitted", "The TXT verification challenge is generated as part of the job — the verify screen shows it when done.");
    } catch {
      push("error", "Could not add the domain", "Try again — nothing was created.");
    } finally {
      setSubmitting(false);
    }
  };

  if (opId !== null) {
    return (
      <Screen id="UX-DNS-002" breadcrumbs={[{ label: "Domains", href: "/domains" }, { label: "Add domain" }]}>
        <div className="mx-auto max-w-2xl">
          {operation !== undefined && !isTerminal(operation.status) && <PendingState operation={operation} />}
          {operation !== undefined && isTerminal(operation.status) && operation.status === "succeeded" && (
            <Card title={`${name.trim()} added`} description="Next: prove ownership with the TXT challenge.">
              <Callout tone="success" title="Verification challenge generated">
                Open the verification screen to copy the TXT record and check when it appears at your
                registrar&apos;s nameservers.
              </Callout>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button icon="shield" onClick={() => { window.location.href = "/domains"; }}>
                  Go to domains inventory
                </Button>
                <Link href="/domains" className="inline-flex items-center text-sm font-medium text-accent hover:underline">
                  Verify ownership →
                </Link>
              </div>
              <p className="mt-3 text-xs text-ink-3">
                The prototype keeps fixtures static — your new domain appears in the inventory list story via the
                verification flow.
              </p>
            </Card>
          )}
          {operation !== undefined && isTerminal(operation.status) && operation.status !== "succeeded" && (
            <Callout tone="danger" title="The domain could not be added">
              {operation.error?.detail ?? "Try again."}
            </Callout>
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      id="UX-DNS-002"
      breadcrumbs={[{ label: "Domains", href: "/domains" }, { label: "Add domain" }]}
      description="Domain, ownership, DNS mode, zone and nameservers — for v1 the flow is guidance mode: your DNS stays at your registrar."
    >
      <div className="mx-auto max-w-3xl">
        <Stepper steps={STEPS} current={step} className="mb-6" />

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Field label="Domain name" htmlFor="dn-name" required error={error} hint="You must already own the domain — the panel verifies control, it does not register domains.">
              <Input id="dn-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="myshop.co.ke" className="font-mono" spellCheck={false} autoComplete="url" />
            </Field>
            <Field label="Attach to site (optional)" htmlFor="dn-site" hint="You can also attach it later from the site or the connection wizard.">
              <Select id="dn-site" value={intendedSite} onChange={(e) => setIntendedSite(e.target.value)}>
                <option value="">— decide later —</option>
                {db.websites.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}</option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {step === 1 && (
          <Callout tone="info" title="Ownership = a TXT record">
            After activation we generate a TXT challenge ({"_nexuspanel-verify.<your-domain>"}). Add it at your
            registrar, then press “Check now” on the verify screen. We never claim verification before the
            record is actually observed.
          </Callout>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <Callout tone="info" title="DNS mode: external (guidance) — the v1 mode">
              Your DNS stays at your registrar; the panel shows the exact records and polls propagation.
              Authoritative DNS hosting (the panel hosts your zone) is coming in v2 and will be a per-domain
              choice.
            </Callout>
          </div>
        )}

        {step === 3 && (
          <Callout tone="info" title="Ready to activate">
            We create the domain record, generate the TXT challenge and prepare the guidance records. No DNS
            is hosted or changed by us — your registrar stays the source of truth.
          </Callout>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => (step === 0 && !valid ? setError("Enter a valid domain name, e.g. myshop.co.ke.") : setStep((s) => s + 1))}>
              Next
            </Button>
          ) : (
            <Button icon="check" onClick={activate} loading={submitting}>
              Activate domain
            </Button>
          )}
        </div>
      </div>
    </Screen>
  );
}
