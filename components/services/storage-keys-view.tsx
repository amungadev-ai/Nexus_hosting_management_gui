"use client";

import React, { useState } from "react";
import { findServiceInstance, templateForKey, ACCESS_KEYS } from "@/lib/mock/services";
import type { AccessKey } from "@/lib/mock/services";
import { useCapability, useOperationStream, useSession, useToast } from "@/components/providers";
import { createAccessKey, revokeAccessKey } from "@/lib/api/services";
import { ApiError } from "@/lib/api/core";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Field, Select } from "@/components/ui/form";
import { SecretField } from "@/components/ui/code";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";
import type { Operation } from "@/lib/types";

/** UX-SVC-004 — Storage access keys: scoped keys, one-time secrets, revocation. */
export default function StorageKeysView({ bucketId }: { bucketId: string }) {
  const bucket = findServiceInstance(bucketId);
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();
  const storage = useCapability("service.storage");
  const now = useNow();
  const [keys, setKeys] = useState<AccessKey[]>(() => [...ACCESS_KEYS]);
  const [scope, setScope] = useState<"read-only" | "write-only" | "read-write">("read-only");
  const [created, setCreated] = useState<{ op: Operation; secret: string } | null>(null);
  const [revokeFor, setRevokeFor] = useState<AccessKey | null>(null);
  const [pendingOp, setPendingOp] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);

  if (bucket === undefined || templateForKey(bucket.template_key)?.category !== "storage") {
    return (
      <Screen id="UX-SVC-004" breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: "Keys" }]}>
        <NotFoundInline what="storage bucket" />
      </Screen>
    );
  }

  const create = async () => {
    setBusy(true);
    try {
      const res = await createAccessKey(bucket.id, scope, profile);
      setCreated({ op: res.data.operation, secret: res.data.secret });
      setPendingOp(res.data.operation);
      push("success", "Access key created", "The secret is shown once below — it cannot be retrieved again.");
      setTrayOpen(true);
    } catch (e) {
      push("error", "Could not create the key", e instanceof ApiError ? e.problem.detail : "Try again or contact support.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (key: AccessKey) => {
    const res = await revokeAccessKey(bucket.id, key.id, key.label);
    setPendingOp(res.data.operation);
    setKeys((prev) => prev.filter((k) => k.id !== key.id));
    push("success", "Revocation submitted", `${key.label} is being revoked — dependent clients will fail their next request.`);
  };

  const columns: DataTableColumn<AccessKey>[] = [
    { key: "label", header: "Key", render: (k) => <span className="font-medium">{k.label}</span> },
    { key: "id", header: "ID", render: (k) => <span className="font-mono text-xs text-ink-2">{k.id}</span> },
    { key: "scope", header: "Scope", render: (k) => <Chip tone={k.scope === "read-write" ? "warning" : k.scope === "read-only" ? "neutral" : "info"}>{k.scope}</Chip> },
    { key: "created_at", header: "Created", render: (k) => <span className="whitespace-nowrap">{formatDateTime(k.created_at)}</span> },
    { key: "last_used_at", header: "Last used", render: (k) => <span className="whitespace-nowrap">{k.last_used_at === null ? "Never" : formatRelative(k.last_used_at, now)}</span> },
    {
      key: "actions",
      header: "",
      render: (k) => (
        <Button size="sm" variant="ghost" onClick={() => setRevokeFor(k)} aria-label={`Revoke key ${k.label}`}>
          Revoke
        </Button>
      ),
    },
  ];

  return (
    <Screen
      id="UX-SVC-004"
      breadcrumbs={[
        { label: "Platform services", href: "/services" },
        { label: bucket.name, href: `/services/storage/${bucket.id}` },
        { label: "Access keys" },
      ]}
      actions={<ButtonLink href={`/services/storage/${bucket.id}`} variant="ghost">Back to bucket</ButtonLink>}
    >
      <div className="flex flex-col gap-4">
        {pendingOp !== null && <PendingState operation={pendingOp} />}

        <Card title="Create an access key" description="Least privilege is the default — start read-only and widen only when a client proves it needs more.">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Scope" htmlFor="key-scope" className="w-56">
              <Select id="key-scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="read-only">read-only</option>
                <option value="write-only">write-only</option>
                <option value="read-write">read-write</option>
              </Select>
            </Field>
            <Button icon="key" loading={busy} onClick={() => void create()} disabled={storage.state === "unavailable"}>
              Create key
            </Button>
          </div>
          {created !== null && (
            <div className="mt-4 border-t border-line pt-4">
              <SecretField value={created.secret} label={`New ${scope} secret — shown once`} />
            </div>
          )}
        </Card>

        <DataTable
          caption={`Access keys for ${bucket.name}`}
          columns={columns}
          rows={keys}
          rowKey={(k) => k.id}
          emptyState={
            <Callout tone="info" title="No keys left">
              Every key was revoked — create a new one above; the S3 endpoint stays reachable, authentication just
              requires fresh credentials.
            </Callout>
          }
        />

        <Callout tone="warning" title="Revoking a key in use">
          Clients holding a revoked key fail immediately with access denied. Prefer rotation when a site depends
          on the key — the bucket page has a guided Rotate keys action.
        </Callout>

        {revokeFor !== null && (
          <ConfirmDialog
            open
            onClose={() => setRevokeFor(null)}
            onConfirm={() => void revoke(revokeFor)}
            title={`Revoke access key “${revokeFor.label}”?`}
            body={`Clients using ${revokeFor.label} (${revokeFor.scope}) on ${bucket.name} will be denied from the moment the revocation verifies. This is audited.`}
            confirmLabel="Revoke key"
            destructive
          />
        )}
      </div>
    </Screen>
  );
}
