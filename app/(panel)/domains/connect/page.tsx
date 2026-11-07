"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/form";
import { Callout } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/code";
import { GuidanceRecordsTable } from "@/components/dns/dns-bits";
import { checkDnsPropagation } from "@/lib/api/dns";
import { dnsGuidance } from "@/lib/mock/dns";
import { db } from "@/lib/mock/data";
import { isTerminal } from "@/lib/operations";
import { jobHref } from "@/lib/job-routes";

/**
 * UX-WEB-018 — Domain connection wizard (the lay-person killer feature):
 * shows the exact A/AAAA/CNAME record to add at the registrar, polls for
 * propagation, confirms when live, then offers SSL. v1 DNS guidance companion
 * to UX-DNS-014 — NexusPanel doesn't host DNS; we give you exact records.
 */
export default function DomainConnectPage() {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const verifiedDomains = useMemo(() => db.domains, []);
  const [domainId, setDomainId] = useState(verifiedDomains[0]?.id ?? "");
  const [checking, setChecking] = useState(false);

  const domain = useMemo(() => db.domains.find((d) => d.id === domainId), [domainId]);
  const guidance = useMemo(() => dnsGuidance.find((g) => g.domain_id === domainId), [domainId]);
  const checkOps = useMemo(() => list.filter((o) => o.kind === "domain.dns.check"), [list]);
  const runningCheck = checkOps.find((o) => !isTerminal(o.status));
  const lastCheck = checkOps.find((o) => o.status === "succeeded");
  const lastFailedCheck = checkOps.find((o) => o.status === "failed");

  const propagated = guidance?.propagation_state === "propagated";

  const doCheck = async () => {
    if (domain === undefined) return;
    setChecking(true);
    try {
      const res = await checkDnsPropagation(domain.id, domain.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      if (guidance?.check_outcome === "propagated") {
        push("success", "Propagation confirmed", `All checked resolvers now return the expected values for ${domain.name}. SSL can be issued.`);
      } else {
        push("info", "Not propagated yet", "Some resolvers still return the old value — this is normal while caches expire. Check again in a few minutes.");
      }
    } catch {
      push("error", "Check could not start", "Try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen
      id="UX-WEB-018"
      breadcrumbs={[{ label: "Websites", href: "/websites" }, { label: "Connect a domain" }]}
      actions={
        <>
          <Button variant="secondary" icon="activity" onClick={doCheck} loading={checking || runningCheck !== undefined}>
            Check propagation
          </Button>
          <ButtonLink href="/domains/new" variant="ghost" icon="plus">
            Add a different domain
          </ButtonLink>
        </>
      }
    >
      <div className="mb-4 rounded-xl border border-line bg-surface-2 p-4"><p className="text-sm font-semibold text-ink">New: connected domain setup</p><p className="mt-1 text-sm text-ink-2">Prefer a step-by-step path from domain to destination, DNS guidance and HTTPS?</p><Link href="/domains/setup" className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">Open guided domain setup →</Link></div>
      <Callout tone="info" title="NexusPanel doesn't host DNS yet — we give you exact records for your registrar">
        Add the records below at your registrar (Kenic panel → DNS management). We poll real resolvers and
        only say your domain is live when every checked resolver agrees — never before.
      </Callout>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Pick the domain">
          <Field label="Domain" htmlFor="dc-domain" hint="Add a new domain first if it isn't in the inventory.">
            <Select id="dc-domain" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
              {verifiedDomains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.state})
                </option>
              ))}
            </Select>
          </Field>
          {domain !== undefined && (
            <p className="mt-3 text-sm text-ink-2">
              Attached site:{" "}
              <Link href={`/websites/${domain.website_id ?? ""}`} className="text-accent hover:underline">
                {db.websites.find((w) => w.id === domain.website_id)?.title ?? "—"}
              </Link>
            </p>
          )}
        </Card>

        <Card title="State" className="lg:col-span-2">
          {guidance === undefined || domain === undefined ? (
            <p className="text-sm text-ink-2">Pick a domain to see its records.</p>
          ) : propagated ? (
            <Callout tone="success" title={`${domain.name} resolves to this server`}>
              {guidance.checks.length} resolvers checked — all match. Your site is being served over HTTPS. You
              can remove the verification TXT record whenever you like.
            </Callout>
          ) : (
            <Callout tone="warning" title="Waiting for propagation">
              {lastFailedCheck !== undefined
                ? "The last check still saw the old value. Registrar edits can take minutes to hours depending on TTL — the exact records stay ready below."
                : "Run “Check propagation” after you've added the records at your registrar."}
            </Callout>
          )}
          {runningCheck !== undefined && (
            <div className="mt-3">
              <PendingState operation={runningCheck} />
            </div>
          )}
          {lastCheck !== undefined && (
            <p className="mt-3 text-xs text-ink-3">
              Last verified check: <Link href={jobHref(lastCheck.id)} className="text-accent hover:underline">{lastCheck.id}</Link>
            </p>
          )}
        </Card>
      </div>

      {guidance !== undefined && (
        <Card title={`Records to add at your registrar — ${guidance.domain}`} className="mt-4" description={guidance.instructions}>
          <GuidanceRecordsTable records={guidance.records} caption={`DNS records for ${guidance.domain}`} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip tone="neutral">registrar: Kenic-accredited</Chip>
            <CopyButton text={guidance.records.map((r) => `${r.type} ${r.name} ${r.value} TTL ${r.ttl_seconds}`).join("\n")} label="Copy all records" />
          </div>
          <p className="mt-2 text-xs text-ink-3">{guidance.registrar_hint}</p>
        </Card>
      )}

      {propagated && (
        <Card title="Next: SSL" className="mt-4" description="DNS is ready — request the certificate.">
          <ButtonLink href="/certificates/new" icon="shield">
            Issue SSL certificate
          </ButtonLink>
        </Card>
      )}
    </Screen>
  );
}
