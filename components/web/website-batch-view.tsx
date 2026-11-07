"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { EmptyState, Callout } from "@/components/ui/feedback";
import { cancelBatchOperation } from "@/lib/api/web";
import { db } from "@/lib/mock/data";
import { isTerminal } from "@/lib/operations";
import { formatRelative } from "@/lib/format";
import { jobHref } from "@/lib/job-routes";

/**
 * UX-WEB-020 — Batch jobs for site: builds, backups and transforms queued by
 * resource, shown as queued (never failed) with the honest "will run when
 * idle" copy. Cancel is best-effort and says so.
 */
export function WebsiteBatchView({ siteId }: { siteId: string }) {
  const site = useMemo(() => db.websites.find((w) => w.id === siteId), [siteId]);
  const { list } = useOperationStream();
  const { push } = useToast();

  const batchJobs = useMemo(
    () =>
      list.filter(
        (o) =>
          o.workload_category === "batch" &&
          (o.resource_ref.id === siteId || o.resource_ref.type === "backup") &&
          o.resource_ref.name !== undefined
      ),
    [list, siteId]
  );
  const jobsForSite = useMemo(
    () =>
      list.filter(
        (o) =>
          o.workload_category === "batch" &&
          (o.resource_ref.id === siteId ||
            db.backups.some((b) => b.id === o.resource_ref.id && b.resource_ref.id === siteId))
      ),
    [list, siteId]
  );
  const visible = jobsForSite.length > 0 ? jobsForSite : batchJobs.filter((o) => o.resource_ref.id === siteId);

  if (site === undefined) {
    return (
      <Screen id="UX-WEB-020" breadcrumbs={[{ label: "Websites", href: "/websites" }]}>
        <NotFoundInline what="website" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Websites", href: "/websites" },
    { label: site.title, href: `/websites/${site.id}` },
    { label: "Batch jobs" },
  ];

  const doCancel = async (opId: string, title: string) => {
    const res = await cancelBatchOperation(opId, title);
    if (res.cancelled) {
      push("info", "Cancellation requested", `${title} was cancelled. Best-effort: committed changes are not reversed.`);
    } else {
      push("info", "Already finished", `${title} reached a terminal state before cancellation could apply.`);
    }
  };

  return (
    <Screen
      id="UX-WEB-020"
      breadcrumbs={crumbs}
      actions={
        <ButtonLink href="/monitoring/batch" variant="secondary" icon="layers">
          View full queue
        </ButtonLink>
      }
    >
      <Callout tone="info" title="Batch workloads queue under site traffic — this is normal">
        Builds, backups and transforms run low-priority and yield to your websites. Queued is the honest
        state, not an error.
      </Callout>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon="layers"
          title="No batch jobs for this site"
          body="Backups, builds and image transforms for this site will appear here with their queue state. Everything here runs when your sites are idle."
          action={{ label: "Create a backup now", href: "/backups" }}
          secondaryAction={{ label: "Open the site", href: `/websites/${site.id}` }}
        />
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {visible.map((op) => {
            const terminal = isTerminal(op.status);
            return (
              <Card
                key={op.id}
                title={op.title}
                description={`${op.kind} · submitted ${formatRelative(op.created_at)}`}
                actions={
                  <>
                    {op.batch !== undefined && op.batch.queue_position !== undefined && <Chip tone="info">queue position {op.batch.queue_position}</Chip>}
                    {op.batch?.low_priority === true && !terminal && <Chip tone="neutral">low priority</Chip>}
                    {op.batch?.yielded === true && <Chip tone="warning">yielded to site traffic</Chip>}
                    <Link href={jobHref(op.id)} className="text-sm font-medium text-accent hover:underline">
                      Inspect
                    </Link>
                    {!terminal && (
                      <Button size="sm" variant="ghost" onClick={() => doCancel(op.id, op.title)}>
                        Cancel if supported
                      </Button>
                    )}
                  </>
                }
              >
                <p className="text-sm text-ink-2">
                  {op.status === "queued" && "Queued — will run when your websites are idle, usually within minutes."}
                  {op.status === "running" && "Running at reduced priority — it yields to site traffic."}
                  {op.status === "verifying" && "Finished — verifying the actual result before we claim success."}
                  {op.status === "succeeded" && "Succeeded and verified."}
                  {op.status === "failed" && (op.error?.detail ?? "Failed — the previous state is untouched.")}
                  {op.status === "cancelled" && "Cancelled before completion."}
                  {!["queued", "running", "verifying", "succeeded", "failed", "cancelled"].includes(op.status) &&
                    `Status: ${op.status}.`}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
