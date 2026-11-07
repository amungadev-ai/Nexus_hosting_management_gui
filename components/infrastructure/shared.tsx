"use client";

import React, { useEffect, useState } from "react";
import { cx, formatMb, formatMillicores } from "@/lib/format";
import type { TemplateCategory, UsageSnapshot, WorkloadCategory } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { ProgressBar } from "@/components/ui/misc";
import { withLatency } from "@/lib/api/core";

/**
 * Shared helpers for the infrastructure screens: the composed workload list
 * (websites + applications + service instances — the "db.workloads" view),
 * a mini allocation strip for table rows, and the honest simulated-load hook.
 */

export interface WorkloadRow {
  id: string;
  name: string;
  kindLabel: string;
  kindChip: string;
  category: WorkloadCategory;
  health: "healthy" | "degraded" | "unknown";
  verifiedAt: string;
  usage: UsageSnapshot;
  href: string;
}

const SERVICE_HREF: Record<TemplateCategory, (id: string) => string> = {
  storage: (id) => `/services/storage/${id}`,
  transform: (id) => `/services/transform/${id}`,
  delivery: (id) => `/services/delivery/${id}`,
  cache: (id) => `/services/cache/${id}`,
  queue: (id) => `/services/queue/${id}`,
  search: (id) => `/services/search/${id}`,
  self_hosted_app: (id) => `/services/template/${id}`,
  database: () => `/databases`,
};

export function composeWorkloads(): WorkloadRow[] {
  const rows: WorkloadRow[] = [];
  for (const w of db.websites) {
    rows.push({
      id: w.id,
      name: w.name,
      kindLabel: `Website (${w.kind === "static" ? "static" : `PHP ${w.php_version ?? ""}`.trim()})`,
      kindChip: "website",
      category: "serving",
      health: w.health,
      verifiedAt: w.last_verified_at,
      usage: w.usage,
      href: `/websites/${w.id}`,
    });
  }
  for (const a of db.applications) {
    rows.push({
      id: a.id,
      name: a.name,
      kindLabel: `App (${a.runtime} ${a.runtime_version})`,
      kindChip: "application",
      category: a.category,
      health: a.health,
      verifiedAt: a.last_verified_at,
      usage: a.usage,
      href: `/apps/${a.id}`,
    });
  }
  for (const s of db.serviceInstances) {
    const template = db.templates.find((t) => t.key === s.template_key);
    rows.push({
      id: s.id,
      name: s.name,
      kindLabel: `Service (${template?.name ?? s.template_key})`,
      kindChip: "service",
      category: "serving",
      health: s.health === "unhealthy" ? "degraded" : s.health,
      verifiedAt: s.created_at,
      usage: s.usage,
      href: SERVICE_HREF[template?.category ?? "self_hosted_app"](s.id),
    });
  }
  return rows;
}

/** Mini DS-022 strip for table rows: RAM current/allocated + typical/peak. */
export function MiniAllocation({ usage, className }: { usage: UsageSnapshot; className?: string }) {
  const ram = usage.ram_mb;
  const cpu = usage.cpu_millicores;
  const ratio = ram.allocated > 0 ? ram.current / ram.allocated : 0;
  return (
    <div className={cx("min-w-40", className)}>
      <ProgressBar
        value={ram.current}
        max={ram.allocated}
        tone={ratio >= 0.95 ? "danger" : ratio > 0.8 ? "warning" : "accent"}
        label={`RAM ${formatMb(ram.current)} / ${formatMb(ram.allocated)}`}
        showValue
      />
      <p className="mt-1 text-[11px] text-ink-3">
        typical {formatMb(ram.typical)} · peak {formatMb(ram.peak)} · CPU {formatMillicores(cpu.current)}/
        {formatMillicores(cpu.allocated)}
      </p>
    </div>
  );
}

/** Simulated fixture fetch — honest loading state for list screens. */
export function useFixtureLoad<T>(produce: () => T): { loading: boolean; data: T | null } {
  const [state, setState] = useState<{ loading: boolean; data: T | null }>({ loading: true, data: null });
  useEffect(() => {
    let alive = true;
    withLatency(() => produce()).then((data) => {
      if (alive) setState({ loading: false, data });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}
