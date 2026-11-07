"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cx } from "@/lib/format";
import { useCapabilities, useSession } from "@/components/providers";
import { CAPABILITY_META, PROFILES } from "@/lib/profiles";
import type { CapabilityRecord } from "@/lib/types";
import { Icon } from "@/components/ui/icons";

/**
 * DS-021 Capability banner — persistent wherever any capability is
 * unavailable, honest, not alarming. Collapsed, the primary line stays
 * visible ("Your VPS cannot run: WordPress, Databases (+2 more)" — Stage 3
 * §13 requires it without expanding, especially on mobile). Expanding shows
 * each record's own reason (which already carries the resource delta) and
 * the upgrade path. Never "disabled" or "not on your plan" language.
 */

function capabilityLabel(rec: CapabilityRecord): string {
  return CAPABILITY_META[rec.capability_key]?.label ?? rec.capability_key;
}

export function CapabilityBanner({ force = false }: { force?: boolean }) {
  const caps = useCapabilities();
  const { profile } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const unavailable = caps.filter((c) => c.state === "unavailable");
  const borderline = caps.filter((c) => c.state === "borderline");
  if (unavailable.length === 0 && borderline.length === 0) return null;
  if (dismissed && !force) return null;

  const warning = unavailable.length > 0;
  const records = warning ? unavailable : borderline;
  const labels = records.map(capabilityLabel);
  const head = labels.slice(0, 2).join(", ");
  const rest = labels.length - 2;
  const primary = `${warning ? "Your VPS cannot run:" : "Runs, but tight:"} ${head}${rest > 0 ? ` (+${rest} more)` : ""}`;
  const toneIcon = warning ? "alert-triangle" : "info";
  const currentProfile = PROFILES[profile];

  return (
    <div
      role="note"
      className={cx(
        "rounded-card border p-4",
        warning ? "border-warning bg-warning-soft" : "border-info bg-info-soft"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cx(
            "mt-0.5 shrink-0",
            warning ? "text-warning" : "text-info"
          )}
        >
          <Icon name={toneIcon} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left"
            >
              <span className="text-sm font-medium text-ink">{primary}</span>
              <Icon
                name="chevron-down"
                size={16}
                className={cx(
                  "mt-0.5 shrink-0 text-ink-2 transition-transform",
                  expanded && "rotate-180"
                )}
              />
            </button>
            {!force && (
              <button
                type="button"
                aria-label="Dismiss capability banner"
                title="Dismiss for now — it reappears on the overview"
                onClick={() => setDismissed(true)}
                className="-m-1 shrink-0 rounded-control p-1.5 text-ink-2 transition-colors hover:bg-surface hover:text-ink"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          {expanded && (
            <div className="mt-3">
              <p className="text-xs text-ink-2">
                This VPS: {currentProfile.label} — {currentProfile.tagline}.
              </p>
              <ul className="mt-2 flex list-none flex-col gap-3 p-0">
                {records.map((rec) => {
                  const upgrade = CAPABILITY_META[rec.capability_key]?.upgrade;
                  return (
                    <li
                      key={rec.capability_key}
                      className={cx(
                        "border-t pt-2",
                        warning ? "border-warning/30" : "border-info/30"
                      )}
                    >
                      <p className="text-sm font-medium text-ink">
                        {capabilityLabel(rec)}
                      </p>
                      {rec.reason !== null && (
                        <p className="mt-0.5 text-sm text-ink-2">{rec.reason}</p>
                      )}
                      {warning && upgrade !== undefined && (
                        <p className="mt-1 text-xs text-ink-2">
                          Upgrade path: {upgrade}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link
              href="/system/upgrade"
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
            >
              View upgrade options
              <Icon name="arrow-right" size={12} className="shrink-0" />
            </Link>
            <Link
              href="/overview/capabilities"
              className="text-accent hover:underline"
            >
              See all capabilities
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
