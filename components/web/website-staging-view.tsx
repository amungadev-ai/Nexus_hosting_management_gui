"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { TableCard } from "@/components/ui/table";
import { ConfirmDialog, ImpactReview } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { createStaging, promoteStaging } from "@/lib/api/web";
import { websiteStaging } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";
import { formatRelative } from "@/lib/format";
import type { StagingFixture } from "@/lib/mock/web";

/**
 * UX-WEB-005 — Staging environments: staging copies, sync state and the
 * promotion impact review (DS-009) before promoting to production.
 */
export function WebsiteStagingView({ siteId }: { siteId: string }) {
  const site = useMemo(() => db.websites.find((w) => w.id === siteId), [siteId]);
  const copies = useMemo(() => websiteStaging.filter((s) => s.website_id === siteId), [siteId]);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId, list } = useOperationStream();
  const [creating, setCreating] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<StagingFixture | null>(null);
  const [confirmPromote, setConfirmPromote] = useState(false);

  const stagingOps = list.filter((o) => o.resource_ref.id === siteId && o.kind.startsWith("website.staging."));
  const runningOp = stagingOps.find((o) => o.status !== "succeeded" && o.status !== "failed");

  if (site === undefined) {
    return (
      <Screen id="UX-WEB-005" breadcrumbs={[{ label: "Websites", href: "/websites" }]}>
        <NotFoundInline what="website" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Websites", href: "/websites" },
    { label: site.title, href: `/websites/${site.id}` },
    { label: "Staging" },
  ];

  const doCreate = async () => {
    setCreating(true);
    try {
      const res = await createStaging(site.id, site.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Staging copy queued", "The copy is a batch job — it runs when your sites are idle, usually within minutes.");
    } catch {
      push("error", "Could not create staging", "Try again — nothing was created.");
    } finally {
      setCreating(false);
    }
  };

  const doPromote = async () => {
    if (promoteTarget === null) return;
    try {
      const res = await promoteStaging(promoteTarget.name, site.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Promotion accepted", `${promoteTarget.name} will be promoted to ${site.name} only after the health check passes. The previous release stays available.`);
    } catch {
      push("error", "Promotion was not accepted", "Try again — production is untouched.");
    } finally {
      setPromoteTarget(null);
      setConfirmPromote(false);
    }
  };

  return (
    <Screen
      id="UX-WEB-005"
      breadcrumbs={crumbs}
      actions={
        <Button icon="plus" onClick={doCreate} loading={creating}>
          Create staging copy
        </Button>
      }
    >
      {runningOp !== undefined && (
        <div className="mb-4">
          <PendingState operation={runningOp} />
        </div>
      )}

      {copies.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No staging copies for this site"
          body="A staging copy lets you test changes (new content, plugin updates) without touching production. Copies are batch jobs — they run when your sites are idle."
          action={{ label: "Create staging copy", onClick: doCreate }}
          secondaryAction={{ label: "Back to site", href: `/websites/${site.id}` }}
        />
      ) : (
        <TableCard<StagingFixture>
          title="Staging copies"
          caption="Staging copies, sync and promotion impact"
          rowKey={(s) => s.id}
          columns={[
            {
              key: "name",
              header: "Copy",
              render: (s) => (
                <span className="font-medium text-ink">
                  {s.name}
                  <span className="block font-mono text-xs text-ink-2">{s.url}</span>
                </span>
              ),
            },
            { key: "drift", header: "Sync state", render: (s) => <span className="text-xs text-ink-2">{s.drift}</span> },
            { key: "synced_at", header: "Last synced", render: (s) => <span className="whitespace-nowrap text-xs text-ink-2">{formatRelative(s.synced_at)}</span> },
            {
              key: "actions",
              header: "Actions",
              render: (s) => (
                <span className="flex flex-wrap items-center gap-2">
                  <Chip tone={s.drift.startsWith("In sync") ? "success" : "warning"}>
                    {s.drift.startsWith("In sync") ? "in sync" : "behind"}
                  </Chip>
                  <Button size="sm" variant="secondary" onClick={() => { setPromoteTarget(s); setConfirmPromote(true); }}>
                    Promote
                  </Button>
                </span>
              ),
            },
          ]}
          rows={copies}
        />
      )}

      <Card title="How promotion works" className="mt-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>Promotion diffs staging against production, then swaps the release symlink atomically.</li>
          <li>Production is health-checked before the panel reports success — a finished file copy is not a promoted site.</li>
          <li>The previous production release stays available for instant rollback.</li>
        </ul>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
          <StatusPill status="succeeded" /> promotions show as verified with a timestamp on the job page.
        </p>
      </Card>

      <ImpactReview
        open={confirmPromote && promoteTarget !== null}
        onClose={() => { setConfirmPromote(false); setPromoteTarget(null); }}
        onSubmit={doPromote}
        title={`Promote ${promoteTarget?.name ?? ""} to ${site.title}`}
        submitLabel="Promote to production"
        impact={{
          before: `Production serves the current release of ${site.name} (${site.primary_domain}).`,
          after: `Production serves the staging copy ${promoteTarget?.name ?? ""}. ${promoteTarget?.drift ?? ""}`,
          affectedResources: [site.name, promoteTarget?.name ?? ""].filter((r) => r !== ""),
          downtimeEstimate: "None expected — symlink swap is atomic; reload is graceful.",
          reversibility: "Fully reversible — the previous release is retained for instant rollback.",
        }}
      >
        Review the sync state above: promoting a copy that is behind production overwrites newer content.
      </ImpactReview>
    </Screen>
  );
}
