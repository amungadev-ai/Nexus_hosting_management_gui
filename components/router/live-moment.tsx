"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";

/**
 * The “you're live” moment every router path ends with (FLOW-013/014) —
 * calm, honest, verified: it appears only after the operation reports
 * `postcondition_verified`. Shows the elapsed time from router start so the
 * DEC-011 “install to live 1-page site in under 10 minutes” test is visible
 * in the product itself.
 */
export function LiveMoment({
  url,
  title,
  nextSteps,
}: {
  url: string;
  title: string;
  nextSteps: { label: string; href: string; hint?: string }[];
}) {
  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    const started = window.sessionStorage.getItem("nx.router_started_at");
    if (!started) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((Date.now() - new Date(started).getTime()) / 1000));
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setElapsed(m > 0 ? `${m} min ${s} s` : `${s} s`);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-xl rounded-card border border-line bg-surface p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
        <Icon name="check-circle" size={24} />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">{title} is live</h1>
      <p className="mt-2 text-sm text-ink-2">
        Verified from the outside just now. Your site is being served over HTTPS.
      </p>
      <p className="mt-3 inline-flex items-center gap-2 rounded-control border border-line bg-surface-2 px-3 py-1.5 font-mono text-sm">
        <Icon name="globe" size={14} className="text-ink-2" />
        {url}
      </p>
      {elapsed && (
        <p className="mt-3 text-xs text-ink-2">
          {elapsed} from “What do you want to run?” to live — target: under 10 minutes.
        </p>
      )}
      <div className="mt-6 border-t border-line pt-4 text-left">
        <h2 className="text-sm font-medium">Good next steps</h2>
        <ul className="mt-2 space-y-2">
          {nextSteps.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="flex items-center justify-between rounded-control border border-line px-3 py-2 text-sm transition-colors hover:border-accent"
              >
                <span>
                  {s.label}
                  {s.hint && <span className="ml-2 text-xs text-ink-2">{s.hint}</span>}
                </span>
                <Icon name="chevron-right" size={14} className="text-ink-2" />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/overview" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Go to your portfolio →
        </Link>
      </div>
    </div>
  );
}
