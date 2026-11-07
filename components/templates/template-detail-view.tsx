"use client";

import React from "react";
import Link from "next/link";
import type { ServiceTemplate } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { allServiceInstances, instanceHref, serviceStatusPill } from "@/lib/mock/services";
import { useCapability, useSession } from "@/components/providers";
import { PROFILES } from "@/lib/profiles";
import { allocatedRamMb } from "@/lib/mock/overview";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, UnavailableState } from "@/components/common/states";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { formatMb, formatGb } from "@/lib/format";

/** UX-TPL-002 — Template detail: description, resource profile, prerequisites, install CTA. */
export default function TemplateDetailView({ templateKey }: { templateKey: string }) {
  const template = db.templates.find((t) => t.key === templateKey);
  const { profile } = useSession();
  const docker = useCapability("service.docker");

  if (template === undefined) {
    return (
      <Screen id="UX-TPL-002" breadcrumbs={[{ label: "Templates", href: "/templates" }, { label: "Detail" }]}>
        <NotFoundInline what="template" />
      </Screen>
    );
  }

  const cap = template.docker_required ? docker : useCapability("website.php");
  const headroom = PROFILES[profile].specs.ram_mb - allocatedRamMb();
  const fits = headroom >= template.ram_floor_mb;
  const installable = cap.state !== "unavailable" && fits;

  const family = allServiceInstances().filter((i) => i.template_key === template.key);

  return (
    <Screen
      id="UX-TPL-002"
      breadcrumbs={[{ label: "Templates", href: "/templates" }, { label: template.name }]}
      actions={
        installable ? (
          <ButtonLink href={`/templates/${template.key}/deploy`} icon="download">
            Install {template.name}
          </ButtonLink>
        ) : (
          <ButtonLink href="/overview/capabilities" variant="secondary" icon="info">
            See what your VPS can run
          </ButtonLink>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{template.category.split("_").join(" ")}</Chip>
          <Chip tone="neutral">v{template.version}</Chip>
          <Chip tone={template.docker_required ? "info" : "success"}>
            {template.docker_required ? "requires Docker" : "no Docker needed"}
          </Chip>
          {family.length > 0 && <Chip tone="accent">{family.length} installed</Chip>}
        </div>

        <Card title={`About ${template.name}`}>
          <p className="text-sm text-ink-2">{template.description}</p>
          <div className="mt-4 border-t border-line pt-4">
            <KeyValue
              columns={2}
              items={[
                { label: "RAM floor (won't start under)", value: formatMb(template.ram_floor_mb) },
                { label: "RAM typical (7-day p50)", value: formatMb(template.ram_typical_mb) },
                { label: "RAM ceiling (hard limit)", value: formatMb(template.ram_ceiling_mb) },
                { label: "Disk floor", value: formatGb(template.disk_floor_gb) },
                { label: "Unallocated headroom on this VPS", value: `${Math.max(0, headroom)} MB of ${PROFILES[profile].specs.ram_mb} MB` },
                { label: "Admin credentials", value: "generated at install — shown once, stored hashed" },
              ]}
            />
          </div>
        </Card>

        {!installable && (
          <UnavailableState
            capabilityKey={template.docker_required ? "service.docker" : "website.php"}
            title={`This VPS cannot run ${template.name}`}
          >
            {!fits && cap.state !== "unavailable" && (
              <p className="text-sm text-ink-2">
                Docker is available, but only {Math.max(0, headroom)} MB is unallocated and {template.name} needs{" "}
                {template.ram_floor_mb} MB to start — {template.ram_floor_mb - Math.max(0, headroom)} MB more.
              </p>
            )}
          </UnavailableState>
        )}

        <Card title="Instances of this template">
          {family.length === 0 ? (
            <p className="text-sm text-ink-2">None installed yet.</p>
          ) : (
            <ul className="flex list-none flex-col divide-y divide-line p-0">
              {family.map((f) => {
                const href = instanceHref(f);
                return (
                  <li key={f.id} className="flex items-center gap-3 py-2">
                    <StatusPill status={serviceStatusPill(f)} />
                    {href !== null ? (
                      <Link href={href} className="text-sm font-medium text-accent hover:underline">
                        {f.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-ink">{f.name}</span>
                    )}
                    <span className="truncate font-mono text-xs text-ink-2">{f.hostname}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </Screen>
  );
}

export type { ServiceTemplate };
