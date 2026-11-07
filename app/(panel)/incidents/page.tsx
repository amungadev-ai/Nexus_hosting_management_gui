"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { useNow, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { incidentEvents } from "@/lib/mock/ops";
import { formatRelative } from "@/lib/format";

/**
 * UX-OPS-010 /incidents — severity, ownership, timeline, status.
 * Acknowledge is a state change with a toast + a timeline entry.
 */
export default function IncidentsPage() {
  const now = useNow();
  const { push } = useToast();
  const base = useFixture(() => db.incidents);
  const [acked, setAcked] = useState<Record<string, boolean>>({});

  const incidents = useMemo(
    () => (base ?? []).map((i) => (acked[i.id] && i.state === "open" ? { ...i, state: "acknowledged" as const } : i)),
    [base, acked]
  );

  const open = incidents.filter((i) => i.state === "open");
  const acknowledged = incidents.filter((i) => i.state === "acknowledged");
  const resolved = incidents.filter((i) => i.state === "resolved");

  const acknowledge = (id: string, title: string) => {
    setAcked((prev) => ({ ...prev, [id]: true }));
    push("info", "Incident acknowledged", `${title} — it stays open until it is resolved.`);
  };

  if (base === null) {
    return (
      <Screen id="UX-OPS-010" breadcrumbs={[{ label: "Incidents" }]}>
        <SkeletonTable rows={3} cols={4} />
      </Screen>
    );
  }

  return (
    <Screen
      id="UX-OPS-010"
      breadcrumbs={[{ label: "Incidents" }]}
      description="Severity, ownership, timeline and status. Acknowledge to claim attention — resolve only when the cause is verified fixed."
    >
      <div className="flex flex-col gap-4">
        {incidents.length === 0 && (
          <Callout tone="success" title="No incidents recorded">
            Nothing has gone wrong recently. Alert rules still watch RAM, disk, backups and certificates.
          </Callout>
        )}

        {[
          { label: "Open — unclaimed", items: open, canAck: true },
          { label: "Acknowledged", items: acknowledged, canAck: false },
          { label: "Resolved", items: resolved, canAck: false },
        ].map((group) =>
          group.items.length === 0 ? null : (
            <section key={group.label} aria-label={group.label} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-ink">{group.label} ({group.items.length})</h2>
              {group.items.map((i) => {
                const related = incidentEvents.filter((e) => e.incident_id === i.id);
                return (
                  <Card
                    key={i.id}
                    title={
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/incidents/${i.id}`} className="font-semibold text-accent hover:underline">
                          {i.title}
                        </Link>
                        <StatusPill status={i.severity === "critical" ? "failed" : i.severity === "major" ? "degraded" : "unknown"} />
                        <StatusPill status={i.state === "open" ? "open" : i.state === "acknowledged" ? "pending" : "succeeded"} />
                      </span>
                    }
                    description={i.summary}
                    footer={
                      <span>
                        Started {formatRelative(i.started_at, now)}
                        {i.resolved_at !== undefined && ` · resolved ${formatRelative(i.resolved_at, now)}`} ·
                        {" "}{related.length} related event{related.length === 1 ? "" : "s"}
                      </span>
                    }
                    actions={
                      <>
                        {group.canAck && (
                          <button
                            type="button"
                            onClick={() => acknowledge(i.id, i.title)}
                            className="h-8 rounded-control border border-line bg-surface px-3 text-xs font-medium text-ink hover:border-line-strong"
                          >
                            Acknowledge
                          </button>
                        )}
                        <ButtonLink href={`/incidents/${i.id}`} variant="secondary" size="sm">
                          Open
                        </ButtonLink>
                      </>
                    }
                  >
                    <p className="text-xs text-ink-3">Affects: {i.affected.join(", ")}</p>
                  </Card>
                );
              })}
            </section>
          )
        )}
      </div>
    </Screen>
  );
}
