"use client";

import React from "react";
import { cx } from "@/lib/format";
import { useToast } from "@/components/providers";
import { Icon, type IconName } from "./icons";

/**
 * Toast viewport (Stage 3 §4.1 region 7): acknowledgement ONLY — durable
 * results live in the operation tray/activity center, and errors are carried
 * in-page by Callout/ErrorBlock. Fixed bottom-right on desktop, bottom
 * full-width-ish on mobile, z-[600] (top of the z-scale). Auto-dismiss and
 * stacking are handled by the provider.
 */

type ToastKind = "success" | "info" | "error";

const KIND_META: Record<ToastKind, { icon: IconName; bar: string; text: string }> = {
  success: { icon: "check-circle", bar: "bg-success", text: "text-success" },
  info: { icon: "info", bar: "bg-info", text: "text-info" },
  error: { icon: "alert-triangle", bar: "bg-danger", text: "text-danger" },
};

export function ToastViewport({ className }: { className?: string }) {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "pointer-events-none fixed inset-x-3 bottom-3 z-[600] flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96",
        className
      )}
    >
      {toasts.map((toast) => {
        const meta = KIND_META[toast.kind];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto relative flex overflow-hidden rounded-card border border-line bg-surface"
          >
            <span aria-hidden="true" className={cx("w-1 shrink-0", meta.bar)} />
            <div className="flex min-w-0 flex-1 items-start gap-2.5 p-3">
              <span className={cx("mt-0.5 shrink-0", meta.text)}>
                <Icon name={meta.icon} size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{toast.title}</p>
                {toast.body !== undefined && (
                  <p className="mt-0.5 text-sm text-ink-2">{toast.body}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="m-1.5 shrink-0 self-start rounded-control p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
