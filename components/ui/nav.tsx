"use client";

import React from "react";
import Link from "next/link";
import { cx } from "@/lib/format";
import { Button } from "./button";
import { Icon } from "./icons";

/**
 * Navigation primitives: Breadcrumbs (same markup as <Screen>'s inline
 * crumbs, standalone), Pagination (cursor-based "Load more" — Stage 6 §1,
 * never numbered pages), Stepper (DS-006 wizard progress) and
 * SegmentedControl (mode/profile switchers).
 */

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cx("flex flex-wrap items-center gap-1 text-xs text-ink-2", className)}
    >
      {items.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden="true" className="text-ink-3">
              /
            </span>
          )}
          {crumb.href !== undefined ? (
            <Link href={crumb.href} className="hover:text-ink hover:underline">
              {crumb.label}
            </Link>
          ) : (
            <span aria-current="page">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export interface PaginationPage {
  next_cursor: string | null;
  has_more: boolean;
}

export function Pagination({
  page,
  onPage,
  loading = false,
  className,
}: {
  page: PaginationPage;
  onPage: (cursor: string) => void;
  loading?: boolean;
  className?: string;
}) {
  const cursor = page.next_cursor;
  if (!page.has_more || cursor === null) return null;

  return (
    <div className={cx("flex justify-center pt-3", className)}>
      <Button variant="secondary" loading={loading} onClick={() => onPage(cursor)}>
        Load more
      </Button>
    </div>
  );
}

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
}) {
  return (
    <ol aria-label="Progress" className={cx("flex list-none flex-col p-0 sm:flex-row sm:items-center", className)}>
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "future";
        const isLast = i === steps.length - 1;
        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className="flex min-w-0 items-start gap-3 sm:flex-1 sm:items-center"
          >
            <div className="flex flex-col items-center self-start sm:self-auto">
              <span
                className={cx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  state === "done" && "bg-accent text-accent-ink",
                  state === "current" && "border-2 border-accent bg-surface text-accent",
                  state === "future" && "border border-line bg-surface text-ink-3"
                )}
              >
                {state === "done" ? <Icon name="check" size={12} /> : i + 1}
              </span>
              {!isLast && (
                <span aria-hidden="true" className="h-6 w-px shrink-0 bg-line sm:hidden" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 pb-1 sm:pb-0">
              <span
                className={cx(
                  "min-w-0 whitespace-nowrap text-xs",
                  state === "future" ? "text-ink-2" : "font-medium text-ink"
                )}
              >
                {step}
              </span>
              {!isLast && (
                <span aria-hidden="true" className="hidden h-px min-w-4 flex-1 bg-line sm:block" />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface SegmentedOption {
  value: string;
  label: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx("inline-flex items-center rounded-control border border-line bg-surface-2 p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cx(
              "whitespace-nowrap rounded-[4px] font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active ? "bg-surface text-ink" : "text-ink-2 hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
