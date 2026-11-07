"use client";

import { Screen } from "@/components/common/screen";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { MailGate } from "@/components/mail/shared";

export default function WebmailLauncherPage() {
  return (
    <Screen id="UX-MAIL-007" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Webmail" }]}>
      <MailGate capabilityKey="mail.mailboxes">
        <Card title="Open webmail" description="Separate login with a safe redirect">
          <p className="text-sm text-ink-2">
            Webmail runs on the mail container at <span className="font-mono text-xs">webmail.wanjiku.co.ke</span>. The
            panel never proxies your mailbox session — you sign in directly, and the panel only redirects you there.
          </p>
          <div className="mt-4">
            <a
              href="https://webmail.wanjiku.co.ke/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-control bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              Open webmail in a new tab
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
            </a>
          </div>
          <Callout tone="info" className="mt-4">
            SSO into webmail is planned alongside self-hosted mail v2. Until then, use the mailbox password from the
            mailbox detail screen.
          </Callout>
        </Card>
      </MailGate>
    </Screen>
  );
}
