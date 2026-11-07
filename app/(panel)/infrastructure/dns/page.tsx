"use client";

import React from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { UnsupportedState } from "@/components/common/states";
import { useCapability } from "@/components/providers";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { dnsZones } from "@/lib/mock/dns";
import { db } from "@/lib/mock/data";

/**
 * UX-DNS-009 — DNS infrastructure (provider). Primary/secondary DNS, health,
 * replication and zones are v2+ surfaces; the honest v1 screen explains
 * guidance mode vs future hosted DNS and points at the domains inventory.
 */
export default function DnsInfrastructurePage() {
  const cap = useCapability("dns.authoritative");
  const zones = dnsZones();

  return (
    <Screen id="UX-DNS-009">
      <UnsupportedState
        title="Primary/secondary DNS infrastructure is a v2 surface"
        body="Running authoritative DNS for customer domains needs primary/secondary name servers, replication health monitoring and zone management. NexusPanel defers that to v2: in v1 the panel deliberately does not answer DNS for any domain — your DNS stays at your registrar, and the panel verifies what public resolvers observe."
        action={{ label: "Open the domains inventory", href: "/domains" }}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Today — v1: DNS guidance mode" description="What the panel actually does for DNS right now.">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
            <li>No hosted zones — the panel never answers authoritatively for a domain.</li>
            <li>Per-domain guidance: the exact records to add at the registrar, with copyable values.</li>
            <li>Propagation checks against named public resolvers (Cloudflare, Safaricom, Liquid), never a worldwide “fully propagated” claim.</li>
            <li>Ownership verification via TXT challenges and a delegation checklist for parked domains.</li>
            <li>Let&apos;s Encrypt certificates over HTTP-01 once a domain actually resolves here.</li>
          </ul>
          <p className="mt-3 text-xs text-ink-3">{cap.reason}</p>
        </Card>

        <Card title="v2 — authoritative DNS hosting" description="What this screen will manage once DNS hosting ships.">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
            <li>Primary name server on this panel, with independently hosted secondaries.</li>
            <li>Replication and zone-health monitoring with honest last-checked timestamps.</li>
            <li>Zone editor, change review and DNSSEC (keys, DS records, tested rollover).</li>
            <li>Per-domain choice of DNS mode: registrar-hosted (guidance) or panel-hosted (authoritative).</li>
          </ul>
          <p className="mt-3 text-sm">
            <Link href="/domains" className="font-medium text-accent hover:underline">
              Meanwhile, manage domains and DNS guidance →
            </Link>
          </p>
        </Card>
      </div>

      <Card
        title="Zones that v2 would host"
        className="mt-4"
        description="Derived from the domain inventory — each domain name is the zone authoritative DNS would take over."
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {zones.length === 0 ? (
            <p className="text-sm text-ink-2">No domains yet — add one from the domains inventory.</p>
          ) : (
            zones.map((z) => {
              const d = db.domains.find((dom) => dom.id === z.domain_id);
              return (
                <Link key={z.zone} href={`/domains/${z.domain_id}/dns-guidance`}>
                  <Chip tone={z.has_guidance ? "accent" : "neutral"}>
                    {z.zone}
                    {d !== undefined && d.state !== "verified" ? ` · ${d.state.replace(/_/g, " ")}` : ""}
                  </Chip>
                </Link>
              );
            })
          )}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Chips link to the v1 guidance screen for each domain. Authoritative hosting of these zones is planned for
          v2 — no hardware upgrade changes that today.
        </p>
      </Card>
    </Screen>
  );
}
