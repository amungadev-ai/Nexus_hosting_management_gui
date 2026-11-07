"use client";

import { deliverabilityRecords } from "@/lib/mock/mail";
import { Screen } from "@/components/common/screen";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { RecordCopyRow, MailGate } from "@/components/mail/shared";
import { ButtonLink } from "@/components/ui/button";

export default function DeliverabilityPage() {
  return (
    <Screen
      id="UX-MAIL-008"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Mail DNS health" }]}
      description="SPF/DKIM/DMARC/PTR checks for wanjiku.co.ke. The panel never displays “deliverability guaranteed” — reputation is earned, not asserted."
      actions={<ButtonLink href="/email/domains/new" size="sm" variant="secondary">Setup checklist</ButtonLink>}
    >
      <MailGate capabilityKey="mail.external_smtp">
        <div className="flex flex-col gap-3">
          {deliverabilityRecords.map((r) => (
            <RecordCopyRow key={r.id} role={r.role} type={r.type} name={r.name} value={r.value} status={r.status} note={r.note} />
          ))}
        </div>
        <Callout tone="info" className="mt-4" title="How to read this">
          SPF authorizes the relay to send for your domain, DKIM signs the messages, DMARC tells receivers what to do
          when checks fail, and PTR matches your server IP back to a hostname. These exact values tie into the
          DNS-guidance story — add them once at the registrar.
        </Callout>
      </MailGate>
    </Screen>
  );
}
