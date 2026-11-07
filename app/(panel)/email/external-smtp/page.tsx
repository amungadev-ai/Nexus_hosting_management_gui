"use client";

import React, { useState } from "react";
import { smtpConfig } from "@/lib/mock/mail";
import { formatRelative } from "@/lib/format";
import { useOperationStream, useToast } from "@/components/providers";
import { saveSmtpConfig, sendTestEmail } from "@/lib/api/mail";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { SecretField } from "@/components/ui/code";
import { Callout } from "@/components/ui/feedback";
import { MailGate, useMailLoad } from "@/components/mail/shared";

export default function ExternalSmtpPage() {
  const { push } = useToast();
  const { setFocusedId, setTrayOpen } = useOperationStream();
  const { loading, data } = useMailLoad(() => smtpConfig);
  const [provider, setProvider] = useState(smtpConfig.provider);
  const [host, setHost] = useState(smtpConfig.host);
  const [port, setPort] = useState(String(smtpConfig.port));
  const [username, setUsername] = useState(smtpConfig.username);
  const [from, setFrom] = useState(smtpConfig.from_address);
  const [recipient, setRecipient] = useState("postmaster@wanjiku.co.ke");

  return (
    <Screen id="UX-MAIL-011" breadcrumbs={[{ label: "Home", href: "/" }, { label: "External SMTP" }]}>
      <MailGate capabilityKey="mail.external_smtp">
        <p className="mb-4 max-w-3xl text-sm text-ink-2">
          The v1 email path: configure Resend / Postmark / Mailgun / SES for panel notifications and WordPress
          outbound mail. Mailboxes stay with an external provider until self-hosted mail ships in v2.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Relay credentials" description={loading ? "Loading…" : `Verified ${data?.verified_at ? formatRelative(data.verified_at) : "never"}`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Provider" htmlFor="smtp-provider">
                <Select id="smtp-provider" value={provider} onChange={(e) => setProvider(e.target.value as typeof smtpConfig.provider)}>
                  <option value="resend">Resend</option>
                  <option value="postmark">Postmark</option>
                  <option value="mailgun">Mailgun</option>
                  <option value="ses">Amazon SES</option>
                </Select>
              </Field>
              <Field label="From address" htmlFor="smtp-from" required><Input id="smtp-from" type="email" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="Host" htmlFor="smtp-host"><Input id="smtp-host" value={host} onChange={(e) => setHost(e.target.value)} /></Field>
              <Field label="Port" htmlFor="smtp-port"><Input id="smtp-port" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} /></Field>
              <Field label="Username" htmlFor="smtp-user" className="sm:col-span-2"><Input id="smtp-user" value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
            </div>
            <CardSection>
              <SecretField label="SMTP password / API key" value="smtp_secret_redacted_reference" />
              <div className="mt-3">
                <Button
                  onClick={() => {
                    saveSmtpConfig({ provider, host, port: parseInt(port, 10) || 587, username, from_address: from });
                    push("success", "SMTP settings saved", "Run a test send to verify the relay accepts mail.");
                  }}
                >
                  Save settings
                </Button>
              </div>
            </CardSection>
          </Card>
          <Card title="Test the relay" description="A durable mail.test operation — the UI never claims delivery before the relay accepts.">
            <Field label="Send test message to" htmlFor="smtp-test" required>
              <Input id="smtp-test" type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </Field>
            <div className="mt-3 flex gap-2">
              <Button
                icon="mail"
                onClick={() => {
                  try {
                    const op = sendTestEmail(recipient);
                    setFocusedId(op.id);
                    setTrayOpen(true);
                    push("info", "Test send submitted", "The result (with relay latency) lands in the operation tray.");
                  } catch (e) {
                    push("error", "Cannot send test", e instanceof Error ? e.message : "Check the recipient address.");
                  }
                }}
              >
                Send test email
              </Button>
            </div>
            <Callout tone="info" className="mt-4">
              Nano installations cannot configure even external SMTP — email of any kind is unavailable there, honestly stated rather than greyed out.
            </Callout>
          </Card>
        </div>
      </MailGate>
    </Screen>
  );
}
