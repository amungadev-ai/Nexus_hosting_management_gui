"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/common/screen";
import { UnavailableState } from "@/components/common/states";
import { useCapability } from "@/components/providers";
import { ButtonLink } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table";
import { StatusPill } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/feedback";
import { KindChip, ListSkeleton, MiniUsage, useFixtureList } from "@/components/web/web-bits";
import { listWebsites } from "@/lib/api/web";
import type { Website } from "@/lib/types";
import { formatRelative } from "@/lib/format";

/**
 * UX-WEB-001 — Websites list. Populated fixture data by default, honest
 * empty/loading states, and a capability-honest Create path.
 */
export default function WebsitesListPage() {
  const websites = useFixtureList(listWebsites);
  const staticCap = useCapability("website.static");
  const router = useRouter();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    if (websites === null) return null;
    const q = query.trim().toLowerCase();
    if (q === "") return websites;
    return websites.filter(
      (w) => w.title.toLowerCase().includes(q) || w.primary_domain.toLowerCase().includes(q)
    );
  }, [websites, query]);

  return (
    <Screen
      id="UX-WEB-001"
      actions={
        <ButtonLink href="/websites/new" icon="plus">
          Create
        </ButtonLink>
      }
    >
      {staticCap.state === "unavailable" && (
        <div className="mb-4">
          <UnavailableState capabilityKey="website.static" />
        </div>
      )}

      <div className="mb-3 max-w-sm">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Filter by name or domain"
          aria-label="Filter websites by name or domain"
        />
      </div>

      {rows === null || websites === null ? (
        <ListSkeleton rows={4} cols={6} />
      ) : rows.length === 0 && websites.length > 0 ? (
        <EmptyState
          icon="search"
          title="No websites match this filter"
          body={`Nothing matches “${query}”. Clear the filter to see all ${websites.length} websites.`}
          action={{ label: "Clear filter", onClick: () => setQuery("") }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="globe"
          title="No websites yet"
          body="Your server is ready — it just has nothing to serve. Create your first website: pick static, PHP (WordPress) or Node, and the wizard checks what your VPS can run."
          action={{ label: "Create your first website", href: "/websites/new" }}
          secondaryAction={{ label: "What can my VPS run?", href: "/overview/capabilities" }}
        />
      ) : (
        <TableCard<Website>
          title="Websites"
          caption="Websites with domain, runtime, SSL, health and account"
          rowKey={(w) => w.id}
          onRowClick={(w) => {
            router.push(`/websites/${w.id}`);
          }}
          emptyState={<EmptyState title="No websites" body="Create a website to get started." action={{ label: "Create", href: "/websites/new" }} />}
          columns={[
            {
              key: "title",
              header: "Website",
              sortable: true,
              className: "sticky left-0 bg-surface",
              render: (w) => (
                <Link href={`/websites/${w.id}`} className="font-medium text-accent hover:underline">
                  <span className="block truncate">{w.title}</span>
                  <span className="block truncate text-xs text-ink-2">{w.name}</span>
                </Link>
              ),
            },
            {
              key: "primary_domain",
              header: "Domain",
              sortable: true,
              render: (w) => (
                <Link href="/domains" className="truncate text-sm text-ink hover:text-accent hover:underline">
                  {w.primary_domain}
                </Link>
              ),
            },
            { key: "kind", header: "Runtime", render: (w) => <KindChip kind={w.kind} /> },
            {
              key: "health",
              header: "Status",
              render: (w) => <StatusPill status={w.status === "active" ? w.health === "healthy" ? "healthy" : w.health === "degraded" ? "degraded" : "unknown" : "provisioning"} at={w.last_verified_at} />,
            },
            { key: "usage", header: "Mini usage", render: (w) => <MiniUsage usage={w.usage} seedId={w.id} /> },
            {
              key: "created_at",
              header: "Created",
              sortable: true,
              render: (w) => <span className="whitespace-nowrap text-xs text-ink-2">{formatRelative(w.created_at)}</span>,
            },
          ]}
          rows={rows}
        />
      )}

      {rows !== null && rows.length > 0 && (
        <p className="mt-3 text-xs text-ink-3">
          Status reflects the last verified health check — {formatRelative(rows[0].last_verified_at)} for{" "}
          {rows[0].title}. Provisioning sites show their pending job.
        </p>
      )}
    </Screen>
  );
}
