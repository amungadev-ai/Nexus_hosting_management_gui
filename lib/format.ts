import type { Iso8601, Money } from "@/lib/types";

/** Class name combiner — keeps conditional classes readable. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Money: integer minor units → "KES 150.00" (never floats — Stage 6 §1). */
export function formatMoney(m: Money): string {
  const major = (m.amount_minor / 100).toFixed(2);
  return `${m.currency} ${major}`;
}

/** Break money into display parts for receipts/invoice tables. */
export function moneyParts(m: Money): { currency: string; major: string } {
  return { currency: m.currency, major: (m.amount_minor / 100).toFixed(2) };
}

export function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`;
}

export function formatGb(gb: number): string {
  return `${gb >= 100 ? Math.round(gb) : gb.toFixed(1)} GB`;
}

export function formatMillicores(mc: number): string {
  return mc >= 1000 ? `${(mc / 1000).toFixed(mc % 1000 === 0 ? 0 : 2)} vCPU` : `${mc} m`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** Parse an RFC 3339 UTC stamp safely. */
export function parseIso(ts: Iso8601): Date {
  return new Date(ts);
}

/** Relative age — "12 seconds ago" (DS-025 live status line). */
export function formatRelative(ts: Iso8601, now: Date = new Date()): string {
  const then = parseIso(ts).getTime();
  const diff = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff} seconds ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return mins === 1 ? "1 minute ago" : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "1 day ago" : `${days} days ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}

/** User-timezone date+time for user-facing stamps. */
export function formatDateTime(ts: Iso8601): string {
  const d = parseIso(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(ts: Iso8601): string {
  return parseIso(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Audits render in UTC (Stage 3 content rules). */
export function formatUtc(ts: Iso8601): string {
  return `${ts.replace("T", " ").replace("Z", "")} UTC`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 6)}•••${phone.slice(-3)}`;
}

/** Countdown label for M-Pesa pending expiry (5-minute STK window). */
export function formatCountdown(expiresAt: Iso8601, now: Date = new Date()): string {
  const secs = Math.max(0, Math.floor((parseIso(expiresAt).getTime() - now.getTime()) / 1000));
  return formatDuration(secs);
}

/** Deterministic pseudo-random series for sparklines/metrics (seeded per id). */
export function seededSeries(
  id: string,
  points: number,
  base: number,
  variance: number
): number[] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    h = Math.imul(h ^ (i + 1), 2654435761);
    const unit = ((h >>> 0) % 1000) / 1000; // 0..1
    out.push(Math.round(base + unit * variance));
  }
  return out;
}

/** Tiny inline sparkline as SVG path (no chart dependency). */
export function sparklinePath(values: number[], width = 120, height = 28): string {
  if (values.length < 2) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const stepX = width / (values.length - 1);
  return values
    .map((v, i) => {
      const x = (i * stepX).toFixed(1);
      const y = (height - ((v - min) / range) * (height - 4) - 2).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}
