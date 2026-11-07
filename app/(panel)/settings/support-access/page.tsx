"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/mock/data";
import { grantSupportAccess, isApiError, type ActiveGrant } from "@/lib/api/iam";
import { formatDate, formatRelative } from "@/lib/format";
import { useNow, useSession, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { Field, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/overlay";
import { KeyValue } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";

/**
 * UX-IAM-011 — Support access grants (DS-019). Time-limited, scoped,
 * reason-required grants to support engineers; while a grant is live the
 * persistent shell banner shows scope/actor/reason/expiry and every action
 * is audited with the grant as context. Revoking ends access immediately.
 */
export default function SupportAccessPage() {
  const { supportAccess, setSupportAccess } = useSession();
  const { push } = useToast();
  const now = useNow();

  const [engineerId, setEngineerId] = useState(db.users.find((u) => u.role_labels.includes("support"))?.id ?? "");
  const [scope, setScope] = useState<"read-only" | "extended">("read-only");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<"2" | "24">("2");
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grant, setGrant] = useState<ActiveGrant | null>(
    supportAccess
      ? {
          actor: db.supportGrant.actor,
          scope: db.supportGrant.scope,
          reason: db.supportGrant.reason,
          granted_at: "2026-11-06T15:00:00Z",
          expires_at: db.supportGrant.expires_at,
        }
      : null
  );
  const [revokeOpen, setRevokeOpen] = useState(false);

  // Keep the page card in sync with the shell banner (single source: session).
  useEffect(() => {
    if (!supportAccess) setGrant(null);
  }, [supportAccess]);

  const engineers = db.users.filter((u) => u.role_labels.includes("support"));
  const live = supportAccess && grant !== null;

  const submit = async () => {
    setError(null);
    setGranting(true);
    try {
      const result = await grantSupportAccess({
        engineer_id: engineerId,
        scope,
        reason,
        duration_hours: duration === "2" ? 2 : 24,
      });
      setGrant(result);
      setSupportAccess(true);
      setReason("");
      push(
        "success",
        `Support access granted to ${result.actor}`,
        `${result.scope}, expires ${formatRelative(result.expires_at, now)}. The DS-019 banner is now visible across the panel and every action is audited with this grant as context.`
      );
    } catch (e) {
      setError(isApiError(e) ? `${e.problem.title} — ${e.problem.detail}` : "Requesting the grant failed.");
    } finally {
      setGranting(false);
    }
  };

  const revoke = () => {
    setSupportAccess(false);
    setGrant(null);
    push("info", "Support access revoked", "The engineer lost access immediately and the revocation was recorded in the audit chain.");
  };

  return (
    <Screen
      id="UX-IAM-011"
      breadcrumbs={[{ label: "Settings" }, { label: "Support access" }]}
      description="Time-limited support access with scope and justification. Grants are visible as a persistent banner (DS-019) and expire automatically."
    >
      <div className="flex flex-col gap-4">
        {live ? (
          <section
            role="note"
            aria-label="Support access is active"
            className="rounded-card border border-warning bg-warning-soft p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-warning" aria-hidden="true" />
                  LIVE — support access is active
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  The persistent banner at the top of the panel shows this grant everywhere. It
                  expires on its own — revoking now ends access immediately.
                </p>
              </div>
              <Button variant="destructive" size="sm" icon="power" onClick={() => setRevokeOpen(true)}>
                Revoke access
              </Button>
            </div>
            <div className="mt-4 rounded-control bg-surface p-3">
              <KeyValue
                columns={2}
                items={[
                  { label: "Actor", value: grant.actor },
                  { label: "Scope", value: grant.scope },
                  { label: "Reason", value: grant.reason },
                  { label: "Granted", value: formatDate(grant.granted_at) },
                  {
                    label: "Expires",
                    value: (
                      <span className="flex items-center gap-2">
                        {formatRelative(grant.expires_at, now)}
                        <Chip tone="warning">{formatDate(grant.expires_at)}</Chip>
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </section>
        ) : (
          <Card title="No support access is active" description="Engineers see exactly nothing until a scoped, time-limited grant below is issued.">
            <GrantFormFields
              engineers={engineers}
              engineerId={engineerId}
              setEngineerId={setEngineerId}
              scope={scope}
              setScope={setScope}
              reason={reason}
              setReason={setReason}
              duration={duration}
              setDuration={setDuration}
              error={error}
              granting={granting}
              onSubmit={() => void submit()}
            />
          </Card>
        )}

        <Callout tone="info" title="Every support action is recorded in the audit chain with the grant as context.">
          Audit entries carry the acting engineer, the grant reason and its expiry — and are
          rendered in UTC. Access never outlives its expiry: no manual cleanup, no forgotten
          permissions.
        </Callout>
      </div>

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onConfirm={revoke}
        title={grant !== null ? `Revoke support access for ${grant.actor}` : "Revoke support access"}
        body="Access ends immediately and the revocation is audited. If the ticket is still open, a new grant with a fresh reason is required."
        confirmLabel="Revoke access"
        destructive
      />
    </Screen>
  );
}

function GrantFormFields({
  engineers,
  engineerId,
  setEngineerId,
  scope,
  setScope,
  reason,
  setReason,
  duration,
  setDuration,
  error,
  granting,
  onSubmit,
}: {
  engineers: { id: string; display_name: string }[];
  engineerId: string;
  setEngineerId: (v: string) => void;
  scope: "read-only" | "extended";
  setScope: (v: "read-only" | "extended") => void;
  reason: string;
  setReason: (v: string) => void;
  duration: "2" | "24";
  setDuration: (v: "2" | "24") => void;
  error: string | null;
  granting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Support engineer" htmlFor="grant-engineer" required>
          <Select id="grant-engineer" value={engineerId} onChange={(e) => setEngineerId(e.target.value)}>
            {engineers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Scope"
          htmlFor="grant-scope"
          hint="Read-only can look; extended may also run safe diagnostics (no config changes)."
        >
          <Select id="grant-scope" value={scope} onChange={(e) => setScope(e.target.value as "read-only" | "extended")}>
            <option value="read-only">Read-only</option>
            <option value="extended">Extended — safe diagnostics</option>
          </Select>
        </Field>
      </div>
      <Field
        label="Reason"
        htmlFor="grant-reason"
        required
        hint="Stored with the grant, shown in the banner, and attached to every audited action."
      >
        <Textarea
          id="grant-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ticket #4821 — investigate backup schedule failures"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Expiry" htmlFor="grant-duration" hint="Short by default — grants expire automatically.">
          <Select id="grant-duration" value={duration} onChange={(e) => setDuration(e.target.value === "24" ? "24" : "2")}>
            <option value="2">2 hours</option>
            <option value="24">24 hours</option>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button loading={granting} disabled={engineerId === "" || reason.trim().length < 10} onClick={onSubmit}>
            Grant support access
          </Button>
        </div>
      </div>
    </div>
  );
}
