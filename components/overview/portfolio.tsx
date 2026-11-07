"use client";

import React from "react";
import Link from "next/link";
import type { Application, ServiceInstance, UsageSnapshot, Website } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { templateForKey } from "@/lib/mock/services";
import { cx, formatMb } from "@/lib/format";
import { Chip, StatusPill, type StatusPillStatus } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/misc";
import { Icon, type IconName } from "@/components/ui/icons";
import { Card } from "@/components/ui/card";

/**
 * Service portfolio building blocks (UX-OV-001): sectioned cards of
 * everything this installation runs, one honest row per workload — status
 * pill with freshness, kind/runtime chip, primary domain, mini RAM usage.
 */

export function siteStatusPill(w: Website): StatusPillStatus {
  switch (w.status) {
    case "active":
      return "active";
    case "provisioning":
      return "provisioning";
    case "suspended":
      return "offline";
    case "closing":
      return "pending";
  }
}

export function RamMiniBar({ usage }: { usage: UsageSnapshot }) {
  return (
    <div className="w-40 min-w-32 shrink-0">
      <ProgressBar
        value={usage.ram_mb.current}
        max={usage.ram_mb.allocated}
        tone={usage.ram_mb.current / Math.max(1, usage.ram_mb.allocated) > 0.8 ? "warning" : "accent"}
        label="RAM usage"
      />
      <p className="mt-1 text-xs tabular-nums text-ink-3">
        {formatMb(usage.ram_mb.current)} / {formatMb(usage.ram_mb.allocated)} RAM
      </p>
    </div>
  );
}

export interface PortfolioRowProps {
  href: string | null;
  pill: StatusPillStatus;
  pillAt: string;
  title: string;
  chips: React.ReactNode;
  meta: string;
  usage: UsageSnapshot;
  trailing?: React.ReactNode;
}

export function PortfolioRow({ href, pill, pillAt, title, chips, meta, usage, trailing }: PortfolioRowProps) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={pill} />
          <span className="truncate text-sm font-medium text-ink">{title}</span>
          {chips}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-2">{meta}</p>
      </div>
      <RamMiniBar usage={usage} />
      {trailing ?? (href !== null ? <Icon name="chevron-right" size={16} className="shrink-0 text-ink-3" /> : null)}
    </>
  );
  const layout =
    "flex items-center gap-3 px-4 py-3 sm:px-6 max-md:flex-wrap";
  if (href === null) {
    return <div className={cx(layout, "bg-surface-2/40")}>{body}</div>;
  }
  return (
    <Link href={href} className={cx(layout, "transition-colors hover:bg-surface-2")}>
      {body}
    </Link>
  );
}

export function PortfolioSection({
  icon,
  title,
  count,
  empty,
  children,
}: {
  icon: IconName;
  title: string;
  count: number;
  empty: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0">
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-2">
            <Icon name={icon} size={15} />
          </span>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <span className="rounded-control bg-surface-2 px-1.5 py-0.5 text-xs tabular-nums text-ink-2">{count}</span>
        </div>
        {count === 0 ? (
          empty
        ) : (
          <div className="divide-y divide-line">
            {children}
          </div>
        )}
      </Card>
    </section>
  );
}

export function WebsiteChips({ w }: { w: Website }) {
  return (
    <>
      <Chip tone="neutral">{w.kind === "php" ? `PHP ${w.php_version ?? ""}`.trim() : w.kind === "node" ? `Node ${w.node_version ?? ""}`.trim() : "static"}</Chip>
      <Chip tone="accent">{w.primary_domain}</Chip>
    </>
  );
}

export function AppChips({ a }: { a: Application }) {
  return (
    <>
      <Chip tone="neutral">
        {a.runtime} {a.runtime_version}
      </Chip>
      {a.category === "batch" && <Chip tone="info">batch · low priority</Chip>}
    </>
  );
}

export function ServiceChips({ s }: { s: ServiceInstance }) {
  const tpl = templateForKey(s.template_key);
  return (
    <>
      <Chip tone="neutral">{tpl?.name ?? s.template_key}</Chip>
      <Chip tone={s.exposure === "public" ? "success" : "neutral"}>{s.exposure}</Chip>
    </>
  );
}

export function serviceMeta(s: ServiceInstance): string {
  return `${s.hostname ?? "no hostname yet"} · v${s.version}`;
}

/* ------------------------------------------------------------------ */
/* Getting started checklist (first-run follow-up, FLOW-013)           */
/* ------------------------------------------------------------------ */

interface ChecklistItem {
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

function gettingStartedItems(): ChecklistItem[] {
  const domainConnected = db.domains.some((d) => d.state === "verified");
  const backupsOn = db.backups.length > 0;
  return [
    {
      label: "Connect a domain",
      hint: domainConnected
        ? `Verified: ${db.domains.find((d) => d.state === "verified")?.name ?? ""}`
        : "Add a domain and point it at this server with the guided records.",
      href: "/domains",
      done: domainConnected,
    },
    {
      label: "Enable backups",
      hint: backupsOn
        ? `${db.backups.length} verified snapshot${db.backups.length === 1 ? "" : "s"} on the nightly policy.`
        : "Attach a remote destination and set a nightly policy.",
      href: "/backups/policies",
      done: backupsOn,
    },
    {
      label: "Set up email",
      hint: "V1 uses external SMTP for outbound mail; mailboxes get an honest recommendation.",
      href: "/email/recommendation",
      done: false,
    },
  ];
}

export function GettingStartedCard() {
  const items = gettingStartedItems();
  const doneCount = items.filter((i) => i.done).length;
  return (
    <Card
      title="Getting started"
      description={`Set up the essentials — ${doneCount} of ${items.length} done. This checklist disappears once you finish it.`}
      actions={
        <span className="text-xs tabular-nums text-ink-3" aria-hidden="true">
          {doneCount}/{items.length}
        </span>
      }
    >
      <ul className="mt-1 flex list-none flex-col divide-y divide-line p-0">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-start gap-3 py-3 transition-colors hover:bg-surface-2 -mx-2 px-2 rounded-control"
            >
              <span
                className={cx(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  item.done ? "bg-success-soft text-success" : "border border-line bg-surface text-ink-3"
                )}
                aria-hidden="true"
              >
                <Icon name={item.done ? "check" : "chevron-right"} size={12} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {item.label}
                  {item.done && <Chip tone="success">done</Chip>}
                </span>
                <span className="mt-0.5 block text-xs text-ink-2">{item.hint}</span>
              </span>
              <Icon name="arrow-right" size={14} className="ml-auto mt-1 shrink-0 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
