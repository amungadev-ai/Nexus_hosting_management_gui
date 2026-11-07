"use client";

import React from "react";
import Link from "next/link";
import { SCREENS, type ScreenDef } from "@/lib/screens";
import { useSession } from "@/components/providers";
import { cx } from "@/lib/format";

/**
 * <Screen id="UX-WEB-001"> — the archetype frame every screen composes.
 *
 * Gives each of the 184 screens: breadcrumb + title + description header,
 * the prototype traceability chip (screen ID → Stage 3 §8), the v2 phase
 * chip, primary actions slot, and a presentation-level persona guard.
 * The guard is PRESENTATION ONLY (persona ≠ permission): the API remains the
 * authorization authority; this never leaks resource existence.
 */

export interface Crumb {
  label: string;
  href?: string;
}

function roleCovers(audience: string, persona: string, roleLabels: string[]): boolean {
  const a = audience.toLowerCase();
  if (a === "all" || a === "authorized" || a === "authorized members" || a === "authorized opt-in" || a === "authorized admins" || a === "authorized auditors" || a === "billing authorized" || a === "approvers") return true;
  if (a === "admin only") return roleLabels.includes("owner") || roleLabels.includes("provider");
  if (a === "explicit privileged scope") return true;
  return roleLabels.includes(a) || persona === a;
}

export function Screen({
  id,
  breadcrumbs,
  description,
  actions,
  children,
  noPad,
}: {
  id: string;
  breadcrumbs?: Crumb[];
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  const def: ScreenDef | undefined = SCREENS.find((s) => s.id === id);
  const { persona } = useSession();
  const roleLabels = roleLabelsFor(persona);

  if (!def) {
    return <div className="p-6 text-ink-2">Unknown screen: {id}</div>;
  }

  const allowed = def.audiences.some((a) => roleCovers(a, persona, roleLabels));
  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg mt-16 rounded-card border border-line bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold">You don&apos;t have access to this area</h1>
        <p className="mt-2 text-sm text-ink-2">
          This area isn&apos;t part of your current workspace view. If you believe you should
          have access, ask your administrator — the request and decision will be audited.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Back to your landing page
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-ink-2">
            {breadcrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">/</span>}
                {c.href ? (
                  <Link href={c.href} className="hover:text-ink hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{def.title}</h1>
              <span
                className="rounded-control border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2"
                title={`Stage 3 ${def.spec_section} — behavioral spec, not implementation-approved`}
              >
                {def.id}
              </span>
              {def.phase === "v2" && (
                <span
                  className="rounded-control border border-info/30 bg-info-soft px-1.5 py-0.5 text-[11px] font-medium text-info"
                  title="Spec phase v2 — deferred surface; screens render the gate honestly"
                >
                  v2 scope
                </span>
              )}
            </div>
            {(description || def.summary) && (
              <p className="mt-1 max-w-3xl text-sm text-ink-2">{description ?? def.summary}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className={cx(noPad && "mt-2")}>{children}</div>
    </div>
  );
}

function roleLabelsFor(persona: string): string[] {
  switch (persona) {
    case "self_hoster":
    case "website_owner":
    case "explorer":
      return ["owner"];
    case "app_developer":
      return ["developer"];
    case "storage_user":
      return ["customer"];
    case "reseller":
      return ["reseller"];
    case "provider_admin":
      return ["provider"];
    case "infrastructure_user":
      return ["support", "auditor"];
    default:
      return [];
  }
}
