"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, UnsupportedState } from "@/components/common/states";
import { useCapability } from "@/components/providers";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { GuidanceRecordsTable } from "@/components/dns/dns-bits";
import { domainForZone, guidanceForZone } from "@/lib/mock/dns";

/**
 * UX-DNS-006 / 007 / 008 — the v2 gates for the authoritative-DNS surfaces
 * (zone editor, change review, DNSSEC). Authoritative DNS hosting is deferred
 * to v2: each gate explains honestly what the v2 screen will do, why it can't
 * run yet, and hands over to the v1 DNS guidance mode. The zone editor gate
 * also carries the UX-DNS-015 state ("guidance mode active for this domain").
 */
type ZoneGateVariant = "editor" | "review" | "dnssec";

const GATE: Record<ZoneGateVariant, { id: string; crumb: string; title: string; body: string }> = {
  editor: {
    id: "UX-DNS-006",
    crumb: "DNS zone editor",
    title: "The DNS zone editor is coming in v2",
    body: "Editing records here (add/edit/delete, TTLs, conflict and syntax checks, before/after diffs) needs NexusPanel to host your DNS authoritatively. That capability is deferred to v2 — today your DNS stays at your registrar, and the panel shows you the exact records to add there.",
  },
  review: {
    id: "UX-DNS-007",
    crumb: "Zone change review",
    title: "DNS zone change review is coming in v2",
    body: "Reviewing a zone change before it applies (before/after per record, affected records, approval, propagation follow-up) is part of authoritative DNS hosting, which ships in v2. In v1 nothing can silently change your zone — your registrar stays the single place where records are edited.",
  },
  dnssec: {
    id: "UX-DNS-008",
    crumb: "DNSSEC",
    title: "DNSSEC management is coming in v2",
    body: "DNSSEC keys, DS records at the registrar and key rollover need the panel to hold the zone signing keys. That is part of v2 authoritative DNS. A mismatched DS record can take a domain completely offline, so DNSSEC ships together with the v2 zone editor and its tested rollover flow — not as a hand-typed shortcut.",
  },
};

export function ZoneGateView({ zone, variant }: { zone: string; variant: ZoneGateVariant }) {
  const cap = useCapability("dns.authoritative");
  const gate = GATE[variant];

  const domain = useMemo(() => domainForZone(zone), [zone]);
  const guidance = useMemo(() => guidanceForZone(zone), [zone]);

  if (domain === undefined) {
    return (
      <Screen id={gate.id} breadcrumbs={[{ label: "Domains", href: "/domains" }, { label: zone }]}>
        <NotFoundInline what="DNS zone" />
      </Screen>
    );
  }

  const guidanceHref = `/domains/${domain.id}/dns-guidance`;

  return (
    <Screen
      id={gate.id}
      breadcrumbs={[
        { label: "Domains", href: "/domains" },
        { label: domain.name, href: `/domains/${domain.id}` },
        { label: gate.crumb },
      ]}
    >
      <UnsupportedState
        title={gate.title}
        body={gate.body}
        action={{ label: "Use DNS guidance mode", href: guidanceHref }}
      />

      <div className="mt-4 flex flex-col gap-4">
        {cap.reason !== null && (
          <p className="flex items-start gap-1.5 text-xs text-ink-2">
            <span className="font-medium text-ink">Capability:</span>
            <span className="min-w-0">{cap.reason}</span>
          </p>
        )}

        {variant === "editor" && (
          <Callout tone="success" title={`Guidance mode active for ${domain.name}`}>
            The v1 DNS experience is already doing the useful part of a zone editor:{" "}
            <Link href={guidanceHref} className="font-medium text-accent hover:underline">
              open the DNS guidance screen
            </Link>{" "}
            for the exact records to add at your registrar, propagation checks and error diagnosis. This is the
            honest v1 state for authoritative DNS — it arrives in v2.
          </Callout>
        )}

        <Card
          title={variant === "dnssec" ? "What v2 will add for DNSSEC" : "What the v2 surface will add"}
          description={
            variant === "editor"
              ? "Record table with add/edit/delete, TTL handling, conflict and syntax validation, and a reviewed diff before any change applies."
              : variant === "review"
                ? "Before/after per record, affected-record summary, approval step and a propagation follow-up that never claims worldwide completion."
                : "Key generation, DS records with registrar instructions, tested rollover and an explicit warning flow — mismatched DS records can break resolution for the whole domain."
          }
        >
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
            {variant !== "dnssec" && (
              <>
                <li>Authoritative hosting of the zone on this panel (primary), with secondaries in v2.</li>
                <li>Reviewed changes with a durable operation per apply — no silent edits.</li>
                <li>Full DNSSEC support once the zone is hosted here.</li>
              </>
            )}
            {variant === "dnssec" && (
              <>
                <li>Panel-held signing keys with automated rollover.</li>
                <li>DS record values to publish at your registrar, with copyable values.</li>
                <li>Pre-change validation so a wrong DS cannot take {domain.name} offline silently.</li>
              </>
            )}
          </ul>
        </Card>

        {guidance !== undefined && variant !== "dnssec" && (
          <Card
            title={`Records guidance already covers for ${zone}`}
            description="Read-only — in v1 these records live at your registrar; the panel verifies what public resolvers see."
            actions={
              <Link href={guidanceHref} className="text-sm font-medium text-accent hover:underline">
                Open DNS guidance
              </Link>
            }
          >
            <GuidanceRecordsTable records={guidance.records} caption={`DNS guidance records for ${zone}`} />
          </Card>
        )}
      </div>
    </Screen>
  );
}
