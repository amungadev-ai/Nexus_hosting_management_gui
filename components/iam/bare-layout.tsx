"use client";

import Link from "next/link";
import { SCREENS } from "@/lib/screens";
import { cx } from "@/lib/format";
import { Icon } from "@/components/ui/icons";
import { ToastViewport } from "@/components/ui/toast";

/**
 * Bare-layout shell for the four identity screens that live OUTSIDE the
 * panel (setup, onboarding, auth — the router appears before any
 * organization context exists, Stage 3 §2.2). Calm centered card on the
 * canvas token, NexusPanel wordmark + prototype chip, and the screen-ID
 * chip so every bare screen stays traceable to Stage 3 §8. Small footer
 * links back to the landing page.
 */

export function BareLayout({
  screenId,
  width = "md",
  children,
}: {
  screenId: string;
  width?: "md" | "lg" | "wide";
  children: React.ReactNode;
}) {
  const def = SCREENS.find((s) => s.id === screenId);
  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div
          className={cx(
            "mx-auto w-full",
            width === "wide" ? "max-w-5xl" : width === "lg" ? "max-w-2xl" : "max-w-md"
          )}
        >
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-accent text-accent-ink">
              <Icon name="layers" size={18} />
            </span>
            <span className="text-base font-semibold tracking-tight">NexusPanel</span>
            <span className="rounded-control border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink-2">
              prototype
            </span>
            {def !== undefined && (
              <span
                title={`Stage 3 ${def.spec_section} — ${def.title}`}
                className="rounded-control border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-2"
              >
                {def.id}
              </span>
            )}
          </div>
          {children}
        </div>
      </div>
      <ToastViewport />
      <footer className="border-t border-line px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
          <span>NexusPanel GUI prototype — behavioral-spec screens, all data mocked.</span>
          <Link href="/" className="font-medium text-accent hover:underline">
            Back to the landing page
          </Link>
        </div>
      </footer>
    </main>
  );
}
