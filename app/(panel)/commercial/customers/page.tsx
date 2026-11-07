"use client";

import React, { useState } from "react";
import { customers } from "@/lib/mock/commercial";
import { useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { operations } from "@/lib/operations";
import { CommercialGate, useLoaded, LoadedTable } from "@/components/commercial/shared";

export default function CustomersPage() {
  const { push } = useToast();
  const { loading, data } = useLoaded(() => customers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");

  const invite = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      push("error", "Invalid email", "Enter the contact's full email address.");
      return;
    }
    operations.submit({
      kind: "organization.member.invite",
      title: `Invite ${email}${org ? ` to ${org}` : ""}`,
      resource_ref: { type: "organization", id: "org_01JKV8Z9P3", name: "Jamii Hosting Ltd" },
      workload_category: "infrastructure",
      step_titles: ["Create invitation", "Email invitee", "Record audit entry"],
      actor_id: "usr_01JOWN01",
      organization_id: "org_01JKV8Z9P3",
    });
    setInviteOpen(false);
    setEmail("");
    push("success", "Invitation sent", "Single-use and expiring — never above your delegable scope.");
  };

  return (
    <Screen
      id="UX-COM-007"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Customers" }]}
      actions={<Button icon="plus" onClick={() => setInviteOpen(true)}>Invite</Button>}
    >
      <CommercialGate>
        <LoadedTable loading={loading}>
          <DataTable
            caption="Customer organizations"
            rowKey={(c) => c.id}
            rows={data ?? []}
            columns={[
              { key: "name", header: "Customer", sortable: true },
              { key: "contact_name", header: "Contact" },
              { key: "contact_email", header: "Email" },
              { key: "services", header: "Services", render: (c) => String(c.services) },
              { key: "account", header: "Account", render: (c) => <a className="text-accent hover:underline" href={`/commercial/accounts/${c.account_id}`}>{c.account_id.replace("acct_", "")}</a> },
            ]}
            emptyState={<EmptyState icon="users" title="No customers yet" body="Invite a customer organization to start assigning services." action={{ label: "Invite", onClick: () => setInviteOpen(true) }} />}
          />
        </LoadedTable>
        <Modal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          title="Invite a customer"
          footer={<><Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button><Button onClick={invite}>Send invitation</Button></>}
        >
          <div className="flex flex-col gap-4">
            <Field label="Contact email" htmlFor="c-email" required><Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.co.ke" /></Field>
            <Field label="Assign to customer org" htmlFor="c-org" hint="Optional — leave as new organization.">
              <Select id="c-org" value={org} onChange={(e) => setOrg(e.target.value)}>
                <option value="">New organization…</option>
                {(data ?? []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
        </Modal>
      </CommercialGate>
    </Screen>
  );
}
