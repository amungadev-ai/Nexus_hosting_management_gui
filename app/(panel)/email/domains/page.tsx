"use client";

import { mailDomains } from "@/lib/mock/mail";
import { formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill, Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { LiveStatusLine } from "@/components/common/states";
import { Callout } from "@/components/ui/feedback";
import { MailGate, useMailLoad } from "@/components/mail/shared";

export default function EmailDomainsPage() {
  const now = useNow();
  const { loading, data } = useMailLoad(() => mailDomains);

  return (
    <Screen
      id="UX-MAIL-002"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Email domains" }]}
      actions={<ButtonLink href="/email/domains/new" size="sm" variant="secondary">Set up a mail domain</ButtonLink>}
    >
      <MailGate capabilityKey="mail.external_smtp">
        <p className="mb-2 max-w-3xl text-sm text-ink-2">
          Mail domains with health and deliverability. Mode: <strong>External SMTP relay</strong> — available on Starter
          and above; self-hosted mailboxes ship in v2 on Standard.
        </p>
        <LiveStatusLine at={mailDomains[0]?.last_checked_at ?? now.toISOString()} label="Delivery checks" />
        {loading ? (
          <p className="mt-4 text-sm text-ink-2" role="status">Loading mail domains…</p>
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon="mail" title="No mail domains" body="Set up a domain to send panel notifications and WordPress mail over the relay." action={{ label: "Set up a mail domain", href: "/email/domains/new" }} />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(data ?? []).map((d) => (
              <Card key={d.id} title={d.domain} description={d.mode === "external_smtp" ? "Outbound relay via external SMTP" : "Self-hosted mail (v2)"}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={d.health === "healthy" ? "healthy" : d.health === "degraded" ? "degraded" : "unknown"} at={d.last_checked_at} />
                  <Chip tone={d.mx_verified ? "success" : "neutral"}>{d.mx_verified ? "MX present" : "No MX — outbound only"}</Chip>
                </div>
                <Callout tone="info" className="mt-3">
                  Delivery health never reads “deliverability guaranteed” — reputation is earned by your sending behavior.
                </Callout>
              </Card>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/email/deliverability" size="sm" variant="secondary">SPF / DKIM / DMARC guidance</ButtonLink>
          <ButtonLink href="/email/recommendation" size="sm" variant="ghost">Mailbox recommendation</ButtonLink>
        </div>
        <Callout tone="info" className="mt-4" title="Mail import is planned for v2">
          Migrating existing mailboxes and messages from other providers arrives with self-hosted mail in v2. Until then, keep mailboxes at your provider and point outbound mail at the relay.
        </Callout>
      </MailGate>
    </Screen>
  );
}
