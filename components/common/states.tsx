"use client";

import React from "react";
import Link from "next/link";
import { cx, formatRelative, parseIso } from "@/lib/format";
import type { Operation } from "@/lib/types";
import { useCapability, useNow, useOperationStream } from "@/components/providers";
import { CAPABILITY_META } from "@/lib/profiles";
import { isTerminal } from "@/lib/operations";
import { OPERATION_STATUS_TEXT } from "@/components/common/operation-timeline";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Spinner } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";

/**
 * Honest-state primitives (DS-016 + DS-025): the shared vocabulary for
 * "we don't know", "this can't run here", "this isn't supported (different
 * from unavailable)", "work is in progress (nothing looks like success)"
 * and "this doesn't exist". No dead ends — every block explains why and
 * offers the next step.
 */

/** DS-025 staleness threshold: older than this, no live-health claim. */
const STALE_MS = 15 * 60 * 1000;

export function LiveStatusLine({ at, label }: { at: string; label?: string }) {
  const now = useNow();
  const stale = now.getTime() - parseIso(at).getTime() > STALE_MS;
  const prefix = label !== undefined ? `${label}: ` : "";
  return (
    <p className="flex items-start gap-1.5 text-xs text-ink-2">
      <Icon name="clock" size={14} className="mt-0.5 shrink-0 text-ink-3" />
      <span className="min-w-0">
        {stale
          ? `${prefix}Last contact with this server was ${formatRelative(at, now)}. Current health is unknown.`
          : `${prefix}Last checked ${formatRelative(at, now)}.`}
      </span>
    </p>
  );
}

export function UnavailableState({
  capabilityKey,
  title,
  children,
}: {
  capabilityKey: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const rec = useCapability(capabilityKey);
  const meta = CAPABILITY_META[capabilityKey];
  const ok = rec.state !== "unavailable";
  const heading =
    title ??
    (ok
      ? rec.state === "borderline"
        ? "Runs, but tight"
        : "Available on this VPS"
      : "Not available on this VPS");

  return (
    <div className="rounded-card border border-line bg-surface p-6">
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-control",
            ok ? "bg-info-soft text-info" : "bg-surface-2 text-ink-2"
          )}
        >
          <Icon name={ok ? "info" : "lock"} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{heading}</h3>
          {ok ? (
            <Callout tone="info" className="mt-2">
              {rec.state === "borderline"
                ? (rec.reason ?? "It runs on this VPS, but with little headroom.")
                : "Available on this VPS."}
            </Callout>
          ) : (
            <>
              {rec.reason !== null && (
                <p className="mt-1 text-sm text-ink-2">{rec.reason}</p>
              )}
              {meta?.upgrade !== undefined && (
                <p className="mt-3 text-sm">
                  <Link
                    href="/system/upgrade"
                    className="inline-flex flex-wrap items-center gap-1 font-medium text-accent hover:underline"
                  >
                    {meta.upgrade}
                    <Icon name="arrow-right" size={12} className="shrink-0" />
                  </Link>
                </p>
              )}
            </>
          )}
          {children !== undefined && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function UnsupportedState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-2">
          <Icon name="info" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm text-ink-2">{body}</p>
          {action !== undefined && (
            <div className="mt-3">
              {action.href !== undefined ? (
                <ButtonLink href={action.href} variant="secondary" size="sm">
                  {action.label}
                </ButtonLink>
              ) : (
                <Button variant="secondary" size="sm" onClick={action.onClick}>
                  {action.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PendingState({
  operation,
  children,
}: {
  operation: Operation;
  children?: React.ReactNode;
}) {
  const { setTrayOpen, setFocusedId } = useOperationStream();

  // Honest guard: a finished operation is never presented as in-progress
  // (no false green success — the caller renders the real terminal state).
  if (isTerminal(operation.status)) {
    return children === undefined ? null : <>{children}</>;
  }

  const openTray = () => {
    setFocusedId(operation.id);
    setTrayOpen(true);
  };

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-start gap-2.5">
        <Spinner size={16} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            In progress — {operation.title}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            <span className="font-mono">{operation.id}</span> ·{" "}
            {OPERATION_STATUS_TEXT[operation.status]}
          </p>
          <Button variant="link" size="sm" onClick={openTray} className="mt-1">
            View progress
          </Button>
        </div>
      </div>
      {children !== undefined && (
        <div className="mt-2 border-t border-line pt-2">{children}</div>
      )}
    </div>
  );
}

export function NotFoundInline({ what }: { what: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-line bg-surface p-4 text-sm text-ink-2">
      <Icon name="help-circle" size={16} className="shrink-0 text-ink-3" />
      <span className="min-w-0">
        We couldn&apos;t find that {what}. It may have been deleted, or the
        link is wrong.
      </span>
      <Link
        href="/"
        className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
      >
        Back to your landing page
        <Icon name="arrow-right" size={12} className="shrink-0" />
      </Link>
    </div>
  );
}
