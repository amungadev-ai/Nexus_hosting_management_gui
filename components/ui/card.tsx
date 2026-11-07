"use client";

import React from "react";
import { cx } from "@/lib/format";

/**
 * Card — the summary/detail surface (Stage 3 §4.1 region 4).
 * rounded-card + border-line + bg-surface, p-4 on mobile / p-6 ≥sm.
 * Hover elevation appears ONLY when the card itself is clickable —
 * "avoid excessive decorative shadows" (Stage 3 §4.2).
 */

export interface CardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({
  title,
  description,
  actions,
  footer,
  children,
  className,
  onClick,
}: CardProps) {
  const hasHeader = title !== undefined || description !== undefined || actions !== undefined;
  const hasBody = children !== undefined && children !== null;
  const clickable = typeof onClick === "function";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={cx(
        "rounded-card border border-line bg-surface p-4 sm:p-6",
        clickable && "cursor-pointer transition-shadow hover:shadow-sm",
        className
      )}
    >
      {hasHeader && (
        <div className={cx("flex flex-wrap items-start justify-between gap-3", hasBody && "pb-3")}>
          <div className="min-w-0">
            {title !== undefined && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
            {description !== undefined && <p className="mt-1 text-sm text-ink-2">{description}</p>}
          </div>
          {actions !== undefined && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      {children}
      {footer !== undefined && (
        <div className="mt-4 border-t border-line pt-3 text-sm text-ink-2">{footer}</div>
      )}
    </div>
  );
}

/** Sub-block inside a Card — separated by an inset border-top divider. */
export function CardSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cx("mt-4 border-t border-line pt-4", className)}>{children}</div>;
}
