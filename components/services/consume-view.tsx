"use client";

import React, { useMemo, useState } from "react";
import { findServiceInstance, templateForKey, consumeCandidates } from "@/lib/mock/services";
import { useOperationStream, useToast } from "@/components/providers";
import { consumeService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/core";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/form";
import { DiffViewer } from "@/components/ui/misc";
import type { Operation } from "@/lib/types";

/**
 * UX-SVC-010 — Consume service: attach a bucket to a site/app, inject the
 * credentials, preview the exact diff before confirming. No .env editing,
 * no copying keys between dashboards.
 */
export default function ConsumeView({ bucketId }: { bucketId: string }) {
  const bucket = findServiceInstance(bucketId);
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();
  const candidates = useMemo(() => consumeCandidates(), []);
  const [targetId, setTargetId] = useState(candidates[0]?.id ?? "");
  const [pendingOp, setPendingOp] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);

  if (bucket === undefined || templateForKey(bucket.template_key)?.category !== "storage") {
    return (
      <Screen id="UX-SVC-010" breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: "Attach" }]}>
        <NotFoundInline what="storage bucket" />
      </Screen>
    );
  }

  const target = candidates.find((c) => c.id === targetId);
  const targetLabel = target?.label ?? "a site";

  const hunks = [
    { path: "S3_ENDPOINT", before: "(unset)", after: `https://${bucket.hostname ?? ""}` },
    { path: "S3_BUCKET", before: "(unset)", after: bucket.name },
    { path: "S3_ACCESS_KEY_ID", before: "(unset)", after: `sak_${bucket.name.slice(0, 6)}` },
    { path: "S3_SECRET_ACCESS_KEY", before: "(unset)", after: "•••••••• (write-only — injected, never displayed)" },
  ];

  const inject = async () => {
    if (target === undefined) return;
    setBusy(true);
    try {
      const res = await consumeService(bucket, { type: target.type, id: target.id, name: target.label });
      setPendingOp(res.data.operation);
      push("success", "Attachment submitted", `${bucket.name} is being attached to ${targetLabel} — the diff above is what changes.`);
      setTrayOpen(true);
    } catch (e) {
      push("error", "Could not attach", e instanceof ApiError ? e.problem.detail : "Try again or contact support.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      id="UX-SVC-010"
      breadcrumbs={[
        { label: "Platform services", href: "/services" },
        { label: bucket.name, href: `/services/storage/${bucket.id}` },
        { label: "Attach to a site" },
      ]}
      actions={<ButtonLink href={`/services/storage/${bucket.id}`} variant="ghost">Back to bucket</ButtonLink>}
    >
      <div className="flex flex-col gap-4">
        {pendingOp !== null ? (
          <PendingState operation={pendingOp}>
            <p className="text-sm text-ink-2">
              Credentials are injected write-only; the app process restarts (or the site config is applied) and the
              connection is verified before the job can succeed.
            </p>
          </PendingState>
        ) : (
          <>
            <Card title="Pick the workload that should use this bucket">
              <Field label="Site or application" htmlFor="consume-target" hint="Only active sites and running apps are listed.">
                <Select id="consume-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </Card>

            <Card title="Preview: exactly what changes">
              <DiffViewer hunks={hunks} />
              <Callout tone="info" title="No .env editing, no key copying">
                The panel writes the four variables above into the workload&apos;s environment and restarts it.
                Secrets are write-only — they are never displayed again after injection.
              </Callout>
              <div className="mt-4 flex gap-2">
                <Button icon="zap" loading={busy} onClick={() => void inject()}>
                  Attach {bucket.name} to {targetLabel}
                </Button>
                <ButtonLink href={`/services/storage/${bucket.id}`} variant="ghost">
                  Cancel
                </ButtonLink>
              </div>
            </Card>
          </>
        )}
      </div>
    </Screen>
  );
}
