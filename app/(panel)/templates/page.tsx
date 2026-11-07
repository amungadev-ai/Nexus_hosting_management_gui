"use client";

import React, { useMemo, useState } from "react";
import { db } from "@/lib/mock/data";
import { allServiceInstances, instanceHref, serviceStatusPill, templateForKey } from "@/lib/mock/services";
import { useCapability } from "@/components/providers";
import { allocatedRamMb } from "@/lib/mock/overview";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/nav";
import { TemplateCard } from "@/components/ui/misc";
import { formatMb } from "@/lib/format";
import type { TemplateCategory } from "@/lib/types";

/**
 * UX-TPL-001 — Template catalog (the v1 "marketplace"): data, not code.
 * Per-card deploy availability comes from the live capability set + RAM fit.
 * UX-TPL-005 (state) lives here: when Docker is unavailable the honest
 * catalog gate renders above the grid, and every Docker template shows its
 * own reason line with the upgrade path.
 */
const CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "self_hosted_app", label: "Self-hosted apps" },
  { value: "storage", label: "Storage" },
  { value: "transform", label: "Transform" },
  { value: "database", label: "Databases" },
  { value: "cache", label: "Cache" },
  { value: "search", label: "Search" },
];

export default function TemplatesPage() {
  const docker = useCapability("service.docker");
  const { profile } = useSessionSafe();
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  const headroom = useMemo(() => {
    const ram = PROFILE_RAM[profile];
    return ram - allocatedRamMb();
  }, [profile]);

  const templates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.templates.filter((t) => {
      if (category !== "all" && t.category !== (category as TemplateCategory)) return false;
      if (q !== "" && !`${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q)) return false;
      return t.published;
    });
  }, [category, query]);

  const dockerBlocked = docker.state === "unavailable";
  const installedKeys = new Set(allServiceInstances().map((i) => i.template_key));

  return (
    <Screen
      id="UX-TPL-001"
      breadcrumbs={[{ label: "Templates" }]}
      actions={<><ButtonLink href="/services/setup">Guided setup</ButtonLink><ButtonLink href="/services" variant="secondary">My services</ButtonLink></>}
    >
      <div className="flex flex-col gap-4">
        {dockerBlocked && (
          <Callout tone="warning" title="Self-hosted templates require Docker">
            {docker.reason ?? "Docker is not available on this VPS."} Upgrade to Standard to enable the catalog —
            templates that don&apos;t need Docker (like WordPress) still install today.
          </Callout>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={`Search ${db.templates.length} templates…`}
            aria-label="Search templates"
            className="max-w-sm flex-1"
          />
          <SegmentedControl aria-label="Filter by category" size="sm" options={CATEGORIES} value={category} onChange={setCategory} />
        </div>

        {templates.length === 0 ? (
          <EmptyState
            icon="box"
            title="No templates match"
            body="The catalog is data, not code — new templates appear as the catalog updates. Try a different category or a shorter search."
            action={{ label: "Show everything", onClick: () => { setQuery(""); setCategory("all"); } }}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => {
              const cap = t.docker_required ? docker : PHP_CAP_PLACEHOLDER;
              const needsDocker = t.docker_required && cap?.state === "unavailable";
              const noFit = headroom < t.ram_floor_mb;
              const state: "available" | "borderline" | "unavailable" = needsDocker || noFit ? "unavailable" : headroom < t.ram_typical_mb ? "borderline" : "available";
              const reason = needsDocker
                ? `Docker is not available on this VPS — ${docker.reason ?? "it lacks the RAM headroom to run containers."}`
                : noFit
                  ? `Only ${Math.max(0, headroom)} MB is unallocated and ${t.name} needs ${t.ram_floor_mb} MB to start (${t.ram_floor_mb - Math.max(0, headroom)} MB more).`
                  : null;
              return (
                <div key={t.key} className="flex flex-col gap-2">
                  <TemplateCard
                    template={t}
                    state={state}
                    reason={reason}
                    deployHref={`/templates/${t.key}`}
                  />
                  <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-ink-3">
                    {installedKeys.has(t.key) && <Chip tone="success">installed</Chip>}
                    <span>
                      typical {formatMb(t.ram_typical_mb)} · ceiling {formatMb(t.ram_ceiling_mb)}
                    </span>
                    {state === "unavailable" && (
                      <a href="/overview/capabilities" className="font-medium text-accent hover:underline">
                        Why? See capabilities
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Screen>
  );
}

import { useSession } from "@/components/providers";
import { capabilityFor } from "@/lib/profiles";

function useSessionSafe() {
  return useSession();
}

const PROFILE_RAM: Record<string, number> = {
  nano: 512,
  starter: 2048,
  standard: 6144,
  provider: 16384,
};

const PHP_CAP_PLACEHOLDER = capabilityFor("standard", "website.php") as ReturnType<typeof capabilityFor>;
