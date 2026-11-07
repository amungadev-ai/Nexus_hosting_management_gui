"use client";

import React from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { useNow, useSession } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { loginEvents, serviceHealth, sessionPolicies } from "@/lib/mock/ops";
import { formatRelative, formatUtc } from "@/lib/format";

/**
 * UX-OPS-012 /security — Security overview: findings, risky settings, MFA and
 * patch status, plus Login security (MFA status, session policy). Links into
 * the firewall / SSH / isolation / audit surfaces.
 */
export default function SecurityPage() {
  const now = useNow();
  const { profile } = useSession();
  const health = useFixture(() => serviceHealth);
  const logins = useFixture(() => loginEvents);

  const unhealthy = (health ?? []).filter((h) => h.state === "unhealthy" || h.state === "degraded");
  const failedLogins = (logins ?? []).filter((l) => l.outcome === "failed");
  const me = db.users.find((u) => u.id === db.currentUser);

  return (
    <Screen
      id="UX-OPS-012"
      breadcrumbs={[{ label: "Security" }]}
      actions={
        <ButtonLink href="/audit" variant="secondary" icon="file-text">
          Audit trail
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Firewall" description={`${5} rules · default-deny inbound`}>
            <p className="text-sm text-ink-2">
              SSH is restricted to your office IP; web ports are public. One change is
              awaiting second-person approval.
            </p>
            <div className="mt-3">
              <ButtonLink href="/security/firewall" variant="secondary" size="sm">
                Review rules
              </ButtonLink>
            </div>
          </Card>
          <Card title="SSH keys" description="2 keys authorized">
            <p className="text-sm text-ink-2">
              Keys are ed25519; the private keys never leave your devices. Revoke anything
              you no longer recognise.
            </p>
            <div className="mt-3">
              <ButtonLink href="/security/ssh" variant="secondary" size="sm">
                Manage keys
              </ButtonLink>
            </div>
          </Card>
          <Card title="Patch status" description={`Panel 2.4.1 · agent 1.4.2 · ${db.server.os}`}>
            <p className="text-sm text-ink-2">
              One panel update is available and applies inside your maintenance window.
            </p>
            <div className="mt-3">
              <ButtonLink href="/operations/updates" variant="secondary" size="sm">
                Updates and patches
              </ButtonLink>
            </div>
          </Card>
        </div>

        {failedLogins.length > 0 && (
          <Callout tone="warning" title="Recent failed sign-ins">
            {failedLogins.map((l) => `${formatUtc(l.occurred_at)} — ${l.detail} (source ${l.ip})`).join(" · ")}.
            Rate limiting held; no account was locked. Audit the source IP if it is unfamiliar.
          </Callout>
        )}

        {unhealthy.length > 0 && (
          <Callout tone="info" title="Findings from monitoring">
            {unhealthy.map((h) => `${h.name}: ${h.detail}`).join(" · ")} — unhealthy services are
            the most common attack-surface after stale software.
          </Callout>
        )}

        <Card title="Login security" description="MFA status and the session policy that binds every admin action">
          <ul className="flex list-none flex-col gap-3 p-0">
            {sessionPolicies.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{p.label}</p>
                  <p className="text-xs text-ink-2">{p.description}</p>
                </div>
                <span className="text-sm font-medium text-ink">{p.value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            You are signed in as {me?.display_name ?? "the owner"} — MFA{" "}
            {me?.mfa_enabled ? "enabled" : "NOT enabled (fix this first)"}. The isolation and
            tenancy boundaries live in{" "}
            <ButtonLink href="/security/isolation" variant="link" size="sm">Isolation and policies</ButtonLink>.
          </p>
        </Card>

        <Card title="Recent security events" description="Sign-in outcomes from the auth service">
          {logins === null ? (
            <SkeletonTable rows={3} cols={3} />
          ) : (
            <ul className="divide-y divide-line">
              {logins.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {l.actor_label} <span className="font-mono text-xs text-ink-3">{l.ip}</span>
                    </p>
                    <p className="text-xs text-ink-3">{l.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={l.outcome === "succeeded" ? "succeeded" : "failed"} />
                    <span className="text-xs text-ink-3">{formatRelative(l.occurred_at, now)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="text-xs text-ink-3">
          Profile context: {profile} — capability honesty means security features that cannot
          run on this VPS say so instead of hiding (see the capability overview).
        </p>
      </div>
    </Screen>
  );
}
