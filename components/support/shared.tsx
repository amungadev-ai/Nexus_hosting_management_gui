"use client";

import React, { useEffect, useState } from "react";
import { cx, formatRelative } from "@/lib/format";
import { withLatency } from "@/lib/api/core";
import { useNow } from "@/components/providers";
import { Icon, type IconName } from "@/components/ui/icons";
import type { DataExportState, MigrationState, TicketStatus } from "@/lib/mock/support";

/**
 * Support-module shared parts: the fixture-loading hook (honest loading
 * skeleton before populated data) and DS-004-style status pills for the
 * module's own state vocabularies (icon + text, never color-only).
 */

/** Simulated network hop for fixture-backed lists (same pattern as lib fixtures app-wide). */
export function useFixture<T>(produce: () => T): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    withLatency(() => produce()).then((v) => {
      if (live) setValue(v);
    });
    return () => {
      live = false;
    };
    // Run once per mount — the fixture set is static for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

/** Force a re-render after a direct fixture mutation (createTicket & friends). */
export function useRefresh(): [number, () => void] {
  const [v, setV] = useState(0);
  return [v, () => setV((x) => x + 1)];
}

const PILL_TONES = {
  success: { soft: "bg-success-soft", text: "text-success" },
  warning: { soft: "bg-warning-soft", text: "text-warning" },
  danger: { soft: "bg-danger-soft", text: "text-danger" },
  info: { soft: "bg-info-soft", text: "text-info" },
  neutral: { soft: "bg-surface-2", text: "text-ink-2" },
} as const;

type PillTone = keyof typeof PILL_TONES;

function Pill({ tone, icon, label }: { tone: PillTone; icon: IconName; label: string }) {
  const t = PILL_TONES[tone];
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-control px-1.5 py-0.5 text-xs font-medium",
        t.soft,
        t.text
      )}
    >
      <Icon name={icon} size={12} className="shrink-0" />
      {label}
    </span>
  );
}

const MIGRATION_STATE_META: Record<MigrationState, { tone: PillTone; icon: IconName; label: string }> = {
  completed: { tone: "success", icon: "check-circle", label: "Completed" },
  running: { tone: "info", icon: "activity", label: "Running" },
  conflicts: { tone: "warning", icon: "alert-triangle", label: "Conflicts — review needed" },
  failed: { tone: "danger", icon: "x", label: "Failed" },
  rolled_back: { tone: "neutral", icon: "minus", label: "Rolled back" },
};

export function MigrationStatePill({ state }: { state: MigrationState }) {
  const meta = MIGRATION_STATE_META[state];
  return <Pill tone={meta.tone} icon={meta.icon} label={meta.label} />;
}

const TICKET_STATUS_META: Record<TicketStatus, { tone: PillTone; icon: IconName; label: string }> = {
  open: { tone: "info", icon: "file-text", label: "Open" },
  pending_customer: { tone: "warning", icon: "clock", label: "Waiting on you" },
  resolved: { tone: "success", icon: "check-circle", label: "Resolved" },
};

export function TicketStatusPill({ status }: { status: TicketStatus }) {
  const meta = TICKET_STATUS_META[status];
  return <Pill tone={meta.tone} icon={meta.icon} label={meta.label} />;
}

const EXPORT_STATE_META: Record<DataExportState, { tone: PillTone; icon: IconName; label: string }> = {
  completed: { tone: "success", icon: "check-circle", label: "Ready" },
  expired: { tone: "neutral", icon: "clock", label: "Expired" },
};

export function DataExportStatePill({ state }: { state: DataExportState }) {
  const meta = EXPORT_STATE_META[state];
  return <Pill tone={meta.tone} icon={meta.icon} label={meta.label} />;
}

/** "Requested 3 hours ago · expires in 14 days" freshness line for exports. */
export function ExportFreshnessLine({
  requestedAt,
  expiresAt,
}: {
  requestedAt: string;
  expiresAt: string;
}) {
  const now = useNow();
  return (
    <span className="text-xs text-ink-3">
      Requested {formatRelative(requestedAt, now)} · expires {formatRelative(expiresAt, now)}
    </span>
  );
}
