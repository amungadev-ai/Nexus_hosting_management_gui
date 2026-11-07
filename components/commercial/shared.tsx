"use client";

import React, { useEffect, useState } from "react";
import type { InvoiceState, PaymentProvider, PaymentState, ReconciliationState } from "@/lib/types";
import { useCapability } from "@/components/providers";
import { withLatency } from "@/lib/api/core";
import { UnavailableState } from "@/components/common/states";
import { StatusPill, type StatusPillStatus, Chip } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/feedback";

/** Whole-module gate — commercial.surface is unavailable on nano/starter. */
export function CommercialGate({ children }: { children: React.ReactNode }) {
  const cap = useCapability("commercial.surface");
  if (cap.state === "unavailable") {
    return <UnavailableState capabilityKey="commercial.surface" />;
  }
  return <>{children}</>;
}

/** Simulated fetch of fixture data — gives every list screen an honest loading state. */
export function useLoaded<T>(produce: () => T): { loading: boolean; data: T | null } {
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

export function LoadedTable({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  if (loading) return <SkeletonTable rows={4} cols={4} className="mt-3" />;
  return <>{children}</>;
}

/** Force a re-render after a direct fixture mutation. */
export function useRefresh(): [number, () => void] {
  const [v, setV] = useState(0);
  return [v, () => setV((x) => x + 1)];
}

export const PAYMENT_PILL: Record<PaymentState, StatusPillStatus> = {
  initiated: "pending",
  pending: "pending",
  confirmed: "confirmed",
  failed: "failed",
  expired: "expired",
  reversed: "cancelled",
};

export function PaymentStatePill({ state }: { state: PaymentState }) {
  return <StatusPill status={PAYMENT_PILL[state]} />;
}

export const INVOICE_PILL: Record<InvoiceState, StatusPillStatus> = {
  draft: "draft",
  open: "open",
  paid: "paid",
  void: "void",
  uncollectible: "failed",
};

export function InvoiceStatePill({ state }: { state: InvoiceState }) {
  return <StatusPill status={INVOICE_PILL[state]} />;
}

export function ProviderChip({ provider }: { provider: PaymentProvider }) {
  return <Chip tone={provider === "mpesa" ? "success" : "info"}>{provider === "mpesa" ? "M-Pesa" : "Stripe"}</Chip>;
}

export function ReconChip({ state }: { state: ReconciliationState }) {
  const map: Record<ReconciliationState, { tone: "success" | "warning" | "accent"; label: string }> = {
    matched: { tone: "success", label: "Matched" },
    unmatched: { tone: "warning", label: "Unmatched" },
    manual: { tone: "accent", label: "Manual review" },
  };
  const m = map[state];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

export function AccountStateChip({ state }: { state: "provisioning" | "active" | "suspended" | "closing" }) {
  const map = {
    provisioning: { tone: "info", label: "Provisioning" },
    active: { tone: "success", label: "Active" },
    suspended: { tone: "warning", label: "Suspended" },
    closing: { tone: "neutral", label: "Closing" },
  } as const;
  const m = map[state];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}
