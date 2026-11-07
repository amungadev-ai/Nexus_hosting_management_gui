"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCapabilities, useSession, useLanding } from "@/components/providers";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/lib/format";
import { CAPABILITY_META } from "@/lib/profiles";
import { PERSONA_BY_ID } from "@/lib/personas";

/**
 * GET / resolved client-side from GET /me/persona-matrix + GET /me/default-landing
 * (Stage 6 §3): the guided router is the primary IA for "get something new
 * working" personas; the service portfolio for "manage what I already have".
 * This landing page composes both; the demo switcher in the top bar lets you
 * flip persona / first-run and watch the landing change.
 */
export default function LandingPage() {
  const landing = useLanding();
  const { persona, firstRun } = useSession();

  return (
    <main className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-accent text-accent-ink">
              <Icon name="layers" size={18} />
            </span>
            <span className="text-base font-semibold tracking-tight">NexusPanel</span>
            <span className="rounded-control border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
              prototype
            </span>
          </div>
          <p className="text-xs text-ink-2">
            Landing resolved for <strong>{PERSONA_BY_ID[persona].label}</strong> via
            {" "}<code className="font-mono">/me/default-landing</code> →{" "}
            <code className="font-mono">{landing}</code>
            {firstRun && " (first-run)"}
          </p>
        </div>

        {landing === "router" ? (
          <RouterIntro />
        ) : (
          <PortfolioLanding />
        )}
      </div>
    </main>
  );
}

function PortfolioLanding() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Your service portfolio</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Everything running on your VPS, at a glance — sites, apps, services, their
        status and their usage. The portfolio replaces the dashboard as the primary
        surface for returning users; the full menu stays one click away in
        “Advanced tools”.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/overview"
          className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Open the portfolio <Icon name="arrow-right" size={14} />
        </Link>
        <Link
          href="/overview/capabilities"
          className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong"
        >
          What can this VPS run?
        </Link>
      </div>
    </div>
  );
}

/**
 * FLOW-013 — the Router: “Welcome to NexusPanel. What do you want to run?”
 * Six cards (DS-024), capability-aware availability, with the “I'm not sure
 * yet” fallback below. Router cards: vertical on mobile, 2×3 tablet, 3×2
 * desktop; fully tappable.
 */
export function RouterIntro({ compact }: { compact?: boolean }) {
  const caps = useCapabilities();
  const { profile } = useSession();
  const router = useRouter();

  // Start the DEC-011 timed test: install → live 1-page site in under 10 minutes.
  useEffect(() => {
    if (!window.sessionStorage.getItem("nx.router_started_at")) {
      window.sessionStorage.setItem("nx.router_started_at", new Date().toISOString());
    }
  }, []);

  const stateOf = (key: string) => caps.find((c) => c.capability_key === key);

  const cards: {
    title: string;
    blurb: string;
    icon: "globe" | "zap" | "box" | "cloud" | "server";
    href: string;
    capabilityKey?: string;
  }[] = [
    { title: "A website", blurb: "A fast static site or a WordPress blog, live on your own domain.", icon: "globe", href: "/websites/new", capabilityKey: "website.static" },
    { title: "An application", blurb: "Deploy a Node app from Git with processes, env vars and logs.", icon: "zap", href: "/apps/new", capabilityKey: "app.node" },
    { title: "A self-hosted app", blurb: "Nextcloud, Gitea, Ghost, n8n — one-click from the template catalog.", icon: "box", href: "/templates", capabilityKey: "service.docker" },
    { title: "Data & storage", blurb: "S3-compatible buckets, image pipelines, caches and search.", icon: "cloud", href: "/services/storage/new", capabilityKey: "service.storage" },
    { title: "Infrastructure", blurb: "Servers, capability detection, fleet topology and maintenance.", icon: "server", href: "/infrastructure/servers" },
  ];

  return (
    <div>
      <h1 className={cx("font-semibold tracking-tight", compact ? "text-xl" : "text-2xl")}>
        Welcome to NexusPanel. What do you want to run?
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Pick a starting point — we&apos;ll handle the server setup. You can always
        change course; nothing here is irreversible.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const rec = card.capabilityKey ? stateOf(card.capabilityKey) : undefined;
          const unavailable = rec?.state === "unavailable";
          const borderline = rec?.state === "borderline";
          const meta = card.capabilityKey ? CAPABILITY_META[card.capabilityKey] : undefined;
          const sub = unavailable
            ? `Not available on this VPS — ${rec?.reason ?? meta?.upgrade ?? "needs more resources"}`
            : borderline
              ? `Runs, but tight — ${rec?.reason ?? "close to resource limits"}`
              : "Available on this VPS";
          return (
            <button
              key={card.title}
              type="button"
              onClick={() => router.push(card.href)}
              className={cx(
                "group rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-accent hover:shadow-sm",
                unavailable && "opacity-90"
              )}
            >
              <span
                className={cx(
                  "flex h-9 w-9 items-center justify-center rounded-control",
                  unavailable ? "bg-surface-2 text-ink-2" : "bg-accent-soft text-accent"
                )}
              >
                <Icon name={card.icon} size={18} />
              </span>
              <h2 className="mt-3 text-base font-medium">{card.title}</h2>
              <p className="mt-1 text-sm text-ink-2">{card.blurb}</p>
              <p
                className={cx(
                  "mt-3 text-xs leading-snug",
                  unavailable ? "text-warning" : borderline ? "text-warning" : "text-success"
                )}
              >
                {sub}
              </p>
              {!unavailable ? (
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  Get started
                  <Icon name="arrow-right" size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              ) : (
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-ink-2">
                  View requirements
                  <Icon name="arrow-right" size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
              {unavailable && meta && (
                <span className="mt-3 block text-xs text-ink-2">{meta.upgrade}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-card border border-line bg-surface p-4">
        <Link href="/overview/capabilities" className="group inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
          I&apos;m not sure yet
          <span className="text-ink-2 group-hover:text-ink">— let&apos;s see what your {profile} VPS can do first</span>
          <Icon name="arrow-right" size={13} />
        </Link>
      </div>

      <div className="mt-8 border-t border-line pt-4">
        <p className="text-xs text-ink-2">
          Know your way around?{" "}
          <Link href="/overview" className="font-medium text-accent hover:underline">
            Advanced tools
          </Link>{" "}
          opens the full menu — the same tools, the same permissions, just laid out for experts.
        </p>
      </div>
    </div>
  );
}
