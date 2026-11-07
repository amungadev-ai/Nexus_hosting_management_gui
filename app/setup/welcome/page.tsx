"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Operation } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { iamClaim } from "@/lib/mock/iam";
import { claimInstallation, isApiError } from "@/lib/api/iam";
import { isTerminal, operations } from "@/lib/operations";
import { formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";
import { BareLayout } from "@/components/iam/bare-layout";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/badge";

/**
 * UX-IAM-001 — Welcome / installation claim (bare screen).
 * One-time enrollment entry: prerequisites, claim expiry, and the claim
 * form. The server was installed with a claim token so nobody else can
 * adopt it — submitting runs the "panel.claim" operation through the
 * operation engine (202 pattern); success arrives when the operation
 * reaches `succeeded`, never marked client-side.
 */
export default function SetupWelcomePage() {
  return (
    <BareLayout screenId="UX-IAM-001">
      <ClaimCard />
    </BareLayout>
  );
}

type Phase = "form" | "submitting" | "claimed";

function ClaimCard() {
  const now = useNow();
  const [serverIp, setServerIp] = useState(db.server.ip);
  const [claimToken, setClaimToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [operation, setOperation] = useState<Operation | null>(null);

  useEffect(() => {
    if (operation === null) return;
    const unsubscribe = operations.subscribe((op) => {
      if (op.id === operation.id) setOperation({ ...op });
    });
    return unsubscribe;
  }, [operation]);

  const submit = async () => {
    setError(null);
    setPhase("submitting");
    try {
      const op = await claimInstallation({ server_ip: serverIp, claim_token: claimToken });
      setOperation(op);
    } catch (e) {
      setPhase("form");
      setError(
        isApiError(e)
          ? `${e.problem.title} — ${e.problem.detail}`
          : "The claim request failed. Check the token and try again."
      );
    }
  };

  // Operation terminal → resolve the honest success state.
  useEffect(() => {
    if (operation !== null && isTerminal(operation.status)) {
      setPhase(operation.status === "succeeded" ? "claimed" : "form");
      if (operation.status !== "succeeded") {
        setError(
          `${operation.error?.code ?? "CLAIM_FAILED"} — the claim operation did not complete. Retry from the installer output.`
        );
      }
    }
  }, [operation]);

  if (phase === "claimed" && operation !== null) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
            <Icon name="check-circle" size={22} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">This installation is yours</h1>
          <p className="max-w-sm text-sm text-ink-2">
            Operation <span className="font-mono text-xs">{operation.id}</span> verified — the
            claim token is spent and this server can only be managed from this panel. Next:
            create the owner account and MFA.
          </p>
          <ButtonLink href="/setup/owner" icon="arrow-right" className="mt-2">
            Continue to owner setup
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Claim this NexusPanel installation
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          This is the one-time setup — the server was installed with a claim token so nobody
          else can adopt it. After claiming, you create the owner account and the router
          starts.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusPill status="active" />
            <span className="text-xs text-ink-2">
              Claim expires {formatRelative(iamClaim.expires_at, now)} — after expiry, rerun the
              installer to mint a new one.
            </span>
          </div>

          <div>
            <h2 className="text-sm font-medium">Before you start</h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-2">
              {[
                `${db.server.os} on ${db.server.provider_label} (${db.server.name})`,
                "Agent installed and connected over the local Unix socket",
                "HTTPS reachable — the panel serves static files behind Nginx/Caddy",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-success" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {error !== null && <Callout tone="danger">{error}</Callout>}

          <Field
            label="Server IP"
            htmlFor="claim-ip"
            hint="Detected from the installer — correct it only if this panel fronts a different host."
          >
            <Input
              id="claim-ip"
              value={serverIp}
              onChange={(e) => setServerIp(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </Field>

          <Field
            label="Claim token"
            htmlFor="claim-token"
            required
            hint="Paste the one-time token from the installer output. It is masked as you type; it is single-use and never displayed again."
          >
            <div className="flex items-center gap-2">
              <Input
                id="claim-token"
                type={showToken ? "text" : "password"}
                value={claimToken}
                onChange={(e) => setClaimToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="npx-claim-••••-••••"
                className="font-mono"
              />
              <Button
                variant="secondary"
                size="sm"
                icon={showToken ? "eye-off" : "eye"}
                onClick={() => setShowToken((s) => !s)}
                aria-label={showToken ? "Hide claim token" : "Show claim token"}
              >
                {showToken ? "Hide" : "Show"}
              </Button>
            </div>
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={submit}
              loading={phase === "submitting"}
              disabled={phase === "submitting" || claimToken.trim() === ""}
            >
              {phase === "submitting" ? "Claiming…" : "Claim this installation"}
            </Button>
            {phase === "submitting" && operation !== null && (
              <span className="text-xs text-ink-2" role="status">
                Operation <span className="font-mono">{operation.id}</span> —{" "}
                {operation.steps.find((s) => s.status === "running")?.title ??
                  "queued on the server"}
              </span>
            )}
          </div>
          {phase === "form" && claimToken.trim() === "" && (
            <p className="text-xs text-ink-3">
              Demo: paste the fixture token <span className="font-mono">{iamClaim.token}</span> —
              anything else is rejected with the honest error path.
            </p>
          )}
        </div>
      </Card>

      <p className="text-sm text-ink-2">
        Want the full picture first?{" "}
        <Link href="/overview/capabilities" className="font-medium text-accent hover:underline">
          What NexusPanel can and cannot do on this VPS
        </Link>{" "}
        — the capability story is checked at install time, not marketed.
      </p>
    </div>
  );
}
