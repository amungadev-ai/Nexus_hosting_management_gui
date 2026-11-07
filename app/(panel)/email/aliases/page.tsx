"use client";

import React, { useState } from "react";
import { catchAll, mailAliases } from "@/lib/mock/mail";
import { useToast } from "@/components/providers";
import { createAlias, deleteAlias, setCatchAll } from "@/lib/api/mail";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Field, Input } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { MailGate, useMailRefresh } from "@/components/mail/shared";

export default function AliasesPage() {
  const { push } = useToast();
  const [refresh, bump] = useMailRefresh();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [catchTarget, setCatchTarget] = useState(catchAll.target ?? "");

  return (
    <Screen
      id="UX-MAIL-005"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Aliases and forwarders" }]}
      actions={<Button size="sm" icon="plus" onClick={() => setOpen(true)}>New alias</Button>}
    >
      <MailGate capabilityKey="mail.mailboxes">
        <DataTable
          caption="Aliases and forwarders — loop and restriction checked at submit"
          rowKey={(a) => a.id}
          rows={refresh >= 0 ? mailAliases : []}
          columns={[
            { key: "source", header: "Source", render: (a) => <span className="font-mono text-xs">{a.source}</span> },
            { key: "target", header: "Delivers to", render: (a) => <span className="font-mono text-xs">{a.target}</span> },
            { key: "state", header: "State", render: () => "Active" },
            { key: "actions", header: " ", render: (a) => <Button size="sm" variant="ghost" onClick={() => setRemoveId(a.id)}>Remove…</Button> },
          ]}
          emptyState={<EmptyState icon="mail" title="No aliases yet" body="Forward role addresses like info@ to a real mailbox." action={{ label: "New alias", onClick: () => setOpen(true) }} />}
        />
        <Card title="Catch-all" className="mt-4" description="Where unmatched addresses on the domain go">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Target (blank = reject unmatched mail)" htmlFor="ca-target">
              <Input id="ca-target" value={catchTarget} onChange={(e) => setCatchTarget(e.target.value)} placeholder="jane@wanjiku.co.ke" />
            </Field>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                try {
                  setCatchAll(catchTarget.trim() === "" ? null : catchTarget.trim());
                  push("success", "Catch-all updated", catchTarget.trim() === "" ? "Unmatched addresses are now rejected (fewer spam traps)." : `Unmatched addresses forward to ${catchTarget.trim()}.`);
                } catch (e) {
                  push("error", "Invalid target", e instanceof Error ? e.message : "Use a full email address.");
                }
              }}
            >
              Save catch-all
            </Button>
          </div>
          <CardSection>
            <p className="text-xs text-ink-3">Catch-alls can accept a lot of spam — rejecting unmatched mail is the safer default.</p>
          </CardSection>
        </Card>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="New alias"
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => { try { createAlias(source.trim(), target.trim()); push("success", "Alias created", `${source.trim()} now forwards to ${target.trim()}.`); setOpen(false); setSource(""); setTarget(""); bump(); } catch (e) { push("error", "Cannot create alias", e instanceof Error ? e.message : "Check source and target."); } }}>Create alias</Button></>}
        >
          <div className="flex flex-col gap-4">
            <Field label="Source address" htmlFor="al-src" required><Input id="al-src" value={source} onChange={(e) => setSource(e.target.value)} placeholder="info@wanjiku.co.ke" /></Field>
            <Field label="Delivers to" htmlFor="al-dst" required hint="Loops (an alias forwarding to itself) are rejected."><Input id="al-dst" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="jane@wanjiku.co.ke" /></Field>
          </div>
        </Modal>
        <ConfirmDialog
          open={removeId !== null}
          onClose={() => setRemoveId(null)}
          onConfirm={() => { try { deleteAlias(removeId ?? ""); push("info", "Alias removed", "Senders to the old address now get a bounce."); bump(); } catch { push("error", "Cannot remove", "That alias no longer exists."); } }}
          title="Remove alias"
          body="Mail to the source address will bounce once the alias is gone. Tell frequent senders before removing it."
          confirmLabel="Remove alias"
          destructive
        />
      </MailGate>
    </Screen>
  );
}
