"use client";

import Link from "next/link";
import { useState } from "react";
import { useCapability } from "@/components/providers";
import { Icon } from "@/components/ui/icons";

const options = [
  { id: "static", name: "Static website", detail: "HTML, CSS, JavaScript or a compiled frontend", href: "/websites/new", icon: "globe" as const, cap: "website.static" as const, hint: "Best for landing pages and portfolios" },
  { id: "php", name: "PHP website", detail: "PHP runtime, WordPress or a traditional CMS", href: "/websites/new", icon: "box" as const, cap: "website.php" as const, hint: "Best for PHP-powered websites" },
  { id: "node", name: "Node.js application", detail: "Git deployment, runtime, build, process and environment", href: "/apps/new", icon: "cpu" as const, cap: "app.node" as const, hint: "Best for APIs, dashboards and full-stack apps" },
];

export default function ConnectedWebLauncher() {
  const [selected, setSelected] = useState("static");
  const staticCap = useCapability("website.static");
  const phpCap = useCapability("website.php");
  const nodeCap = useCapability("app.node");
  const capabilities = { static: staticCap, php: phpCap, node: nodeCap };
  const current = options.find((o) => o.id === selected)!;
  const capability = capabilities[selected as keyof typeof capabilities];
  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-accent">Connected setup · Batch 02</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">What would you like to publish?</h1><p className="mt-2 max-w-2xl text-sm text-ink-2">Start with your goal. NexusPanel will guide you through source, runtime, domain and HTTPS without making you navigate six different tools.</p></div>
        <Link className="text-sm text-accent hover:underline" href="/overview">Back to overview</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {options.map((option) => {
          const cap = capabilities[option.id as keyof typeof capabilities];
          return <button type="button" key={option.id} onClick={() => setSelected(option.id)} aria-pressed={selected === option.id} className={`rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${selected === option.id ? "border-accent bg-accent-soft shadow-sm" : "border-line bg-surface"}`}>
            <span className="flex items-center justify-between"><span className="rounded-xl bg-surface-2 p-3"><Icon name={option.icon} size={22}/></span><span className={`rounded-full px-2 py-1 text-xs ${cap.state === "unavailable" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>{cap.state}</span></span>
            <span className="mt-5 block text-base font-semibold text-ink">{option.name}</span><span className="mt-1 block text-sm text-ink-2">{option.detail}</span><span className="mt-4 block text-xs text-ink-3">{option.hint}</span>
          </button>;
        })}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-line bg-surface p-6"><h2 className="text-lg font-semibold text-ink">Your publishing journey</h2><p className="mt-1 text-sm text-ink-2">One connected flow; advanced settings remain available later.</p>
          <ol className="mt-6 space-y-5">{[
            ["1", "Choose your project", "Website or application — with capability checks"],
            ["2", "Connect your code", "Git repository or uploaded files"],
            ["3", "Configure hosting", "Runtime, commands and resource preflight when needed"],
            ["4", "Choose a domain", "Existing domain, new domain or preview hostname"],
            ["5", "Deploy and verify", "Tracked operation, HTTPS and a health check"],
          ].map(([number, title, detail]) => <li key={number} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{number}</span><span><span className="block text-sm font-semibold text-ink">{title}</span><span className="text-xs text-ink-2">{detail}</span></span></li>)}</ol>
        </section>
        <aside className="rounded-2xl border border-line bg-surface p-6"><h2 className="text-lg font-semibold text-ink">Ready to start?</h2><p className="mt-2 text-sm text-ink-2">Selected: <strong className="text-ink">{current.name}</strong></p>
          {capability.state === "unavailable" ? <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4 text-sm text-ink-2"><strong className="block text-ink">Not supported by this VPS profile</strong><p className="mt-2">{capability.reason}</p><Link className="mt-3 inline-block text-accent underline" href="/system/upgrade">View upgrade requirements</Link></div> : <><p className="mt-4 text-xs text-ink-2">The next screen gathers the settings for this project. No server changes happen until you review and submit.</p><Link href={current.href} className="mt-6 flex h-11 items-center justify-center rounded-control bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">Continue with {current.name} →</Link></>}
          <div className="mt-6 border-t border-line pt-4"><p className="text-xs font-semibold text-ink">Already have a project?</p><div className="mt-2 flex flex-wrap gap-3 text-sm"><Link className="text-accent hover:underline" href="/websites">Websites</Link><Link className="text-accent hover:underline" href="/apps">Applications</Link><Link className="text-accent hover:underline" href="/domains">Domains</Link></div></div>
        </aside>
      </div>
    </main>
  );
}
