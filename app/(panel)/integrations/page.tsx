"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { connectedIntegrations, type ConnectedIntegration } from "@/lib/mock/automation";
import { submitIntegrationConnect, submitIntegrationRevoke } from "@/lib/api/automation";
import { formatRelative } from "@/lib/format";

/**
 * UX-AUTO-006 /integrations — connected services, health, permissions.
 * Connect and revoke both submit operations; revoke is a typed confirm.
 */
export default function IntegrationsPage() {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const base = useFixture(() => connectedIntegrations);
  const [overrides, setOverrides] = useState<Record<string, ConnectedIntegration["state"]>>({});
  const [revoke, setRevoke] = useState<ConnectedIntegration | null>(null);

  const items = (base ?? []).map((i) => (overrides[i.id] !== undefined ? { ...i, state: overrides[i.id] } : i));

  const connect = (i: ConnectedIntegration) => {
    const op = submitIntegrationConnect(i.name);
    setFocusedId(op.id);
    setTrayOpen(true);
    setOverrides((prev) => ({ ...prev, [i.id]: "connected" }));
    push("success", "Connection started", `${i.name} — permissions verified before credentials are stored.`);
  };

  const doRevoke = () => {
    if (!revoke) return;
    const op = submitIntegrationRevoke(revoke.name, revoke.id);
    setFocusedId(op.id);
    setTrayOpen(true);
    setOverrides((prev) => ({ ...prev, [revoke.id]: "available" }));
    push("info", "Revocation submitted", `${revoke.name} — credentials removed when the operation verifies.`);
    setRevoke(null);
  };

  return (
    <Screen
      id="UX-AUTO-006"
      breadcrumbs={[{ label: "Integrations" }]}
    >
      {base === null ? (
        <SkeletonTable rows={4} cols={3} />
      ) : items.length === 0 ? (
        <Callout tone="info" title="No integrations catalogued">
          Email relay, storage destinations and SMS webhooks connect here.
        </Callout>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((i) => (
            <Card
              key={i.id}
              title={i.name}
              description={i.health}
              actions={
                i.state === "connected" ? (
                  <Button variant="secondary" size="sm" icon="trash" onClick={() => setRevoke(i)}>
                    Revoke
                  </Button>
                ) : i.state === "available" ? (
                  <Button size="sm" icon="plus" onClick={() => connect(i)}>
                    Connect
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" icon="refresh" onClick={() => connect(i)}>
                    Reconnect
                  </Button>
                )
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={i.state === "connected" ? "healthy" : i.state === "error" ? "failed" : "unknown"} />
                {i.state === "connected" && i.connected_at !== null && (
                  <span className="text-xs text-ink-3">connected {formatRelative(i.connected_at, now)}</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {i.scopes.length === 0 ? (
                  <Chip tone="neutral">no scopes granted</Chip>
                ) : (
                  i.scopes.map((s) => (
                    <Chip key={s} tone="accent">
                      {s}
                    </Chip>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={revoke !== null}
        onClose={() => setRevoke(null)}
        onConfirm={doRevoke}
        title={`Revoke ${revoke?.name ?? ""}?`}
        body="Panels features that rely on this integration stop working (e.g. backup uploads or notification email). The revocation is audited."
        confirmLabel="Revoke integration"
        destructive
      />
    </Screen>
  );
}
