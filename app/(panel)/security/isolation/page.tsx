"use client";

import React from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { useSession } from "@/components/providers";
import { serviceHealth } from "@/lib/mock/ops";

/**
 * UX-OPS-015 /security/isolation — tenant boundaries, process users, quotas
 * and exceptions (provider audience; the Screen guard handles presentation).
 */
export default function IsolationPage() {
  const { profile } = useSession();
  const health = useFixture(() => serviceHealth);

  const boundaries = [
    { name: "Process users", detail: "Each website runs as its own system user (web-acme, web-kili, web-blog). No shared shells, no cross-site writes." },
    { name: "cgroup boundaries", detail: "CPU weight and memory.max per workload; batch workloads capped at 50% of cores (cpu.max), serving never throttled below priority 100." },
    { name: "Filesystem", detail: "Open_basedir per site on PHP; document roots owned by the site user, mode 750. Symlink escapes are detected." },
    { name: "Network", detail: "Default-deny inbound; service instances on internal hostnames are not routable from the public internet." },
    { name: "Tenancy", detail: "Single organization on this install — provider/reseller delegation is a v2+ surface and is not active here." },
    { name: "Quotas", detail: "Disk and inode quotas per website account; the batch queue has its own concurrency limit (423 when full)." },
  ];

  return (
    <Screen
      id="UX-OPS-015"
      breadcrumbs={[{ label: "Security", href: "/security" }, { label: "Isolation" }]}
      actions={
        <ButtonLink href="/audit" variant="secondary" icon="file-text">
          Audit trail
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="Isolation model on this install">
          Profile: <Chip tone="accent">{profile}</Chip> — the panel enforces capability and
          policy gates at the API entry and again at job execution; the UI never bypasses
          them, and hidden buttons are not a security boundary.
        </Callout>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {boundaries.map((b) => (
            <Card key={b.name} title={b.name} description={b.detail}>
              <StatusPill status="active" />
            </Card>
          ))}
        </div>

        <Card title="Exceptions review" description="Anything granted outside the defaults — keep this list short">
          <ul className="flex list-none flex-col gap-2 p-0 text-sm text-ink-2">
            <li className="flex flex-wrap items-center gap-2">
              <Chip tone="warning">exception</Chip> 8443/tcp from the office IP — pending second-person approval (Jambo dashboard).
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <Chip tone="neutral">note</Chip> image-worker runs as a batch workload: cpu.max 500m, yields under serving contention.
            </li>
          </ul>
        </Card>

        {health === null ? (
          <SkeletonTable rows={2} cols={3} />
        ) : (
          <Card title="Enforcement health" description="Guards that apply the boundaries above">
            <ul className="divide-y divide-line">
              {health.slice(0, 4).map((h) => (
                <li key={h.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="text-sm text-ink">{h.name}</span>
                  <StatusPill
                    status={h.state === "healthy" ? "healthy" : h.state === "degraded" ? "degraded" : "failed"}
                    at={h.last_check_at}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Screen>
  );
}
