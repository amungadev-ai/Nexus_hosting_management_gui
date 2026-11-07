"use client";

import { deliverabilityRecords } from "@/lib/mock/mail";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { RecordCopyRow, MailGate } from "@/components/mail/shared";

export default function EmailDomainSetupPage() {
  return (
    <Screen
      id="UX-MAIL-001"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Email domains", href: "/email/domains" }]}
      description="Mail role readiness with MX/SPF/DKIM/DMARC checks for the sending domain."
    >
      <MailGate capabilityKey="mail.mailboxes">
        <Card title="Readiness checks — wanjiku.co.ke" description="Add these exact records at your registrar; the panel re-checks them automatically.">
          <div className="flex flex-col gap-3">
            {deliverabilityRecords.map((r) => (
              <RecordCopyRow key={r.id} role={r.role} type={r.type} name={r.name} value={r.value} status={r.status} note={r.note} />
            ))}
          </div>
        </Card>
        <Callout tone="warning" className="mt-4" title="Never promise global propagation">
          Record checks are observations at specific resolvers, repeated over time — the checklist turns green only when each record verifies, and it can regress.
        </Callout>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/email/deliverability" size="sm" variant="secondary">Open deliverability details</ButtonLink>
          <ButtonLink href="/domains" size="sm" variant="ghost">DNS guidance for this domain</ButtonLink>
        </div>
      </MailGate>
    </Screen>
  );
}
