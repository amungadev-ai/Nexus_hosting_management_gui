"use client";

import React, { useState } from "react";
import { useCapability, useOperationStream, useSession, useToast } from "@/components/providers";
import { createBucket } from "@/lib/api/services";
import { ApiError } from "@/lib/api/core";
import { Screen } from "@/components/common/screen";
import { UnavailableState, PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { Field, Fieldset, Input, Select } from "@/components/ui/form";
import { KeyValue } from "@/components/ui/misc";
import type { Operation } from "@/lib/types";

/**
 * UX-SVC-002 — Create storage bucket wizard (FLOW-015): S3 naming rules,
 * visibility with the public-read warning + URL preview, quota. Submits a
 * service.provision operation — acknowledgement only, never fake success.
 */
export default function StorageNewPage() {
  const storage = useCapability("service.storage");
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();
  const [name, setName] = useState("");
  const [exposure, setExposure] = useState<"private" | "public">("private");
  const [quotaGb, setQuotaGb] = useState("25");
  const [error, setError] = useState<string | null>(null);
  const [op, setOp] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);

  const nameValid = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await createBucket({ profile, name, exposure, quota_gb: Number(quotaGb) });
      setOp(res.data.operation);
      push("success", "Bucket creation submitted", "Provisioning runs as a verified job — the bucket appears in Platform services when the health check passes.");
      setTrayOpen(true);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.problem.title} — ${e.problem.detail}` : "The bucket could not be created. Try again or contact support.");
    } finally {
      setBusy(false);
    }
  };

  if (storage.state === "unavailable") {
    return (
      <Screen id="UX-SVC-002" breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: "New bucket" }]}>
        <UnavailableState capabilityKey="service.storage" />
      </Screen>
    );
  }

  return (
    <Screen
      id="UX-SVC-002"
      breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: "New bucket" }]}
      actions={<ButtonLink href="/services" variant="ghost">Back to services</ButtonLink>}
    >
      <div className="flex max-w-2xl flex-col gap-4">
        {op !== null ? (
          <>
            <PendingState operation={op}>
              <p className="text-sm text-ink-2">
                Access keys are generated as part of provisioning and shown once, on the bucket page.
              </p>
            </PendingState>
            <Card title="What happens next">
              <KeyValue
                items={[
                  { label: "Job", value: `${op.id} · ${op.title}`, mono: true },
                  { label: "Bucket name", value: name, mono: true },
                  { label: "Visibility", value: exposure === "public" ? "public — anyone can read objects" : "private — signed access only" },
                  { label: "Quota", value: `${quotaGb} GB` },
                ]}
              />
              <div className="mt-3 flex gap-2">
                <ButtonLink href="/services">Open Platform services</ButtonLink>
              </div>
            </Card>
          </>
        ) : (
          <Card title="Bucket details">
            <div className="flex flex-col gap-4">
              <Field
                label="Bucket name"
                htmlFor="bucket-name"
                required
                hint="S3 naming rules: lowercase letters, digits, hyphens; 3–63 characters."
                error={name !== "" && !nameValid ? "Use lowercase letters, digits and hyphens (3–63 chars, no leading/trailing hyphen)." : undefined}
              >
                <Input id="bucket-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" spellCheck={false} placeholder="media-store" />
              </Field>

              <Fieldset legend="Visibility" hint="Private is the safe default; public buckets serve objects to anyone with the URL.">
                <Select aria-label="Bucket visibility" value={exposure} onChange={(e) => setExposure(e.target.value === "public" ? "public" : "private")}>
                  <option value="private">Private — signed access only</option>
                  <option value="public">Public — anyone can read</option>
                </Select>
              </Fieldset>

              {exposure === "public" && (
                <Callout tone="warning" title="Public means anyone can read">
                  Objects in this bucket will be readable by anyone with the URL. Public preview URL:{" "}
                  <code className="font-mono text-xs">https://{name === "" ? "<name>" : name}.s3.panel-host/</code> — never
                  put exports, backups or customer data in a public bucket.
                </Callout>
              )}

              <Field label="Quota" htmlFor="bucket-quota" hint="The bucket stops accepting writes at the ceiling — usage is measured, not reserved.">
                <Select id="bucket-quota" value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)}>
                  <option value="10">10 GB</option>
                  <option value="25">25 GB</option>
                  <option value="100">100 GB</option>
                </Select>
              </Field>

              <Field label="Region" htmlFor="bucket-region" hint="Single-node installation: buckets live on this server (Nairobi route).">
                <Input id="bucket-region" value="Follows your server — nairobi-01" disabled readOnly />
              </Field>

              {error !== null && (
                <Callout tone="danger" title="Could not create the bucket">
                  {error}
                </Callout>
              )}

              <div className="flex gap-2">
                <Button icon="plus" loading={busy} disabled={!nameValid} onClick={() => void submit()}>
                  Create bucket
                </Button>
                <ButtonLink href="/services" variant="ghost">
                  Cancel
                </ButtonLink>
              </div>
              {name !== "" && !nameValid && (
                <p className="text-xs text-ink-3">The create button unlocks when the name passes the S3 rules — nothing is submitted until then.</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </Screen>
  );
}
