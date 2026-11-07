"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { LogViewer } from "@/components/ui/code";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { Card } from "@/components/ui/card";
import { useFixture } from "@/components/ops/use-fixture";
import { db } from "@/lib/mock/data";
import { logLines } from "@/lib/mock/ops";
import { formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";
import type { LogRow } from "@/lib/mock/ops";

/**
 * UX-OPS-008 /monitoring/logs — Log explorer: search, time range, severity and
 * tenant scopes. Lines arrive already redacted (no secrets); the viewer keeps
 * live/pause and export, and severity/scope filters sit above it.
 */
const SOURCES = ["all", "agent", "nginx", "panel", "orders-api", "backup", "restore", "auth"];

export default function LogExplorerPage() {
  const now = useNow();
  const rows = useFixture(() => logLines);
  const [severity, setSeverity] = useState<"all" | "info" | "warn" | "error">("all");
  const [source, setSource] = useState("all");
  const [range, setRange] = useState("1h");

  const filtered = useMemo<LogRow[]>(() => {
    const base = rows ?? [];
    return base.filter(
      (l) =>
        (severity === "all" || l.severity === severity) &&
        (source === "all" || l.source === source)
    );
  }, [rows, severity, source]);

  return (
    <Screen
      id="UX-OPS-008"
      breadcrumbs={[{ label: "Monitoring", href: "/monitoring" }, { label: "Logs" }]}
    >
      <div className="flex flex-col gap-4">
        <Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Severity" htmlFor="log-severity">
              <Select
                id="log-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as LogRow["severity"] | "all")}
              >
                <option value="all">All severities</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </Select>
            </Field>
            <Field label="Scope (source)" htmlFor="log-source">
              <Select id="log-source" value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All sources" : s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Time range" htmlFor="log-range" hint="Older ranges open the export instead of paging in memory.">
              <Select id="log-range" value={range} onChange={(e) => setRange(e.target.value)}>
                <option value="1h">Last hour</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
              </Select>
            </Field>
          </div>
        </Card>

        {rows === null ? (
          <SkeletonTable rows={6} cols={2} />
        ) : (
          <LogViewer
            lines={filtered.map((l) => ({ ts: l.ts, severity: l.severity, message: `[${l.source}] ${l.message}` }))}
            live
          />
        )}

        <Callout tone="info" title="Scoping and redaction">
          This explorer only shows sources your account is scoped to, and values that look
          like secrets are redacted before storage — the panel never logs passwords, tokens
          or unredacted environment variables. Last sample {formatRelative(db.server.last_seen_at, now)}.
        </Callout>
      </div>
    </Screen>
  );
}
