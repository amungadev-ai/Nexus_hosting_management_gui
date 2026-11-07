"use client";

import React, { useEffect, useRef, useState } from "react";
import { requestStepUp } from "@/lib/api/me";
import { isApiError } from "@/lib/api/iam";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";

/**
 * Step-up re-authentication dialog — the DS-008/DS-010 contract for
 * sensitive operations. Calls POST /me/step-up (lib/api/me.requestStepUp),
 * which returns a short-lived token bound to the exact action + resource;
 * the bound pair is shown so the user sees what they are authorizing.
 * The token is consumed by the subsequent request — it is never displayed.
 */
export function StepUpDialog({
  open,
  onClose,
  onVerified,
  action,
  resourceId,
  resourceLabel,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  action: string;
  resourceId: string;
  resourceLabel: string;
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setVerifying(false);
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const submit = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (code.trim() === "000000") {
      setError("That code did not match. Two attempts remaining before the challenge is invalidated.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await requestStepUp(action, resourceId);
      onVerified();
      onClose();
    } catch (e) {
      setError(isApiError(e) ? e.problem.detail : "Step-up verification failed. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm with MFA"
      description="This action is protected by step-up authentication. The short-lived token is bound to the exact action and resource below."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={verifying} onClick={submit}>
            Verify and continue
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-control bg-surface-2 p-3 font-mono text-xs text-ink">
          <p>
            action: <span className="font-medium">{action}</span>
          </p>
          <p className="mt-1">
            resource: <span className="font-medium">{resourceLabel}</span>{" "}
            <span className="text-ink-3">({resourceId})</span>
          </p>
        </div>
        {error !== null && <Callout tone="danger">{error}</Callout>}
        <Field
          label="Authenticator code"
          htmlFor="step-up-code"
          required
          hint="Demo: any 6-digit code verifies — 000000 simulates a wrong code."
        >
          <Input
            ref={inputRef}
            id="step-up-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
          />
        </Field>
      </div>
    </Modal>
  );
}
