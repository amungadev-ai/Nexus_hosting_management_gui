"use client";

import React, { useState } from "react";
import { cx, formatMoney, formatCountdown, parseIso } from "@/lib/format";
import type { Payment } from "@/lib/types";
import { useNow } from "@/components/providers";
import { Callout, Spinner } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/code";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

/**
 * DS-026 Pending payment banner — the async-first payment state machine
 * (initiated → pending → confirmed | failed | expired | reversed). Mobile
 * money resolves in 10s–2min: the UI holds a live pending state with a
 * countdown and NEVER fakes instant success. Unmatched callbacks surface
 * the reconciliation copy honestly (admin review within 24 hours).
 */

/** M-Pesa STK request window: created_at + 5 minutes (Stage 4 ADR-005d). */
const REQUEST_WINDOW_MS = 5 * 60 * 1000;

function mpesaReceipt(payment: Payment): string | undefined {
  for (const evt of payment.events) {
    const v = evt.payload_redacted?.mpesa_receipt;
    if (typeof v === "string") return v;
  }
  return undefined;
}

function lastResultDesc(payment: Payment): string | undefined {
  for (let i = payment.events.length - 1; i >= 0; i--) {
    const v = payment.events[i]?.payload_redacted?.result_desc;
    if (typeof v === "string") return v;
  }
  return undefined;
}

function Reference({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      <code className="min-w-0 break-all rounded-control bg-surface px-2 py-1 font-mono text-xs text-ink">
        {value}
      </code>
      <CopyButton text={value} label="Copy reference" />
    </div>
  );
}

function UnmatchedLine() {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-2">
      <Icon name="info" size={14} className="mt-0.5 shrink-0 text-info" />
      We received a payment notification we couldn&apos;t match to an invoice.
      An administrator will review it within 24 hours.
    </p>
  );
}

export function PaymentPendingBanner({
  payment,
  onRetry,
  onCancel,
}: {
  payment: Payment;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const now = useNow(1000);
  const [waitingDismissed, setWaitingDismissed] = useState(false);

  const pending = payment.state === "pending" || payment.state === "initiated";
  if (pending && waitingDismissed) return null;

  const unmatched = payment.reconciliation_state === "unmatched";

  if (pending) {
    const expiresAt = new Date(
      parseIso(payment.created_at).getTime() + REQUEST_WINDOW_MS
    ).toISOString();
    const windowEnded = parseIso(expiresAt).getTime() <= now.getTime();
    return (
      <div className="rounded-card border border-info/30 bg-info-soft p-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 text-info">
            <Icon name="clock" size={16} />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-ink">
              We&apos;ve sent a payment request to your phone
            </p>
            <p className="mt-1 text-ink">
              Enter your M-Pesa PIN to complete the payment of{" "}
              {formatMoney(payment.amount)}. Waiting for confirmation…
            </p>
            <p className="mt-1.5 text-xs text-ink-2">
              {windowEnded
                ? "The request window has ended — waiting for M-Pesa's final confirmation."
                : `Request expires in ${formatCountdown(expiresAt, now)}`}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
              <Spinner size={14} />
              Check your phone
            </p>
            <Reference value={payment.provider_reference} className="mt-2" />
            {unmatched && <UnmatchedLine />}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setWaitingDismissed(true)}
              >
                Wait
              </Button>
              {onRetry !== undefined && (
                <Button variant="primary" size="sm" icon="refresh" onClick={onRetry}>
                  Retry
                </Button>
              )}
              {onCancel !== undefined && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-control border border-danger/40 px-3 text-xs font-medium text-danger transition-colors hover:bg-danger-soft"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (payment.state === "confirmed") {
    const receipt = mpesaReceipt(payment);
    return (
      <Callout tone="success" title="Payment received.">
        <p>Your subscription is active.</p>
        {receipt !== undefined && (
          <p className="mt-1 text-xs text-ink-2">
            M-Pesa receipt:{" "}
            <span className="font-mono text-ink">{receipt}</span>
          </p>
        )}
        {unmatched && <UnmatchedLine />}
      </Callout>
    );
  }

  if (payment.state === "failed") {
    const desc = lastResultDesc(payment) ?? "the request was cancelled";
    return (
      <div>
        <Callout tone="danger">Payment failed — {desc}</Callout>
        {unmatched && (
          <div className="mt-2 rounded-card border border-line bg-surface p-3">
            <UnmatchedLine />
          </div>
        )}
        {onRetry !== undefined && (
          <div className="mt-3">
            <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (payment.state === "expired") {
    return (
      <div>
        <Callout tone="warning">
          Payment expired — no confirmation received. We&apos;re checking with
          M-Pesa; you can retry.
        </Callout>
        {unmatched && (
          <div className="mt-2 rounded-card border border-line bg-surface p-3">
            <UnmatchedLine />
          </div>
        )}
        {onRetry !== undefined && (
          <div className="mt-3">
            <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  }

  // reversed — neutral presentation, charge undone; never danger-colored noise.
  return (
    <div className="rounded-card border border-line bg-surface-2 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-ink-2">
          <Icon name="minus" size={16} />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-ink">Payment reversed</p>
          <p className="mt-1 text-ink-2">
            This payment was undone — no amount is due from it. Contact support
            if you weren&apos;t expecting this.
          </p>
          <Reference value={payment.provider_reference} className="mt-2" />
          {unmatched && <UnmatchedLine />}
        </div>
      </div>
    </div>
  );
}
