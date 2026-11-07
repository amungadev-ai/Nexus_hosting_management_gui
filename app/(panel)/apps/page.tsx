"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table";
import { Chip, StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { ListSkeleton, useFixtureList } from "@/components/web/web-bits";
import { listApplications } from "@/lib/api/web";
import { deploymentsForApp } from "@/lib/mock/web";
import type { Application } from "@/lib/types";
import { formatRelative } from "@/lib/format";

/**
 * UX-WEB-007 — Applications list: runtime, process, deployments and health.
 * The New app CTA navigates to the wizard, which renders the honest
 * capability-unavailable gate on profiles that cannot run Node apps.
 */
export default function ApplicationsListPage() {
  const apps = useFixtureList(listApplications);
  const router = useRouter();
  const [category, setCategory] = useState<"all" | "serving" | "batch">("all");

  const rows = useMemo(() => {
    if (apps === null) return null;
    return category === "all" ? apps : apps.filter((a) => a.category === category);
  }, [apps, category]);

  return (
    <Screen
      id="UX-WEB-007"
      actions={
        <ButtonLink href="/apps/new" icon="plus">
          New app
        </ButtonLink>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by workload category">
        {(["all", "serving", "batch"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={
              "rounded-control border px-2.5 py-1 text-xs font-medium transition-colors " +
              (category === c ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:text-ink")
            }
          >
            {c === "all" ? "All apps" : c === "serving" ? "Serving" : "Batch"}
          </button>
        ))}
      </div>

      {rows === null || apps === null ? (
        <ListSkeleton rows={3} cols={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="cpu"
          title={apps.length === 0 ? "No applications yet" : "No applications in this category"}
          body={
            apps.length === 0
              ? "Deploy your first app from Git or an upload: runtime, build and start commands with health checks. On smaller VPS profiles the wizard shows honestly whether Node fits."
              : "Switch the filter to see your other applications."
          }
          action={{ label: "New app", href: "/apps/new" }}
          secondaryAction={apps.length === 0 ? { label: "What can my VPS run?", href: "/overview/capabilities" } : { label: "Show all", onClick: () => setCategory("all") }}
        />
      ) : (
        <TableCard<Application>
          title="Applications"
          caption="Applications with runtime, process, deployments and health"
          rowKey={(a) => a.id}
          onRowClick={(a) => router.push(`/apps/${a.id}`)}
          columns={[
            {
              key: "name",
              header: "Application",
              sortable: true,
              className: "sticky left-0 bg-surface",
              render: (a) => (
                <Link href={`/apps/${a.id}`} className="font-medium text-accent hover:underline">
                  {a.name}
                </Link>
              ),
            },
            {
              key: "runtime",
              header: "Runtime",
              render: (a) => (
                <span className="whitespace-nowrap text-sm text-ink">
                  {a.runtime === "node" ? "Node.js" : a.runtime === "php" ? "PHP" : "Python"} {a.runtime_version}
                </span>
              ),
            },
            {
              key: "category",
              header: "Category",
              render: (a) => (
                <Chip tone={a.category === "batch" ? "info" : "neutral"}>
                  {a.category === "batch" ? "batch — queues under site traffic" : "serving"}
                </Chip>
              ),
            },
            {
              key: "health",
              header: "Status",
              render: (a) => (
                <StatusPill status={a.status === "active" ? (a.health === "healthy" ? "healthy" : a.health === "degraded" ? "degraded" : "unknown") : "provisioning"} at={a.last_verified_at} />
              ),
            },
            {
              key: "deployments",
              header: "Deployments",
              render: (a) => {
                const deps = deploymentsForApp(a.id);
                return deps.length > 0 ? (
                  <Link href={`/apps/${a.id}/deployments`} className="text-sm text-accent hover:underline">
                    {deps.length} recent
                  </Link>
                ) : (
                  <span className="text-xs text-ink-3">None recorded</span>
                );
              },
            },
            {
              key: "created_at",
              header: "Created",
              sortable: true,
              render: (a) => <span className="whitespace-nowrap text-xs text-ink-2">{formatRelative(a.created_at)}</span>,
            },
          ]}
          rows={rows}
        />
      )}

      <p className="mt-3 text-xs text-ink-3">
        Batch apps (like image workers) are first-class: they queue under serving contention instead of slowing your sites.
      </p>
    </Screen>
  );
}
