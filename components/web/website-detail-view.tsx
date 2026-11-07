"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/common/screen";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { LiveStatusLine, NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { JobLink, KindChip } from "@/components/web/web-bits";
import { deleteWebsite, deployWebsiteNow } from "@/lib/api/web";
import { db } from "@/lib/mock/data";
import { formatDateTime, formatRelative } from "@/lib/format";
import { jobHref } from "@/lib/job-routes";

/**
 * UX-WEB-003 — Website overview: observed health, URLs, resource usage and
 * recent jobs with the live status line (DS-025). Tabs: Overview (with the
 * DS-022 allocation strip) / Deployments / Settings. Actions: Deploy now,
 * Delete (typed confirmation naming the exact target).
 */
export function WebsiteDetailView({ siteId }: { siteId: string }) {
  const router = useRouter();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const site = useMemo(() => db.websites.find((w) => w.id === siteId), [siteId]);
  const [tab, setTab] = useState("overview");
  const [deploying, setDeploying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const recentJobs = useMemo(
    () => db.operations.filter((o) => o.resource_ref.id === siteId).slice(0, 4),
    [siteId]
  );
  const siteBinds = useMemo(() => db.domains.filter((d) => d.website_id === siteId), [siteId]);

  if (site === undefined) {
    return (
      <Screen id="UX-WEB-003" breadcrumbs={[{ label: "Websites", href: "/websites" }]}>
        <NotFoundInline what="website" />
      </Screen>
    );
  }

  const healthStatus = site.status === "active" ? (site.health === "healthy" ? "healthy" : site.health === "degraded" ? "degraded" : "unknown") : "provisioning";

  const deployNow = async () => {
    setDeploying(true);
    try {
      const res = await deployWebsiteNow(site.id, site.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Deploy accepted", `Deploy of ${site.name} is queued — the current release keeps serving until the new one verifies.`);
    } catch {
      push("error", "Deploy was not accepted", "The request failed before a job was created. Try again.");
    } finally {
      setDeploying(false);
    }
  };

  const doDelete = async () => {
    try {
      const res = await deleteWebsite(site.id, site.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("info", "Deletion job created", `${site.name} will be removed only after the job verifies. A retention snapshot is taken first.`);
      router.push("/websites");
    } catch {
      push("error", "Could not start deletion", "Try again — nothing has been removed.");
    }
  };

  const pendingOp =
    site.pending_operation_id !== undefined
      ? db.operations.find((o) => o.id === site.pending_operation_id)
      : undefined;

  return (
    <Screen
      id="UX-WEB-003"
      breadcrumbs={[{ label: "Websites", href: "/websites" }, { label: site.title }]}
      actions={
        <>
          <Button icon="upload" onClick={deployNow} loading={deploying}>
            Deploy now
          </Button>
          <Button variant="destructive" icon="trash" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusPill status={healthStatus} at={site.last_verified_at} />
        <KindChip kind={site.kind} />
        {site.kind === "php" && site.php_version !== undefined && <Chip tone="neutral">PHP {site.php_version}</Chip>}
        <LiveStatusLine at={site.last_verified_at} label={`Health of ${site.primary_domain}`} />
      </div>

      {pendingOp !== undefined && (
        <div className="mb-4">
          <PendingState operation={pendingOp}>
            <JobLink operationId={pendingOp.id} />
          </PendingState>
        </div>
      )}

      <AllocationStrip usage={site.usage} />

      <Tabs
        className="mt-6"
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "deployments", label: "Deployments", badge: recentJobs.filter((o) => o.kind === "website.deploy").length },
          { id: "settings", label: "Settings" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Addresses">
            <KeyValue
              items={[
                { label: "Primary domain", value: <Link href="/domains" className="text-accent hover:underline">{site.primary_domain}</Link>, mono: true },
                { label: "Serves", value: <span className="font-mono text-xs">https://{site.primary_domain}</span> },
                {
                  label: "DNS",
                  value:
                    siteBinds.length > 0 ? (
                      <Link href={`/domains/${siteBinds[0].id}/dns-guidance`} className="text-accent hover:underline">
                        Guidance records (view / check propagation)
                      </Link>
                    ) : (
                      "No domain attached yet"
                    ),
                },
                { label: "Created", value: formatDateTime(site.created_at) },
              ]}
            />
          </Card>
          <Card title="Recent jobs" description="Every change runs as a tracked operation — completion is only claimed once verified.">
            {recentJobs.length === 0 ? (
              <EmptyState
                icon="activity"
                title="No jobs yet"
                body="Deploys, config applies and backups appear here with their verified outcome."
                action={{ label: "Deploy now", onClick: deployNow }}
              />
            ) : (
              <ul className="flex list-none flex-col gap-3 p-0">
                {recentJobs.map((op) => (
                  <li key={op.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-b-0">
                    <span className="min-w-0 text-sm text-ink">
                      <Link href={jobHref(op.id)} className="font-medium text-accent hover:underline">
                        {op.title}
                      </Link>
                      <span className="ml-2 text-xs text-ink-3">{formatRelative(op.created_at)}</span>
                    </span>
                    <JobLink operationId={op.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "deployments" && (
        <div className="mt-4">
          <Card title="Deployments" description="Static and PHP sites deploy by release — every deploy keeps the previous release until the new one verifies.">
            {recentJobs.filter((o) => o.kind.startsWith("website.")).length === 0 ? (
              <EmptyState
                icon="upload"
                title="No deploys recorded"
                body="Use “Deploy now” to release the current content, or upload a new archive from your computer."
                action={{ label: "Deploy now", onClick: deployNow }}
              />
            ) : (
              <ul className="flex list-none flex-col gap-3 p-0">
                {recentJobs
                  .filter((o) => o.kind.startsWith("website."))
                  .map((op) => (
                    <li key={op.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-b-0">
                      <span className="min-w-0 text-sm">
                        <Link href={jobHref(op.id)} className="font-medium text-accent hover:underline">
                          {op.title}
                        </Link>
                        <span className="block text-xs text-ink-3">
                          {op.kind} · {formatRelative(op.created_at)}
                        </span>
                      </span>
                      <JobLink operationId={op.id} />
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "settings" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card
            title="Configuration"
            description="Document root, redirects, PHP/HTTP settings and staging."
            actions={
              <ButtonLink href={`/websites/${site.id}/settings`} size="sm" variant="secondary">
                Open settings
              </ButtonLink>
            }
          >
            <KeyValue
              items={[
                { label: "Runtime", value: site.kind === "static" ? "Static files" : site.kind === "php" ? `PHP ${site.php_version ?? ""}` : "Node.js" },
                { label: "Redirects", value: <Link href={`/websites/${site.id}/redirects`} className="text-accent hover:underline">Manage redirects and aliases</Link> },
                { label: "Staging", value: <Link href={`/websites/${site.id}/staging`} className="text-accent hover:underline">Staging environments</Link> },
                { label: "HTTPS policy", value: <Link href={`/websites/${site.id}/https`} className="text-accent hover:underline">Redirect, HSTS, TLS modes</Link> },
                { label: "Capabilities", value: <Link href={`/websites/${site.id}/capabilities`} className="text-accent hover:underline">What this site can and cannot do</Link> },
              ]}
            />
          </Card>
          <Card title="Danger zone" description="Deletion is a tracked job with a retention snapshot — but it is still destructive.">
            <p className="text-sm text-ink-2">
              Deleting <span className="font-medium text-ink">{site.name}</span> removes the web root, the nginx
              site config and releases the TLS certificate. Files stay in the retention snapshot for the policy window.
            </p>
            <CardSection>
              <Button variant="destructive" icon="trash" onClick={() => setConfirmDelete(true)}>
                Delete website {site.name}
              </Button>
            </CardSection>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title={`Delete website ${site.name}`}
        confirmLabel={`Delete ${site.name}`}
        destructive
        typedConfirmation={site.name}
        body={
          <>
            <p>
              This deletes <strong>{site.title}</strong> ({site.primary_domain}) — the web root, nginx config and
              TLS certificate. The site stops resolving once the job completes.
            </p>
            <p className="mt-2">
              A retention snapshot is taken first; recovery from it is possible during the retention window.
              This cannot be undone after that window.
            </p>
          </>
        }
      />
    </Screen>
  );
}
