"use client";

import React, { useState } from "react";
import { resellers } from "@/lib/mock/commercial";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/providers";
import { createReseller, setResellerState } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { Field, Input } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { CommercialGate, useLoaded, LoadedTable, useRefresh } from "@/components/commercial/shared";

export default function ResellersPage() {
  const { push } = useToast();
  const [refresh, bump] = useRefresh();
  const { loading, data } = useLoaded(() => resellers);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [maxAccounts, setMaxAccounts] = useState("20");
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);

  return (
    <Screen
      id="UX-COM-008"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Resellers" }]}
      actions={<Button icon="plus" onClick={() => setCreateOpen(true)}>Create reseller</Button>}
    >
      <CommercialGate>
        <LoadedTable loading={loading}>
          <DataTable
            caption="Reseller subtree, grants and limits"
            rowKey={(r) => r.id}
            rows={refresh >= 0 ? (data ?? []) : []}
            columns={[
              { key: "name", header: "Reseller", sortable: true },
              { key: "accounts", header: "Accounts", render: (r) => `${r.accounts} / ${r.max_accounts} delegated` },
              { key: "branding_domain", header: "Branding", render: (r) => (r.branding_domain ? <span className="font-mono text-xs">{r.branding_domain}</span> : <span className="text-ink-3">Default panel</span>) },
              { key: "state", header: "State", render: (r) => <Chip tone={r.state === "active" ? "success" : "warning"}>{r.state === "active" ? "Active" : "Suspended"}</Chip> },
              { key: "expiry", header: "Grant expiry", render: (r) => formatDate(r.expiry) },
              {
                key: "actions",
                header: "Actions",
                render: (r) => (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setResellerState(r.id, r.state === "active" ? "suspended" : "active"); push("success", r.state === "active" ? "Reseller suspended" : "Reseller reactivated", `${r.name} state updated (audited).`); bump(); }}>
                      {r.state === "active" ? "Suspend" : "Reactivate"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSuspendTarget(r.id)}>Revoke…</Button>
                  </div>
                ),
              },
            ]}
            emptyState={<EmptyState icon="users" title="No resellers yet" body="Delegate a reseller relationship with bounded grants — no cycles, no escalation." />}
          />
        </LoadedTable>
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Create reseller"
          description="The grant cannot exceed your own delegated privileges."
          footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => { createReseller({ name: name.trim() || "New reseller", max_accounts: parseInt(maxAccounts, 10) || 10 }); setCreateOpen(false); setName(""); push("success", "Reseller created", "Invite the reseller from Users and invitations."); bump(); }}>Create</Button></>}
        >
          <div className="flex flex-col gap-4">
            <Field label="Reseller name" htmlFor="r-name" required><Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Max hosting accounts" htmlFor="r-max" required hint="The reseller cannot exceed this delegated quota."><Input id="r-max" inputMode="numeric" value={maxAccounts} onChange={(e) => setMaxAccounts(e.target.value)} /></Field>
          </div>
        </Modal>
        <ConfirmDialog
          open={suspendTarget !== null}
          onClose={() => setSuspendTarget(null)}
          onConfirm={() => { if (suspendTarget) { setResellerState(suspendTarget, "suspended"); push("success", "Reseller revoked", "The grant is suspended; customers keep their services."); bump(); } }}
          title="Revoke reseller grant"
          body="Suspending the grant stops new account creation. Existing customer accounts keep running — suspension of services happens per account."
          confirmLabel="Revoke grant"
          destructive
        />
      </CommercialGate>
    </Screen>
  );
}
