"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, ErrorBlock } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/code";
import { recheckDelegation } from "@/lib/api/dns";
import { guidanceForDomain } from "@/lib/mock/dns";
import { db } from "@/lib/mock/data";
import { isTerminal } from "@/lib/operations";

/**
 * UX-DNS-005 — Delegation checklist: registrar NS/glue, observed NS and
 * propagation. Guardrail (FLOW-004): never promise global propagation
 * completion — the panel reports what the checked resolvers see.
 */
export function DomainDelegationView({ domainId }: { domainId: string }) {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [checking, setChecking] = useState(false);

  const domain = useMemo(() => db.domains.find((d) => d.id === domainId), [domainId]);
  const guidance = useMemo(() => guidanceForDomain(domainId), [domainId]);
  const delegation = guidance?.delegation;

  const checkOps = useMemo(
    () => list.filter((o) => o.kind === "domain.delegation.check" && o.resource_ref.id === domainId),
    [list, domainId]
  );
  const runningOp = checkOps.find((o) => !isTerminal(o.status));
  const lastOp = checkOps[0];
  const lastFailed = lastOp !== undefined && isTerminal(lastOp.status) && lastOp.status === "failed" ? lastOp : undefined;
  const lastSucceeded = lastOp !== undefined && isTerminal(lastOp.status) && lastOp.status === "succeeded" ? lastOp : undefined;

  if (domain === undefined) {
    return (
      <Screen id="UX-DNS-005" breadcrumbs={[{ label: "Domains", href: "/domains" }]}>
        <NotFoundInline what="domain" />
      </Screen>
    );
  }

  const delegated = delegation?.delegated ?? true;

  const recheck = async () => {
    setChecking(true);
    try {
      const res = await recheckDelegation(domain.id, domain.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("info", "Delegation recheck started", `The panel reads the registrar NS records and asks public resolvers what they observe for ${domain.name}.`);
    } catch {
      push("error", "Recheck could not start", "Try again — nothing was changed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen
      id="UX-DNS-005"
      breadcrumbs={[
        { label: "Domains", href: "/domains" },
        { label: domain.name, href: `/domains/${domain.id}` },
        { label: "Delegation" },
      ]}
      actions={
        <Button icon="refresh" onClick={recheck} loading={checking || runningOp !== undefined}>
          Recheck
        </Button>
      }
    >
      <Callout tone="info" title="What delegation means — and what we can honestly tell you">
        Ownership (a TXT record) and delegation (which nameservers answer for your domain) are different things. The
        panel reports what the checked resolvers observe; it never promises that propagation has completed worldwide,
        because no one can check every resolver.
      </Callout>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Registrar vs observed nameservers">
          {delegation !== undefined ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-ink-3">Registrar NS records (authoritative source)</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {delegation.registrar_nameservers.map((ns) => (
                    <li key={ns} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink">{ns}</span>
                      <CopyButton text={ns} label="Copy" />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-ink-3">Observed NS (public resolvers)</p>
                {delegation.observed_nameservers.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-2">
                    None observed yet — the delegation change has not reached the checked resolvers.
                  </p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-1">
                    {delegation.observed_nameservers.map((ns) => (
                      <li key={ns} className="font-mono text-xs text-ink">
                        {ns}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!delegation.delegated && (
                <Callout tone="warning" title="Delegation is still parked">
                  The registrar still serves its parking nameservers, so DNS records you add only exist on that parked
                  zone. Replace the nameservers (or add the records directly on the parked zone if your registrar
                  allows it).
                </Callout>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-2">
              No delegation change is pending for {domain.name}. The registrar&apos;s nameservers stay authoritative;
              the panel reads your records through public resolvers and never edits them. If you move DNS providers
              later, come back here and press Recheck.
            </p>
          )}
        </Card>

        <Card title="Registrar change steps">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
            <li>Sign in at your registrar ({domain.registrar ?? "your Kenic-accredited registrar"}).</li>
            <li>Open the domain&apos;s “DNS management” or “Nameservers” section.</li>
            <li>
              Replace the parking nameservers with the ones your DNS provider assigns — or, if the registrar only
              offers records on its own parking zone, add the guidance records there instead.
            </li>
            <li>Save and wait: old NS records can be cached for 24–48 hours (the NS TTL at the parent zone).</li>
            <li>Press Recheck — the panel compares registrar NS with what public resolvers observe.</li>
          </ol>
          {guidance !== undefined && (
            <Callout tone="info" title="Registrar hint" className="mt-3">
              {guidance.registrar_hint}
            </Callout>
          )}
        </Card>
      </div>

      <Card title="Recheck result" className="mt-4">
        {runningOp !== undefined && <PendingState operation={runningOp} />}
        {runningOp === undefined && lastFailed !== undefined && (
          <ErrorBlock
            code={lastFailed.error?.code ?? "DNS_DELEGATION_PENDING"}
            detail={lastFailed.error?.detail ?? "The delegation recheck did not pass."}
            correlationId={lastFailed.correlation_id}
            onRetry={recheck}
          />
        )}
        {runningOp === undefined && lastSucceeded !== undefined && (
          <Callout tone="success" title="Delegation looks healthy">
            The registrar NS records and the observed nameservers agree for the checked resolvers. Records you add at
            your registrar will reach this server — see the{" "}
            <Link href={`/domains/${domain.id}/dns-guidance`} className="font-medium text-accent hover:underline">
              DNS guidance records
            </Link>
            .
          </Callout>
        )}
        {runningOp === undefined && lastFailed === undefined && lastSucceeded === undefined && (
          <p className="text-sm text-ink-2">
            No recheck has run in this session yet. Current fixture state:{" "}
            <span className="font-medium text-ink">{delegated ? "no delegation issue recorded" : "delegation pending"}</span>.
          </p>
        )}
      </Card>

      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink href={`/domains/${domain.id}/dns-guidance`} variant="ghost" size="sm" icon="arrow-right">
          DNS guidance records
        </ButtonLink>
        <ButtonLink href={`/domains/${domain.id}/verify`} variant="ghost" size="sm" icon="shield">
          Ownership verification
        </ButtonLink>
      </div>
    </Screen>
  );
}
