"use client";

import React, { useState } from "react";
import { mailboxes, mailboxActivity } from "@/lib/mock/mail";
import { formatMb, formatDate, formatRelative } from "@/lib/format";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { deleteMailbox, resetMailboxPassword } from "@/lib/api/mail";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine, NotFoundInline } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/misc";
import { LogViewer, CopyButton } from "@/components/ui/code";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { MailGate } from "@/components/mail/shared";

export function MailboxDetailView({ mailboxId }: { mailboxId: string }) {
  const now = useNow();
  const { push } = useToast();
  const { setFocusedId, setTrayOpen } = useOperationStream();
  const box = mailboxes.find((m) => m.id === mailboxId);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [oneTime, setOneTime] = useState<string | null>(null);

  if (!box) {
    return (
      <Screen id="UX-MAIL-004" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Mailboxes", href: "/email/mailboxes" }]}>
        <NotFoundInline what="mailbox" />
      </Screen>
    );
  }
  const pct = box.quota_mb > 0 ? Math.round((box.used_mb / box.quota_mb) * 100) : 0;

  return (
    <Screen
      id="UX-MAIL-004"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Mailboxes", href: "/email/mailboxes" }, { label: box.address }]}
      actions={
        <>
          <Button size="sm" variant="secondary" onClick={() => setResetOpen(true)}>Reset password</Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>Delete mailbox</Button>
        </>
      }
    >
      <MailGate capabilityKey="mail.mailboxes">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Chip tone={box.state === "active" ? "success" : "warning"}>{box.state === "active" ? "Active" : "Suspended"}</Chip>
          <LiveStatusLine at={(mailboxActivity[0]?.ts ?? now.toISOString()) as string} label="Recent delivery" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Quota and usage">
            <ProgressBar label={`${formatMb(box.used_mb)} used of ${formatMb(box.quota_mb)} allocated`} value={pct} showValue tone={pct > 85 ? "warning" : "accent"} />
            <CardSection>
              <p className="text-sm text-ink-2">Created {formatDate(box.created_at)} · quota is a ceiling, not a reservation — the mailbox soft-bounces when it reaches 100%.</p>
            </CardSection>
          </Card>
          <Card title="Forwarding" description="Where copies of incoming mail go">
            {box.forwarders.length === 0 ? (
              <p className="text-sm text-ink-2">No forwarders — mail stays in this mailbox. Manage domain-wide aliases under Aliases and forwarders.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm text-ink">
                {box.forwarders.map((f) => (
                  <li key={f} className="font-mono text-xs">{f}</li>
                ))}
              </ul>
            )}
            <CardSection>
              <ButtonLink href="/email/aliases" size="sm" variant="secondary">Manage aliases and forwarders</ButtonLink>
            </CardSection>
          </Card>
        </div>
        <Card title="Recent activity" className="mt-4" description="Delivery log — secrets and message bodies are redacted">
          <LogViewer lines={mailboxActivity.map((l) => ({ ts: l.ts, severity: l.severity, message: l.message }))} />
        </Card>
        {oneTime !== null && (
          <Callout tone="warning" title="New password — shown once" className="mt-4">
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded-control bg-surface px-2 py-1 font-mono text-xs">{oneTime}</code>
              <CopyButton text={oneTime} label="Copy password" />
            </div>
            <p className="mt-2 text-xs">It will not be shown again — store it in your password manager now.</p>
          </Callout>
        )}
        <Modal
          open={resetOpen}
          onClose={() => { setResetOpen(false); setOneTime(null); }}
          title={`Reset password for ${box.address}`}
          description="The old password stops working immediately."
          footer={<><Button variant="secondary" onClick={() => { setResetOpen(false); setOneTime(null); }}>Close</Button><Button onClick={() => setOneTime(resetMailboxPassword(box.id))}>Generate new password</Button></>}
        >
          <p className="text-sm text-ink-2">A new one-time secret is generated and shown once. Sessions using the old password are disconnected.</p>
        </Modal>
        <ConfirmDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => {
            try {
              deleteMailbox(box.id);
              setFocusedId(null);
              setTrayOpen(false);
              push("info", "Mailbox deleted", `${box.address} and its stored mail are gone — data follows the retention policy.`);
            } catch {
              push("error", "Cannot delete", "The mailbox no longer exists.");
            }
          }}
          title={`Delete mailbox ${box.address}`}
          body={`This permanently deletes ${box.address}, including stored mail. Forwarders pointing at it keep working but will bounce until retargeted. Recovery follows the backup retention policy.`}
          confirmLabel="Delete mailbox"
          destructive
        />
        {false && <EmptyState title="" body="" />}
      </MailGate>
    </Screen>
  );
}
