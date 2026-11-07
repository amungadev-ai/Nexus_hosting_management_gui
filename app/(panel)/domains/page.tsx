"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { ListSkeleton, useFixtureList } from "@/components/web/web-bits";
import { DomainStatusPill } from "@/components/dns/dns-bits";
import { listDomains } from "@/lib/api/dns";
import { allCertificates } from "@/lib/mock/dns";
import { db } from "@/lib/mock/data";
import type { DomainName } from "@/lib/types";
import { formatDate } from "@/lib/format";

/** UX-DNS-001 — Domains inventory: ownership, registrar, delegation, SSL and expiration. */
export default function DomainsPage() {
  const domains = useFixtureList(listDomains);
  const router = useRouter();
  const certs = allCertificates();

  const certFor = (name: string) => certs.find((c) => c.domains.includes(name));

  return (
    <Screen
      id="UX-DNS-001"
      actions={
        <ButtonLink href="/domains/new" icon="plus">
          Add domain
        </ButtonLink>
      }
    >
      {domains === null ? (
        <ListSkeleton rows={4} cols={5} />
      ) : domains.length === 0 ? (
        <EmptyState
          icon="globe"
          title="No domains yet"
          body="Add a .co.ke domain you own — the panel verifies ownership with a TXT record and then shows the exact DNS records to add at your registrar."
          action={{ label: "Add your first domain", href: "/domains/new" }}
          secondaryAction={{ label: "Connect a domain to a site", href: "/domains/connect" }}
        />
      ) : (
        <TableCard<DomainName>
          title="Domains"
          caption="Ownership, registrar, delegation, SSL and expiration"
          rowKey={(d) => d.id}
          onRowClick={(d) => router.push(`/domains/${d.id}`)}
          columns={[
            {
              key: "name",
              header: "Domain",
              sortable: true,
              className: "sticky left-0 bg-surface",
              render: (d) => (
                <Link href={`/domains/${d.id}`} className="font-medium text-accent hover:underline">
                  {d.name}
                </Link>
              ),
            },
            { key: "state", header: "Status", render: (d) => <DomainStatusPill domain={d} /> },
            { key: "registrar", header: "Registrar", render: (d) => <span className="whitespace-nowrap text-xs text-ink-2">{d.registrar ?? "—"}</span> },
            {
              key: "ssl",
              header: "SSL",
              render: (d) => {
                const cert = certFor(d.name);
                return cert !== undefined ? (
                  <Link href={`/certificates/${cert.id}`} className="text-xs text-accent hover:underline">
                    {cert.status === "active" ? "active" : cert.status}
                  </Link>
                ) : (
                  <Chip tone="warning">none — request</Chip>
                );
              },
            },
            { key: "expires_at", header: "Expires", render: (d) => <span className="whitespace-nowrap text-xs text-ink-2">{d.expires_at !== undefined ? formatDate(d.expires_at) : "—"}</span> },
            {
              key: "site",
              header: "Attached site",
              render: (d) => {
                const site = db.websites.find((w) => w.id === d.website_id);
                return site !== undefined ? (
                  <Link href={`/websites/${site.id}`} className="text-xs text-accent hover:underline">{site.title}</Link>
                ) : (
                  <span className="text-xs text-ink-3">—</span>
                );
              },
            },
          ]}
          rows={domains}
        />
      )}
      <p className="mt-3 text-xs text-ink-3">
        DNS modes in v1: external (guidance). Authoritative DNS hosting arrives in v2 — the inventory always
        shows the honest mode per domain.
      </p>
    </Screen>
  );
}
