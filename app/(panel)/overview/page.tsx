"use client";

import React from "react";
import Link from "next/link";
import { db } from "@/lib/mock/data";
import { allServiceInstances, instanceHref } from "@/lib/mock/services";
import { useSession } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { CapabilityBanner } from "@/components/common/capability-banner";
import {
  AppChips,
  GettingStartedCard,
  PortfolioRow,
  PortfolioSection,
  ServiceChips,
  WebsiteChips,
  serviceMeta,
  siteStatusPill,
} from "@/components/overview/portfolio";
import { ButtonLink } from "@/components/ui/button";
import { Chip, StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";

/**
 * UX-OV-001 — Service portfolio: the primary surface for "manage what I
 * already have". Everything this installation runs, in three sections, one
 * honest row per workload.
 */
export default function OverviewPage() {
  const { firstRun } = useSession();
  const instances = allServiceInstances();

  return (
    <Screen
      id="UX-OV-001"
      breadcrumbs={[{ label: "Home", href: "/" }]}
      actions={
        <>
          <ButtonLink href="/websites/new" icon="plus">
            Add website
          </ButtonLink>
          <ButtonLink href="/apps/new" variant="secondary" icon="upload">
            Deploy app
          </ButtonLink>
          <ButtonLink href="/templates" variant="secondary" icon="box">
            Install template
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {firstRun && <GettingStartedCard />}

        <CapabilityBanner force />

        <PortfolioSection
          icon="globe"
          title="Websites"
          count={db.websites.length}
          empty={
            <EmptyState
              icon="globe"
              title="No websites yet"
              body="Your first site takes about two minutes: pick a domain (or a preview hostname), choose static or PHP, and the panel provisions it as a verified job."
              action={{ label: "Add website", href: "/websites/new" }}
            />
          }
        >
          {db.websites.map((w) => (
            <PortfolioRow
              key={w.id}
              href={`/websites/${w.id}`}
              pill={siteStatusPill(w)}
              pillAt={w.last_verified_at}
              title={w.title}
              chips={<WebsiteChips w={w} />}
              meta={w.primary_domain}
              usage={w.usage}
            />
          ))}
        </PortfolioSection>

        <PortfolioSection
          icon="cpu"
          title="Applications"
          count={db.applications.length}
          empty={
            <EmptyState
              icon="cpu"
              title="No applications yet"
              body="Deploy from Git or an upload: pick a runtime, set build and start commands, and the panel preflights the resource fit before anything runs."
              action={{ label: "Deploy app", href: "/apps/new" }}
            />
          }
        >
          {db.applications.map((a) => (
            <PortfolioRow
              key={a.id}
              href={`/apps/${a.id}`}
              pill={a.health === "healthy" ? "active" : a.health === "degraded" ? "degraded" : "unknown"}
              pillAt={a.last_verified_at}
              title={a.name}
              chips={<AppChips a={a} />}
              meta={`Observed ${formatRel(a.last_verified_at)} · RAM peak ${a.usage.ram_mb.peak} MB${a.usage.oom_events_7d > 0 ? ` · ${a.usage.oom_events_7d} OOM (7d)` : ""}`}
              usage={a.usage}
            />
          ))}
        </PortfolioSection>

        <PortfolioSection
          icon="box"
          title="Platform services"
          count={instances.length}
          empty={
            <EmptyState
              icon="box"
              title="No platform services yet"
              body="Storage buckets, transform pipelines, cache and search are installed from the template catalog. Each one runs as a container with its own health checks and usage."
              action={{ label: "Install template", href: "/templates" }}
              secondaryAction={{ label: "What can my VPS run?", href: "/overview/capabilities" }}
            />
          }
        >
          {instances.map((s) => {
            const href = instanceHref(s);
            return (
              <PortfolioRow
                key={s.id}
                href={href}
                pill={pillFor(s)}
                pillAt={s.usage.updated_at}
                title={s.name}
                chips={<ServiceChips s={s} />}
                meta={serviceMeta(s)}
                usage={s.usage}
                trailing={
                  href === null ? (
                    <Chip tone="accent">newly installed</Chip>
                  ) : (
                    <Icon name="chevron-right" size={16} className="shrink-0 text-ink-3" />
                  )
                }
              />
            );
          })}
        </PortfolioSection>

        <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 pb-2 text-sm">
          <Link href="/overview/usage" className="inline-flex items-center gap-1 text-accent hover:underline">
            Allocation and usage <Icon name="arrow-right" size={13} />
          </Link>
          <Link href="/overview/recommendations" className="inline-flex items-center gap-1 text-accent hover:underline">
            Upgrade recommendations <Icon name="arrow-right" size={13} />
          </Link>
          <Link href="/activity" className="inline-flex items-center gap-1 text-accent hover:underline">
            Activity and jobs <Icon name="arrow-right" size={13} />
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <StatusPill status={db.server.agent_connected ? "healthy" : "unknown"} />
            agent on {db.server.name} · {db.server.provider_label}
          </span>
        </div>
      </div>
    </Screen>
  );
}

import { serviceStatusPill } from "@/lib/mock/services";
import { formatRelative } from "@/lib/format";

function pillFor(s: ReturnType<typeof allServiceInstances>[number]) {
  return serviceStatusPill(s);
}

function formatRel(ts: string): string {
  return formatRelative(ts);
}
