"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine, NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout, ErrorBlock, EmptyState } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/code";
import { GuidanceRecordsTable } from "@/components/dns/dns-bits";
import { checkDnsPropagation } from "@/lib/api/dns";
import { guidanceForDomain } from "@/lib/mock/dns";
import { db } from "@/lib/mock/data";
import { isTerminal } from "@/lib/operations";

/**
 * UX-DNS-014 — DNS guidance: THE v1 DNS mode. Full record tables (A/AAAA/
 * CNAME/TXT — MX shown when the fixture includes one), copyable values, step-by-
 * step registrar instructions and honest propagation polling. NexusPanel
 * doesn't host DNS in v1 — it gives you the exact records for your registrar.
 */
const TYPE_ORDER = ["A", "AAAA", "CNAME", "TXT", "MX"] as const;

const TYPE_LABEL: Record<string, string> = {
  A: "A records (IPv4 addresses)",
  AAAA: "AAAA records (IPv6 addresses)",
  CNAME: "CNAME records (aliases)",
  TXT: "TXT records (verification, SPF, policies)",
  MX: "MX records (mail routing)",
};

export function DomainGuidanceView({ domainId }: { domainId: string }) {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [checking, setChecking] = useState(false);

  const domain = useMemo(() => db.domains.find((d) => d.id === domainId), [domainId]);
  const guidance = useMemo(() => guidanceForDomain(domainId), [domainId]);

  const checkOps = useMemo(
    () => list.filter((o) => o.kind === "domain.dns.check" && o.resource_ref.id === domainId),
    [list, domainId]
  );
  const runningOp = checkOps.find((o) => !isTerminal(o.status));
  const lastOp = checkOps[0];
  const lastFailed = lastOp !== undefined && isTerminal(lastOp.status) && lastOp.status === "failed" ? lastOp : undefined;
  const lastSucceeded = lastOp !== undefined && isTerminal(lastOp.status) && lastOp.status === "succeeded" ? lastOp : undefined;

  if (domain === undefined) {
    return (
      <Screen id="UX-DNS-014" breadcrumbs={[{ label: "Domains", href: "/domains" }]}>
        <NotFoundInline what="domain" />
      </Screen>
    );
  }

  if (guidance === undefined) {
    return (
      <Screen
        id="UX-DNS-014"
        breadcrumbs={[
          { label: "Domains", href: "/domains" },
          { label: domain.name, href: `/domains/${domain.id}` },
          { label: "DNS guidance" },
        ]}
      >
        <EmptyState
          icon="globe"
          title={`No guidance records for ${domain.name} yet`}
          body="This domain has no DNS guidance fixture in the prototype. Add the domain through the onboarding wizard to generate its verification challenge and record set."
          action={{ label: "Domain onboarding wizard", href: "/domains/new" }}
          secondaryAction={{ label: "Back to domain", href: `/domains/${domain.id}` }}
        />
      </Screen>
    );
  }

  const recordsText = [
    `DNS records for ${guidance.domain} — add these at your registrar (NexusPanel guidance mode)`,
    ...guidance.records.map((r) => `${r.type}\t${r.name}\t${r.value}\tTTL ${r.ttl_seconds}s`),
  ].join("\n");

  const grouped = TYPE_ORDER.map((t) => ({ type: t as string, rows: guidance.records.filter((r) => r.type === t) })).filter(
    (g) => g.rows.length > 0
  );
  const hasMx = guidance.records.some((r) => r.type === "MX");

  const check = async () => {
    setChecking(true);
    try {
      const res = await checkDnsPropagation(domain.id, domain.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      if (guidance.check_outcome === "propagated") {
        push("success", "Propagation confirmed", `All checked resolvers now return the expected values for ${domain.name}.`);
      } else {
        push("info", "Not propagated yet", "Some resolvers still return the old (or no) value — normal while caches expire. Check again in a few minutes.");
      }
    } catch {
      push("error", "Check could not start", "Try again — nothing was changed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen
      id="UX-DNS-014"
      breadcrumbs={[
        { label: "Domains", href: "/domains" },
        { label: domain.name, href: `/domains/${domain.id}` },
        { label: "DNS guidance" },
      ]}
      actions={
        <>
          <CopyButton text={recordsText} label="Copy records" />
          <Button icon="activity" onClick={check} loading={checking || runningOp !== undefined}>
            Check propagation
          </Button>
        </>
      }
    >
      <Callout tone="info" title="NexusPanel doesn't host DNS yet — we give you exact records for your registrar">
        Add the records below at your registrar; they stay under your control. The panel then polls public resolvers
        and tells you honestly what it observes — it never claims your domain is live before every checked resolver
        agrees. Authoritative DNS hosting (the panel answers for your zone) is planned for v2.
      </Callout>

      <div className="mt-4 flex flex-col gap-4">
        <Card title="Step-by-step — make the domain resolve to this server">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
            <li>Sign in at your registrar ({domain.registrar ?? "Kenic-accredited registrar"}).</li>
            <li>Open “DNS management” / “Zone records” for {domain.name}.</li>
            <li>Add each record below — type, name, value and TTL exactly as shown (copy buttons per row).</li>
            <li>Save. Resolvers may keep serving the old answer for up to the TTL (3600s here).</li>
            <li>
              Press <span className="font-medium text-ink">Check propagation</span> — every checked resolver must
              agree before we call it propagated.
            </li>
            <li>Once propagated: request the Let&apos;s Encrypt certificate (HTTPS needs the domain to resolve here).</li>
          </ol>
          <Callout tone="info" title="Registrar hint" className="mt-3">
            {guidance.registrar_hint}
          </Callout>
        </Card>

        {grouped.map((g) => (
          <Card key={g.type} title={TYPE_LABEL[g.type] ?? `${g.type} records`}>
            <GuidanceRecordsTable records={g.rows} caption={`${g.type} records for ${domain.name}`} />
          </Card>
        ))}
        {!hasMx && (
          <Card title="MX records (mail routing)">
            <p className="text-sm text-ink-2">
              No MX records — this domain does not route mail today. If you want mail on {domain.name}, add MX
              records at your registrar pointing at your mail provider; self-hosted mail is a v2 surface and the panel
              currently recommends an external provider (Zoho or Google Workspace).
            </p>
          </Card>
        )}

        {domain.state === "delegation_pending" && guidance.delegation !== undefined && (
          <Callout tone="warning" title="Delegation comes first for this domain">
            The nameservers still point at the registrar&apos;s parking (
            <span className="font-mono text-xs">{guidance.delegation.registrar_nameservers.join(", ")}</span>), so
            records added on a hosted zone cannot be observed yet.{" "}
            <Link href={`/domains/${domain.id}/delegation`} className="font-medium text-accent hover:underline">
              Fix delegation
            </Link>{" "}
            — or add these records on the parked zone if your registrar supports it.
          </Callout>
        )}

        <Card
          title="Propagation"
          description="What public resolvers observe for the expected records. This is an observation, never a promise of worldwide propagation."
          actions={
            <Button variant="secondary" size="sm" icon="activity" onClick={check} loading={checking || runningOp !== undefined}>
              Poll propagation
            </Button>
          }
        >
          {runningOp !== undefined && <PendingState operation={runningOp} />}
          {runningOp === undefined && lastFailed !== undefined && (
            <ErrorBlock
              code={lastFailed.error?.code ?? "DNS_NOT_PROPAGATED"}
              detail={lastFailed.error?.detail ?? "Some resolvers still return the old value."}
              correlationId={lastFailed.correlation_id}
              onRetry={check}
            />
          )}
          {runningOp === undefined && lastSucceeded !== undefined && (
            <Callout tone="success" title="Every checked resolver agrees">
              {domain.name} resolves to this server. Next:{" "}
              <Link href="/certificates/new" className="font-medium text-accent hover:underline">
                request the SSL certificate
              </Link>
              .
            </Callout>
          )}
          {runningOp === undefined && lastFailed === undefined && lastSucceeded === undefined && (
            <div className="flex flex-wrap items-center gap-1.5">
              {guidance.checks.map((c) => (
                <Chip key={c.resolver} tone={c.match ? "success" : "warning"}>
                  {c.resolver}: {c.match ? "match" : c.observed === null ? "no answer" : "old value"}
                </Chip>
              ))}
            </div>
          )}
          <div className="mt-3 border-t border-line pt-3">
            <LiveStatusLine
              at={guidance.last_checked_at ?? domain.last_checked_at}
              label="Resolver observations"
            />
          </div>
        </Card>

        {(domain.state === "pending_verification" || domain.state === "failed") && (
          <Card title="Diagnose problems" description="Records that still don't resolve have a cause — start here.">
            <div className="flex flex-col gap-2 text-sm text-ink-2">
              {domain.state === "pending_verification" && (
                <p>
                  Ownership is not verified yet: add the TXT challenge first ({" "}
                  <Link href={`/domains/${domain.id}/verify`} className="text-accent hover:underline">
                    ownership verification
                  </Link>
                  ), then point the domain with the A record above.
                </p>
              )}
              {domain.state === "failed" && (
                <p>
                  The last verification attempt failed — check the record values character by character, then retry
                  the check. Nothing on your registrar was changed by the panel.
                </p>
              )}
              <p>
                Stuck on delegation or old values?{" "}
                <Link href={`/domains/${domain.id}/delegation`} className="text-accent hover:underline">
                  Open the delegation checklist
                </Link>{" "}
                — it explains registrar NS changes and cache TTLs.
              </p>
            </div>
          </Card>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink href={`/domains/${domain.id}`} variant="ghost" size="sm" icon="arrow-right">
          Back to domain detail
        </ButtonLink>
        <ButtonLink href="/certificates/new" variant="ghost" size="sm" icon="shield">
          Request SSL certificate
        </ButtonLink>
      </div>
    </Screen>
  );
}
