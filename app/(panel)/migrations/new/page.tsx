"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/mock/data";
import { startMigration } from "@/lib/api/support";
import { isTerminal } from "@/lib/operations";
import { useOperationStream, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Stepper } from "@/components/ui/nav";
import { Field, Input, Select } from "@/components/ui/form";
import { KeyValue } from "@/components/ui/misc";
import { SecretField } from "@/components/ui/code";
import { Callout, ErrorBlock, SkeletonTable } from "@/components/ui/feedback";
import { useFixture } from "@/components/support/shared";

/**
 * UX-SUP-003 /migrations/new — migration wizard (DS-006 stepper). Source
 * cPanel-style URL, masked credentials (DS-008), target website, preflight
 * note, review. Submitting calls startMigration() → migration.import batch
 * operation (202) → PendingState; the hub tracks the result.
 */

const STEPS = ["Source", "Credentials", "Target", "Review"];

export default function MigrationWizardPage() {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [step, setStep] = useState(0);
  const [sourceUrl, setSourceUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [target, setTarget] = useState<string>("new");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [opId, setOpId] = useState<string | null>(null);

  const websites = useFixture(() => db.websites);
  const operation = useMemo(() => (opId === null ? undefined : list.find((o) => o.id === opId)), [opId, list]);

  const targetLabel = target === "new" ? "New website (created during import)" : (websites ?? []).find((w) => w.id === target)?.title ?? target;

  const validateStep = (s: number): boolean => {
    const next: Record<string, string> = {};
    if (s === 0) {
      if (sourceUrl.trim() === "") {
        next.sourceUrl = "Enter the full cPanel URL, for example https://server.example.com:2083.";
      } else {
        try {
          const parsed = new URL(sourceUrl.trim());
          if (parsed.protocol !== "https:") next.sourceUrl = "The source must be reached over HTTPS — update the URL to https://…";
        } catch {
          next.sourceUrl = "That does not look like a URL. Include the scheme, e.g. https://server.example.com:2083.";
        }
      }
    }
    if (s === 1) {
      if (username.trim() === "") next.username = "The cPanel username is required to read the source inventory.";
      if (password === "") next.password = "Paste the source password or an app-specific password — it is never displayed or logged.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    if (!validateStep(0) || !validateStep(1)) {
      setStep(0);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await startMigration({
        source_url: sourceUrl.trim(),
        host_label: targetLabel,
      });
      setOpId(result.operation_id);
      setFocusedId(result.operation_id);
      setTrayOpen(true);
      push(
        "success",
        "Import accepted (202)",
        "The migration runs as a batch job — it yields to your websites under load. If the dry-run finds conflicts, the import pauses for review."
      );
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "The import could not be started. Check the values and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- import accepted: track the operation ------------------------------
  if (opId !== null) {
    const succeeded = operation?.status === "succeeded";
    return (
      <Screen
        id="UX-SUP-003"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Migrations", href: "/migrations" }, { label: "New" }]}
      >
        <div className="mx-auto max-w-2xl">
          {succeeded ? (
            <Callout tone="success" title="Import finished and verified">
              Checksums verified. The migration now appears as completed in the migration hub —
              open the hub to see the result and any DNS guidance for the cutover.
            </Callout>
          ) : operation !== undefined && isTerminal(operation.status) ? (
            <ErrorBlock
              code={operation.error?.code ?? "MIGRATION_IMPORT_FAILED"}
              detail={operation.error?.detail ?? "The import stopped before cutover. Nothing was replaced — you can retry safely."}
              correlationId={operation.correlation_id}
            />
          ) : operation !== undefined ? (
            <PendingState operation={operation}>
              <p className="text-xs text-ink-2">
                Batch job — it runs at low priority and yields to your websites. If the dry-run finds
                conflicts (name clashes, PHP version, database prefix), the import pauses and the hub
                links to the conflict review.
              </p>
            </PendingState>
          ) : (
            <Callout tone="info">Accepting the request…</Callout>
          )}
          <div className="mt-4">
            <ButtonLink href="/migrations" variant="secondary">
              Back to migration hub
            </ButtonLink>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      id="UX-SUP-003"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Migrations", href: "/migrations" }, { label: "New" }]}
      description="Inventory, dry-run, conflicts, cutover and rollback. Source-platform imports (cPanel/DirectAdmin/Plesk) are v2 scope — this wizard prototypes the flow; the supported v1 path is template transfer."
    >
      <div className="mx-auto max-w-3xl">
        <Stepper steps={STEPS} current={step} className="mb-6" />

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Field
              label="Source cPanel URL"
              htmlFor="mig-url"
              required
              error={errors.sourceUrl}
              hint="The server you are moving from, e.g. https://server.example.com:2083. DirectAdmin and Plesk follow the same flow in v2."
            >
              <Input
                id="mig-url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://server.example.com:2083"
                autoComplete="url"
                inputMode="url"
              />
            </Field>
            <Callout tone="info" title="What the preflight checks before anything is written">
              Source inventory and sizes, free disk space, PHP/runtime compatibility, and name or
              database-prefix clashes against this panel. Conflicts pause the import for review —
              nothing is cut over until you resolve them.
            </Callout>
            <Callout tone="warning" title="Moving between two NexusPanel VPS installs instead?">
              Use the supported v1 path —{" "}
              <Link href="/settings/templates/transfer" className="font-medium text-accent hover:underline">
                ServiceTemplate export/import
              </Link>{" "}
              — which packages an instance as an OCI-compatible artifact.
            </Callout>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Field label="cPanel username" htmlFor="mig-user" required error={errors.username}>
              <Input
                id="mig-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Source account username"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field
              label="Password"
              htmlFor="mig-pass"
              required
              error={errors.password}
              hint="Prefer an app-specific password. Credentials are used once to read the inventory, never logged, and redacted from job output."
            >
              <Input
                id="mig-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Callout tone="info" title="Secrets handling (DS-008)">
              The password stays masked, is never captured in analytics or job logs, and you can
              review it masked once more on the review step before submitting.
            </Callout>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Field
              label="Where does the content land?"
              htmlFor="mig-target"
              hint="A new website is created from the source inventory; an existing website merges the imported content into it."
            >
              <Select id="mig-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="new">New website (created during import)</option>
                {websites === null ? (
                  <option value="" disabled>
                    Loading websites…
                  </option>
                ) : (
                  websites.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title} ({w.primary_domain})
                    </option>
                  ))
                )}
              </Select>
            </Field>
            {target !== "new" && websites !== null && (
              <Callout tone="warning" title="Existing website selected">
                Files and databases from the source are merged into{" "}
                {websites.find((w) => w.id === target)?.title}. Where names clash, the import pauses
                for conflict review — the existing site keeps serving until cutover.
              </Callout>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <Callout tone="info" title="Review — what will happen">
              The panel reads the source inventory, runs a dry-run, then copies files and databases
              as a batch job. Verification and DNS guidance come last; the source server is never
              modified.
            </Callout>
            <KeyValue
              columns={2}
              items={[
                { label: "Source", value: <span className="break-all font-mono text-xs">{sourceUrl.trim() === "" ? "—" : sourceUrl.trim()}</span>, mono: true },
                { label: "Username", value: username === "" ? "—" : username },
                { label: "Target", value: targetLabel },
                { label: "Preflight", value: "Inventory, disk fit, runtime compatibility, clash check" },
              ]}
            />
            <SecretField label="Source password (masked)" value={password} />
            {submitError !== null && (
              <Callout tone="danger" title="Could not start the import">
                {submitError}
              </Callout>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <ButtonLink href="/migrations" variant="ghost">
              Cancel
            </ButtonLink>
            {step < STEPS.length - 1 ? (
              <Button onClick={goNext}>Next: {STEPS[step + 1]}</Button>
            ) : (
              <Button onClick={submit} loading={submitting} icon="upload">
                Start import
              </Button>
            )}
          </div>
        </div>
        {websites === null && (
          <div className="mt-4">
            <SkeletonTable rows={1} cols={2} />
          </div>
        )}
      </div>
    </Screen>
  );
}
