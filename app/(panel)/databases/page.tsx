"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Callout, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { UnavailableState } from "@/components/common/states";
import { DataTable } from "@/components/ui/table";
import { StatusPill } from "@/components/ui/badge";
import { useSession, useNow } from "@/components/providers";
import { listDatabases, type DatabaseListResult } from "@/lib/api/databases";
import type { DatabaseInstance } from "@/lib/mock/databases";
import { formatMb, formatRelative } from "@/lib/format";

/**
 * UX-DB-001 + UX-DB-009 — Databases list, incl. the honest Nano state on the
 * same route: the API returns [] plus an explanation, and the screen renders
 * it without hiding the menu (UXD-031).
 */
export default function DatabasesPage() {
  const { profile } = useSession();
  const now = useNow();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DatabaseListResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listDatabases(profile).then((res) => {
      if (!cancelled) {
        setResult(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <Screen
      id="UX-DB-001"
      breadcrumbs={[{ label: "Databases" }]}
      actions={
        result !== null && !result.meta.capability_unavailable ? (
          <ButtonLink href="/databases/new" icon="plus">Create database</ButtonLink>
        ) : undefined
      }
    >
      {loading && <SkeletonTable rows={3} cols={5} />}
      {!loading && result !== null && result.meta.capability_unavailable && (
        <div className="flex flex-col gap-4">
          {/* UX-DB-009 (state) — honest Nano state sharing the /databases route. */}
          <UnavailableState capabilityKey="db.mariadb" title="Databases are not available on this VPS">
            <p className="text-sm text-ink-2">
              The panel&apos;s own metadata database already consumes the available SQLite budget on this
              512 MB VPS, so no MariaDB or Postgres container can fit. Upgrading to a 6 GB Standard VPS
              enables both engines and the database tooling.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href="/system/upgrade" icon="trending-up">Upgrade</ButtonLink>
              <ButtonLink href="/overview/capabilities" variant="secondary">Learn more</ButtonLink>
            </div>
          </UnavailableState>
          <Callout tone="info" title="What your sites use today">
            WordPress on Nano stores its data in the site&apos;s own SQLite/PHP runtime — your sites keep working;
            managed database instances simply are not part of this profile.
          </Callout>
        </div>
      )}
      {!loading && result !== null && !result.meta.capability_unavailable && result.data.length === 0 && (
        <EmptyState
          icon="database"
          title="No databases yet"
          body="Create a MariaDB or Postgres instance — provisioning runs as a verified job and connection details appear when it is healthy."
          action={{ label: "Create database", href: "/databases/new" }}
        />
      )}
      {!loading && result !== null && !result.meta.capability_unavailable && result.data.length > 0 && (
        <div className="flex flex-col gap-4">
          {profile === "starter" && (
            <Callout tone="warning" title="Borderline on this VPS">
              A small database fits, but the RAM floor (350–400 MB) exceeds comfortable headroom — it runs,
              but tight. Avoid stacking a database with a Node app and heavy batch jobs at the same time.
            </Callout>
          )}
          <DataTable
            caption="Database instances"
            rows={result.data}
            rowKey={(d: DatabaseInstance) => d.id}
            onRowClick={(d: DatabaseInstance) => {
              window.location.assign(`/databases/${d.id}`);
            }}
            columns={[
              { key: "display_name", header: "Name", render: (d: DatabaseInstance) => <span className="font-medium">{d.display_name}</span> },
              { key: "engine", header: "Engine", render: (d: DatabaseInstance) => `${d.engine === "mariadb" ? "MariaDB" : "PostgreSQL"} ${d.engine_version}` },
              { key: "hostname", header: "Host", render: (d: DatabaseInstance) => <span className="font-mono text-xs">{d.hostname}</span> },
              { key: "size_mb", header: "Size", render: (d: DatabaseInstance) => formatMb(d.size_mb) },
              { key: "backups", header: "Backups", render: (d: DatabaseInstance) => `${d.backups.length} · ${d.backups[0] ? formatRelative(d.backups[0].snapshot_at, now) : "none"}` },
              { key: "health", header: "Health", render: (d: DatabaseInstance) => <StatusPill status={d.health === "healthy" ? "healthy" : d.health === "unhealthy" ? "degraded" : "unknown"} at={d.last_health_check_at} /> },
            ]}
          />
          <p className="text-xs text-ink-3">
            Rows open the database overview. Service settings for the database engines live under{" "}
            <Link href="/infrastructure/databases" className="text-accent hover:underline">Infrastructure → Database service</Link>.
          </p>
        </div>
      )}
    </Screen>
  );
}
