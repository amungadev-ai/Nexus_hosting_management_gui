"use client";

import React, { useState } from "react";
import { findServiceInstance, templateForKey } from "@/lib/mock/services";
import { useCapability, useOperationStream, useToast } from "@/components/providers";
import { flushCache, restartService, stopService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/core";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine, NotFoundInline, PendingState } from "@/components/common/states";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { CopyButton } from "@/components/ui/code";
import { KeyValue } from "@/components/ui/misc";
import type { ServiceInstance } from "@/lib/types";
import type { Operation } from "@/lib/types";

/**
 * UX-SVC-007 — Cache instance (Redis): memory limit, persistence,
 * connection details, flush/restart/stop as verified operations.
 * Delivery (006) and queue (008) share this honest pattern: when no
 * instance exists the route renders the explanatory not-found state.
 */
export default function CacheView({ instanceId }: { instanceId: string }) {
  const instance = findServiceInstance(instanceId);
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();
  const docker = useCapability("service.docker");
  const [pendingOp, setPendingOp] = useState<Operation | null>(null);
  const [confirmFlush, setConfirmFlush] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  if (instance === undefined || templateForKey(instance.template_key)?.category !== "cache") {
    return (
      <Screen id="UX-SVC-007" breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: "Cache" }]}>
        <NotFoundInline what="cache instance" />
      </Screen>
    );
  }

  const run = async (action: (i: ServiceInstance) => Promise<{ data: { operation: Operation } }>, done: string) => {
    try {
      const res = await action(instance);
      setPendingOp(res.data.operation);
      push("success", done, "Submitted as a verified job — the tray tracks it.");
      setTrayOpen(true);
    } catch (e) {
      push("error", "Action failed", e instanceof ApiError ? e.problem.detail : "Try again or contact support.");
    }
  };

  return (
    <Screen
      id="UX-SVC-007"
      breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: instance.name }]}
      actions={
        <>
          <Button icon="refresh" onClick={() => void run(restartService, "Restart submitted")} disabled={docker.state === "unavailable"}>
            Restart
          </Button>
          <Button variant="secondary" icon="power" onClick={() => setConfirmStop(true)} disabled={docker.state === "unavailable"}>
            Stop
          </Button>
          <ButtonLink href="/settings/templates/transfer" variant="ghost">
            Export
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">Redis {instance.version}</Chip>
          <Chip tone={instance.exposure === "public" ? "success" : "neutral"}>{instance.exposure}</Chip>
          <span className="font-mono text-xs text-ink-2">{instance.hostname}</span>
          <LiveStatusLine at={instance.usage.updated_at} label="Cache health" />
        </div>

        {instance.state === "stopped" && (
          <Callout tone="warning" title="This cache is stopped">
            Sessions fall back to the database while the cache is down — slower, but nothing breaks. Start it with
            Restart when you&apos;re ready.
          </Callout>
        )}

        <AllocationStrip usage={instance.usage} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Configuration">
            <KeyValue
              items={[
                { label: "Memory limit", value: `${instance.usage.ram_mb.allocated} MB (maxmemory)` },
                { label: "Eviction", value: "allkeys-lru" },
                { label: "Persistence", value: "AOF everysec + snapshot every 6h" },
                { label: "Created", value: instance.created_at.slice(0, 10) },
              ]}
            />
          </Card>
          <Card title="Connection details" description="Applications reach the cache over the internal network — never expose it publicly.">
            <KeyValue
              items={[
                { label: "Host", value: <span className="flex items-center gap-2"><span>{instance.hostname}</span><CopyButton text={instance.hostname ?? ""} /></span>, mono: true },
                { label: "Port", value: "6379", mono: true },
                { label: "TLS", value: "yes (internal CA)" },
                { label: "Auth", value: "requirepass — secret in the panel's secret store" },
              ]}
            />
          </Card>
        </div>

        {pendingOp !== null && <PendingState operation={pendingOp} />}

        <Card title="Maintenance">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="refresh" onClick={() => setConfirmFlush(true)} disabled={docker.state === "unavailable"}>
              Flush cache
            </Button>
            <span className="self-center text-xs text-ink-3">
              Flushing clears cached keys — sites rebuild the cache automatically; expect a brief CPU bump.
            </span>
          </div>
        </Card>

        {confirmFlush && (
          <ConfirmDialog
            open
            onClose={() => setConfirmFlush(false)}
            onConfirm={() => void run(flushCache, "Flush submitted")}
            title={`Flush cache ${instance.name}?`}
            body={`All cached keys in ${instance.name} are dropped. Sessions stored in the cache are logged out. This is safe but visible — flush during low traffic.`}
            confirmLabel="Flush now"
          />
        )}
        {confirmStop && (
          <ConfirmDialog
            open
            onClose={() => setConfirmStop(false)}
            onConfirm={() => void run(stopService, "Stop submitted")}
            title={`Stop ${instance.name}?`}
            body="Sites will fall back to database-backed sessions while the cache is stopped. The volume and its persisted data are kept."
            confirmLabel="Stop cache"
            destructive
          />
        )}
      </div>
    </Screen>
  );
}
