"use client";

import React, { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Switch } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Screen } from "@/components/common/screen";
import { useToast } from "@/components/providers";
import { saveMpesaConfig } from "@/lib/api/commercial";
import { mpesaConfig } from "@/lib/mock/commercial";
import { Callout } from "@/components/ui/feedback";
import { CommercialGate } from "@/components/commercial/shared";

export default function CommerceIntegrationsPage() {
  const { push } = useToast();
  const [stripeOpen, setStripeOpen] = useState(false);
  const [publishable, setPublishable] = useState("");
  const [stripeConnected, setStripeConnected] = useState(false);
  const [mpesaEnabled, setMpesaEnabled] = useState(mpesaConfig.enabled);

  return (
    <Screen id="UX-COM-013" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Commerce integrations" }]}>
      <CommercialGate>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card
            title="M-Pesa (Daraja)"
            description="STK push payments in KES — sandbox and production credentials."
            actions={<Chip tone={mpesaConfig.environment === "sandbox" ? "info" : "success"}>{mpesaConfig.environment}</Chip>}
          >
            <p className="text-sm text-ink-2">
              Panel-generated callback URL, signed callbacks and a required test transaction before enabling.
            </p>
            <CardSection>
              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  checked={mpesaEnabled}
                  onChange={(v) => {
                    if (v && mpesaConfig.last_test === null) {
                      push("error", "Test transaction required", "Run the sandbox test transaction before enabling M-Pesa.");
                      return;
                    }
                    setMpesaEnabled(v);
                    saveMpesaConfig({ enabled: v });
                    push(v ? "success" : "info", v ? "M-Pesa enabled" : "M-Pesa disabled", v ? "Live payments will use the configured Daraja credentials." : "New M-Pesa payments are rejected while disabled.");
                  }}
                  label={mpesaEnabled ? "Enabled — test transaction verified" : "Disabled — test transaction required before enabling"}
                  disabled={mpesaConfig.last_test === null && !mpesaEnabled}
                />
              </div>
              {mpesaConfig.last_test === null && !mpesaEnabled && (
                <p className="mt-2 text-xs text-ink-3">The switch unlocks after a successful sandbox test transaction on the M-Pesa settings screen.</p>
              )}
              <div className="mt-3 flex gap-2">
                <ButtonLink href="/commercial/integrations/mpesa" size="sm" variant="secondary">M-Pesa settings</ButtonLink>
              </div>
            </CardSection>
          </Card>
          <Card
            title="Stripe"
            description="Card payments as tokenized references — card data never touches the panel."
            actions={<Chip tone={stripeConnected ? "success" : "neutral"}>{stripeConnected ? "Connected · test mode" : "Not connected"}</Chip>}
          >
            <p className="text-sm text-ink-2">
              Payment intents resolve in under a second; the UI still treats every payment as async-first (202 + pending) per ADR-005d.
            </p>
            <CardSection>
              <Button size="sm" variant="secondary" onClick={() => setStripeOpen(true)}>{stripeConnected ? "Manage connection" : "Connect Stripe"}</Button>
            </CardSection>
          </Card>
        </div>
        <Callout tone="info" className="mt-4">
          Credentials are stored as secret references and redacted from logs, telemetry and exports (DS-008).
        </Callout>
        <Modal
          open={stripeOpen}
          onClose={() => setStripeOpen(false)}
          title="Connect Stripe"
          description="Store the publishable key; the secret key is held server-side as a write-only secret."
          footer={<><Button variant="secondary" onClick={() => setStripeOpen(false)}>Cancel</Button><Button onClick={() => { if (publishable.trim().length < 8) { push("error", "Invalid key", "Paste the publishable key from your Stripe dashboard."); return; } setStripeConnected(true); setStripeOpen(false); push("success", "Stripe connected (test mode)", "Run a test payment before switching to production."); }}>Save &amp; test</Button></>}
        >
          <Field label="Publishable key" htmlFor="st-key" required><Input id="st-key" value={publishable} onChange={(e) => setPublishable(e.target.value)} placeholder="pk_test_…" /></Field>
        </Modal>
      </CommercialGate>
    </Screen>
  );
}
