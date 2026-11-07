"use client";

import React from "react";
import { cx } from "@/lib/format";
import type { Certificate, DomainName } from "@/lib/types";
import { StatusPill, type StatusPillStatus } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/code";
import { Th, Td } from "@/components/ui/table";

/** DNS-module shared view helpers (domain/cert pills, guidance record table). */

export function DomainStatusPill({ domain, className }: { domain: DomainName; className?: string }) {
  if (domain.state === "delegation_pending") {
    return (
      <span className={cx("inline-flex max-w-full flex-wrap items-center gap-1.5", className)}>
        <StatusPill status="pending" />
        <span className="whitespace-nowrap text-xs text-ink-3">· delegation pending</span>
      </span>
    );
  }
  const status: StatusPillStatus =
    domain.state === "verified" ? "verified" : domain.state === "failed" ? "failed" : "pending";
  return <StatusPill status={status} at={domain.last_checked_at} className={className} />;
}

const CERT_STATUS: Record<Certificate["status"], StatusPillStatus> = {
  active: "active",
  issuing: "issuing",
  renewing: "renewing",
  failed: "failed",
  expired: "expired",
};

export function CertStatusPill({ certificate, className }: { certificate: Certificate; className?: string }) {
  return <StatusPill status={CERT_STATUS[certificate.status]} className={className} />;
}

/** The registrar record table — the heart of DNS guidance mode (v1). */
export function GuidanceRecordsTable({
  records,
  caption,
}: {
  records: { type: string; name: string; value: string; ttl_seconds: number; purpose: string }[];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-surface-2">
            <Th scope="col">Type</Th>
            <Th scope="col">Name</Th>
            <Th scope="col">Value</Th>
            <Th scope="col">TTL</Th>
            <Th scope="col">What it does</Th>
            <Th scope="col">
              <span className="sr-only">Copy value</span>
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {records.map((r) => (
            <tr key={`${r.type}-${r.name}`}>
              <Td className="whitespace-nowrap font-mono text-xs font-medium">{r.type}</Td>
              <Td className="whitespace-nowrap font-mono text-xs">{r.name}</Td>
              <Td className="min-w-0 max-w-56 truncate font-mono text-xs" >
                <span title={r.value}>{r.value}</span>
              </Td>
              <Td className="whitespace-nowrap tabular-nums text-xs text-ink-2">{r.ttl_seconds}s</Td>
              <Td className="min-w-0 text-xs text-ink-2">{r.purpose}</Td>
              <Td className="whitespace-nowrap">
                <CopyButton text={r.value} label="Copy value" />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
