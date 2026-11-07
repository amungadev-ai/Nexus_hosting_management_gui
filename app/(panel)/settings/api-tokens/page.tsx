"use client";

import { useEffect, useState } from "react";
import type { ApiToken } from "@/lib/types";
import { createApiToken, isApiError, listApiTokens, revokeApiToken, type CreatedToken } from "@/lib/api/iam";
import { getMyCapabilities } from "@/lib/api/me";
import { formatDate, formatRelative } from "@/lib/format";
import { useNow, useSession, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Callout, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { DataTable, TableCard } from "@/components/ui/table";
import { SecretField } from "@/components/ui/code";

/**
 * UX-IAM-010 — API tokens. Scopes are least-privilege (checkboxes mirror
 * GET /me/capabilities permissions); the secret is returned ONCE at creation
 * and rendered through the DS-008 one-time SecretField (reveal, copy, then
 * it is gone — hashed at rest, never displayed again). Revocation is a
 * typed, audited confirmation.
 */
export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    listApiTokens()
      .then((rows) => {
        if (alive) setTokens(rows);
      })
      .catch(() => {
        if (alive) setTokens([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Screen
      id="UX-IAM-010"
      breadcrumbs={[{ label: "Settings" }, { label: "API tokens" }]}
      actions={
        <Button icon="plus" onClick={() => setCreateOpen(true)}>
          Create token
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <TokensTable tokens={tokens} setTokens={setTokens} onOpenCreate={() => setCreateOpen(true)} />
        <CreateTokenModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(result) => setTokens((prev) => (prev === null ? prev : [result.token, ...prev]))}
        />
      </div>
    </Screen>
  );
}

function TokensTable({
  tokens,
  setTokens,
  onOpenCreate,
}: {
  tokens: ApiToken[] | null;
  setTokens: React.Dispatch<React.SetStateAction<ApiToken[] | null>>;
  onOpenCreate: () => void;
}) {
  const now = useNow();
  const { push } = useToast();
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmRevoke = async () => {
    if (revoking === null) return;
    setError(null);
    try {
      await revokeApiToken(revoking.id);
      setTokens((prev) => (prev === null ? prev : prev.filter((t) => t.id !== revoking.id)));
      push("success", `Token revoked — ${revoking.name}`, "Requests with this token now fail with 401. The revocation was audited.");
    } catch (e) {
      setError(isApiError(e) ? e.problem.detail : "Revoking the token failed.");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <>
      {error !== null && <Callout tone="danger">{error}</Callout>}
      {tokens === null ? (
        <SkeletonTable rows={2} cols={6} />
      ) : (
        <TableCard
          title="Tokens"
          rowKey={(t) => t.id}
          rows={tokens}
          caption="API tokens hashed at rest — only the masked prefix is ever listed"
          emptyState={
            <EmptyState
              icon="key"
              title="No API tokens"
              body="Create a scoped token for CI or monitoring — least privilege, explicit lifetime, and the secret is shown exactly once."
              action={{ label: "Create the first token", onClick: onOpenCreate }}
              className="py-8"
            />
          }
          columns={[
            { key: "name", header: "Name", sortable: true, className: "sticky left-0 bg-surface font-medium" },
            {
              key: "scopes",
              header: "Scopes",
              render: (t) => (
                <span className="flex flex-wrap gap-1">
                  {t.scopes.map((s) => (
                    <Chip key={s} tone="info" className="font-mono">
                      {s}
                    </Chip>
                  ))}
                </span>
              ),
            },
            { key: "created_at", header: "Created", sortable: true, render: (t) => formatDate(t.created_at) },
            {
              key: "last_used_at",
              header: "Last used",
              render: (t) =>
                t.last_used_at === null ? (
                  <span className="text-ink-3">Never used</span>
                ) : (
                  <span title={formatDate(t.last_used_at)}>{formatRelative(t.last_used_at, now)}</span>
                ),
            },
            {
              key: "expires_at",
              header: "Expires",
              render: (t) => (t.expires_at === null ? <span className="text-ink-3">No expiry</span> : formatDate(t.expires_at)),
            },
            { key: "masked_secret", header: "Secret", render: (t) => <span className="font-mono text-xs">{t.masked_secret}</span> },
            {
              key: "actions",
              header: "",
              render: (t) => (
                <Button variant="secondary" size="sm" onClick={() => setRevoking(t)}>
                  Revoke
                </Button>
              ),
            },
          ]}
        />
      )}

      {/* One-time secret reveal (DS-008): shown once, then unrecoverable. */}
      <Modal
        open={created !== null}
        onClose={() => setCreated(null)}
        title="Token secret — shown once"
        description="Copy it now and store it safely. This is the only time the full secret is displayed."
        footer={<Button onClick={() => setCreated(null)}>Done — I saved the secret</Button>}
      >
        {created !== null && (
          <div className="flex flex-col gap-3">
            <Callout tone="warning" title="You won't see this again.">
              The secret is hashed at rest — nobody (including support) can retrieve it after you
              leave this dialog. If it leaks, revoke <span className="font-mono">{created.token.name}</span> and
              mint a new one.
            </Callout>
            <SecretField value={created.secret} label={`Secret for ${created.token.name}`} />
            <p className="text-xs text-ink-2">
              Scopes: <span className="font-mono">{created.token.scopes.join(", ")}</span> — a
              token can never exceed its owner&apos;s delegated privileges (Stage 6 §2).
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => void confirmRevoke()}
        title={revoking !== null ? `Revoke token ${revoking.name}` : "Revoke token"}
        body={
          revoking !== null
            ? `Requests authenticated with ${revoking.name} (${revoking.masked_secret}) start failing immediately. Anything relying on it — CI jobs, monitors — needs a new token.`
            : ""
        }
        confirmLabel="Revoke token"
        destructive
        typedConfirmation={revoking?.name ?? ""}
      />
    </>
  );
}

function CreateTokenModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: CreatedToken) => void;
}) {
  const { profile } = useSession();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [lifetime, setLifetime] = useState("90");
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getMyCapabilities(profile)
      .then((res) => {
        if (alive) setPermissions(res.data.permissions);
      })
      .catch(() => {
        if (alive) setPermissions([]);
      });
    return () => {
      alive = false;
    };
  }, [open, profile]);

  const toggleScope = (scope: string, checked: boolean) => {
    setScopes((prev) => (checked ? [...prev, scope] : prev.filter((s) => s !== scope)));
  };

  const submit = async () => {
    setError(null);
    setCreating(true);
    try {
      const result = await createApiToken({
        name: name.trim(),
        scopes,
        expires_in_days: lifetime === "never" ? null : Number(lifetime),
      });
      push("success", `Token ${result.token.name} created`, "The secret is shown once — copy it before closing the dialog.");
      onCreated(result);
      setName("");
      setScopes([]);
      setLifetime("90");
      onClose();
    } catch (e) {
      setError(isApiError(e) ? `${e.problem.title} — ${e.problem.detail}` : "Creating the token failed.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create API token"
      description="Least privilege first: tick only the scopes the integration needs. The secret is shown once after creation."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={creating} disabled={name.trim().length < 2 || scopes.length === 0} onClick={() => void submit()}>
            Create token
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error !== null && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Field label="Token name" htmlFor="token-name" required hint="Name it after the integration — it appears in audit events.">
          <Input
            id="token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="ci-deploy"
          />
        </Field>
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-sm font-medium text-ink">
            Scopes<span aria-hidden="true" className="text-danger"> *</span>
            <span className="sr-only"> (required)</span>
          </legend>
          <p className="mb-2 text-xs text-ink-3">
            From GET /me/capabilities — a token can never exceed its owner&apos;s privileges.
          </p>
          <div className="nx-scroll grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-control border border-line p-3 sm:grid-cols-2">
            {permissions === null
              ? Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="inline-block h-5 w-40 animate-pulse rounded-control bg-surface-2" />
                ))
              : permissions.map((p) => (
                  <Checkbox
                    key={p}
                    label={<span className="font-mono text-xs">{p}</span>}
                    checked={scopes.includes(p)}
                    onChange={(checked) => toggleScope(p, checked)}
                  />
                ))}
          </div>
        </fieldset>
        <Field label="Lifetime" htmlFor="token-lifetime" hint="Explicit lifetime — tokens without expiry need stronger monitoring.">
          <Select id="token-lifetime" value={lifetime} onChange={(e) => setLifetime(e.target.value)}>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
            <option value="never">No expiry (audited)</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
