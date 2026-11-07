"use client";
import { databaseHref } from "@/lib/database-routes";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { ImpactReview } from "@/components/ui/overlay";
import { DataTable } from "@/components/ui/table";
import { Chip, StatusPill } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/misc";
import { UnavailableState } from "@/components/common/states";
import { Field, Select } from "@/components/ui/form";
import { useCapability, useOperationStream, useSession, useToast } from "@/components/providers";
import { listDatabases, type DatabaseListResult } from "@/lib/api/databases";
import { planDatabaseCapacityChange } from "@/lib/api/infrastructure";
import { ApiError } from "@/lib/api/core";
import type { DatabaseInstance } from "@/lib/mock/databases";
import { PROFILES } from "@/lib/profiles";
import { formatMb } from "@/lib/format";

/**
 * UX-DB-008 — Database service settings (provider): engine modules, pool
 * capacity vs the physical × 1.2 hard limit, plan change → resource.limit.update
 * operation, maintenance and upgrade pointers.
 */
export default function DatabaseServiceSettingsPage() {
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const mariadb = useCapability("db.mariadb");
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DatabaseListResult | null>(null);
  const [delta, setDelta] = useState("450");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const p = PROFILES[profile];
  const hardMaxMb = useMemo(() => Math.round(p.specs.ram_mb * 1.2), [p]);
  const poolCeilingMb = useMemo(
    () => (result?.data ?? []).reduce((sum, d) => sum + d.ram_ceiling_mb, 0),
    [result]
  );
  const planned = poolCeilingMb + Number(delta);

  if (loading) {
    return (
      <Screen id="UX-DB-008" breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Database service" }]}>
        <SkeletonTable rows={3} cols={4} />
      </Screen>
    );
  }

  if (result === null || result.meta.capability_unavailable) {
    return (
      <Screen id="UX-DB-008" breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Database service" }]}>
        <UnavailableState capabilityKey="db.mariadb" title="The database service is not part of this VPS" />
      </Screen>
    );
  }

  const instances = result.data;
  const engines = [mariadb];

  const submitPlan = () => {
    setError(null);
    planDatabaseCapacityChange(Number(delta))
      .then((op) => {
        push("success", "Capacity plan submitted", `Operation ${op.id} — ceilings are applied and verified on the running containers.`);
        setFocusedId(op.id);
        setTrayOpen(true);
      })
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.problem.detail : "Unexpected error.");
      });
  };

  return (
    <Screen
      id="UX-DB-008"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Database service" }]}
      actions={<ButtonLink href="/infrastructure/maintenance" variant="secondary" icon="calendar">Maintenance windows</ButtonLink>}
    >
      <div className="flex flex-col gap-4">
        {profile === "starter" && (
          <Callout tone="warning" title="Borderline engine fit on Starter">
            {mariadb.reason} Keep batch jobs light while a database container runs.
          </Callout>
        )}

        <Card title="Engine modules" description="Databases ship as ServiceTemplate instances (database.mariadb / database.postgres) — the engine list comes from the signed capability file, never invented.">
          <div className="grid gap-3 sm:grid-cols-2">
            {engines.map((rec) => (
              <div key={rec.capability_key} className="rounded-card border border-line bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{rec.capability_key}</p>
                  <StatusPill status={rec.state} />
                </div>
                <p className="mt-1 text-xs text-ink-2">
                  RAM floor {formatMb(rec.ram_floor_mb)} · typical {formatMb(rec.ram_typical_mb)} · ceiling {formatMb(rec.ram_ceiling_mb)}
                </p>
                {rec.reason !== null && <p className="mt-1 text-xs text-ink-2">{rec.reason}</p>}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href="/infrastructure/capabilities" variant="secondary" size="sm">Capability detection</ButtonLink>
            <ButtonLink href="/infrastructure/modules" variant="secondary" size="sm">Installed modules</ButtonLink>
          </div>
        </Card>

        <Card title="Pool capacity" description={`Sum of per-instance memory.max against the hard limit (${formatMb(hardMaxMb)} = physical ${formatMb(p.specs.ram_mb)} × 1.2).`}>
          <DataTable
            caption="Database instances and ceilings"
            rows={instances}
            rowKey={(d: DatabaseInstance) => d.id}
            columns={[
              { key: "display_name", header: "Instance", render: (d: DatabaseInstance) => <Link href={databaseHref(d.id)} className="font-medium text-accent hover:underline">{d.display_name}</Link> },
              { key: "engine", header: "Engine", render: (d: DatabaseInstance) => `${d.engine === "mariadb" ? "MariaDB" : "PostgreSQL"} ${d.engine_version}` },
              { key: "state", header: "State", render: (d: DatabaseInstance) => <Chip tone={d.state === "running" ? "success" : d.state === "degraded" ? "warning" : "info"}>{d.state}</Chip> },
              { key: "ram_ceiling_mb", header: "memory.max", render: (d: DatabaseInstance) => formatMb(d.ram_ceiling_mb) },
              { key: "size_mb", header: "Data", render: (d: DatabaseInstance) => formatMb(d.size_mb) },
            ]}
            emptyState={<Callout tone="info">No database instances yet — create one under Databases.</Callout>}
          />
          <div className="mt-4 max-w-xl">
            <ProgressBar
              value={poolCeilingMb}
              max={hardMaxMb}
              tone={poolCeilingMb > hardMaxMb ? "danger" : "accent"}
              label={`Allocated ceilings: ${formatMb(poolCeilingMb)} of ${formatMb(hardMaxMb)} hard limit`}
              showValue
            />
            <p className="mt-1 text-xs text-ink-3">
              A ceiling is a cap, not a reservation — instances share the physical RAM fairly; the × 1.2 hard limit
              is the overcommit guard the installer enforces (CGROUP_CONFIG_INVALID above it).
            </p>
          </div>
        </Card>

        <Card title="Plan a capacity change" description="Raises the pool headroom for new or growing instances. Applied as a verified resource.limit.update job.">
          <div className="grid max-w-xl gap-4">
            <Field
              label="Additional pool ceiling"
              htmlFor="db-pool-delta"
              required
              hint={`Current allocated ${formatMb(poolCeilingMb)} + planned +${Number(delta)} MB = ${formatMb(planned)} (hard limit ${formatMb(hardMaxMb)}).`}
            >
              <Select id="db-pool-delta" value={delta} onChange={(e) => setDelta(e.target.value)}>
                <option value="450">+450 MB — one small instance</option>
                <option value="900">+900 MB — one medium instance</option>
                <option value="1000">+1 GB — one large instance</option>
                <option value="1800">+1.8 GB — headroom for two instances</option>
              </Select>
            </Field>
            {planned > hardMaxMb && (
              <Callout tone="warning" title="This plan exceeds the × 1.2 hard limit">
                {formatMb(planned)} would overcommit the server by {formatMb(planned - hardMaxMb)}. The control plane
                refuses ceilings above {formatMb(hardMaxMb)} — free capacity first (remove an instance, shrink
                ceilings) or upgrade the VPS.
              </Callout>
            )}
            <div className="flex flex-wrap gap-2">
              <Button icon="trending-up" onClick={() => setReviewOpen(true)}>Plan change</Button>
              <ButtonLink href="/system/upgrade" variant="secondary">Upgrade the VPS instead</ButtonLink>
            </div>
          </div>
        </Card>

        <Callout tone="info" title="Upgrades and maintenance">
          Engine version upgrades run inside a{" "}
          <Link href="/infrastructure/maintenance" className="text-accent hover:underline">maintenance window</Link> so
          serving workloads are paused first. The panel never reports an engine upgrade as done before the container
          re-verifies with a real query.
        </Callout>

        {error !== null && <Callout tone="danger" title="Could not submit the plan">{error}</Callout>}

        <ImpactReview
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onSubmit={submitPlan}
          title={`Database capacity plan change (+${Number(delta)} MB)`}
          submitLabel="Submit capacity plan"
          impact={{
            before: `Pool ceilings sum to ${formatMb(poolCeilingMb)} of the ${formatMb(hardMaxMb)} hard limit`,
            after: `Pool headroom grows by ${Number(delta)} MB — new ceilings apply to the pool, running containers keep their memory.max until re-fitted`,
            affectedResources: instances.map((d) => d.display_name),
            downtimeEstimate: "None — ceilings are written per container without restarts",
            reversibility: "Ceilings can be lowered again; running containers are never overcommitted above the × 1.2 guard",
          }}
        >
          <p>
            The job validates the sum of memory.max against physical × 1.2, stages the new pool ceilings, applies them
            and re-reads each container to verify — success is only reported after verification.
          </p>
        </ImpactReview>
      </div>
    </Screen>
  );
}
