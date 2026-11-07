"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapOwner, isApiError, type OwnerBootstrap } from "@/lib/api/iam";
import { BareLayout } from "@/components/iam/bare-layout";
import { QrBlock } from "@/components/iam/qr-block";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, Spinner } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Stepper } from "@/components/ui/nav";
import { CodeBlock, CopyButton } from "@/components/ui/code";
import { useToast } from "@/components/providers";

/**
 * UX-IAM-002 — Owner account and MFA (bare screen). The bootstrap
 * prerequisite for the router (FLOW-013 entry condition): owner identity →
 * authenticator MFA (mock QR + 6-digit verify) → recovery codes shown once
 * (DS-008). Finishing submits the "panel.owner_bootstrap" operation and
 * hands off to /onboarding.
 */
export default function SetupOwnerPage() {
  return (
    <BareLayout screenId="UX-IAM-002" width="lg">
      <OwnerSetup />
    </BareLayout>
  );
}

const STEPS = ["Owner account", "Set up MFA", "Recovery codes"];

function OwnerSetup() {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<OwnerBootstrap | null>(null);
  const { push } = useToast();
  const router = useRouter();

  const accountValid =
    displayName.trim().length >= 2 && email.includes("@") && password.length >= 12;

  const verifyMfa = async () => {
    setError(null);
    if (!/^\d{6}$/.test(mfaCode.trim())) {
      setError("Enter the 6-digit code shown by your authenticator app.");
      return;
    }
    setVerifying(true);
    try {
      const result = await bootstrapOwner({
        display_name: displayName.trim(),
        email: email.trim(),
        password,
        mfa_code: mfaCode.trim(),
      });
      setBootstrap(result);
      setStep(2);
    } catch (e) {
      setError(
        isApiError(e)
          ? `${e.problem.title} — ${e.problem.detail}`
          : "MFA verification failed. Try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  const finish = () => {
    push(
      "success",
      "Owner account created",
      "MFA is bound and recovery codes were hashed at rest. Opening the router — the bootstrap job is tracked under Activity → Jobs."
    );
    // Give the acknowledgement a beat, then hand off to FLOW-013.
    window.setTimeout(() => router.push("/onboarding"), 900);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create the owner account</h1>
        <p className="mt-2 text-sm text-ink-2">
          One owner identity, MFA enforced. This is the bootstrap prerequisite for the router —
          after this, NexusPanel asks what you want to run.
        </p>
      </div>

      <Stepper steps={STEPS} current={step} />

      {error !== null && <Callout tone="danger">{error}</Callout>}

      {step === 0 && (
        <Card>
          <div className="flex flex-col gap-4">
            <Field label="Display name" htmlFor="owner-name" required>
              <Input
                id="owner-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                placeholder="Jane Wanjiku"
              />
            </Field>
            <Field label="Email" htmlFor="owner-email" required hint="Used for sign-in and critical notifications.">
              <Input
                id="owner-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="jane@wanjiku.digital"
              />
            </Field>
            <Field
              label="Password"
              htmlFor="owner-password"
              required
              hint="At least 12 characters. The API never receives recovery codes or passwords in logs; hashing happens server-side."
              error={password !== "" && password.length < 12 ? "Use at least 12 characters." : undefined}
            >
              <Input
                id="owner-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <div className="flex justify-end">
              <Button
                disabled={!accountValid}
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
              >
                Continue to MFA setup
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2">
              <QrBlock seed={`owner-mfa:${email}`} className="h-40 w-40 rounded-control border border-line" />
              <p className="max-w-40 text-center text-xs text-ink-3">
                Scan with any TOTP authenticator app.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <Field
                label="Authenticator code"
                htmlFor="owner-mfa-code"
                required
                hint="Demo: any 6-digit code verifies. The real product checks the TOTP against the server-issued secret."
              >
                <Input
                  id="owner-mfa-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="max-w-40 font-mono tracking-widest"
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button loading={verifying} onClick={verifyMfa}>
                  Verify code
                </Button>
                <Button variant="ghost" onClick={() => setStep(0)}>
                  Back
                </Button>
                {verifying && (
                  <span className="inline-flex items-center gap-2 text-xs text-ink-2">
                    <Spinner size={14} /> Binding the MFA factor…
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && bootstrap !== null && (
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold">Recovery codes — shown once</h2>
              <p className="mt-1 text-sm text-ink-2">
                Each code works exactly one time if you lose your authenticator. They are hashed
                at rest and <strong>will not be shown again</strong> after you leave this step.
              </p>
            </div>
            <CodeBlock code={bootstrap.recovery_codes.join("\n")} language="recovery codes" />
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={bootstrap.recovery_codes.join("\n")} label="Copy all codes" />
              <span className="text-xs text-ink-3">
                Store them in a password manager — never in screenshots or telemetry.
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-xs text-ink-2">
                Operation <span className="font-mono">{bootstrap.operation.id}</span> —
                creation is tracked as a job, not assumed.
              </p>
              <Button icon="arrow-right" onClick={finish}>
                Finish and open the router
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
