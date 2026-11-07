"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useNow, useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, ErrorBlock } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { OperationTimeline } from "@/components/common/operation-timeline";
import { ConfirmDialog } from "@/components/ui/overlay";
import { CertStatusPill } from "@/components/dns/dns-bits";
import { renewCertificate, revokeCertificate } from "@/lib/api/dns";
import { allCertificates, certificateFailure } from "@/lib/mock/dns";
import { db } from "@/lib/mock/data";
import { isTerminal } from "@/lib/operations";
import { formatDate, formatRelative } from "@/lib/format";

/**
 * UX-DNS-012 — Certificate detail: chain/issuer, validity, renewal timeline
 * (tracked operation), renew and revoke. The failed certificate shows its
 * safe error code with a retry path and the underlying DNS fix.
 */
export function CertificateDetailView({ certId }: { certId: string }) {
  const now = useNow();
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [renewing, setRenewing] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const cert = useMemo(() => allCertificates().find((c) => c.id === certId), [certId]);
  const failure = cert !== undefined ? certificateFailure(cert.id) : undefined;

  const certOps = useMemo(
    () =>
      list.filter(
        (o) =>
          o.resource_ref.type === "certificate" &&
          o.resource_ref.id === certId &&
          (o.kind === "certificate.renew" || o.kind === "certificate.revoke")
      ),
    [list, certId]
  );
  const runningOp = certOps.find((o) => !isTerminal(o.status));
  const lastRenew = certOps.find((o) => o.kind === "certificate.renew");
  const lastRenewFailed = lastRenew !== undefined && isTerminal(lastRenew.status) && lastRenew.status === "failed";

  const domain = useMemo(
    () => (cert === undefined ? undefined : db.domains.find((d) => d.name === cert.domains[0])),
    [cert]
  );

  if (cert === undefined) {
    return (
      <Screen id="UX-DNS-012" breadcrumbs={[{ label: "Certificates", href: "/certificates" }]}>
        <NotFoundInline what="certificate" />
      </Screen>
    );
  }

  const primaryDomain = cert.domains[0];

  const renew = async () => {
    setRenewing(true);
    try {
      const res = await renewCertificate(cert.id, primaryDomain);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Renewal queued", `ACME re-verifies that ${primaryDomain} still resolves to this server before the new certificate is called done.`);
    } catch {
      push("error", "Renewal was not accepted", "Try again — the current certificate stays in place.");
    } finally {
      setRenewing(false);
    }
  };

  const revoke = async () => {
    try {
      const res = await revokeCertificate(cert.id, primaryDomain);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("info", "Revocation submitted", "Let's Encrypt revokes the certificate and nginx falls back — tracked as a job until verified.");
    } catch {
      push("error", "Revocation was not accepted", "Try again — the certificate stays active until a revocation succeeds.");
    }
  };

  return (
    <Screen
      id="UX-DNS-012"
      breadcrumbs={[{ label: "Certificates", href: "/certificates" }, { label: primaryDomain }]}
      actions={
        <>
          <Button icon="refresh" onClick={renew} loading={renewing || runningOp !== undefined}>
            Renew
          </Button>
          <Button variant="secondary" icon="trash" onClick={() => setConfirmRevoke(true)}>
            Revoke
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Certificate">
          <KeyValue
            items={[
              {
                label: "Covers",
                value: (
                  <span className="flex flex-col gap-0.5">
                    {cert.domains.map((d) => (
                      <span key={d} className="font-mono text-xs">
                        {d}
                      </span>
                    ))}
                  </span>
                ),
              },
              { label: "Issuer", value: cert.issuer },
              { label: "Status", value: <CertStatusPill certificate={cert} /> },
            ]}
          />
        </Card>

        <Card title="Validity & renewal">
          <KeyValue
            items={[
              {
                label: "Valid until",
                value: (
                  <>
                    {formatDate(cert.expires_at)}{" "}
                    <span className="text-xs text-ink-3">({formatRelative(cert.expires_at, now)})</span>
                  </>
                ),
              },
              { label: "Auto-renew", value: cert.auto_renew ? "On — renewal starts ~30 days before expiry" : "Off" },
              {
                label: "Last renewal attempt",
                value: cert.last_renewal_attempt_at !== undefined ? formatRelative(cert.last_renewal_attempt_at, now) : "—",
              },
              {
                label: "Assignment",
                value:
                  domain?.website_id !== undefined ? (
                    <Link href={`/websites/${domain.website_id}`} className="text-accent hover:underline">
                      {db.websites.find((w) => w.id === domain.website_id)?.title ?? "website"}
                    </Link>
                  ) : (
                    "No website assigned"
                  ),
              },
            ]}
          />
        </Card>
      </div>

      {failure !== undefined && (
        <Card title="Why the last attempt failed" className="mt-4">
          <ErrorBlock
            code={failure.code}
            detail={failure.detail}
            correlationId={undefined}
            onRetry={renew}
          />
          {domain !== undefined && domain.state === "delegation_pending" && (
            <Callout tone="warning" title="Renewal will keep failing until DNS is fixed" className="mt-3">
              Retry here re-runs ACME, but HTTP-01 cannot succeed while {primaryDomain} points at the registrar&apos;s
              parking.{" "}
              <Link href={`/domains/${domain.id}/delegation`} className="font-medium text-accent hover:underline">
                Fix the delegation first
              </Link>
              .
            </Callout>
          )}
        </Card>
      )}

      <Card
        title="Renewal timeline"
        className="mt-4"
        description="Every renewal is a tracked operation — success is only claimed after the panel verifies HTTPS from the outside."
      >
        {runningOp !== undefined && (
          <div className="mb-3">
            <PendingState operation={runningOp} />
          </div>
        )}
        {lastRenew !== undefined ? (
          <OperationTimeline operation={lastRenew} />
        ) : (
          <p className="text-sm text-ink-2">
            No renewal job has run in this session yet. Auto-renew runs ~30 days before expiry; press Renew to start
            one now. Renewals never display as successful while the operation is still pending.
          </p>
        )}
        {lastRenew !== undefined && lastRenewFailed && failure === undefined && (
          <ErrorBlock
            code={lastRenew.error?.code ?? "CERT_RENEW_FAILED"}
            detail={lastRenew.error?.detail ?? "The renewal job failed."}
            correlationId={lastRenew.correlation_id}
            onRetry={renew}
            className="mt-3"
          />
        )}
      </Card>

      <div className="mt-3">
        <ButtonLink href="/certificates" variant="ghost" size="sm" icon="arrow-right">
          All certificates
        </ButtonLink>
      </div>

      <ConfirmDialog
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={revoke}
        title={`Revoke certificate for ${primaryDomain}?`}
        body={`Revocation is permanent for this certificate: Let's Encrypt will stop trusting ${primaryDomain}'s current certificate and the site falls back to no TLS until a new one is issued. Browsers will warn visitors. Renew instead if you just want a fresh certificate.`}
        confirmLabel={`Revoke certificate for ${primaryDomain}`}
        destructive
      />
    </Screen>
  );
}
