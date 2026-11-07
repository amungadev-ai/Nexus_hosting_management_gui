"use client";

import React from "react";
import Link from "next/link";
import { cx } from "@/lib/format";
import { Icon, type IconName } from "./icons";

/**
 * Buttons (Stage 3 §4.3 + a11y §6): primary / secondary / destructive / ghost
 * / link variants, 40px default height (touch-target ≥ 24px, prefer 40–44px),
 * 32px compact size, loading state with an inline spinner, optional leading
 * icon. Focus-visible rings come from the global stylesheet. Destructive is
 * always text-labeled — the icon slot never replaces the label.
 */

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "link";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line bg-surface text-ink hover:border-line-strong",
  destructive: "bg-danger text-white hover:bg-danger/90",
  ghost: "text-ink hover:bg-surface-2",
  link: "text-accent hover:underline",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-sm", // 40px — the a11y baseline for common actions
  sm: "h-8 px-3 text-xs", // 32px — compact/inline use
};

const BASE_CLASSES =
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80",
        className ?? "h-4 w-4"
      )}
    />
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconName;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  type = "button",
  disabled = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
      {...rest}
    >
      {loading ? (
        <InlineSpinner />
      ) : icon ? (
        <Icon name={icon} size={size === "sm" ? 14 : 16} className="shrink-0" />
      ) : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  className?: string;
  children: React.ReactNode;
}

/** Same styling as Button, renders next/link for internal navigation. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cx(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} className="shrink-0" /> : null}
      {children}
    </Link>
  );
}
