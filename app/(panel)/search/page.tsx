"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { searchAll, SEARCH_HINT, type SearchResult } from "@/lib/mock/overview";
import { Screen } from "@/components/common/screen";
import { SearchInput } from "@/components/ui/form";
import { Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Icon, type IconName } from "@/components/ui/icons";
import { Card } from "@/components/ui/card";

/**
 * UX-OV-003 — Resource search: grouped, live-filtered results over every
 * authorized resource (websites, apps, domains, certificates, platform
 * services, invoices, payments, templates) plus matching screens.
 */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchAll(query), [query]);

  const groups = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return [...map.entries()];
  }, [results]);

  const GROUP_ICON: Record<string, IconName> = {
    Websites: "globe",
    Applications: "cpu",
    Domains: "globe",
    Certificates: "shield",
    "Platform services": "box",
    Invoices: "file-text",
    Payments: "credit-card",
    Templates: "layers",
    Screens: "list",
  };

  return (
    <Screen id="UX-OV-003" breadcrumbs={[{ label: "Search" }]}>
      <div className="flex flex-col gap-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search sites, domains, invoices, services…"
          aria-label="Search resources"
          className="max-w-xl"
        />

        {query.trim() === "" ? (
          <Card title="What you can find here" description="Search covers everything your account can see — no cross-tenant results, ever.">
            <div className="mt-2 flex flex-wrap gap-2">
              {["kilishop", "acme", "orders", "nextcloud", "NP-2026", "minio", "invoice", "templates"].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setQuery(hint)}
                  className="rounded-control border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                >
                  {hint}
                </button>
              ))}
            </div>
          </Card>
        ) : results.length === 0 ? (
          <EmptyState
            icon="search"
            title="No results"
            body={SEARCH_HINT}
            action={{ label: "Clear search", onClick: () => setQuery("") }}
          />
        ) : (
          <p className="text-sm text-ink-2" role="status">
            {results.length} result{results.length === 1 ? "" : "s"} for “{query.trim()}”
          </p>
        )}

        {groups.map(([group, rows]) => (
          <section key={group} aria-label={group}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
              <Icon name={GROUP_ICON[group] ?? "list"} size={13} />
              {group}
              <span className="font-normal normal-case text-ink-3">({rows.length})</span>
            </h2>
            <ul className="flex list-none flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface p-0">
              {rows.map((r) => (
                <li key={`${r.group}-${r.id}`}>
                  <Link href={r.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                      <span className="block truncate text-xs text-ink-2">{r.context}</span>
                    </span>
                    <Chip tone={r.status === "failed" || r.status === "unhealthy" ? "warning" : "neutral"}>
                      {r.status.replace(/_/g, " ")}
                    </Chip>
                    <Icon name="chevron-right" size={15} className="shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Screen>
  );
}
