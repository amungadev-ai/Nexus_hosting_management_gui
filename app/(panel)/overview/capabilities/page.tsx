"use client";

import React from "react";
import { useCapabilities, useSession } from "@/components/providers";
import { PROFILES } from "@/lib/profiles";
import { Screen } from "@/components/common/screen";
import { CapabilityBanner } from "@/components/common/capability-banner";
import { CapabilityComparison, CapabilityGrid } from "@/components/overview/capability-comparison";
import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";

/**
 * UX-OV-002 — Capability overview: the honest answer to "what can this VPS
 * run?" — DS-021 banner + every capability record with reason, resource
 * delta and the static per-profile comparison strip.
 */
export default function CapabilitiesPage() {
  const caps = useCapabilities();
  const { profile } = useSession();
  const p = PROFILES[profile];

  return (
    <Screen
      id="UX-OV-002"
      breadcrumbs={[{ label: "Overview", href: "/overview" }, { label: "Capabilities" }]}
      actions={
        <ButtonLink href="/system/upgrade" icon="trending-up">
          Upgrade options
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-4">
        <CapabilityBanner force />

        <Callout tone="info" title={`This VPS: ${p.label} — ${p.tagline}`}>
          {p.summary} Detected hardware and the signed capability file are the source of truth; the panel never
          invents availability. See the detailed detection under Infrastructure → Capability detection.
        </Callout>

        <CapabilityComparison />

        <section aria-label="Capability records" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">
            Every capability on {p.label} <span className="font-normal text-ink-2">({caps.length})</span>
          </h2>
          <CapabilityGrid records={caps} />
        </section>
      </div>
    </Screen>
  );
}
