"use client";

import React from "react";
import Link from "next/link";
import { cx, formatRelative, formatMb, formatGb, sparklinePath } from "@/lib/format";
import type { NotificationItem, ServiceTemplate, TemplateCategory } from "@/lib/types";
import { useNow, useSession, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { Button, ButtonLink } from "./button";
import { Chip } from "./badge";
import { Icon, type IconName } from "./icons";

/**
 * Misc primitives: KeyValue, ProgressBar, Sparkline, DiffViewer (DS-012),
 * NotificationList (DS-018) — plus TemplateCard (DS-027),
 * UpgradeRecommendation (DS-028) and AccessGrantBanner (DS-019) below.
 */

export function KeyValue({
  items,
  columns = 1,
  className,
}: {
  items: { label: string; value: React.ReactNode; mono?: boolean }[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl className={cx("grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`} className="min-w-0">
          <dt className="text-xs text-ink-3">{item.label}</dt>
          <dd
            className={cx(
              "mt-0.5 break-words text-sm text-ink",
              item.mono === true && "font-mono text-xs"
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type ProgressTone = "accent" | "success" | "warning" | "danger" | "info";

const PROGRESS_TONES: Record<ProgressTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  label,
  showValue = false,
  className,
}: {
  value: number;
  max?: number;
  tone?: ProgressTone;
  label?: string;
  showValue?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cx("min-w-0", className)}>
      {(label !== undefined || showValue) && (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 text-ink-2">{label}</span>
          {showValue && (
            <span className="shrink-0 tabular-nums text-ink-3">{Math.round(pct)}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={cx("h-full rounded-full", PROGRESS_TONES[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const SPARK_TONES: Record<
  "accent" | "success" | "warning" | "danger" | "info" | "neutral",
  string
> = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-ink-3",
};

export function Sparkline({
  values,
  width = 120,
  height = 28,
  tone = "accent",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "accent" | "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}) {
  const d = sparklinePath(values, width, height);
  if (d === "") return null;
  const toneClass = SPARK_TONES[tone];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cx("inline-block shrink-0", toneClass, className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface DiffHunk {
  path: string;
  before: string;
  after: string;
}

/** DS-012 diff viewer — side-by-side (stacked on mobile) before/after. */
export function DiffViewer({ hunks, className }: { hunks: DiffHunk[]; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {hunks.map((hunk) => (
        <div key={hunk.path} className="overflow-hidden rounded-control border border-line">
          <p className="border-b border-line bg-surface px-3 py-1.5 font-mono text-xs text-ink-2">
            {hunk.path}
          </p>
          <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
            <div className="bg-danger-soft p-3">
              <p className="flex items-center gap-1 text-xs font-medium text-danger">
                <Icon name="minus" size={12} /> Before
              </p>
              <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-xs text-ink">
                {hunk.before === "" ? "(empty)" : hunk.before}
              </p>
            </div>
            <div className="bg-success-soft p-3">
              <p className="flex items-center gap-1 text-xs font-medium text-success">
                <Icon name="plus" size={12} /> After
              </p>
              <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-xs text-ink">
                {hunk.after === "" ? "(empty)" : hunk.after}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const NOTIFICATION_SEVERITY: Record<
  NotificationItem["severity"],
  { icon: IconName; text: string }
> = {
  critical: { icon: "alert-triangle", text: "text-danger" },
  warning: { icon: "alert-triangle", text: "text-warning" },
  info: { icon: "info", text: "text-info" },
};

export function NotificationList({
  items,
  onRead,
  className,
}: {
  items: NotificationItem[];
  onRead?: (id: string) => void;
  className?: string;
}) {
  const now = useNow();
  return (
    <ul className={cx("divide-y divide-line overflow-hidden rounded-card border border-line bg-surface", className)}>
      {items.length === 0 && (
        <li className="p-4 text-sm text-ink-2">You're all caught up — no notifications.</li>
      )}
      {items.map((item) => {
        const meta = NOTIFICATION_SEVERITY[item.severity];
        const clickable = onRead !== undefined && !item.read;
        return (
          <li
            key={item.id}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onRead?.(item.id) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRead?.(item.id);
                    }
                  }
                : undefined
            }
            className={cx("flex gap-3 p-4", clickable && "cursor-pointer hover:bg-surface-2")}
          >
            <span className={cx("mt-0.5 shrink-0", meta.text)}>
              <Icon name={meta.icon} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {!item.read && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                )}
                {!item.read && <span className="sr-only">Unread.</span>}
                <h4 className="text-sm font-medium text-ink">{item.title}</h4>
                <span className="text-xs text-ink-3">{formatRelative(item.occurred_at, now)}</span>
              </div>
              <p className="mt-1 text-sm text-ink-2">{item.body}</p>
              {item.deep_link !== undefined && (
                <Link
                  href={item.deep_link}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1.5 inline-flex items-center gap-1 text-sm text-accent hover:underline"
                >
                  View details
                  <Icon name="arrow-right" size={12} />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* DS-027 Template card                                                */
/* ------------------------------------------------------------------ */

const TEMPLATE_CATEGORY_ICON: Record<TemplateCategory, IconName> = {
  storage: "cloud",
  transform: "zap",
  delivery: "globe",
  self_hosted_app: "box",
  database: "database",
  cache: "zap",
  queue: "layers",
  search: "search",
};

export function TemplateCard({
  template,
  state = "available",
  reason,
  onDeploy,
  deployHref,
  className,
}: {
  template: ServiceTemplate;
  state?: "available" | "borderline" | "unavailable";
  reason?: string | null;
  onDeploy?: () => void;
  deployHref?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:p-6", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-2">
          <Icon name={TEMPLATE_CATEGORY_ICON[template.category]} size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{template.name}</h3>
          <p className="mt-1 text-sm text-ink-2">{template.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="neutral">{template.category.split("_").join(" ")}</Chip>
      </div>
      <p className="text-xs text-ink-3">
        RAM floor {formatMb(template.ram_floor_mb)} · disk {formatGb(template.disk_floor_gb)}
        {template.docker_required ? " · requires Docker" : ""}
      </p>
      {state === "unavailable" && (
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">This server can&apos;t run {template.name}.</span>{" "}
          {reason ?? "It doesn't meet the template's resource requirements."} Upgrade to a larger
          server profile to deploy it.
        </p>
      )}
      {state === "borderline" && (
        <p className="text-sm text-ink-2">
          Runs on this profile, but with little headroom — check the resource profile below the
          template&apos;s typical usage.
        </p>
      )}
      {state !== "unavailable" && (onDeploy !== undefined || deployHref !== undefined) && (
        <div className="mt-auto pt-1">
          {deployHref !== undefined ? (
            <ButtonLink href={deployHref} size="sm">
              Deploy
            </ButtonLink>
          ) : (
            <Button size="sm" onClick={onDeploy}>
              Deploy
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DS-028 Upgrade recommendation                                       */
/* ------------------------------------------------------------------ */

export function UpgradeRecommendation({
  recommendation,
  className,
}: {
  recommendation: {
    id: string;
    severity: "info" | "warning";
    title: string;
    evidence: string;
    action: string;
    deep_link: string;
    upgrade_link: string;
  };
  className?: string;
}) {
  const isWarning = recommendation.severity === "warning";
  return (
    <div className={cx("rounded-card border border-line bg-surface p-4 sm:p-6", className)}>
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-control",
            isWarning ? "bg-warning-soft text-warning" : "bg-info-soft text-info"
          )}
        >
          <Icon name={isWarning ? "alert-triangle" : "trending-up"} size={16} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{recommendation.title}</h3>
          <p className="mt-1 text-sm text-ink-2">{recommendation.evidence}</p>
          <p className="mt-1 text-sm text-ink">{recommendation.action}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <Link
              href={recommendation.deep_link}
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              View evidence
              <Icon name="arrow-right" size={12} />
            </Link>
            <ButtonLink href={recommendation.upgrade_link} variant="secondary" size="sm">
              Upgrade
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DS-019 Access grant banner                                          */
/* ------------------------------------------------------------------ */

export function AccessGrantBanner({ className }: { className?: string }) {
  const { supportAccess, setSupportAccess } = useSession();
  const { push } = useToast();
  const now = useNow();
  if (!supportAccess) return null;

  const grant = db.supportGrant;

  const revoke = () => {
    setSupportAccess(false);
    push("info", "Support access revoked", `${grant.actor} no longer has access to this organization.`);
  };

  return (
    <div
      role="note"
      className={cx(
        "flex flex-wrap items-center justify-between gap-3 border-b border-warning bg-warning-soft px-4 py-2",
        className
      )}
    >
      <p className="flex min-w-0 items-start gap-2 text-sm text-ink">
        <span className="mt-0.5 shrink-0 text-warning">
          <Icon name="shield" size={16} />
        </span>
        <span className="min-w-0">
          <span className="font-medium">Support access active</span> — {grant.actor}, {grant.reason} (
          {grant.scope}), expires {formatRelative(grant.expires_at, now)}.
        </span>
      </p>
      <Button variant="secondary" size="sm" onClick={revoke}>
        Revoke
      </Button>
    </div>
  );
}
