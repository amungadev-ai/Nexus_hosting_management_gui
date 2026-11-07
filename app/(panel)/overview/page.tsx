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
          <ButtonLink href="/launch/web" icon="plus">
            Publish a project
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
      <div className="flex flex-col gap-5">
        <section className="nx-welcome-hero rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success"><span className="h-1.5 w-1.5 rounded-full bg-success"/> Workspace ready · Demo</div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your hosting, at a glance.</h2><p className="mt-2 max-w-xl text-sm text-ink-2">Everything you run, one place to manage it. Pick up where you left off or launch something new.</p></div><Link href="/launch/web" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink hover:bg-accent-hover"><Icon name="plus" size={16}/> Create something</Link></div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:"Websites",value:db.websites.length,icon:"globe" as const,href:"/websites"},{label:"Applications",value:db.applications.length,icon:"cpu" as const,href:"/apps"},{label:"Platform services",value:instances.length,icon:"cloud" as const,href:"/services"},{label:"Domains",value:db.domains.length,icon:"layers" as const,href:"/domains"}].map(metric=><Link href={metric.href} key={metric.label} className="nx-stat-card rounded-xl border border-line bg-canvas p-4 transition hover:border-accent"><div className="flex items-center justify-between text-ink-2"><span className="text-xs">{metric.label}</span><Icon name={metric.icon} size={16}/></div><div className="mt-3 text-3xl font-semibold tabular-nums">{metric.value}</div><span className="mt-1 inline-block text-xs text-accent">Manage →</span></Link>)}</div>
        </section>
        <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-3">{[{label:"Launch a website",detail:"Static, PHP or WordPress",href:"/launch/web",icon:"globe" as const},{label:"Deploy an application",detail:"Node.js, Python and more",href:"/apps/new",icon:"cpu" as const},{label:"Connect a domain",detail:"DNS, HTTPS and routing",href:"/domains/connect",icon:"layers" as const}].map(a=><Link key={a.label} href={a.href} className="nx-quick-action flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-accent hover:shadow-sm"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon name={a.icon} size={19}/></span><span className="min-w-0 flex-1"><strong className="block text-sm">{a.label}</strong><span className="text-xs text-ink-2">{a.detail}</span></span><Icon name="arrow-right" size={16} className="text-ink-3"/></Link>)}</section>
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
