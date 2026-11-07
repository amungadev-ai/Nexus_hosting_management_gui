"use client";

import React, { useEffect, useState } from "react";
import { useCapability } from "@/components/providers";
import { withLatency } from "@/lib/api/core";
import { UnavailableState } from "@/components/common/states";
import { CopyButton } from "@/components/ui/code";
import { StatusPill, type StatusPillStatus } from "@/components/ui/badge";

/** Per-screen capability gate (mail.external_smtp | mail.mailboxes). */
export function MailGate({ capabilityKey, children }: { capabilityKey: string; children: React.ReactNode }) {
  const cap = useCapability(capabilityKey);
  if (cap.state === "unavailable") {
    return <UnavailableState capabilityKey={capabilityKey} />;
  }
  return <>{children}</>;
}

/** Simulated fixture fetch — honest loading state for list screens. */
export function useMailLoad<T>(produce: () => T): { loading: boolean; data: T | null } {
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

export function useMailRefresh(): [number, () => void] {
  const [v, setV] = useState(0);
  return [v, () => setV((x) => x + 1)];
}

export function RecordCopyRow({ role, type, name, value, status, note }: { role: string; type: string; name: string; value: string; status: "verified" | "pending" | "action_needed"; note: string }) {
  const pill: StatusPillStatus = status === "verified" ? "verified" : status === "pending" ? "pending" : "failed";
  const label = status === "verified" ? "Verified" : status === "pending" ? "Pending — add at registrar" : "Action needed";
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-control bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">{role}</span>
        <span className="rounded-control bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-2">{type}</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={name}>{name}</code>
        <StatusPill status={pill} />
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-control bg-surface-2 px-3 py-2 font-mono text-xs text-ink">{value}</code>
        <CopyButton text={value} label="Copy value" />
      </div>
      <p className="mt-2 text-xs text-ink-3">{note}</p>
    </div>
  );
}
