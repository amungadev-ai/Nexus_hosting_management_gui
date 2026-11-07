"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/form";
import { SecretField } from "@/components/ui/code";
import { useToast, useNow } from "@/components/providers";
import { addPublicKey, generateDeployKey, listDevKeys, revokeKey, type DevKey } from "@/lib/api/files";
import { ApiError } from "@/lib/api/core";
import { formatDate, formatRelative } from "@/lib/format";

/** UX-FILE-007 — SFTP/SSH access hub: keys, scopes, expiry, revocation. */
export default function DeveloperAccessPage() {
  const { push } = useToast();
  const now = useNow();
  const [keys, setKeys] = useState<DevKey[]>([...listDevKeys()]);
  const [addOpen, setAddOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<DevKey | null>(null);
  const [generated, setGenerated] = useState<{ key: DevKey; private_key_once: string } | null>(null);

  const refresh = () => setKeys([...listDevKeys()]);

  return (
    <Screen
      id="UX-FILE-007"
      breadcrumbs={[{ label: "Developer" }]}
      description="Keys, access scopes, expiry and revocation for file and deployment access."
      actions={
        <>
          <Button variant="secondary" icon="plus" onClick={() => setAddOpen(true)}>
            Add key
          </Button>
          <Button icon="key" onClick={() => setGenOpen(true)}>
            Generate deploy key
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="Developer access hub">
          Deploy keys are scoped read-only by default and expire after 90 days. For CI tokens with API scopes
          use{" "}
          <ButtonLink href="/settings/api-tokens" variant="link" size="sm">
            Settings → API tokens
          </ButtonLink>
          ; for git-driven deploys see{" "}
          <ButtonLink href="/apps" variant="link" size="sm">
            Applications
          </ButtonLink>
          .
        </Callout>

        {keys.length === 0 ? (
          <EmptyState
            icon="key"
            title="No keys yet"
            body="Add your laptop's public key for SFTP/SSH, or generate a deploy key for CI. Private keys never leave your machine."
            action={{ label: "Add a key", onClick: () => setAddOpen(true) }}
          />
        ) : (
          <DataTable
            caption="SSH and deploy keys"
            rows={keys}
            rowKey={(k) => k.id}
            columns={[
              {
                key: "name",
                header: "Key",
                render: (k: DevKey) => (
                  <span className="flex flex-col">
                    <span className="font-medium">{k.name}</span>
                    <span className="font-mono text-xs text-ink-3">{k.fingerprint.slice(0, 24)}…</span>
                  </span>
                ),
              },
              { key: "kind", header: "Type", render: (k: DevKey) => (k.kind === "deploy" ? <Chip tone="accent">Deploy key</Chip> : <Chip>Public key</Chip>) },
              { key: "scopes", header: "Scopes", render: (k: DevKey) => <span className="flex flex-wrap gap-1">{k.scopes.map((s) => <Chip key={s}>{s}</Chip>)}</span> },
              { key: "created_at", header: "Added", render: (k: DevKey) => formatDate(k.created_at) },
              { key: "last_used_at", header: "Last used", render: (k: DevKey) => (k.last_used_at ? formatRelative(k.last_used_at, now) : "Never") },
              {
                key: "expires_at",
                header: "Expiry",
                render: (k: DevKey) => (k.expires_at ? <span className="text-xs">expires {formatDate(k.expires_at)}</span> : <span className="text-xs text-ink-3">no expiry</span>),
              },
              {
                key: "actions",
                header: "Actions",
                render: (k: DevKey) => (
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setRevokeTarget(k)}>
                    Revoke
                  </Button>
                ),
              },
            ]}
          />
        )}
        <p className="text-xs text-ink-3">
          Revocation is immediate and audited; active SFTP sessions on a revoked key are closed within seconds.
        </p>
      </div>

      <AddKeyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          refresh();
          setAddOpen(false);
          push("success", "Key added", "The fingerprint is registered; the key can be used on the next connection.");
        }}
      />
      <Modal
        open={genOpen}
        onClose={() => {
          setGenOpen(false);
          setGenerated(null);
        }}
        title="Generate a deploy key"
        description="NexusPanel generates the keypair; the private half is shown once and never stored in plaintext."
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenOpen(false)}>
              Close
            </Button>
            {!generated && (
              <Button
                onClick={() => {
                  generateDeployKey("deploy " + new Date().toISOString().slice(0, 10))
                    .then((res) => {
                      setGenerated(res);
                      refresh();
                    })
                    .catch(() => push("error", "Generation failed", "Try again."));
                }}
              >
                Generate key
              </Button>
            )}
          </>
        }
      >
        {generated === null ? (
          <p className="text-sm text-ink-2">
            The deploy key is scoped to <span className="font-mono">files.read</span> (checkout-only) and expires
            after 90 days. Rotate it from this screen.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <SecretField label="Private key — shown once, copy it now" value={generated.private_key_once} />
            <div>
              <p className="text-xs text-ink-3">Public key (registered)</p>
              <p className="break-all font-mono text-xs">{generated.key.public_key}</p>
            </div>
            <p className="text-xs text-ink-3">Fingerprint {generated.key.fingerprint}</p>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget === null) return;
          revokeKey(revokeTarget.id).then(() => {
            refresh();
            push("success", "Key revoked", `${revokeTarget.name} can no longer authenticate.`);
          });
        }}
        title={`Revoke key "${revokeTarget?.name ?? ""}"`}
        confirmLabel={`Revoke ${revokeTarget?.name ?? "key"}`}
        destructive
        body="Anything authenticating with this key — including CI pipelines — stops working immediately. Generate a replacement first if a pipeline depends on it."
      />
    </Screen>
  );
}

function AddKeyModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [keyText, setKeyText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a public key"
      description="Paste the public half only — private keys are never uploaded."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={name.trim() === "" || keyText.trim() === ""}
            onClick={() => {
              setBusy(true);
              setError(null);
              addPublicKey(name.trim(), keyText)
                .then(() => {
                  setBusy(false);
                  onAdded();
                })
                .catch((e: unknown) => {
                  setBusy(false);
                  setError(e instanceof ApiError ? e.problem.detail : "Unexpected error.");
                });
            }}
          >
            Add key
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Key name" htmlFor="key-name" required>
          <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Work laptop" autoComplete="off" />
        </Field>
        <Field label="Public key" htmlFor="key-text" required hint="One line starting with ssh-ed25519 or ssh-rsa.">
          <Textarea id="key-text" value={keyText} onChange={(e) => setKeyText(e.target.value)} rows={3} spellCheck={false} className="font-mono text-xs" />
        </Field>
        {error !== null && (
          <Callout tone="danger">{error}</Callout>
        )}
      </div>
    </Modal>
  );
}
