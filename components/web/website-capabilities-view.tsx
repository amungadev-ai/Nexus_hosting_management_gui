"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { UnavailableState } from "@/components/common/states";
import { useCapabilities, useSession } from "@/components/providers";
import { CAPABILITY_META, PROFILES } from "@/lib/profiles";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { NotFoundInline } from "@/components/common/states";
import { db } from "@/lib/mock/data";

/**
 * UX-WEB-019 — Website capability strip: what the site can and cannot do
 * (PHP? Node? DB? Transform?) based on the installer capability set and
 * container fit. Explains why the creation wizard offers fewer options on
 * Nano/Starter. Honest, not alarming — reason + delta + upgrade path.
 */
export function WebsiteCapabilitiesView({ siteId }: { siteId: string }) {
  const site = useMemo(() => db.websites.find((w) => w.id === siteId), [siteId]);
  const caps = useCapabilities();
  const { profile } = useSession();

  if (site === undefined) {
    return (
      <Screen id="UX-WEB-019" breadcrumbs={[{ label: "Websites", href: "/websites" }]}>
        <NotFoundInline what="website" />
      </Screen>
    );
  }

  const relevant = ["website.static", "website.php", "app.node", "db.mariadb", "service.transform", "service.docker"];
  const records = relevant
    .map((key) => caps.find((c) => c.capability_key === key))
    .filter((r) => r !== undefined);
  const current = PROFILES[profile];

  return (
    <Screen
      id="UX-WEB-019"
      breadcrumbs={[
        { label: "Websites", href: "/websites" },
        { label: site.title, href: `/websites/${site.id}` },
        { label: "Capabilities" },
      ]}
      actions={
        <ButtonLink href="/system/upgrade" icon="trending-up">
          Upgrade
        </ButtonLink>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <span>
          Capability set for <span className="font-medium text-ink">{current.label}</span> ({current.tagline}) — this is why the
          creation wizard offers fewer options on smaller profiles.
        </span>
        <Link href="/overview/capabilities" className="text-accent hover:underline">
          See the full capability overview
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {records.map((rec) => {
          const meta = CAPABILITY_META[rec.capability_key];
          return (
            <Card
              key={rec.capability_key}
              title={meta?.label ?? rec.capability_key}
              description={
                rec.capability_key === "website.static"
                  ? "Serving HTML/CSS/JS from the web root."
                  : rec.capability_key === "website.php"
                    ? "Running PHP sites (e.g. WordPress) on this server."
                    : rec.capability_key === "app.node"
                      ? "Running Node.js applications with build + start commands."
                      : rec.capability_key === "db.mariadb"
                        ? "A MariaDB container the site could use."
                        : rec.capability_key === "service.transform"
                          ? "Batch image transformation (needs Docker)."
                          : "Docker containers for isolation and services."
              }
              actions={<StatusPill status={rec.state} />}
            >
              {rec.state === "unavailable" ? (
                <p className="text-sm text-ink-2">{rec.reason}</p>
              ) : rec.state === "borderline" ? (
                <p className="text-sm text-ink-2">{rec.reason}</p>
              ) : (
                <p className="text-sm text-ink-2">
                  Available on this VPS{rec.delta !== undefined && Object.keys(rec.delta).length > 0 ? "" : ""}. Typical fit:{" "}
                  {rec.ram_typical_mb} MB RAM (floor {rec.ram_floor_mb} MB, ceiling {rec.ram_ceiling_mb} MB).
                </p>
              )}
              {meta !== undefined && rec.state === "unavailable" && (
                <p className="mt-2 text-xs text-ink-3">Upgrade path: {meta.upgrade}</p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-4">
        <UnavailableState capabilityKey="service.transform" title="Image transformation for this site" />
      </div>
    </Screen>
  );
}
