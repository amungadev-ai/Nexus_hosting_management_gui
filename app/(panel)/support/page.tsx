"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/mock/data";
import { tickets as ticketFixtures, type Ticket } from "@/lib/mock/support";
import { createSupportGrant, createTicket, revokeSupportGrant, type GrantScope } from "@/lib/api/support";
import { withLatency } from "@/lib/api/core";
import { formatRelative, formatUtc } from "@/lib/format";
import { useNow, useSession, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { Modal, Drawer, ConfirmDialog } from "@/components/ui/overlay";
import { Callout, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icons";
import { TicketStatusPill } from "@/components/support/shared";

/**
 * UX-SUP-001 /support — support center. Guides and channels link to the help
 * center; tickets come from the support fixtures and new tickets go through
 * lib/api/support.ts (audit-recorded). The "Support access" section demos the
 * DS-019 grant: granting lights the persistent banner via the session
 * (setSupportAccess) and writes a support-context audit entry.
 */

const TOPICS: { icon: IconName; title: string; body: string; href: string }[] = [
  {
    icon: "file-text",
    title: "Guides & docs",
    body: "Step-by-step flows: first website, domain connection, backups, PHP and Node runtimes.",
    href: "/help",
  },
  {
    icon: "users",
    title: "Community forum",
    body: "Ask other self-hosters; the 'What can my VPS run?' article explains capability sets in plain language.",
    href: "/help",
  },
  {
    icon: "activity",
    title: "Diagnostics & safe data sharing",
    body: "Diagnostics read operation outcomes and logs with secrets redacted — you choose what a ticket shares.",
    href: "/activity",
  },
];

const CATEGORIES = ["Websites & deployments", "Migrations", "Backups & recovery", "Billing & plan", "Other"] as const;

const CHANNEL_LABEL: Record<Ticket["channel"], string> = {
  panel: "Panel",
  email: "Email",
};

export default function SupportCenterPage() {
  const now = useNow();
  const { push } = useToast();
  const { supportAccess, setSupportAccess } = useSession();
  const [query, setQuery] = useState("");
  // null = still loading (honest skeleton); fixture snapshot afterwards.
  const [rows, setRows] = useState<Ticket[] | null>(null);

  React.useEffect(() => {
    let live = true;
    withLatency(() => [...ticketFixtures]).then((v) => {
      if (live) setRows(v);
    });
    return () => {
      live = false;
    };
  }, []);

  const [ticketOpen, setTicketOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Websites & deployments");
  const [description, setDescription] = useState("");
  const [shareDiagnostics, setShareDiagnostics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);

  const [grantOpen, setGrantOpen] = useState(false);
  const [engineerId, setEngineerId] = useState(
    db.users.find((u) => u.role_labels.includes("support"))?.id ?? ""
  );
  const [scope, setScope] = useState<GrantScope>("read-only");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<"2" | "24">("2");
  const [grantError, setGrantError] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows ?? [];
    if (q === "") return base;
    return base.filter(
      (t) => t.subject.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const submitTicket = () => {
    setFormError(null);
    if (subject.trim().length < 4) {
      setFormError("Give the ticket a short subject so support can route it.");
      return;
    }
    if (description.trim().length < 10) {
      setFormError("Describe the problem in a sentence or two — what you tried and what happened.");
      return;
    }
    setSubmitting(true);
    try {
      const ticket = createTicket({
        subject: subject.trim(),
        body: `Category: ${category}\n\n${description.trim()}`,
        share_diagnostics: shareDiagnostics,
      });
      setRows([...ticketFixtures]);
      setTicketOpen(false);
      setSubject("");
      setDescription("");
      setShareDiagnostics(false);
      push(
        "success",
        "Ticket created",
        `${ticket.id} is open — replies arrive in the panel and by email. This acknowledgement is not a resolution yet.`
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "The ticket could not be created. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitGrant = () => {
    setGrantError(null);
    const engineer = db.users.find((u) => u.id === engineerId);
    if (engineer === undefined) {
      setGrantError("Choose the support engineer who needs access.");
      return;
    }
    if (reason.trim().length < 8) {
      setGrantError("Add a short justification — it is stored in the audit chain next to the grant.");
      return;
    }
    try {
      createSupportGrant({
        engineer_name: engineer.display_name,
        scope,
        reason: reason.trim(),
        hours: duration === "2" ? 2 : 24,
      });
      setSupportAccess(true);
      setGrantOpen(false);
      setReason("");
      push(
        "success",
        "Support access granted",
        `${engineer.display_name} now has ${scope} access. The persistent banner shows the scope and expiry until you revoke it.`
      );
    } catch (e) {
      setGrantError(e instanceof Error ? e.message : "The grant could not be created.");
    }
  };

  const revoke = () => {
    revokeSupportGrant();
    setSupportAccess(false);
    setRevokeOpen(false);
    push("info", "Support access revoked", "The banner is gone and the revocation is recorded in the audit chain.");
  };

  return (
    <Screen
      id="UX-SUP-001"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Support" }]}
      actions={
        <Button icon="message-square" onClick={() => setTicketOpen(true)}>
          Open a ticket
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Guides & channels */}
        <section aria-labelledby="support-channels">
          <h2 id="support-channels" className="text-sm font-semibold text-ink">
            Guides &amp; channels
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {TOPICS.map((t) => (
              <Link
                key={t.title}
                href={t.href}
                className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-accent"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-info-soft text-info">
                  <Icon name={t.icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    {t.title}
                    <Icon name="arrow-right" size={12} className="shrink-0 text-ink-3" />
                  </span>
                  <span className="mt-1 block text-xs text-ink-2">{t.body}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent tickets */}
        <section aria-labelledby="recent-tickets">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="recent-tickets" className="text-sm font-semibold text-ink">
              Recent tickets
            </h2>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search tickets by subject or ID"
              aria-label="Search tickets"
              className="w-full sm:w-72"
            />
          </div>
          <div className="mt-3">
            {rows === null ? (
              <SkeletonTable rows={3} cols={4} />
            ) : (
              <DataTable
                caption="Recent support tickets"
                rowKey={(t) => t.id}
                rows={filtered}
                onRowClick={(t) => setOpenTicket(t)}
                columns={[
                  { key: "subject", header: "Subject", className: "sticky left-0 bg-surface", sortable: true },
                  { key: "id", header: "Ticket", render: (t) => <span className="font-mono text-xs text-ink-3">{t.id}</span> },
                  { key: "status", header: "Status", render: (t) => <TicketStatusPill status={t.status} /> },
                  {
                    key: "channel",
                    header: "Channel",
                    render: (t) => <Chip tone={t.channel === "panel" ? "accent" : "neutral"}>{CHANNEL_LABEL[t.channel]}</Chip>,
                  },
                  {
                    key: "updated_at",
                    header: "Updated",
                    render: (t) => (
                      <span className="whitespace-nowrap text-xs text-ink-3" title={formatUtc(t.updated_at)}>
                        {formatRelative(t.updated_at, now)}
                      </span>
                    ),
                  },
                ]}
                emptyState={
                  <EmptyState
                    icon="message-square"
                    title={query === "" ? "No tickets yet" : "No tickets match your search"}
                    body={
                      query === ""
                        ? "If guides and troubleshooting don't solve it, open a ticket — support replies in the panel and by email."
                        : "Try a different subject or the ticket ID (looks like tkt_01J…)."
                    }
                    action={query === "" ? { label: "Open a ticket", onClick: () => setTicketOpen(true) } : undefined}
                    secondaryAction={query === "" ? { label: "Browse guides", href: "/help" } : undefined}
                  />
                }
              />
            )}
          </div>
        </section>

        {/* Support access (DS-019 demo) */}
        <section aria-labelledby="support-access">
          <h2 id="support-access" className="text-sm font-semibold text-ink">
            Support access
          </h2>
          <Card
            className="mt-3"
            title="Time-limited, scoped access for support engineers"
            description="A grant shows a persistent banner with scope, actor, reason and expiry while it is live. Every action taken under the grant is audited with that context."
          >
            {supportAccess ? (
              <div className="flex flex-col gap-3">
                <Callout tone="warning" title="Support access is active right now">
                  {db.supportGrant.actor} — {db.supportGrant.reason} ({db.supportGrant.scope}). Expires{" "}
                  {formatUtc(db.supportGrant.expires_at)} ({formatRelative(db.supportGrant.expires_at, now)}).
                  Every action under this grant is written to the audit chain.
                </Callout>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="destructive" icon="lock" onClick={() => setRevokeOpen(true)}>
                    Revoke support access
                  </Button>
                  <Link href="/audit" className="text-sm font-medium text-accent hover:underline">
                    See grant events in the audit trail
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ink-2">
                  No support access is active. Granting access is revocable at any time and never
                  includes passwords or private keys — the engineer sees exactly what the banner says.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button icon="shield" onClick={() => setGrantOpen(true)}>
                    Grant support access
                  </Button>
                  <Link href="/settings/support-access" className="text-sm font-medium text-accent hover:underline">
                    Manage grants in Settings → Support access
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>

      {/* Open a ticket modal */}
      <Modal
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        title="Open a support ticket"
        description="Support replies in the panel and by email. Share only what you're comfortable with — diagnostics are always redacted."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTicketOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitTicket} loading={submitting} icon="mail">
              Create ticket
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Subject" htmlFor="ticket-subject" required error={formError !== null && subject.trim().length < 4 ? formError : undefined}>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Nightly backup moves kilishop to queued"
              autoComplete="off"
            />
          </Field>
          <Field label="Category" htmlFor="ticket-category" hint="Routing only — it does not change who can see the ticket.">
            <Select id="ticket-category" value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Description"
            htmlFor="ticket-description"
            required
            error={formError !== null && description.trim().length < 10 ? formError : undefined}
            hint="What you expected, what happened, and when it started. Never paste passwords or private keys."
          >
            <Textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Since this morning the kilishop backup shows 'queued' instead of running…"
            />
          </Field>
          {formError !== null && subject.trim().length >= 4 && description.trim().length >= 10 && (
            <Callout tone="danger" title="Could not create the ticket">
              {formError}
            </Callout>
          )}
          <Checkbox
            checked={shareDiagnostics}
            onChange={setShareDiagnostics}
            label="Attach recent diagnostics"
            description="Recent operation outcomes for this organization, with secrets and file paths redacted. You can see exactly what was shared in the ticket thread."
          />
        </div>
      </Modal>

      {/* Ticket thread drawer */}
      <Drawer
        open={openTicket !== null}
        onClose={() => setOpenTicket(null)}
        title={openTicket?.subject ?? "Ticket"}
      >
        {openTicket !== null && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <TicketStatusPill status={openTicket.status} />
              <Chip tone="accent">{CHANNEL_LABEL[openTicket.channel]}</Chip>
              <span className="font-mono text-xs text-ink-3">{openTicket.id}</span>
            </div>
            <ol className="flex list-none flex-col gap-3 p-0">
              {openTicket.messages.map((m, i) => (
                <li key={i} className="rounded-card border border-line bg-surface-2 p-3">
                  <p className="text-xs font-medium text-ink">
                    {m.author} · <span className="font-normal text-ink-3">{formatUtc(m.at)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{m.body}</p>
                </li>
              ))}
            </ol>
            <p className="text-xs text-ink-3">
              Replies arrive by email and in the panel. The prototype does not send new messages from
              the ticket drawer — open a ticket above and support picks it up from there.
            </p>
          </div>
        )}
      </Drawer>

      {/* Grant modal */}
      <Modal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="Grant support access"
        description="The grant activates the persistent DS-019 banner and is recorded in the audit chain with your justification."
        footer={
          <>
            <Button variant="secondary" onClick={() => setGrantOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitGrant} icon="shield">
              Grant access
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Support engineer" htmlFor="grant-engineer" error={grantError !== null && engineerId === "" ? grantError : undefined}>
            <Select id="grant-engineer" value={engineerId} onChange={(e) => setEngineerId(e.target.value)}>
              {db.users
                .filter((u) => u.role_labels.includes("support"))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.email})
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Scope" htmlFor="grant-scope" hint="Read-only can see everything but change nothing; extended adds safe recovery actions.">
            <Select id="grant-scope" value={scope} onChange={(e) => setScope(e.target.value as GrantScope)}>
              <option value="read-only">Read-only</option>
              <option value="extended">Extended (safe recovery actions)</option>
            </Select>
          </Field>
          <Field label="Justification" htmlFor="grant-reason" required error={grantError !== null && reason.trim().length < 8 ? grantError : undefined} hint="Ticket number and reason — this text appears in the banner and the audit chain.">
            <Textarea
              id="grant-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ticket tkt_01J… — investigate nightly backup queueing"
            />
          </Field>
          <Field label="Expires after" htmlFor="grant-duration">
            <Select id="grant-duration" value={duration} onChange={(e) => setDuration(e.target.value as "2" | "24")}>
              <option value="2">2 hours</option>
              <option value="24">24 hours</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onConfirm={revoke}
        title="Revoke support access?"
        confirmLabel="Revoke access"
        destructive
        body={
          <>
            <p>
              {db.supportGrant.actor} loses access immediately, including any open panel session under
              the grant. The banner disappears and the revocation is written to the audit chain.
            </p>
            <p className="mt-2">Work already performed under the grant stays in the audit trail.</p>
          </>
        }
      />
    </Screen>
  );
}
