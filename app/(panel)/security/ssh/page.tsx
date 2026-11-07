"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { sshKeys, type SshKey } from "@/lib/mock/ops";
import { submitSshKeyAdd, submitSshKeyRevoke } from "@/lib/api/ops";
import { formatRelative } from "@/lib/format";

/**
 * UX-OPS-014 /security/ssh — keys, access and the safe change workflow
 * (FLOW-009). Public keys are pasted (they are public); the private key never
 * touches the panel. Add + revoke both submit operations.
 */
const KEY_PATTERN = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+)\s+\S+/;

export default function SshSecurityPage() {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const base = useFixture(() => sshKeys);
  const [added, setAdded] = useState<SshKey[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [revoke, setRevoke] = useState<SshKey | null>(null);

  const [name, setName] = useState("");
  const [pub, setPub] = useState("");
  const [error, setError] = useState<string | null>(null);

  const keys = [...(base ?? []), ...added];

  const add = () => {
    if (!KEY_PATTERN.test(pub.trim())) {
      setError("Paste a valid OpenSSH public key (ssh-ed25519, ssh-rsa or ecdsa) — the private key stays on your device.");
      return;
    }
    const label = name.trim() || "New key";
    const op = submitSshKeyAdd(label);
    setFocusedId(op.id);
    setTrayOpen(true);
    const algorithm = pub.trim().split(/\s+/)[0];
    setAdded((prev) => [
      ...prev,
      {
        id: op.id,
        name: label,
        algorithm,
        fingerprint: "SHA256:" + Array.from({ length: 8 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("") + "…",
        added_at: new Date().toISOString(),
        last_used_at: null,
        added_by: "You",
      },
    ]);
    push("success", "Key submitted", `${label} — test a sign-in from an independent session before closing this one.`);
    setAddOpen(false);
    setName("");
    setPub("");
    setError(null);
  };

  const doRevoke = () => {
    if (!revoke) return;
    const op = submitSshKeyRevoke(revoke.name, revoke.id);
    setFocusedId(op.id);
    setTrayOpen(true);
    setAdded((prev) => prev.filter((k) => k.id !== revoke.id));
    push("info", "Revocation submitted", `${revoke.name} — the key stops working when the operation verifies.`);
    setRevoke(null);
  };

  return (
    <Screen
      id="UX-OPS-014"
      breadcrumbs={[{ label: "Security", href: "/security" }, { label: "SSH" }]}
      actions={
        <Button icon="plus" onClick={() => setAddOpen(true)}>
          Add key
        </Button>
      }
    >
      <Callout tone="info" className="mb-4" title="Safe change workflow">
        Add the new key, verify you can sign in with it from a second session, and only then
        revoke anything else. Firewall and SSH changes always keep an alternate access path.
      </Callout>

      {base === null ? (
        <SkeletonTable rows={3} cols={5} />
      ) : keys.length === 0 ? (
        <Callout tone="warning" title="No SSH keys authorized">
          Without a key you cannot reach the server over SSH. Add one to get started.
        </Callout>
      ) : (
        <TableCard<SshKey>
          title="Authorized public keys"
          caption="SSH public keys — private keys never leave your device"
          rowKey={(k) => k.id}
          rows={keys}
          columns={[
            { key: "name", header: "Name", render: (k) => <span className="font-medium text-ink">{k.name}</span>, className: "sticky left-0 bg-surface" },
            { key: "algorithm", header: "Algorithm" },
            { key: "fingerprint", header: "Fingerprint", render: (k) => <span className="break-all font-mono text-xs">{k.fingerprint}</span> },
            { key: "added_at", header: "Added", render: (k) => formatRelative(k.added_at, now) },
            { key: "last_used_at", header: "Last used", render: (k) => (k.last_used_at !== null ? formatRelative(k.last_used_at, now) : "never") },
            { key: "added_by", header: "Added by" },
            {
              key: "actions",
              header: "",
              render: (k) => (
                <Button variant="secondary" size="sm" icon="trash" onClick={() => setRevoke(k)}>
                  Revoke
                </Button>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add SSH public key"
        description="Paste the public key — the private key never leaves your device."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={add}>Submit key</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Key name" htmlFor="ssh-name" required>
            <Input id="ssh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office desktop" />
          </Field>
          <Field
            label="Public key"
            htmlFor="ssh-pub"
            required
            hint="One line: <type> <base64 material> [comment]. Secrets and private keys are never accepted here."
          >
            <Textarea
              id="ssh-pub"
              value={pub}
              onChange={(e) => setPub(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5… jane@laptop"
            />
          </Field>
          {error !== null && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={revoke !== null}
        onClose={() => setRevoke(null)}
        onConfirm={doRevoke}
        title={`Revoke SSH key “${revoke?.name ?? ""}”?`}
        body="Sign-ins that rely on this key stop working once the revocation verifies. Confirm you have another way in."
        confirmLabel="Revoke key"
        destructive
      />
    </Screen>
  );
}
