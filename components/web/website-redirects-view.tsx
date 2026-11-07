"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { TableCard } from "@/components/ui/table";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { addRedirect, removeRedirect } from "@/lib/api/web";
import { websiteRedirects, type RedirectFixture } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";

/**
 * UX-WEB-006 — Redirects and aliases: rules with loop/conflict detection and
 * test results. Creating submits a tracked operation whose first step is the
 * loop/conflict validation.
 */
export function WebsiteRedirectsView({ siteId }: { siteId: string }) {
  const site = useMemo(() => db.websites.find((w) => w.id === siteId), [siteId]);
  const rules = useMemo(() => websiteRedirects.filter((r) => r.website_id === siteId), [siteId]);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId, list } = useOperationStream();
  const [addOpen, setAddOpen] = useState(false);
  const [match, setMatch] = useState("");
  const [destination, setDestination] = useState("");
  const [permanent, setPermanent] = useState("301");
  const [matchError, setMatchError] = useState<string | undefined>(undefined);
  const [removeTarget, setRemoveTarget] = useState<RedirectFixture | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ops = list.filter((o) => o.resource_ref.id === siteId && o.kind.startsWith("website.redirect."));
  const runningOp = ops.find((o) => o.status !== "succeeded" && o.status !== "failed");

  if (site === undefined) {
    return (
      <Screen id="UX-WEB-006" breadcrumbs={[{ label: "Websites", href: "/websites" }]}>
        <NotFoundInline what="website" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Websites", href: "/websites" },
    { label: site.title, href: `/websites/${site.id}` },
    { label: "Redirects" },
  ];

  const testRule = (m: string, d: string): string | null => {
    if (m.trim() === "") return "A match pattern is required (e.g. /old-path or http://…).";
    if (d.trim() === "") return "A destination is required — where should the request go?";
    if (m === d) return "Loop detected: the match pattern and destination are identical.";
    const overlapping = rules.find((r) => r.match === m);
    if (overlapping !== undefined) return `Conflict: rule ${overlapping.id} already matches this pattern.`;
    return null;
  };

  const doAdd = async () => {
    const problem = testRule(match, destination);
    setMatchError(problem ?? undefined);
    if (problem !== null) return;
    setSubmitting(true);
    try {
      const res = await addRedirect(site.id, site.name, match);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Redirect submitted", "The rule is validated against existing rules (loop + conflict) before nginx reloads.");
      setAddOpen(false);
      setMatch("");
      setDestination("");
    } catch {
      push("error", "Could not add redirect", "Try again — no rule was changed.");
    } finally {
      setSubmitting(false);
    }
  };

  const doRemove = async () => {
    if (removeTarget === null) return;
    try {
      const res = await removeRedirect(site.id, site.name, removeTarget.match);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("info", "Removal submitted", `${removeTarget.match} will stop redirecting once the job verifies.`);
    } catch {
      push("error", "Could not remove redirect", "Try again — the rule is still active.");
    } finally {
      setRemoveTarget(null);
    }
  };

  return (
    <Screen
      id="UX-WEB-006"
      breadcrumbs={crumbs}
      actions={
        <Button icon="plus" onClick={() => setAddOpen(true)}>
          Create
        </Button>
      }
    >
      {runningOp !== undefined && (
        <div className="mb-4">
          <PendingState operation={runningOp} />
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState
          icon="arrow-right"
          title="No redirect rules yet"
          body="Redirects send old addresses to new ones — http → https, www → apex, or moved pages. Every rule is loop- and conflict-checked before it goes live."
          action={{ label: "Create your first rule", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <TableCard<RedirectFixture>
          title="Redirect rules"
          caption="Redirect rules with loop and conflict detection and test results"
          rowKey={(r) => r.id}
          columns={[
            { key: "match", header: "Match", render: (r) => <span className="font-mono text-xs">{r.match}</span> },
            { key: "destination", header: "Destination", render: (r) => <span className="font-mono text-xs">{r.destination}</span> },
            { key: "permanent", header: "Type", render: (r) => <Chip tone="neutral">{r.permanent ? "301 permanent" : "302 temporary"}</Chip> },
            { key: "priority", header: "Priority", sortable: true, render: (r) => <span className="tabular-nums text-xs">{r.priority}</span> },
            {
              key: "test",
              header: "Test result",
              render: (r) => (
                <span className="min-w-0">
                  <Chip tone={r.test === "passed" ? "success" : r.test === "conflict" ? "danger" : "info"}>{r.test}</Chip>
                  {r.test_note !== undefined && <span className="mt-0.5 block max-w-56 text-xs text-ink-2">{r.test_note}</span>}
                </span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              render: (r) => (
                <Button size="sm" variant="ghost" icon="trash" onClick={() => setRemoveTarget(r)}>
                  <span>Remove</span>
                </Button>
              ),
            },
          ]}
          rows={rules}
        />
      )}

      <Card title="Loop & conflict detection" className="mt-4">
        <p className="text-sm text-ink-2">
          New rules are checked against every existing rule: identical match patterns conflict, and a rule
          whose destination is itself (directly or via a chain) is rejected before nginx reloads. The panel
          never claims a redirect works — the job runs a real request test and records the result above.
        </p>
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create redirect rule"
        description="Loop and conflict detection runs when the rule is submitted."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={doAdd} loading={submitting}>Submit rule</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Match" htmlFor="rdr-match" required error={matchError} hint="A path like /old-page(/.*)?$ or a full origin like http://example.com/$.">
            <Input id="rdr-match" value={match} onChange={(e) => setMatch(e.target.value)} className="font-mono text-xs" spellCheck={false} />
          </Field>
          <Field label="Destination" htmlFor="rdr-dest" required hint="Use $1 to reference captured groups from the match.">
            <Input id="rdr-dest" value={destination} onChange={(e) => setDestination(e.target.value)} className="font-mono text-xs" spellCheck={false} />
          </Field>
          <Field label="Type" htmlFor="rdr-type" hint="301 tells browsers and search engines the move is permanent.">
            <Select id="rdr-type" value={permanent} onChange={(e) => setPermanent(e.target.value)}>
              <option value="301">301 — permanent</option>
              <option value="302">302 — temporary</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={doRemove}
        title="Remove redirect rule"
        confirmLabel="Remove rule"
        body={
          <>
            Remove the rule <span className="font-mono">{removeTarget?.match}</span>? Requests that relied on
            it will get a 404 once the change verifies.
          </>
        }
      />
    </Screen>
  );
}
