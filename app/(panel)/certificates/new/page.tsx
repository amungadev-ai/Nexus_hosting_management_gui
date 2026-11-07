"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Callout, ErrorBlock } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { issueCertificate } from "@/lib/api/dns";
import { allCertificates } from "@/lib/mock/dns";
import { db } from "@/lib/mock/data";
import { isTerminal } from "@/lib/operations";
import type { DomainName } from "@/lib/types";

/**
 * UX-DNS-011 — Certificate issuance wizard: domains, ACME (HTTP-01)
 * prerequisites and validation. Domains whose ownership/delegation is not
 * settled are selectable but honestly disabled with the reason — HTTP-01
 * cannot complete against a domain that doesn't resolve to this server.
 */
const DOMAIN_BLOCK_REASON: Record<string, string> = {
  pending_verification: "ownership verification pending — the TXT challenge hasn't been observed yet",
  delegation_pending: "delegation pending — the domain still points at the registrar's parking",
  failed: "the last verification attempt failed — retry verification first",
};

export default function CertificateNewPage() {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [domainId, setDomainId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const domain = useMemo<DomainName | undefined>(
    () => db.domains.find((d) => d.id === domainId),
    [domainId]
  );
  const blocked = domain !== undefined && domain.state !== "verified";
  const blockReason = domain !== undefined ? DOMAIN_BLOCK_REASON[domain.state] : undefined;

  const issueOps = useMemo(
    () => list.filter((o) => o.kind === "certificate.issue" && domain !== undefined && o.resource_ref.name === domain.name),
    [list, domain]
  );
  const runningOp = issueOps.find((o) => !isTerminal(o.status));
  const lastOp = issueOps[0];
  const succeeded = lastOp !== undefined && isTerminal(lastOp.status) && lastOp.status === "succeeded";
  const failed = lastOp !== undefined && isTerminal(lastOp.status) && lastOp.status === "failed" ? lastOp : undefined;

  const existingCert = useMemo(
    () => (domain === undefined ? undefined : allCertificates().find((c) => c.domains.includes(domain.name))),
    [domain]
  );

  const issue = async () => {
    if (domain === undefined || blocked) return;
    setSubmitting(true);
    try {
      const res = await issueCertificate([domain.name]);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Certificate issue queued", `ACME (HTTP-01) runs as a tracked job — HTTPS is only called done after the panel verifies it from the outside for ${domain.name}.`);
    } catch {
      push("error", "Request was not accepted", "Try again — nothing was submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      id="UX-DNS-011"
      breadcrumbs={[{ label: "Certificates", href: "/certificates" }, { label: "Request certificate" }]}
      actions={
        <Button icon="shield" onClick={issue} loading={submitting || runningOp !== undefined} disabled={domain === undefined || blocked}>
          Issue
        </Button>
      }
    >
      <Callout tone="info" title="How v1 issuance works">
        Certificates come from Let&apos;s Encrypt over HTTP-01: Let&apos;s Encrypt must reach{" "}
        <span className="font-mono text-xs">http://your-domain/.well-known/acme-challenge/</span> on this server
        (203.0.113.10). That is why the domain has to resolve here first — the guidance records do exactly that.
        DNS-01 and wildcards arrive with v2 authoritative DNS.
      </Callout>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="1 — Choose the domain">
          <Field
            label="Domain"
            htmlFor="cert-domain"
            hint="Only verified domains can complete HTTP-01. Others stay selectable but disabled, with the reason."
          >
            <Select id="cert-domain" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
              <option value="">— pick a domain —</option>
              {db.domains.map((d) => {
                const isBlocked = d.state !== "verified";
                return (
                  <option key={d.id} value={d.id} disabled={isBlocked}>
                    {d.name}
                    {isBlocked ? ` — ${DOMAIN_BLOCK_REASON[d.state]}` : ""}
                  </option>
                );
              })}
            </Select>
          </Field>
          {domain !== undefined && blocked && blockReason !== undefined && (
            <Callout tone="warning" title={`${domain.name} can't get a certificate yet`} className="mt-3">
              Reason: {blockReason}.{" "}
              <Link href={`/domains/${domain.id}/dns-guidance`} className="font-medium text-accent hover:underline">
                Open DNS guidance
              </Link>{" "}
              to fix the records first.
            </Callout>
          )}
          {domain !== undefined && !blocked && (
            <p className="mt-3 text-sm text-ink-2">
              Prerequisites look good: {domain.name} is verified and its guidance records propagate to this server
              (203.0.113.10).
            </p>
          )}
        </Card>

        <Card title="2 — ACME prerequisites (checked before issue)">
          <KeyValue
            items={[
              { label: "Challenge type", value: "HTTP-01 (v1)" },
              { label: "Domain must resolve to", value: "203.0.113.10 (this server)", mono: true },
              { label: "Port 80", value: "Reachable from the internet — used for the challenge response" },
              { label: "Issuer", value: "Let's Encrypt" },
              { label: "Renewal", value: "Automatic ~30 days before expiry; renewal re-verifies reachability" },
            ]}
          />
        </Card>
      </div>

      {(runningOp !== undefined || lastOp !== undefined) && domain !== undefined && (
        <Card title="Issue progress" className="mt-4" description={`Tracked operation for ${domain.name}.`}>
          {runningOp !== undefined && <PendingState operation={runningOp} />}
          {runningOp === undefined && succeeded && (
            <Callout tone="success" title={`Certificate for ${domain.name} issued and verified`}>
              HTTPS was verified from the outside.{" "}
              {existingCert !== undefined ? (
                <Link href={`/certificates/${existingCert.id}`} className="font-medium text-accent hover:underline">
                  Open the certificate detail
                </Link>
              ) : (
                <>
                  The prototype keeps fixtures static — see it in the{" "}
                  <Link href="/certificates" className="font-medium text-accent hover:underline">
                    certificates inventory
                  </Link>
                  .
                </>
              )}
            </Callout>
          )}
          {runningOp === undefined && failed !== undefined && (
            <ErrorBlock
              code={failed.error?.code ?? "CERT_ISSUE_FAILED"}
              detail={failed.error?.detail ?? "The issuance job failed."}
              correlationId={failed.correlation_id}
              onRetry={issue}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
