"use client";

import React from "react";
import { cx } from "@/lib/format";
import { Button, ButtonLink } from "./button";
import { Icon, type IconName } from "./icons";

/**
 * Feedback primitives: EmptyState (DS-016 honest empty/disabled state),
 * Callout (in-page error/info surface — toasts never carry errors alone),
 * Skeleton family (accessible loading announcement), Spinner, and
 * ErrorBlock (DS-011 failed contract: safe code, reason, correlation ID).
 */

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  body: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

/** DS-016: explain why it's empty and what to do next — no dead ends. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-2 px-4 py-12 text-center", className)}>
      {icon !== undefined && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
          <Icon name={icon} size={20} />
        </span>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-ink-2">{body}</p>
      {(action !== undefined || secondaryAction !== undefined) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action !== undefined &&
            (action.href !== undefined ? (
              <ButtonLink href={action.href}>{action.label}</ButtonLink>
            ) : (
              <Button onClick={action.onClick}>{action.label}</Button>
            ))}
          {secondaryAction !== undefined &&
            (secondaryAction.href !== undefined ? (
              <ButtonLink href={secondaryAction.href} variant="ghost">
                {secondaryAction.label}
              </ButtonLink>
            ) : (
              <Button variant="ghost" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

type CalloutTone = "info" | "success" | "warning" | "danger";

const CALLOUT_TONES: Record<CalloutTone, { border: string; bg: string; text: string; icon: IconName }> = {
  info: { border: "border-l-info", bg: "bg-info-soft", text: "text-info", icon: "info" },
  success: { border: "border-l-success", bg: "bg-success-soft", text: "text-success", icon: "check-circle" },
  warning: { border: "border-l-warning", bg: "bg-warning-soft", text: "text-warning", icon: "alert-triangle" },
  danger: { border: "border-l-danger", bg: "bg-danger-soft", text: "text-danger", icon: "alert-triangle" },
};

export interface CalloutProps {
  tone: CalloutTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * In-page callout — icon + text always, tone-colored left border on a
 * tone-soft background. Use this for errors (toast is acknowledgement only).
 */
export function Callout({ tone, title, children, className }: CalloutProps) {
  const t = CALLOUT_TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cx("rounded-card border-l-4 p-4", t.border, t.bg, className)}>
      <div className="flex items-start gap-2.5">
        <span className={cx("mt-0.5 shrink-0", t.text)}>
          <Icon name={t.icon} size={16} />
        </span>
        <div className="min-w-0 text-sm text-ink">
          {title !== undefined && <p className="font-medium">{title}</p>}
          <div className={title !== undefined ? "mt-1" : undefined}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx("animate-pulse rounded-control bg-surface-2", className)} />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  const gridCols = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  return (
    <div role="status" className={cx("rounded-card border border-line bg-surface p-4", className)}>
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="mb-4 grid gap-3" style={gridCols}>
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3" />
        ))}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="grid gap-3" style={gridCols}>
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className="h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      className={cx(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-line border-t-accent",
        className
      )}
      style={{ width: size, height: size }}
    >
      <span className="sr-only">Loading…</span>
    </span>
  );
}

export interface ErrorBlockProps {
  code: string;
  detail: string;
  correlationId?: string;
  onRetry?: () => void;
  className?: string;
}

/** DS-011 failed state: safe error code, reason, correlation ID, retry. */
export function ErrorBlock({ code, detail, correlationId, onRetry, className }: ErrorBlockProps) {
  return (
    <div role="alert" className={cx("rounded-card border border-danger/30 bg-danger-soft p-4", className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-danger">
          <Icon name="alert-triangle" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-medium text-danger">{code}</p>
          <p className="mt-1 text-sm text-ink">{detail}</p>
          {correlationId !== undefined && (
            <p className="mt-1 text-xs text-ink-2">
              Correlation ID <span className="font-mono">{correlationId}</span>
            </p>
          )}
          {onRetry !== undefined && (
            <div className="mt-3">
              <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
