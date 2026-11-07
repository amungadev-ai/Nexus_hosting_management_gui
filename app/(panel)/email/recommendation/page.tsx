"use client";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { Screen } from "@/components/common/screen";
import { useCapability } from "@/components/providers";

export default function MailRecommendationPage() {
  const smtp = useCapability("mail.external_smtp");
  const boxes = useCapability("mail.mailboxes");

  return (
    <Screen id="UX-MAIL-012" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Mailbox recommendation" }]}>
      <Callout tone="info" title="For mailboxes, we recommend Zoho or Google Workspace. Self-hosted mail is coming in v2.">
        This is the honest v1 guidance: the panel sends notifications over an external SMTP relay, while day-to-day
        mailboxes live with a dedicated provider. No feature is faked while you wait.
      </Callout>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Keep mailboxes with a provider" description="Recommended today">
          <ul className="flex flex-col gap-2 text-sm text-ink-2">
            <li>Zoho Mail — generous free tier for a single domain.</li>
            <li>Google Workspace — calendars and docs bundled with mail.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="https://www.zoho.com/mail/" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-line-strong">Open Zoho Mail<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" className="ml-1.5"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg></a>
            <a href="https://workspace.google.com/" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-line-strong">Open Google Workspace<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" className="ml-1.5"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg></a>
          </div>
          <p className="mt-3 text-xs text-ink-3">Links open the provider in a new tab — NexusPanel never proxies your mailbox login.</p>
        </Card>
        <Card title="What this VPS can do today" description="Capability-honest mail status">
          <div className="flex flex-wrap gap-2">
            <Chip tone={smtp.state === "unavailable" ? "neutral" : smtp.state === "available" ? "success" : "warning"}>External SMTP relay — {smtp.state}</Chip>
            <Chip tone={boxes.state === "unavailable" ? "neutral" : boxes.state === "available" ? "success" : "warning"}>Self-hosted mailboxes — {boxes.state === "unavailable" ? "v2" : boxes.state}</Chip>
          </div>
          {smtp.state === "unavailable" && <p className="mt-3 text-sm text-ink-2">{smtp.reason}</p>}
          {boxes.state === "unavailable" && <p className="mt-2 text-sm text-ink-2">{boxes.reason}</p>}
          <div className="mt-3"><ButtonLink href="/email/external-smtp" size="sm" variant="secondary">Configure external SMTP</ButtonLink></div>
        </Card>
      </div>
    </Screen>
  );
}
