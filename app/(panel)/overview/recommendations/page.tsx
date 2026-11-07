"use client";

import React from "react";
import { db } from "@/lib/mock/data";
import { Screen } from "@/components/common/screen";
import { UpgradeRecommendation } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";

/**
 * UX-OV-010 — Upgrade recommendations: evidence-based only (7-day peak RAM
 * above 80%, OOM kills, CPU contention). Never upsell without evidence.
 */
export default function RecommendationsPage() {
  const recs = db.recommendations;

  return (
    <Screen
      id="UX-OV-010"
      breadcrumbs={[{ label: "Overview", href: "/overview" }, { label: "Recommendations" }]}
      actions={
        <ButtonLink href="/overview/usage" variant="secondary" icon="trending-up">
          View usage evidence
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="How these are generated">
          Recommendations come from measured evidence only — sustained peak RAM above 80% of the ceiling, OOM
          kills, or CPU contention over the last 7 days. The panel never suggests an upgrade without that
          evidence, and memory-pressure warnings always name the workload and the numbers.
        </Callout>

        {recs.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title="No recommendations right now"
            body="Nothing is running hot. When a workload stays above 80% of its ceiling for a week, or hits its memory limit, an evidence-backed suggestion appears here."
            action={{ label: "Open usage", href: "/overview/usage" }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {recs.map((r) => (
              <UpgradeRecommendation key={r.id} recommendation={r} />
            ))}
          </div>
        )}

        <p className="flex items-center gap-1.5 px-1 text-xs text-ink-2">
          <Icon name="alert-triangle" size={13} className="shrink-0 text-warning" />
          orders-api is using 380 MB of its 400 MB limit. If it hits the limit it will be restarted — consider
          upgrading or reducing its cache size.
        </p>
      </div>
    </Screen>
  );
}
