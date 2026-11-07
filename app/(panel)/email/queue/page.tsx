"use client";

import React from "react";
import { mailQueue } from "@/lib/mock/mail";
import { formatRelative } from "@/lib/format";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { retryQueuedMessage } from "@/lib/api/mail";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { EmptyState, Callout } from "@/components/ui/feedback";
import { MailGate } from "@/components/mail/shared";

export default function MailQueuePage() {
  const now = useNow();
  const { push } = useToast();
  const { setFocusedId, setTrayOpen } = useOperationStream();

  return (
    <Screen id="UX-MAIL-009" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Mail queue" }]}>
      <MailGate capabilityKey="mail.external_smtp">
        <DataTable
          caption="Deferred and bounced messages — logs are redacted"
          rowKey={(q) => q.id}
          rows={mailQueue}
          columns={[
            { key: "recipient", header: "Recipient", render: (q) => <span className="font-mono text-xs">{q.recipient}</span> },
            { key: "subject", header: "Subject" },
            { key: "state", header: "State", render: (q) => <Chip tone={q.state === "deferred" ? "warning" : "danger"}>{q.state === "deferred" ? "Deferred — retrying" : "Bounced"}</Chip> },
            { key: "attempts", header: "Attempts", render: (q) => String(q.attempts) },
            { key: "last_attempt_at", header: "Last attempt", render: (q) => <span className="whitespace-nowrap text-xs text-ink-3">{formatRelative(q.last_attempt_at, now)}</span> },
            { key: "actions", header: " ", render: (q) => (q.state === "deferred" ? <Button size="sm" variant="secondary" onClick={() => { const op = retryQueuedMessage(q.id, q.recipient); setFocusedId(op.id); setTrayOpen(true); push("info", "Redelivery queued", "The final delivery state is recorded in the operation."); }}>Retry now</Button> : <span className="text-xs text-ink-3">{q.reason}</span>) },
          ]}
          emptyState={<EmptyState icon="mail" title="Queue is empty" body="Deferred or bounced messages appear here with a redacted reason." />}
        />
        <Callout tone="info" className="mt-4">
          Deferred mail retries automatically with backoff — “deferred” is normal, not an error. Bounces need a fix on
          your side (usually a wrong recipient or a full mailbox).
        </Callout>
      </MailGate>
    </Screen>
  );
}
