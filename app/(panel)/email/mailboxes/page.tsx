"use client";

import React, { useState } from "react";
import Link from "next/link";
import { mailboxes } from "@/lib/mock/mail";
import { formatMb } from "@/lib/format";
import { useOperationStream, useToast } from "@/components/providers";
import { createMailbox } from "@/lib/api/mail";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { EmptyState, Callout } from "@/components/ui/feedback";
import { MailGate, useMailLoad, useMailRefresh } from "@/components/mail/shared";

export default function MailboxesPage() {
  const { push } = useToast();
  const { setFocusedId, setTrayOpen } = useOperationStream();
  const [refresh, bump] = useMailRefresh();
  const { loading, data } = useMailLoad(() => mailboxes);
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [quota, setQuota] = useState("2048");

  return (
    <Screen
      id="UX-MAIL-003"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Mailboxes" }]}
      actions={<Button size="sm" icon="plus" onClick={() => setOpen(true)}>Create mailbox</Button>}
    >
      <MailGate capabilityKey="mail.mailboxes">
        <p className="mb-3 max-w-3xl text-sm text-ink-2">
          Self-hosted mailboxes on this server (Standard capability). v1 installations keep mailboxes with Zoho or
          Google Workspace and send outbound mail via the relay.
        </p>
        {loading ? (
          <p className="text-sm text-ink-2" role="status">Loading mailboxes…</p>
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon="mail" title="No mailboxes yet" body="Create the first mailbox for this domain, or keep mail at an external provider and use the SMTP relay only." action={{ label: "Create mailbox", onClick: () => setOpen(true) }} secondaryAction={{ label: "Mailbox recommendation", href: "/email/recommendation" }} />
        ) : (
          <DataTable
            caption="Mailboxes with quota and state"
            rowKey={(m) => m.id}
            rows={refresh >= 0 ? (data ?? []) : []}
            onRowClick={(m) => window.setTimeout(() => undefined, 0)}
            columns={[
              { key: "address", header: "Address", className: "sticky left-0 bg-surface", render: (m) => <Link href={`/email/mailboxes/${m.id}`} className="font-medium text-accent hover:underline">{m.address}</Link>, sortable: true },
              { key: "quota", header: "Quota used", render: (m) => `${formatMb(m.used_mb)} of ${formatMb(m.quota_mb)}` },
              { key: "forwarders", header: "Forwarders", render: (m) => (m.forwarders.length > 0 ? m.forwarders.join(", ") : "—") },
              { key: "state", header: "State", render: (m) => (m.state === "active" ? "Active" : "Suspended") },
            ]}
            emptyState={<EmptyState icon="mail" title="No mailboxes yet" body="Create the first mailbox for this domain." action={{ label: "Create mailbox", onClick: () => setOpen(true) }} />}
          />
        )}
        <Callout tone="info" className="mt-4">
          Passwords are write-only: reset generates a one-time secret shown once, then never displayed again (DS-008).
        </Callout>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Create mailbox"
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => { try { const { operation_id } = createMailbox(address.trim(), parseInt(quota, 10) || 2048); setFocusedId(operation_id); setTrayOpen(true); push("info", "Mailbox provisioning", "The mailbox appears once the operation verifies login."); setOpen(false); setAddress(""); } catch (e) { push("error", "Cannot create mailbox", e instanceof Error ? e.message : "Check the address."); } }}>Create</Button></>}
        >
          <div className="flex flex-col gap-4">
            <Field label="Address" htmlFor="mb-addr" required hint="Full address, e.g. hello@wanjiku.co.ke"><Input id="mb-addr" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
            <Field label="Quota (MB)" htmlFor="mb-quota" required><Input id="mb-quota" inputMode="numeric" value={quota} onChange={(e) => setQuota(e.target.value)} /></Field>
          </div>
        </Modal>
      </MailGate>
    </Screen>
  );
}
