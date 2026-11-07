"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useNow, useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout, ErrorBlock } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { CopyButton } from "@/components/ui/code";
import { verifyDomain } from "@/lib/api/dns";
import { challengeForDomain, guidanceForDomain } from "@/lib/mock/dns";
import { db } from "@/lib/mock/data";
import { isTerminal } from "@/lib/operations";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { DomainName, Operation } from "@/lib/types";

/**
 * UX-DNS-004 — Ownership verification: the registrar TXT challenge, TTL,
 * polling and honest errors. "Check now" submits a tracked operation — the
 * result (including a failed lookup) arrives from the operation, never as a
 * client-side guess. Pending domains honestly fail with DNS_TXT_NOT_FOUND.
 */
export function DomainVerifyView({ domainId }: { domainId: string }) {
  const now = useNow();
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [checking, setChecking] = useState(false);

  const domain = useMemo(() => db.domains.find((d) => d.id === domainId), [domainId]);
  const challenge = useMemo(() => challengeForDomain(domainId), [domainId]);
  const guidance = useMemo(() => guidanceForDomain(domainId), [domainId]);

  const verifyOps = useMemo(
    () => list.filter((o) => o.kind === "domain.verify" && o.resource_ref.id === domainId),
    [list, domainId]
  );
  const runningOp = verifyOps.find((o) => !isTerminal(o.status));
  const lastOp = verifyOps[0];

  if (domain === undefined) {
    return (
      <Screen id="UX-DNS-004" breadcrumbs={[{ label: "Domains", href: "/domains" }]}>
        <NotFoundInline what="domain" />
      </Screen>
    );
  }

  const check = async () => {
    setChecking(true);
    try {
      const res = await verifyDomain(domain.id, domain.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("info", "Verification check started", `The panel queries your registrar's nameservers for the TXT challenge of ${domain.name}.`);
    } catch {
      push("error", "Check could not start", "Try again — nothing was changed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <DomainVerifyBody
      domain={domain}
      challengeName={challenge?.txt_name}
      challengeValue={challenge?.txt_value}
      ttlSeconds={challenge?.ttl_seconds}
      generatedAt={challenge?.generated_at}
      checks={guidance?.checks ?? []}
      onCheck={check}
      busy={checking || runningOp !== undefined}
      runningOp={runningOp}
      lastOp={lastOp}
      now={now}
    />
  );
}

function DomainVerifyBody({
  domain,
  challengeName,
  challengeValue,
  ttlSeconds,
  generatedAt,
  checks,
  onCheck,
  busy,
  runningOp,
  lastOp,
  now,
}: {
  domain: DomainName;
  challengeName: string | undefined;
  challengeValue: string | undefined;
  ttlSeconds: number | undefined;
  generatedAt: string | undefined;
  checks: { resolver: string; expected: string; observed: string | null; match: boolean }[];
  onCheck: () => void;
  busy: boolean;
  runningOp: Operation | undefined;
  lastOp: Operation | undefined;
  now: Date;
}) {
  const lastFailed = lastOp !== undefined && isTerminal(lastOp.status) && lastOp.status === "failed" ? lastOp : undefined;
  const lastSucceeded = lastOp !== undefined && isTerminal(lastOp.status) && lastOp.status === "succeeded" ? lastOp : undefined;

  return (
    <Screen
      id="UX-DNS-004"
      breadcrumbs={[
        { label: "Domains", href: "/domains" },
        { label: domain.name, href: `/domains/${domain.id}` },
        { label: "Ownership verification" },
      ]}
      actions={
        <Button icon="shield" onClick={onCheck} loading={busy}>
          Check now
        </Button>
      }
    >
      <Callout tone="info" title="Ownership = a TXT record at your registrar">
        The panel proves you control {domain.name} by looking up{" "}
        <span className="font-mono text-xs">{challengeName ?? "_nexuspanel-verify." + domain.name}</span>. It never
        claims verification before the record is actually observed — resolvers may cache the empty answer for up to
        the TTL (1 hour in this fixture), so a first check can honestly fail.
      </Callout>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="1 — Add this TXT record at your registrar">
          {challengeName === undefined || challengeValue === undefined ? (
            <p className="text-sm text-ink-2">
              No challenge has been generated for this domain yet. Start the domain onboarding flow to generate one.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <KeyValue
                items={[
                  {
                    label: "Record name (host)",
                    value: <span className="break-all">{challengeName}</span>,
                    mono: true,
                  },
                  { label: "Record value", value: <span className="break-all">{challengeValue}</span>, mono: true },
                  { label: "TTL", value: `${ttlSeconds ?? 3600}s` },
                  { label: "Challenge generated", value: generatedAt !== undefined ? formatDateTime(generatedAt) : "—" },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton text={challengeName} label="Copy name" />
                <CopyButton text={challengeValue} label="Copy value" />
              </div>
            </div>
          )}
        </Card>

        <Card title="2 — Then check ownership">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
            <li>Add the TXT record at your registrar (Kenic panel → DNS management → Add record → TXT).</li>
            <li>
              Press <span className="font-medium text-ink">Check now</span> — the panel queries the registrar&apos;s
              nameservers and compares the value.
            </li>
            <li>Verified: the domain state updates once the check observes the record. You can then remove the TXT.</li>
          </ol>
          {domain.state === "delegation_pending" && (
            <Callout tone="warning" title="This domain can't verify yet" className="mt-3">
              The nameservers still serve the registrar&apos;s parking zone, so the challenge cannot be observed.{" "}
              <Link href={`/domains/${domain.id}/delegation`} className="font-medium text-accent hover:underline">
                Fix delegation first
              </Link>{" "}
              — or add the record on the parked zone if your registrar supports it.
            </Callout>
          )}
        </Card>
      </div>

      <Card title="Check results" className="mt-4">
        {runningOp !== undefined && <PendingState operation={runningOp} />}
        {runningOp === undefined && lastFailed !== undefined && (
          <ErrorBlock
            code={lastFailed.error?.code ?? "VERIFY_FAILED"}
            detail={lastFailed.error?.detail ?? "The verification check failed."}
            correlationId={lastFailed.correlation_id}
            onRetry={onCheck}
          />
        )}
        {runningOp === undefined && lastSucceeded !== undefined && domain.state !== "delegation_pending" && (
          <Callout tone="success" title={`Ownership of ${domain.name} verified`}>
            The TXT challenge was observed at your registrar&apos;s nameservers. Next: point the domain at this server
            with the guidance records.{" "}
            <Link href={`/domains/${domain.id}/dns-guidance`} className="font-medium text-accent hover:underline">
              Open DNS guidance
            </Link>
          </Callout>
        )}
        {runningOp === undefined && lastFailed === undefined && lastSucceeded === undefined && (
          <p className="text-sm text-ink-2">
            No check has run in this session yet. Press <span className="font-medium text-ink">Check now</span> after
            adding the record — until then the honest state is{" "}
            <span className="font-medium text-ink">{domain.state === "verified" ? "verified (from the last check before this session)" : "not verified"}</span>.
          </p>
        )}

        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-medium text-ink">Recent resolver observations</p>
          {checks.length === 0 && (
            <p className="mt-1 text-sm text-ink-2">No resolver checks recorded for this domain.</p>
          )}
          {checks.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {checks.map((c) => (
                <Chip key={c.resolver} tone={c.match ? "success" : "warning"}>
                  {c.resolver}: {c.match ? "match" : c.observed === null ? "no answer" : "old value"}
                </Chip>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-ink-3">
            Last checked {formatRelative(domain.last_checked_at, now)} · values are what public resolvers observed,
            not a promise that every resolver worldwide agrees.
          </p>
        </div>
      </Card>

      <p className="mt-3 text-xs text-ink-3">
        Prototype note: fixtures are static — for a pending_verification domain the check honestly fails with
        DNS_TXT_NOT_FOUND and offers a retry; propagation completes only for domains whose fixture says so.
      </p>
      <div className="mt-2">
        <ButtonLink href={`/domains/${domain.id}/delegation`} variant="ghost" size="sm" icon="arrow-right">
          Delegation checklist
        </ButtonLink>
      </div>
    </Screen>
  );
}
