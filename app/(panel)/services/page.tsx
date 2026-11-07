"use client";

import React from "react";
import Link from "next/link";
import { allServiceInstances, categoryLabel, instanceHref, serviceStatusPill, templateForKey } from "@/lib/mock/services";
import type { ServiceInstance, TemplateCategory } from "@/lib/types";
import { useCapability } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { UnavailableState } from "@/components/common/states";
import { PortfolioRow, PortfolioSection, ServiceChips, serviceMeta } from "@/components/overview/portfolio";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";

/**
 * UX-SVC-001 — Platform services overview: provisioned services grouped by
 * family, health + usage per row. On profiles where Docker/storage cannot
 * run, the honest unavailable state explains why — but existing instances
 * still render (gate the actions, show the data).
 */
const CATEGORY_ORDER: TemplateCategory[] = ["storage", "transform", "cache", "search", "queue", "delivery"];

const EMPTY_COPY: Record<TemplateCategory, string> = {
  storage: "No buckets yet — S3-compatible storage for media, backups and exports.",
  transform: "No transform pipeline yet — resize/convert images as a batch workload that yields to site traffic.",
  cache: "No cache instance yet — Redis speeds up WordPress and app session handling.",
  search: "No search instance yet — Meilisearch adds typo-tolerant search to your sites.",
  queue: "No queue instance yet — queue templates are planned; workflows can use n8n today.",
  delivery: "Delivery (Caddy cache) is configured per website rather than as an instance — delivery templates are planned.",
  self_hosted_app: "No self-hosted app instance yet — browse the catalog and provision one from its template page.",
  database: "No database instance yet — database templates provision once Docker capacity is available.",
};

export default function ServicesPage() {
  const storage = useCapability("service.storage");
  const instances = allServiceInstances();
  const apps = instances.filter((s) => {
    const cat = templateForKey(s.template_key)?.category;
    return cat === "self_hosted_app" || cat === "database";
  });

  return (
    <Screen
      id="UX-SVC-001"
      breadcrumbs={[{ label: "Platform services" }]}
      actions={
        <>
          <ButtonLink href="/services/storage/new" icon="plus">
            New bucket
          </ButtonLink>
          <ButtonLink href="/templates" variant="secondary" icon="box">
            Install template
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {storage.state === "unavailable" && <UnavailableState capabilityKey="service.storage" />}

        {CATEGORY_ORDER.map((cat) => {
          const rows = instances.filter((s) => templateForKey(s.template_key)?.category === cat);
          return (
            <PortfolioSection
              key={cat}
              icon={cat === "storage" ? "cloud" : cat === "search" ? "search" : "box"}
              title={categoryLabel(cat)}
              count={rows.length}
              empty={
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-ink-2 sm:p-6">
                  <span>{EMPTY_COPY[cat]}</span>
                  {cat !== "delivery" && cat !== "queue" && (
                    <Link href="/templates" className="inline-flex items-center gap-1 text-accent hover:underline">
                      Browse templates <Icon name="arrow-right" size={13} />
                    </Link>
                  )}
                </div>
              }
            >
              {rows.map((s) => {
                const href = instanceHref(s);
                return (
                  <PortfolioRow
                    key={s.id}
                    href={href}
                    pill={serviceStatusPill(s)}
                    pillAt={s.usage.updated_at}
                    title={s.name}
                    chips={<ServiceChips s={s} />}
                    meta={serviceMeta(s)}
                    usage={s.usage}
                  />
                );
              })}
            </PortfolioSection>
          );
        })}

        <PortfolioSection
          icon="layers"
          title="Self-hosted apps"
          count={apps.length}
          empty={
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-ink-2 sm:p-6">
              <span>Self-hosted apps (Nextcloud, Gitea…) are part of the template catalog.</span>
              <Link href="/templates" className="inline-flex items-center gap-1 text-accent hover:underline">
                Browse templates <Icon name="arrow-right" size={13} />
              </Link>
            </div>
          }
        >
          {apps.map((s) => {
            const href = instanceHref(s);
            return (
              <PortfolioRow
                key={s.id}
                href={href}
                pill={serviceStatusPill(s)}
                pillAt={s.usage.updated_at}
                title={s.name}
                chips={<ServiceChips s={s} />}
                meta={serviceMeta(s)}
                usage={s.usage}
              />
            );
          })}
        </PortfolioSection>
      </div>
    </Screen>
  );
}

export type { ServiceInstance };
