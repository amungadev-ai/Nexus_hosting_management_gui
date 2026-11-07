"use client";

import React, { useState } from "react";
import { allServiceInstances, findServiceInstance, instanceHref, serviceStatusPill, templateForKey } from "@/lib/mock/services";
import { db } from "@/lib/mock/data";
import { useCapability, useOperationStream, useToast } from "@/components/providers";
import { restartService, stopService, uninstallService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/core";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine, NotFoundInline, PendingState } from "@/components/common/states";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { KeyValue } from "@/components/ui/misc";
import { Icon } from "@/components/ui/icons";
import { formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";
import type { Operation } from "@/lib/types";

/**
 * UX-TPL-004 — Self-hosted service detail (route sits under /services): app
 * URL, admin login, health, usage, backups and export — plus the template
 * family view (all instances of the same template) with a stats header.
 * The [id] param accepts an instance id or a template key.
 */
export default function ServiceDetailView({ instanceId }: { instanceId: string }) {
  const instance = findServiceInstance(instanceId);
  const familyKey = instance?.template_key ?? (db.templates.some((t) => t.key === instanceId) ? instanceId : null);
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();
  const docker = useCapability("service.docker");
  const [pendingOp, setPendingOp] = useState<Operation | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  if (instance === undefined || familyKey === null) {
    return (
      <Screen id="UX-TPL-004" breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: "Service" }]}>
        <NotFoundInline what="self-hosted service" />
      </Screen>
    );
  }

  const template = templateForKey(familyKey);
  const family = allServiceInstances().filter((i) => i.template_key === familyKey);
  const backups = db.backups.filter((b) => b.resource_ref.id === instance.id);
  const familyRam = family.reduce((sum, i) => sum + i.usage.ram_mb.allocated, 0);

  const run = async (action: () => Promise<{ data: { operation: Operation } }>, done: string) => {
    try {
      const res = await action();
      setPendingOp(res.data.operation);
      push("success", done, "Submitted as a verified job — track it in the tray.");
      setTrayOpen(true);
    } catch (e) {
      push("error", "Action failed", e instanceof ApiError ? e.problem.detail : "Try again or contact support.");
    }
  };

  return (
    <Screen
      id="UX-TPL-004"
      breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: instance.name }]}
      actions={
        <>
          <Button icon="refresh" onClick={() => void run(() => restartService(instance), "Restart submitted")} disabled={docker.state === "unavailable"}>
            Restart
          </Button>
          <Button variant="secondary" icon="power" onClick={() => void run(() => stopService(instance), "Stop submitted")} disabled={docker.state === "unavailable"}>
            Stop
          </Button>
          <ButtonLink href="/settings/templates/transfer" variant="secondary">
            Export
          </ButtonLink>
          <Button variant="destructive" icon="trash" onClick={() => setConfirmUninstall(true)} disabled={docker.state === "unavailable"}>
            Uninstall
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={serviceStatusPill(instance)} at={instance.usage.updated_at} />
          <Chip tone="neutral">{template?.name ?? familyKey}</Chip>
          <Chip tone={instance.exposure === "public" ? "success" : "neutral"}>{instance.exposure}</Chip>
          <span className="text-xs text-ink-3">installed {formatRelative(instance.created_at, now)}</span>
        </div>

        {instance.health === "unhealthy" && (
          <Callout tone="danger" title={`${instance.name} is unhealthy`}>
            Health checks failed recently. Try a restart first; a recent backup can be restored from Backup
            inventory; if neither works, uninstall and reinstall from the template. Nothing is deleted until you
            confirm — volumes are kept 24h after uninstall.
          </Callout>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="App">
            <KeyValue
              items={[
                {
                  label: "URL",
                  value: (
                    <a href={`https://${instance.hostname ?? ""}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                      {instance.hostname}
                      <Icon name="external-link" size={12} />
                    </a>
                  ),
                  mono: true,
                },
                { label: "Admin login", value: "admin (password in the instance's secret store — rotate from the app)" },
                { label: "Version", value: instance.version },
                { label: "TLS", value: instance.exposure === "public" ? "Let's Encrypt (auto-renew)" : "internal" },
              ]}
            />
          </Card>
          <Card title="Lifecycle">
            <KeyValue
              items={[
                { label: "Container", value: `running under Docker (cgroup per workload)`, mono: false },
                { label: "Backup policy", value: backups.length > 0 ? backups[0].policy_name : "no policy attached — add one in Backups" },
                { label: "Last backup", value: backups.length > 0 ? formatRelative(backups[0].snapshot_at, now) : "never" },
                { label: "Export", value: "OCI artifact via ServiceTemplate export/import" },
              ]}
            />
          </Card>
        </div>

        <AllocationStrip usage={instance.usage} />

        {pendingOp !== null && <PendingState operation={pendingOp} />}

        <Card
          title={`${template?.name ?? familyKey} family`}
          description={`${family.length} instance${family.length === 1 ? "" : "s"} · ${familyRam} MB total ceiling`}
        >
          <ul className="flex list-none flex-col divide-y divide-line p-0">
            {family.map((f) => {
              const href = instanceHref(f);
              const row = (
                <>
                  <StatusPill status={serviceStatusPill(f)} />
                  <span className="text-sm font-medium text-ink">{f.name}</span>
                  <span className="truncate font-mono text-xs text-ink-2">{f.hostname}</span>
                  <span className="ml-auto text-xs tabular-nums text-ink-3">{f.usage.ram_mb.allocated} MB ceiling</span>
                </>
              );
              return (
                <li key={f.id}>
                  {href !== null ? (
                    <a href={href} className="flex items-center gap-3 px-1 py-2 hover:bg-surface-2">
                      {row}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 px-1 py-2 text-ink-2">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {confirmUninstall && (
          <ConfirmDialog
            open
            onClose={() => setConfirmUninstall(false)}
            onConfirm={() => void run(() => uninstallService(instance), "Uninstall submitted")}
            title={`Uninstall ${instance.name}?`}
            body={`This stops and removes the ${template?.name ?? familyKey} container. The volume is kept for 24 hours for recovery, then deleted — ${instance.name}'s data will be gone. Export first if you might come back.`}
            confirmLabel={`Uninstall ${instance.name}`}
            destructive
            typedConfirmation={instance.name}
          />
        )}
      </div>
    </Screen>
  );
}
