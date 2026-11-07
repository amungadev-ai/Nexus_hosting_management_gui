"use client";

import React, { useState } from "react";
import { mpesaConfig } from "@/lib/mock/commercial";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { recordMpesaTestResult, saveMpesaConfig } from "@/lib/api/commercial";
import { operations } from "@/lib/operations";
import { db } from "@/lib/mock/data";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { CodeBlock, CopyButton, SecretField } from "@/components/ui/code";
import { KeyValue } from "@/components/ui/misc";
import { Callout } from "@/components/ui/feedback";
import { CommercialGate } from "@/components/commercial/shared";

export default function MpesaSettingsPage() {
  const now = useNow();
  const { push } = useToast();
  const { setFocusedId, setTrayOpen } = useOperationStream();
  const [env, setEnv] = useState(mpesaConfig.environment);
  const [shortcode, setShortcode] = useState(mpesaConfig.shortcode);
  const [saveOpen, setSaveOpen] = useState(false);
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [passkey, setPasskey] = useState("");

  const runTest = () => {
    const op = operations.submit({
      kind: "payment.test",
      title: "Daraja sandbox test transaction",
      resource_ref: { type: "mpesa_config", id: "mpesa_config" },
      workload_category: "infrastructure",
      step_titles: ["Send STK push to sandbox test number", "Await test callback", "Verify signature and dedupe"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    setFocusedId(op.id);
    setTrayOpen(true);
    recordMpesaTestResult("ws_CO_TEST123");
    push("info", "Test transaction submitted", "Enabling stays locked until the sandbox callback verifies.");
  };

  return (
    <Screen
      id="UX-COM-018"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Commerce integrations", href: "/commercial/integrations" }, { label: "M-Pesa settings" }]}
      actions={<Button variant="secondary" onClick={() => setSaveOpen(true)}>Save credentials</Button>}
    >
      <CommercialGate>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Daraja credentials" description="Sandbox + production environments; secrets stored as write-only references.">
            <KeyValue
              items={[
                { label: "Environment", value: <Chip tone={env === "sandbox" ? "info" : "success"}>{env}</Chip> },
                { label: "Shortcode", value: <span className="font-mono text-xs">{shortcode}</span> },
                { label: "Consumer key", value: <span className="font-mono text-xs">{mpesaConfig.consumer_key_masked}</span> },
                { label: "Credentials verified", value: mpesaConfig.verified_at ? formatDateTime(mpesaConfig.verified_at) : "Never — save credentials to verify" },
              ]}
              columns={2}
            />
            <CardSection>
              <p className="text-xs font-medium text-ink-2">Panel-generated callback URL (read-only)</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 overflow-auto rounded-control bg-surface-2 px-3 py-2 font-mono text-xs text-ink">{mpesaConfig.callback_url}</code>
                <CopyButton text={mpesaConfig.callback_url} label="Copy URL" />
              </div>
              <p className="mt-2 text-xs text-ink-3">Paste this URL into the Daraja app; every callback is signature-verified and deduplicated on CheckoutRequestID.</p>
            </CardSection>
          </Card>
          <Card title="Enablement" description="A test transaction is required before enabling.">
            <div className="flex flex-col gap-3">
              <Field label="Environment" htmlFor="mp-env">
                <Select id="mp-env" value={env} onChange={(e) => { const v = e.target.value === "production" ? "production" : "sandbox"; setEnv(v); saveMpesaConfig({ environment: v }); push("info", `Switched to ${v}`, v === "production" ? "Verify the production credentials before taking live payments." : "Sandbox credentials apply."); }}>
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </Select>
              </Field>
              <Field label="Shortcode" htmlFor="mp-sc"><Input id="mp-sc" value={shortcode} onChange={(e) => setShortcode(e.target.value)} /></Field>
              <Switch
                checked={mpesaConfig.enabled}
                disabled={mpesaConfig.last_test === null}
                onChange={(v) => {
                  if (v && mpesaConfig.last_test === null) {
                    push("error", "Test transaction required", "Run the sandbox test transaction before enabling M-Pesa.");
                    return;
                  }
                  saveMpesaConfig({ enabled: v });
                  push(v ? "success" : "info", v ? "M-Pesa enabled" : "M-Pesa disabled", v ? "Payments can now be initiated over M-Pesa." : "New M-Pesa payments are rejected while disabled.");
                }}
                label={mpesaConfig.last_test === null ? "Enable M-Pesa — locked until a test transaction passes" : mpesaConfig.enabled ? "Enabled" : "Disabled"}
              />
              <Button variant="secondary" size="sm" icon="zap" onClick={runTest}>Run test transaction</Button>
              {mpesaConfig.last_test !== null && (
                <p className="text-xs text-ink-3">
                  Last test: {mpesaConfig.last_test.checkout_request_id} · {formatRelative(mpesaConfig.last_test.at, now)} — passed.
                </p>
              )}
            </div>
          </Card>
        </div>
        <Callout tone="info" className="mt-4">
          The agent never touches M-Pesa credentials and has no payment operations — resolution happens in the control plane only (Stage 6 §7).
        </Callout>
        <SecretField label="Demo: passkey as a secret reference" value="passkey_demo_redacted_reference" className="mt-4" />

        <Modal
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          title="Save Daraja credentials"
          description="Consumer key/secret and passkey are stored as secret references — never displayed again."
          footer={<><Button variant="secondary" onClick={() => setSaveOpen(false)}>Cancel</Button><Button onClick={() => { if (consumerKey.trim().length < 4) { push("error", "Missing consumer key", "Paste the Daraja consumer key."); return; } saveMpesaConfig({ consumer_key_masked: `${consumerKey.trim().slice(0, 8)}••••`, verified_at: null }); setSaveOpen(false); setConsumerKey(""); setConsumerSecret(""); setPasskey(""); push("success", "Credentials saved", "Run the test transaction, then enable."); }}>Save</Button></>}
        >
          <div className="flex flex-col gap-4">
            <Field label="Consumer key" htmlFor="mp-key" required><Input id="mp-key" value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} /></Field>
            <Field label="Consumer secret" htmlFor="mp-sec" required hint="Write-only — stored as a secret reference."><Input id="mp-sec" type="password" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} /></Field>
            <Field label="Passkey (Liowa Na Mpesa)" htmlFor="mp-pass" required><Input id="mp-pass" type="password" value={passkey} onChange={(e) => setPasskey(e.target.value)} /></Field>
            <CodeBlock language="reminder" code="Secrets are never logged, never exported, and redacted from job output (DS-008)." />
          </div>
        </Modal>
      </CommercialGate>
    </Screen>
  );
}
