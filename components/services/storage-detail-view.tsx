"use client";

import React, { useState } from "react";
import Link from "next/link";
import { findServiceInstance, templateForKey, BUCKET_CONSUMERS, BUCKET_OBJECTS, BUCKET_STATS } from "@/lib/mock/services";
import { useCapability, useOperationStream, useSession, useToast } from "@/components/providers";
import { rotateBucketKeys } from "@/lib/api/services";
import { ApiError } from "@/lib/api/core";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine, NotFoundInline, PendingState } from "@/components/common/states";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { CopyButton, SecretField } from "@/components/ui/code";
import { KeyValue } from "@/components/ui/misc";
import { Icon } from "@/components/ui/icons";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";
import type { Operation } from "@/lib/types";
import type { BucketObject } from "@/lib/mock/services";

/** UX-SVC-003 — Storage bucket detail: endpoint, keys, usage, consumed-by. */
export default function StorageDetailView({ bucketId }: { bucketId: string }) {
  const bucket = findServiceInstance(bucketId);
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();
  const storage = useCapability("service.storage");
  const now = useNow();
  const [rotation, setRotation] = useState<{ op: Operation; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (bucket === undefined || templateForKey(bucket.template_key)?.category !== "storage") {
    return (
      <Screen id="UX-SVC-003" breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: "Bucket" }]}>
        <NotFoundInline what="storage bucket" />
      </Screen>
    );
  }

  const rotate = async () => {
    setBusy(true);
    try {
      const res = await rotateBucketKeys(bucket.id, profile);
      setRotation({ op: res.data.operation, secret: res.data.secret });
      push("success", "Key rotation submitted", "The new secret is shown once below — update the consuming sites after the job verifies.");
      setTrayOpen(true);
    } catch (e) {
      push("error", "Rotation failed", e instanceof ApiError ? e.problem.detail : "Try again or contact support.");
    } finally {
      setBusy(false);
    }
  };

  const objectColumns: DataTableColumn<BucketObject>[] = [
    { key: "key", header: "Object", render: (o) => <span className="break-all font-mono text-xs">{o.key}</span>, className: "min-w-64" },
    { key: "size_bytes", header: "Size", render: (o) => <span className="tabular-nums">{formatBytes(o.size_bytes)}</span> },
    { key: "modified_at", header: "Modified", render: (o) => <span className="whitespace-nowrap">{formatRelative(o.modified_at, now)}</span> },
    { key: "storage_class", header: "Class", render: (o) => <Chip tone={o.storage_class === "standard" ? "neutral" : "info"}>{o.storage_class}</Chip> },
  ];

  return (
    <Screen
      id="UX-SVC-003"
      breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: bucket.name }]}
      actions={
        <>
          <Button icon="key" onClick={() => void rotate()} loading={busy} disabled={storage.state === "unavailable"}>
            Rotate keys
          </Button>
          <ButtonLink href={`/services/consume/${bucket.id}`} variant="secondary" icon="zap">
            Attach to a site
          </ButtonLink>
          <ButtonLink href="/settings/templates/transfer" variant="ghost">
            Export
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{bucket.exposure}</Chip>
          <span className="font-mono text-xs text-ink-2">{bucket.hostname}</span>
          <LiveStatusLine at={bucket.usage.updated_at} label="Bucket health" />
        </div>

        {rotation !== null && (
          <Card title="New access keys" description="Shown once — copy them now; the panel stores only a hash.">
            <PendingState operation={rotation.op} />
            <div className="mt-3">
              <SecretField value={rotation.secret} label="Secret access key (write-only on the server)" />
            </div>
          </Card>
        )}

        <AllocationStrip usage={bucket.usage} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Connection (S3-compatible)">
            <KeyValue
              items={[
                { label: "Endpoint", value: <span className="flex items-center gap-2"><span className="break-all">https://{bucket.hostname}</span><CopyButton text={`https://${bucket.hostname ?? ""}`} /></span>, mono: true },
                { label: "Bucket", value: bucket.name, mono: true },
                { label: "Region", value: "nairobi-01 (server-local)" },
                { label: "Engine", value: `MinIO ${bucket.version}` },
              ]}
            />
            <div className="mt-3 border-t border-line pt-3">
              <ButtonLink href={`/services/storage/${bucket.id}/keys`} variant="secondary" size="sm" icon="key">
                Manage access keys
              </ButtonLink>
            </div>
          </Card>

          <Card title="Usage (30 days)">
            <KeyValue
              items={[
                { label: "Objects", value: BUCKET_STATS.objects.toLocaleString() },
                { label: "Storage used", value: `${bucket.usage.disk_gb.current} GB of ${bucket.usage.disk_gb.allocated} GB quota` },
                { label: "Requests", value: BUCKET_STATS.requests_30d.toLocaleString() },
                { label: "Bandwidth", value: `${BUCKET_STATS.bandwidth_gb_30d} GB` },
                { label: "Created", value: formatDateTime(bucket.created_at) },
              ]}
            />
          </Card>
        </div>

        <Card title="Consumed by" description="Sites and apps that hold this bucket's credentials — revoking a key breaks them, so rotate instead.">
          <ul className="flex list-none flex-col gap-2 p-0">
            {BUCKET_CONSUMERS.map((c) => (
              <li key={c.ref.id} className="flex flex-wrap items-center gap-2">
                <Link href={c.ref.type === "website" ? `/websites/${c.ref.id}` : `/apps/${c.ref.id}`} className="text-sm font-medium text-accent hover:underline">
                  {c.ref.name}
                </Link>
                <Chip tone="neutral">{c.ref.type}</Chip>
                <span className="text-xs text-ink-3">env: {c.env_keys.join(", ")}</span>
              </li>
            ))}
          </ul>
        </Card>

        <DataTable
          caption={`Objects in ${bucket.name} (10 most recent of ${BUCKET_STATS.objects})`}
          columns={objectColumns}
          rows={BUCKET_OBJECTS}
          rowKey={(o) => o.key}
          emptyState={<Callout tone="info">No objects yet — attach the bucket to a site or upload via S3.</Callout>}
        />

        <p className="flex items-center gap-1.5 px-1 text-xs text-ink-2">
          <Icon name="info" size={13} className="shrink-0 text-ink-3" />
          Lifecycle: quota {bucket.usage.disk_gb.allocated} GB · infrequent-access class moves objects older than 30 days to
          cheaper storage automatically.
        </p>
      </div>
    </Screen>
  );
}
