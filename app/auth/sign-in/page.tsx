"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isApiError, signIn, verifyMfaCode, verifyRecoveryCode } from "@/lib/api/iam";
import { BareLayout } from "@/components/iam/bare-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icons";

/**
 * UX-IAM-004 — Sign-in and recovery (bare screen). Credentials → MFA
 * challenge (or a one-time recovery code) → the persona-resolved landing.
 * Anti-enumeration: failures never reveal whether the account exists. The
 * demo error paths are reachable (see the demo card) so reviewers can see
 * the honest failure states, not only the happy path.
 */
export default function SignInPage() {
  return (
    <BareLayout screenId="UX-IAM-004">
      <SignInCard />
    </BareLayout>
  );
}

type Step = "credentials" | "mfa";

function SignInCard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("jane@wanjiku.digital");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCredentials = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      setPassword("");
      setStep("mfa");
    } catch (e) {
      setError(isApiError(e) ? e.problem.detail : "Sign-in failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (useRecovery) {
        await verifyRecoveryCode(code.trim());
      } else {
        await verifyMfaCode(code.trim());
      }
      router.push("/");
    } catch (e) {
      const remaining = attemptsLeft - 1;
      setAttemptsLeft(remaining);
      if (remaining <= 0) {
        setError("Too many attempts — this challenge was invalidated. Start again from your password.");
        setStep("credentials");
        setCode("");
        setAttemptsLeft(3);
      } else {
        setError(
          isApiError(e)
            ? `${e.problem.detail} (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`
            : `Verification failed. ${remaining} attempts remaining.`
        );
      }
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to NexusPanel</h1>
        <p className="mt-2 text-sm text-ink-2">
          Authentication with MFA and account recovery that never exposes whether an account
          exists.
        </p>
      </div>

      <Card>
        {error !== null && (
          <Callout tone="danger" className="mb-4">
            {error}
          </Callout>
        )}

        {step === "credentials" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCredentials();
            }}
          >
            <Field label="Email" htmlFor="signin-email" required>
              <Input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Password" htmlFor="signin-password" required>
              <Input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" loading={submitting} disabled={password === ""}>
              Sign in
            </Button>
            <p className="text-xs text-ink-3">
              Forgot your password? Reset links never reveal whether an email is registered.
            </p>
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode();
            }}
          >
            <Field
              label={useRecovery ? "Recovery code" : "Authenticator code"}
              htmlFor="signin-code"
              required
              hint={
                useRecovery
                  ? "Each recovery code works once. Demo: any code with 6+ characters verifies."
                  : "Demo: any 6-digit code verifies — 000000 shows the failure path."
              }
            >
              <Input
                id="signin-code"
                value={code}
                onChange={(e) =>
                  setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode={useRecovery ? "text" : "numeric"}
                autoComplete={useRecovery ? "off" : "one-time-code"}
                className={useRecovery ? undefined : "max-w-40 font-mono tracking-widest"}
                placeholder={useRecovery ? "npx-XXXX-XXXX-01" : "123456"}
              />
            </Field>
            <Button type="submit" loading={submitting} disabled={code.trim() === ""}>
              Verify and sign in
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setCode("");
                  setError(null);
                }}
                className="font-medium text-accent hover:underline"
              >
                {useRecovery ? "Use an authenticator code instead" : "Use a recovery code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setCode("");
                  setError(null);
                  setAttemptsLeft(3);
                }}
                className="text-ink-2 hover:text-ink hover:underline"
              >
                Back to password
              </button>
            </div>
          </form>
        )}
      </Card>

      <Card title="This prototype is persona-aware" className="border-dashed">
        <p className="text-sm text-ink-2">
          The top bar exposes three demo switches you can flip after signing in — every honest
          state in the prototype is reproducible without reinstalling:
        </p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-2">
          <li className="flex items-start gap-2">
            <Icon name="users" size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="text-ink">Persona</strong> — changes the resolved landing,
              navigation emphasis and invite hints (persona ≠ permission).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Icon name="layers" size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="text-ink">Presentation</strong> — Guided / Standard / Expert;
              layout only, permissions identical.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Icon name="hard-drive" size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="text-ink">VPS tier</strong> — Nano / Starter / Standard /
              Provider capability sets; the honest states (DS-021) follow the tier.
            </span>
          </li>
        </ul>
      </Card>

      <p className="text-xs text-ink-2">
        Security note: in the real product sessions are HttpOnly-cookie based (no tokens in
        localStorage), and step-up re-auth binds to action + resource —{" "}
        <code className="font-mono">requestStepUp</code> in{" "}
        <code className="font-mono">lib/api/me.ts</code>.{" "}
        <Link href="/setup/welcome" className="font-medium text-accent hover:underline">
          Setting up a new installation?
        </Link>
      </p>
    </div>
  );
}
