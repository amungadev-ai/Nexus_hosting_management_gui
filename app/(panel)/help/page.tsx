"use client";

import React, { useMemo, useState } from "react";
import { HELP_SECTIONS } from "@/lib/mock/overview";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";

/**
 * UX-OV-008 — Help center: categorized articles written as real guidance
 * (not lorem), the "What can my VPS run?" lay-person entry, and support.
 */
export default function HelpPage() {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return HELP_SECTIONS;
    return HELP_SECTIONS.map((s) => ({
      ...s,
      articles: s.articles.filter(
        (a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)
      ),
    })).filter((s) => s.articles.length > 0);
  }, [query]);

  return (
    <Screen
      id="UX-OV-008"
      breadcrumbs={[{ label: "Help" }]}
      actions={
        <ButtonLink href="/support" variant="secondary" icon="message-square">
          Contact support
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search the guides…"
          aria-label="Search help articles"
          className="max-w-xl"
        />

        <Card className="border-info/40 bg-info-soft">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface text-info">
              <Icon name="help-circle" size={16} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">What can my VPS run?</h2>
              <p className="mt-1 text-sm text-ink">
                The plain-language answer, read live from this VPS&apos; capability set: what runs now, what runs
                but is tight, and what cannot run — each with the reason and the upgrade that changes it.
              </p>
              <ButtonLink href="/overview/capabilities" variant="secondary" size="sm" className="mt-2" icon="arrow-right">
                Open the capability overview
              </ButtonLink>
            </div>
          </div>
        </Card>

        {sections.length === 0 ? (
          <EmptyState
            icon="search"
            title="No articles match"
            body="Try a shorter phrase — or contact support and include the correlation ID of the job you're asking about."
            action={{ label: "Contact support", href: "/support" }}
            secondaryAction={{ label: "Clear search", onClick: () => setQuery("") }}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {sections.map((section) => (
              <Card key={section.id}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-control bg-surface-2 text-ink-2">
                    <Icon name={section.icon} size={15} />
                  </span>
                  <h2 className="text-sm font-semibold text-ink">{section.title}</h2>
                </div>
                <ul className="mt-3 flex list-none flex-col gap-4 p-0">
                  {section.articles.map((a) => (
                    <li key={a.title}>
                      <h3 className="text-sm font-medium text-ink">
                        {a.href !== undefined ? (
                          <a href={a.href} className="text-accent hover:underline">
                            {a.title}
                          </a>
                        ) : (
                          a.title
                        )}
                      </h3>
                      <p className="mt-1 text-sm text-ink-2">{a.body}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}

        <p className="px-1 text-xs text-ink-2">
          Every job has a correlation ID you can paste into a support ticket — it links the safe, redacted logs
          without exposing secrets.
        </p>
      </div>
    </Screen>
  );
}
