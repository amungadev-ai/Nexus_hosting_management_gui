"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Switch } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { MailGate } from "@/components/mail/shared";

interface List { id: string; name: string; members: number; moderated: boolean; policy: string }

export default function MailingListsPage() {
  const [lists, setLists] = useState<List[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [moderated, setModerated] = useState(true);

  return (
    <Screen
      id="UX-MAIL-006"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Mailing lists" }]}
      actions={<Button size="sm" icon="plus" onClick={() => setOpen(true)}>Create list</Button>}
    >
      <MailGate capabilityKey="mail.mailboxes">
        {lists.length === 0 ? (
          <EmptyState
            icon="users"
            title="No mailing lists yet"
            body="Mailing lists group members with a moderation and delivery policy — useful for announcements to customers."
            action={{ label: "Create list", onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {lists.map((l) => (
              <Card key={l.id} title={`${l.name}@wanjiku.co.ke`} description={`${l.members} members · ${l.moderated ? "moderated" : "unmoderated"} · ${l.policy}`}>
                <p className="text-sm text-ink-2">Delivery policy: {l.policy}</p>
              </Card>
            ))}
          </div>
        )}
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Create mailing list"
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => { const n = name.trim() || "announcements"; setLists([...lists, { id: `ml_${Date.now()}`, name: n, members: 0, moderated, policy: moderated ? "Only moderators may post" : "Members may post" }]); setOpen(false); setName(""); }}>Create list</Button></>}
        >
          <div className="flex flex-col gap-4">
            <Field label="List name" htmlFor="ml-name" required hint="The list address becomes name@wanjiku.co.ke."><Input id="ml-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Switch checked={moderated} onChange={setModerated} label="Moderated — only moderators may post" />
          </div>
        </Modal>
      </MailGate>
    </Screen>
  );
}
