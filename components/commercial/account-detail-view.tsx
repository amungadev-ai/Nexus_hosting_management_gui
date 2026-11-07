"use client";

import React, { useState } from "react";
import Link from "next/link";
import { hostingAccounts, hostingPackages } from "@/lib/mock/commercial";
import { db } from "@/lib/mock/data";
import { formatMoney, formatRelative, formatDate, maskPhone } from "@/lib/format";
import { useCapability, useNow, useOperationStream, useSession, useToast } from "@/components/providers";
import { operations } from "@/lib/operations";
import { requestStepUp } from "@/lib/api/me";
import { suspendHostingAccount } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { KeyValue, ProgressBar } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { EmptyState, Callout } from "@/components/ui/feedback";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { CommercialGate, AccountStateChip, InvoiceStatePill, PaymentStatePill, ProviderChip, ReconChip } from "@/components/commercial/shared";

export function AccountDetailView({ accountId }: { accountId: string }) {
  const now = useNow();
  const { push } = useToast();
  const { profile } = useSession();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const account = hostingAccounts.find((a) => a.id === accountId);
  const pkg = account ? hostingPackages.find((p) => p.id === account.package_id) : undefined;
  const [tab, setTab] = useState("overview");
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [suspendBusy, setSuspendBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingOp, setPendingOp] = useState<string | null>(null);

  if (!account) {
    return (
      <Screen id="UX-COM-002" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Hosting accounts", href: "/commercial/accounts" }]}>
        <NotFoundInline what="hosting account" />
      </Screen>
    );
  }

  const invoices = db.invoices.filter((i) => i.subscription_id === "sub_01JSUB01" || account.site_ids.length >= 0);
  const payments = db.payments.filter((p) => invoices.some((i) => i.id === p.invoice_id));
  const pct = (used: number, limit: number) => (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0);

  const doSuspend = async () => {
    setSuspendBusy(true);
    try {
      await requestStepUp("hosting-account.suspend", account.id);
      const op = suspendHostingAccount(account.id);
      setPendingOp(op.id);
      push("info", "Suspension submitted", `${account.name} suspends when the operation verifies.`);
      setFocusedId(op.id);
      setTrayOpen(true);
    } catch {
      push("error", "Step-up verification failed", "Suspension requires MFA. Verify your identity and try again.");
    } finally {
      setSuspendBusy(false);
    }
  };

  const sendInvite = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteEmail)) {
      push("error", "Invalid email", "Enter the new member's full email address.");
      return;
    }
    const op = operations.submit({
      kind: "organization.member.invite",
      title: `Invite ${inviteEmail} to ${account.name}`,
      resource_ref: { type: "hosting_account", id: account.id, name: account.name },
      workload_category: "infrastructure",
      step_titles: ["Create invitation", "Email invitee", "Record audit entry"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    setInviteOpen(false);
    setInviteEmail("");
    setFocusedId(op.id);
    push("success", "Invitation sent", `${inviteEmail} will receive a single-use, expiring invitation.`);
  };

  return (
    <Screen
      id="UX-COM-002"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Hosting accounts", href: "/commercial/accounts" }, { label: account.name }]}
      actions={
        <Button variant="secondary" icon="pause" loading={suspendBusy} onClick={() => setConfirmSuspend(true)}>
          Suspend
        </Button>
      }
    >
      <CommercialGate>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <AccountStateChip state={account.state} />
          <LiveStatusLine at={account.last_verified_at} label={`Observed ${formatRelative(account.last_verified_at, now)}`.length > 0 ? "Account state" : "Account state"} />
        </div>

        {pendingOp !== null && (
          <div className="mb-4">
            <PendingState operation={operations.get(pendingOp)!} />
          </div>
        )}

        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "invoices", label: "Invoices", badge: invoices.length },
            { id: "payments", label: "Payments", badge: payments.length },
            { id: "access", label: "Access" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "overview" && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Account" description={`Customer: ${account.customer_name}`}>
              <KeyValue
                items={[
                  { label: "Account ID", value: account.id, mono: true },
                  { label: "Package", value: pkg ? `${pkg.name} (rev ${pkg.revision})` : "—" },
                  { label: "Owner", value: `${account.owner.name} — ${account.owner.email}` },
                  { label: "Created", value: formatDate(account.created_at) },
                ]}
                columns={2}
              />
              <CardSection>
                <p className="text-xs font-medium text-ink-2">Resource usage vs package limits</p>
                <div className="mt-2 flex flex-col gap-3">
                  <ProgressBar label={`Websites ${account.resources.websites}/${account.limits.websites}`} value={pct(account.resources.websites, account.limits.websites)} tone={pct(account.resources.websites, account.limits.websites) > 80 ? "warning" : "accent"} />
                  <ProgressBar label={`Mailboxes ${account.resources.mailboxes}/${account.limits.mailboxes}`} value={pct(account.resources.mailboxes, account.limits.mailboxes)} tone="accent" />
                  <ProgressBar label={`Disk ${account.resources.disk_gb}/${account.limits.disk_gb} GB`} value={pct(account.resources.disk_gb, account.limits.disk_gb)} tone="accent" />
                </div>
              </CardSection>
            </Card>
            <Card title="Sites" description="Websites hosted under this account">
              {account.site_ids.length === 0 ? (
                <p className="text-sm text-ink-2">No sites provisioned yet — they appear here once the provisioning operation verifies.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {account.site_ids.map((siteId) => {
                    const site = db.websites.find((w) => w.id === siteId);
                    return (
                      <li key={siteId}>
                        {site ? (
                          <Link href={`/websites/${site.id}`} className="text-sm font-medium text-accent hover:underline">
                            {site.title} — {site.primary_domain}
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-2">{siteId}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <CardSection>
                <p className="text-sm text-ink-2">
                  Package price {pkg ? formatMoney(pkg.price) : "—"}/month + 16% VAT.{" "}
                  <Link href="/commercial/subscriptions" className="text-accent hover:underline">
                    Manage subscription
                  </Link>
                </p>
              </CardSection>
            </Card>
          </div>
        )}

        {tab === "invoices" && (
          <div className="mt-4">
            {invoices.length === 0 ? (
              <EmptyState icon="file-text" title="No invoices yet" body="Invoices appear when the subscription renews or a plan changes." action={{ label: "Open invoices", href: "/commercial/invoices" }} />
            ) : (
              <DataTable
                caption="Invoices for this customer"
                rowKey={(i) => i.id}
                rows={invoices}
                columns={[
                  { key: "invoice_number", header: "Invoice", render: (i) => <Link href="/commercial/invoices" className="font-mono text-xs text-accent hover:underline">{i.invoice_number}</Link> },
                  { key: "state", header: "State", render: (i) => <InvoiceStatePill state={i.state} /> },
                  { key: "total", header: "Total", render: (i) => formatMoney(i.total) },
                  { key: "due_at", header: "Due", render: (i) => formatDate(i.due_at) },
                ]}
              />
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="mt-4">
            {payments.length === 0 ? (
              <EmptyState icon="credit-card" title="No payments yet" body="M-Pesa and Stripe payments for this customer's invoices will be listed here." action={{ label: "Open payment history", href: "/commercial/payments" }} />
            ) : (
              <DataTable
                caption="Payments for this customer"
                rowKey={(p) => p.id}
                rows={payments}
                columns={[
                  { key: "provider_reference", header: "Reference", render: (p) => <span className="font-mono text-xs">{p.provider_reference}</span> },
                  { key: "provider", header: "Provider", render: (p) => <ProviderChip provider={p.provider} /> },
                  { key: "state", header: "State", render: (p) => <PaymentStatePill state={p.state} /> },
                  { key: "reconciliation", header: "Reconciliation", render: (p) => <ReconChip state={p.reconciliation_state} /> },
                  { key: "amount", header: "Amount", render: (p) => formatMoney(p.amount) },
                ]}
              />
            )}
          </div>
        )}

        {tab === "access" && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card
              title="Members"
              description="People with access to this hosting account"
              actions={<Button size="sm" icon="plus" onClick={() => setInviteOpen(true)}>Invite</Button>}
            >
              <ul className="flex flex-col divide-y divide-line">
                <li className="py-2 text-sm">
                  <span className="font-medium text-ink">{account.owner.name}</span>
                  <span className="ml-2 text-ink-2">{account.owner.email}</span>
                  <span className="ml-2 rounded-control bg-accent-soft px-1.5 py-0.5 text-xs text-accent">Owner</span>
                </li>
                {db.users
                  .filter((u) => u.email === account.owner.email)
                  .slice(0, 0)
                  .map((u) => (
                    <li key={u.id} className="py-2 text-sm">{u.display_name}</li>
                  ))}
              </ul>
              <CardSection>
                <p className="text-xs text-ink-3">
                  Invitations are single-use and expire. Server policy — not this UI — decides what each member may do.
                </p>
              </CardSection>
            </Card>
            <Card title="Transfer" description="Move this account to another organization">
              <p className="text-sm text-ink-2">
                Ownership transfer is a governed operation: the new organization must accept, and both sides are audited.
              </p>
              <CardSection>
                <ButtonLink href="/settings/system" variant="secondary" size="sm" icon="arrow-right">
                  Start a transfer
                </ButtonLink>
              </CardSection>
            </Card>
          </div>
        )}

        <ConfirmDialog
          open={confirmSuspend}
          onClose={() => setConfirmSuspend(false)}
          onConfirm={doSuspend}
          title={`Suspend hosting account ${account.name}`}
          body={`Sites under ${account.name} become unreachable until the account is unsuspended. This is reversible, requires MFA, and is audited. Current profile: ${profile}.`}
          confirmLabel="Suspend account"
          destructive
        />

        <Modal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          title={`Invite a member to ${account.name}`}
          description="The invitee receives a single-use, expiring invitation — never above your own delegable scope."
          footer={
            <>
              <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={sendInvite}>Send invitation</Button>
            </>
          }
        >
          <Field label="Invitee email" htmlFor="invite-email" required hint="They get an email with a single-use link.">
            <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@example.co.ke" />
          </Field>
        </Modal>

        <Callout tone="info" className="mt-6">
          Demo note: payment phone numbers are masked in listings ({maskPhone("+254712345678")}) and the full number is only used for the M-Pesa STK push.
        </Callout>
      </CommercialGate>
    </Screen>
  );
}
