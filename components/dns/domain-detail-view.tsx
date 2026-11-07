"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine, NotFoundInline } from "@/components/common/states";
import { useNow } from "@/components/providers";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill, Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { DomainStatusPill, GuidanceRecordsTable } from "@/components/dns/dns-bits";
import { challengeForDomain, guidanceForDomain } from "@/lib/mock/dns";
import { db } from "@/lib/mock/data";
import { formatDate, formatRelative } from "@/lib/format";

/**
 * UX-DNS-003 — Domain detail: DNS status, verification, registration dates,
 * nameservers, linked website and a summary of the guidance records. v1 = DNS
 * guidance mode; "Manage" hands over to the full DNS guidance screen.
 */
export function DomainDetailView({ domainId }: { domainId: string }) {
  const now = useNow();

  const domain = useMemo(() => db.domains.find((d) => d.id === domainId), [domainId]);
  const guidance = useMemo(() => guidanceForDomain(domainId), [domainId]);
  const challenge = useMemo(() => challengeForDomain(domainId), [domainId]);

  if (domain === undefined) {
    return (
      <Screen id="UX-DNS-003" breadcrumbs={[{ label: "Domains", href: "/domains" }]}>
        <NotFoundInline what="domain" />
      </Screen>
    );
  }

  const site = domain.website_id !== undefined ? db.websites.find((w) => w.id === domain.website_id) : undefined;
  const delegation = guidance?.delegation;

  const recordTypes = guidance === undefined ? [] : [...new Set(guidance.records.map((r) => r.type))];

  return (
    <Screen
      id="UX-DNS-003"
      breadcrumbs={[{ label: "Domains", href: "/domains" }, { label: domain.name }]}
      actions={
        <>
          <ButtonLink href={`/domains/${domain.id}/dns-guidance`} icon="globe">
            Manage DNS records
          </ButtonLink>
          <ButtonLink href={`/domains/${domain.id}/verify`} variant="secondary" icon="shield">
            Verify ownership
          </ButtonLink>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Registration">
          <KeyValue
            items={[
              { label: "Domain", value: domain.name, mono: true },
              { label: "Registrar", value: domain.registrar ?? "Not recorded" },
              {
                label: "Registered until",
                value:
                  domain.expires_at !== undefined ? (
                    <>
                      {formatDate(domain.expires_at)}{" "}
                      <span className="text-xs text-ink-3">
                        (renewal due {formatRelative(domain.expires_at, now)})
                      </span>
                    </>
                  ) : (
                    "—"
                  ),
              },
              {
                label: "DNS mode",
                value: (
                  <>
                    External — guidance mode <Chip tone="neutral">v1</Chip>
                  </>
                ),
              },
            ]}
          />
          <div className="mt-4 border-t border-line pt-3">
            <LiveStatusLine at={domain.last_checked_at} label="DNS status" />
          </div>
        </Card>

        <Card title="Status">
          <DomainStatusPill domain={domain} />
          <p className="mt-2 text-sm text-ink-2">
            {guidance !== undefined
              ? guidance.propagation_state === "propagated"
                ? "All checked resolvers return the expected records — the domain is served from this server."
                : "Some checked resolvers still return no (or old) values. The exact records to add at your registrar stay ready below."
              : "No guidance records exist for this domain yet — add records from the DNS guidance screen."}
          </p>
          {domain.state === "delegation_pending" && (
            <Callout tone="warning" title="Delegation pending" className="mt-3">
              The nameservers still point at the registrar&apos;s parking page. Fix delegation first —{" "}
              <Link href={`/domains/${domain.id}/delegation`} className="font-medium text-accent hover:underline">
                open the delegation checklist
              </Link>
              .
            </Callout>
          )}
          {domain.state === "pending_verification" && challenge !== undefined && (
            <Callout tone="info" title="Waiting for the TXT challenge" className="mt-3">
              Add <span className="font-mono text-xs">{challenge.txt_name}</span> at your registrar, then{" "}
              <Link href={`/domains/${domain.id}/verify`} className="font-medium text-accent hover:underline">
                check ownership verification
              </Link>
              .
            </Callout>
          )}
          {domain.state === "verified" && (
            <Callout tone="success" title="Ownership verified" className="mt-3">
              The TXT challenge was observed at your registrar&apos;s nameservers. You can remove the
              verification record whenever you like.
            </Callout>
          )}
        </Card>

        <Card title="Nameservers & delegation">
          {delegation !== undefined ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs text-ink-3">Registrar nameservers</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {delegation.registrar_nameservers.map((ns) => (
                    <li key={ns} className="font-mono text-xs text-ink">
                      {ns}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-ink-3">Observed nameservers (public DNS)</p>
                {delegation.observed_nameservers.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-2">None observed yet — delegation has not moved.</p>
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
                <Link
                  href={`/domains/${domain.id}/delegation`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                >
                  Fix delegation — registrar change steps
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-2">
              No delegation change is pending for this domain. Your registrar&apos;s nameservers stay
              authoritative — the panel only reads your records through public resolvers and never edits them.
            </p>
          )}
        </Card>

        <Card title="Linked website">
          {site !== undefined ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/websites/${site.id}`} className="text-sm font-medium text-accent hover:underline">
                  {site.title}
                </Link>
                <StatusPill status={site.health === "healthy" ? "healthy" : site.health === "degraded" ? "degraded" : "unknown"} />
              </div>
              <p className="text-xs text-ink-3">
                Primary domain <span className="font-mono">{site.primary_domain}</span> — served from this server.
              </p>
              <Link
                href={`/websites/${site.id}/https`}
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                HTTPS policy
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-2">
              No website is attached to this domain.{" "}
              <Link href="/websites/new" className="text-accent hover:underline">
                Create a website
              </Link>{" "}
              or connect the domain from the site&apos;s settings.
            </p>
          )}
        </Card>
      </div>

      <Card
        title="DNS records — guidance summary"
        className="mt-4"
        description="The records your registrar should hold for this domain. NexusPanel doesn't host DNS in v1."
        actions={
          <Link
            href={`/domains/${domain.id}/dns-guidance`}
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            Full DNS guidance
          </Link>
        }
      >
        {guidance === undefined || guidance.records.length === 0 ? (
          <p className="text-sm text-ink-2">
            No guidance records yet — open the DNS guidance screen to add the first records for this domain.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {recordTypes.map((t) => (
                <Chip key={t} tone="neutral">
                  {t} × {guidance.records.filter((r) => r.type === t).length}
                </Chip>
              ))}
            </div>
            <GuidanceRecordsTable records={guidance.records} caption={`DNS guidance records for ${domain.name}`} />
          </>
        )}
      </Card>
    </Screen>
  );
}
