"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/common/screen";
import { useNow } from "@/components/providers";
import { ButtonLink } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { ErrorBlock, SkeletonTable } from "@/components/ui/feedback";
import { CertStatusPill } from "@/components/dns/dns-bits";
import { listCertificates } from "@/lib/api/dns";
import { certificateFailure } from "@/lib/mock/dns";
import type { Certificate } from "@/lib/types";
import { formatDate, formatRelative } from "@/lib/format";

/**
 * UX-DNS-010 — SSL certificates: issued/pending/expiring certificates with
 * SANs, renewal state and expiry. All v1 certificates are issued via Let's
 * Encrypt over HTTP-01; the failed certificate shows its honest error inline.
 */
export default function CertificatesPage() {
  const now = useNow();
  const router = useRouter();
  const [certs, setCerts] = React.useState<Certificate[] | null>(null);

  React.useEffect(() => {
    let active = true;
    listCertificates().then((rows) => {
      if (active) setCerts(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen
      id="UX-DNS-010"
      actions={
        <ButtonLink href="/certificates/new" icon="plus">
          Request certificate
        </ButtonLink>
      }
    >
      {certs === null ? (
        <SkeletonTable rows={4} cols={5} />
      ) : certs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <h3 className="text-base font-semibold text-ink">No certificates yet</h3>
          <p className="max-w-sm text-sm text-ink-2">
            Certificates are issued automatically once a domain resolves to this server — request the first one for a
            verified domain.
          </p>
          <ButtonLink href="/certificates/new" icon="plus">
            Request a certificate
          </ButtonLink>
        </div>
      ) : (
        <TableCard<Certificate>
          title="Certificates"
          caption="Issued/pending/expiring certificates, SANs and renewal"
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/certificates/${c.id}`)}
          columns={[
            {
              key: "domains",
              header: "Covers",
              sortable: true,
              className: "sticky left-0 bg-surface",
              render: (c) => (
                <div className="flex min-w-0 flex-col gap-1">
                  <Link href={`/certificates/${c.id}`} className="truncate font-mono text-xs font-medium text-accent hover:underline">
                    {c.domains[0]}
                  </Link>
                  <span className="whitespace-nowrap text-xs text-ink-3">
                    {c.domains.length > 1 ? `${c.domains.length - 1} SAN${c.domains.length > 2 ? "s" : ""}` : "no SANs"}
                  </span>
                </div>
              ),
            },
            { key: "status", header: "Status", render: (c) => <CertStatusPill certificate={c} /> },
            {
              key: "issuer",
              header: "Issuer",
              render: (c) => <span className="whitespace-nowrap text-xs text-ink-2">{c.issuer}</span>,
            },
            {
              key: "expires_at",
              header: "Expires",
              sortable: true,
              render: (c) => (
                <span className="whitespace-nowrap text-xs text-ink-2">
                  {formatDate(c.expires_at)}{" "}
                  <span className="text-ink-3">({formatRelative(c.expires_at, now)})</span>
                </span>
              ),
            },
            {
              key: "auto_renew",
              header: "Auto-renew",
              render: (c) =>
                c.auto_renew ? <Chip tone="success">on</Chip> : <Chip tone="warning">off</Chip>,
            },
          ]}
          rows={certs}
        />
      )}

      {certs !== null &&
        certs.map((c) => {
          const failure = certificateFailure(c.id);
          if (failure === undefined) return null;
          return (
            <div key={c.id} className="mt-3">
              <ErrorBlock
                code={failure.code}
                detail={`${c.domains.join(", ")} — ${failure.detail}`}
                onRetry={undefined}
              />
              <p className="mt-1 text-xs text-ink-3">
                Open{" "}
                <Link href={`/certificates/${c.id}`} className="text-accent hover:underline">
                  the certificate detail
                </Link>{" "}
                for the retry path — or fix the delegation of{" "}
                <Link href="/domains/dom_01JWANI03/delegation" className="text-accent hover:underline">
                  wanjiku.co.ke
                </Link>{" "}
                first.
              </p>
            </div>
          );
        })}

      <p className="mt-3 text-xs text-ink-3">
        Issued via Let&apos;s Encrypt over HTTP-01: a certificate can only be issued (or renewed) once the domain
        actually resolves to this server — renewals never silently succeed against a broken DNS. Wildcard and DNS-01
        issuance arrive with v2 authoritative DNS.
      </p>
    </Screen>
  );
}
