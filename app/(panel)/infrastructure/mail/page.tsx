"use client";

import { Screen } from "@/components/common/screen";
import { Card, CardSection } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { Callout } from "@/components/ui/feedback";
import { MailGate } from "@/components/mail/shared";

export default function MailServerConfigPage() {
  return (
    <Screen id="UX-MAIL-010" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Mail server configuration" }]} description="Provider view: ports, TLS, spam policy, quotas and backups for the mail containers.">
      <MailGate capabilityKey="mail.mailboxes">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Listener and TLS">
            <KeyValue
              items={[
                { label: "SMTP submission", value: "587 (STARTTLS required)" },
                { label: "IMAPS", value: "993 (TLS 1.2+)" },
                { label: "Certificate", value: "Let's Encrypt — auto-renewed with the panel" },
                { label: "Port 25 outbound", value: "Blocked by default — relay via external SMTP instead" },
              ]}
              columns={1}
            />
          </Card>
          <Card title="Spam, quotas and backups">
            <KeyValue
              items={[
                { label: "Spam filtering", value: "rspamd — learn as spam/ham from webmail" },
                { label: "Default mailbox quota", value: "2 GB (per-mailbox override on the detail screen)" },
                { label: "Mail storage backups", value: "Nightly remote (restic → B2), verification weekly" },
                { label: "Rate limit", value: "200 messages/hour/mailbox" },
              ]}
              columns={1}
            />
            <CardSection>
              <Chip tone="info">Plan changes apply on the next container restart</Chip>
            </CardSection>
          </Card>
        </div>
        <Callout tone="info" className="mt-4">
          Self-hosted mail needs port 25, a valid PTR record and Docker — the installer blocks this role honestly when
          any prerequisite is missing (see Infrastructure → Capability detection).
        </Callout>
      </MailGate>
    </Screen>
  );
}
