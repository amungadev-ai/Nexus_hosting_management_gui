"use client";

import React from "react";
import type { CapabilityRecord, ProfileId } from "@/lib/types";
import { CAPABILITY_META, PROFILE_CAPABILITIES, PROFILE_ORDER, PROFILES } from "@/lib/profiles";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import Link from "next/link";

/**
 * UX-OV-002 — per-profile comparison strip: Nano/Starter/Standard/Provider
 * columns × the top capability rows, rendered statically from
 * PROFILES + PROFILE_CAPABILITIES (NOT the demo switcher). ✓ available,
 * ~ borderline, ✗ unavailable — always with a text legend, never color-only.
 */

const TOP_CAPABILITY_KEYS = [
  "website.static",
  "website.php",
  "app.node",
  "db.mariadb",
  "db.postgres",
  "service.docker",
  "service.storage",
  "service.transform",
  "mail.external_smtp",
  "mail.mailboxes",
  "terminal.exec",
  "dns.authoritative",
  "commercial.surface",
] as const;

const SYMBOL: Record<CapabilityRecord["state"], { glyph: string; cls: string; word: string }> = {
  available: { glyph: "✓", cls: "text-success", word: "available" },
  borderline: { glyph: "~", cls: "text-warning", word: "borderline — runs, but tight" },
  unavailable: { glyph: "✗", cls: "text-ink-3", word: "unavailable" },
};

export function CapabilityComparison() {
  return (
    <Card title="Across the VPS ladder" description="The same capability set per profile — this is what changes when you upgrade the VPS (no reinstall, rescan after the hardware change).">
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Capability availability per server profile: available, borderline or unavailable
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-2">
                Capability
              </th>
              {PROFILE_ORDER.map((p) => (
                <th scope="col" key={p} className="px-3 py-2 text-center text-xs font-medium text-ink-2">
                  {PROFILES[p].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TOP_CAPABILITY_KEYS.map((key) => (
              <tr key={key} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-3 py-2 text-left text-sm font-normal text-ink">
                  {CAPABILITY_META[key]?.label ?? key}
                </th>
                {PROFILE_ORDER.map((p) => {
                  const rec = PROFILE_CAPABILITIES[p as ProfileId].find((c) => c.capability_key === key);
                  const state = rec?.state ?? "unavailable";
                  const s = SYMBOL[state];
                  return (
                    <td key={p} className="px-3 py-2 text-center">
                      <span
                        title={`${PROFILES[p].label}: ${s.word}${rec?.reason !== null && rec?.reason !== undefined && state !== "available" ? ` — ${rec.reason}` : ""}`}
                        aria-label={`${PROFILES[p].label}: ${s.word}`}
                        className={`font-semibold ${s.cls}`}
                      >
                        {s.glyph}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="text-success font-semibold">✓ available</span>
        <span className="text-warning font-semibold">~ borderline — runs, but tight</span>
        <span className="text-ink-3 font-semibold">✗ unavailable (with the reason why)</span>
      </p>
    </Card>
  );
}

export function CapabilityGrid({ records }: { records: CapabilityRecord[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {records.map((rec) => {
        const meta = CAPABILITY_META[rec.capability_key];
        return (
          <Card key={rec.capability_key} className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{meta?.label ?? rec.capability_key}</h3>
              <StatusPill status={rec.state} />
              <Chip tone="neutral">{rec.workload_category}</Chip>
            </div>
            {rec.reason !== null && <p className="mt-1 text-sm text-ink-2">{rec.reason}</p>}
            <p className="mt-2 text-xs tabular-nums text-ink-3">
              RAM floor {formatMbSafe(rec.ram_floor_mb)} · typical {formatMbSafe(rec.ram_typical_mb)} · ceiling{" "}
              {formatMbSafe(rec.ram_ceiling_mb)}
              {rec.cpu_max_millicores !== null ? ` · CPU max ${rec.cpu_max_millicores} m (batch)` : ""}
              {rec.disk_floor_gb !== null ? ` · disk ${rec.disk_floor_gb} GB` : ""}
            </p>
            {rec.delta?.ram_mb !== undefined && (
              <p className="mt-1 text-xs font-medium text-warning">
                Needs {rec.delta.ram_mb} MB more RAM
                {rec.delta.vcpu !== undefined ? ` and ${rec.delta.vcpu} more vCPU` : ""}
                {rec.delta.disk_gb !== undefined ? ` and ${rec.delta.disk_gb} GB more disk` : ""}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function formatMbSafe(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function CapabilityUpgradeLink() {
  return (
    <Link href="/system/upgrade" className="text-sm font-medium text-accent hover:underline">
      View upgrade options
    </Link>
  );
}
