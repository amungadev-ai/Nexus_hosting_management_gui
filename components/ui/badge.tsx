"use client";

import React from "react";
import { cx, formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";
import { Icon, type IconName } from "./icons";

/**
 * DS-004 Status pill — every status is icon + text, NEVER color-only.
 * Optional `at` renders the DS-025 freshness flavor ("· last checked …")
 * via the ticking useNow clock. Also exports Chip, the small label chip
 * used for categories, scopes and tags.
 */

export type StatusPillTone = "success" | "warning" | "danger" | "info" | "neutral";

export type StatusPillStatus =
  | "healthy"
  | "active"
  | "degraded"
  | "degraded-health"
  | "pending"
  | "provisioning"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "partially_succeeded"
  | "cancelled"
  | "awaiting_approval"
  | "offline"
  | "stale"
  | "unknown"
  | "verified"
  | "issuing"
  | "renewing"
  | "expired"
  | "confirmed"
  | "open"
  | "paid"
  | "void"
  | "unmatched"
  | "available"
  | "borderline"
  | "unavailable"
  | "draft";

interface StatusMeta {
  icon: IconName;
  tone: StatusPillTone;
  label: string;
}

const TONE_CLASSES: Record<StatusPillTone, { soft: string; text: string }> = {
  success: { soft: "bg-success-soft", text: "text-success" },
  warning: { soft: "bg-warning-soft", text: "text-warning" },
  danger: { soft: "bg-danger-soft", text: "text-danger" },
  info: { soft: "bg-info-soft", text: "text-info" },
  neutral: { soft: "bg-surface-2", text: "text-ink-2" },
};

const STATUS_META: Record<StatusPillStatus, StatusMeta> = {
  healthy: { icon: "check-circle", tone: "success", label: "Healthy" },
  active: { icon: "check-circle", tone: "success", label: "Active" },
  degraded: { icon: "alert-triangle", tone: "warning", label: "Degraded" },
  "degraded-health": { icon: "alert-triangle", tone: "warning", label: "Degraded" },
  pending: { icon: "clock", tone: "info", label: "Pending" },
  provisioning: { icon: "refresh", tone: "info", label: "Provisioning" },
  queued: { icon: "clock", tone: "info", label: "Queued" },
  running: { icon: "activity", tone: "info", label: "Running" },
  succeeded: { icon: "check-circle", tone: "success", label: "Succeeded" },
  failed: { icon: "x", tone: "danger", label: "Failed" },
  partially_succeeded: { icon: "list", tone: "warning", label: "Partial" },
  cancelled: { icon: "minus", tone: "neutral", label: "Cancelled" },
  awaiting_approval: { icon: "clock", tone: "warning", label: "Awaiting approval" },
  offline: { icon: "power", tone: "neutral", label: "Offline" },
  stale: { icon: "clock", tone: "warning", label: "Stale" },
  unknown: { icon: "help-circle", tone: "neutral", label: "Unknown" },
  verified: { icon: "shield", tone: "success", label: "Verified" },
  issuing: { icon: "refresh", tone: "info", label: "Issuing" },
  renewing: { icon: "refresh", tone: "info", label: "Renewing" },
  expired: { icon: "alert-triangle", tone: "danger", label: "Expired" },
  confirmed: { icon: "check-circle", tone: "success", label: "Confirmed" },
  open: { icon: "file-text", tone: "info", label: "Open" },
  paid: { icon: "check-circle", tone: "success", label: "Paid" },
  void: { icon: "minus", tone: "neutral", label: "Void" },
  unmatched: { icon: "alert-triangle", tone: "warning", label: "Unmatched" },
  available: { icon: "check-circle", tone: "success", label: "Available" },
  borderline: { icon: "alert-triangle", tone: "warning", label: "Borderline" },
  unavailable: { icon: "x", tone: "neutral", label: "Unavailable" },
  draft: { icon: "file", tone: "neutral", label: "Draft" },
};

export interface StatusPillProps {
  status: StatusPillStatus;
  /** RFC 3339 stamp of the last observation — renders "· last checked …". */
  at?: string;
  className?: string;
}

export function StatusPill({ status, at, className }: StatusPillProps) {
  const now = useNow();
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span className={cx("inline-flex max-w-full flex-wrap items-center gap-1.5", className)}>
      <span
        className={cx(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-control px-1.5 py-0.5 text-xs font-medium",
          tone.soft,
          tone.text
        )}
      >
        <Icon name={meta.icon} size={12} className="shrink-0" />
        {meta.label}
      </span>
      {at !== undefined && (
        <span className="whitespace-nowrap text-xs text-ink-3">
          · last checked {formatRelative(at, now)}
        </span>
      )}
    </span>
  );
}

export type ChipTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const CHIP_TONE_CLASSES: Record<ChipTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-control px-1.5 py-0.5 text-xs font-medium",
        CHIP_TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
