"use client";

import React from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill, Chip } from "@/components/ui/badge";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { useNow, useOperationStream } from "@/components/providers";
import { connectedIntegrations, scheduledJobs, webhookDeliveries, webhookEndpoints } from "@/lib/mock/automation";
import { isTerminal } from "@/lib/operations";
import { formatRelative } from "@/lib/format";

/**
 * UX-AUTO-001 /automation — Automation overview: jobs, triggers, rules and
 * failures, with cards into schedules, webhooks, workflows, integrations.
 */
export default function AutomationPage() {
  const now = useNow();
  const jobs = useFixture(() => scheduledJobs);
  const webhooks = useFixture(() => webhookEndpoints);
  const deliveries = useFixture(() => webhookDeliveries);
  const integrations = useFixture(() => connectedIntegrations);
  const { list } = useOperationStream();

  const failedAutomations = (jobs ?? []).filter((j) => j.last_outcome === "failed" || j.last_outcome === "missed");
  const failedDeliveries = (deliveries ?? []).filter((d) => d.status === "failed");
  const recentOps = list.filter((op) => op.kind.startsWith("automation.") || op.kind.startsWith("webhook.") || op.kind.startsWith("integration.")).slice(0, 4);

  return (
    <Screen
      id="UX-AUTO-001"
      breadcrumbs={[{ label: "Automation" }]}
      actions={
        <ButtonLink href="/automation/workflows/new" icon="plus">
          New workflow
        </ButtonLink>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Scheduled jobs" description="Cron jobs with next/last runs">
          <p className="text-2xl font-semibold text-ink">{jobs?.length ?? "—"}</p>
          <p className="mt-1 text-xs text-ink-3">
            {(jobs ?? []).filter((j) => j.state === "active").length} active · {(jobs ?? []).filter((j) => j.state === "paused").length} paused
          </p>
          <div className="mt-3">
            <ButtonLink href="/automation/schedules" variant="secondary" size="sm">
              Open schedules
            </ButtonLink>
          </div>
        </Card>
        <Card title="Webhooks" description="Outbound events to your endpoints">
          <p className="text-2xl font-semibold text-ink">{webhooks?.length ?? "—"}</p>
          <p className="mt-1 text-xs text-ink-3">
            {(deliveries ?? []).length} deliveries tracked · {failedDeliveries.length} failed
          </p>
          <div className="mt-3">
            <ButtonLink href="/automation/webhooks" variant="secondary" size="sm">
              Open webhooks
            </ButtonLink>
          </div>
        </Card>
        <Card title="Integrations" description="Connected services and permissions">
          <p className="text-2xl font-semibold text-ink">{(integrations ?? []).filter((i) => i.state === "connected").length}</p>
          <p className="mt-1 text-xs text-ink-3">connected of {(integrations ?? []).length} catalogued</p>
          <div className="mt-3">
            <ButtonLink href="/integrations" variant="secondary" size="sm">
              Open integrations
            </ButtonLink>
          </div>
        </Card>
        <Card title="Developer API" description="Versioned REST + tokens">
          <p className="text-sm text-ink-2 mt-1">Explore /api/v1 endpoints and scopes; tokens are managed in settings.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href="/developer/api" variant="secondary" size="sm">
              API explorer
            </ButtonLink>
            <ButtonLink href="/settings/api-tokens" variant="ghost" size="sm">
              API tokens
            </ButtonLink>
          </div>
        </Card>
      </div>

      {(failedAutomations.length > 0 || failedDeliveries.length > 0) && (
        <Callout tone="warning" className="mt-4" title="Failures needing attention">
          <ul className="mt-1 flex list-none flex-col gap-1 p-0">
            {failedAutomations.map((j) => (
              <li key={j.id}>
                <Link href="/automation/schedules" className="text-accent hover:underline">{j.name}</Link> — last run {j.last_outcome} ({formatRelative(j.last_run_at, now)})
              </li>
            ))}
            {failedDeliveries.map((d) => (
              <li key={d.id}>
                <Link href="/automation/webhooks" className="text-accent hover:underline">{d.event_type}</Link> — {d.detail}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <Card title="Recent automation operations" className="mt-4" description="Durable record of everything this module submitted">
        {recentOps.length === 0 ? (
          <p className="text-sm text-ink-2">
            No automation operations yet — create a schedule or webhook and they appear here,
            tracked in the operation tray.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {recentOps.map((op) => (
              <li key={op.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{op.title}</p>
                  <p className="font-mono text-xs text-ink-3">{op.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone="neutral">{op.kind}</Chip>
                  <StatusPill
                    status={op.status === "succeeded" ? "succeeded" : isTerminal(op.status) ? "failed" : op.status === "queued" ? "queued" : "running"}
                  />
                  <Link href={`/activity/jobs/${op.id}`} className="text-xs text-accent hover:underline">
                    Inspect
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-ink-3">
        The plugin marketplace is a v2 phase surface — it renders an honest gate at{" "}
        <Link href="/plugins" className="text-accent hover:underline">/plugins</Link> instead of
        hiding; the v1 extension mechanism is the template catalog.
      </p>
      {jobs === null && <SkeletonTable rows={2} cols={3} className="mt-2" />}
    </Screen>
  );
}
