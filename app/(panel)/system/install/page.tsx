"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/mock/data";
import { panelVersion } from "@/lib/mock/support";
import { runInstallerRepair } from "@/lib/api/support";
import { isTerminal } from "@/lib/operations";
import { formatRelative, formatUtc } from "@/lib/format";
import { useCapabilities, useNow, useOperationStream, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { Callout } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";

/**
 * UX-SUP-006 /system/install — installer status. The honest state for this
 * demo install is "already installed": the claim completed at setup (the
 * audit chain records panel.installed). Re-install/fresh-install is a v2
 * flow and is not enabled here — the screen explains exactly what a
 * re-install would mean instead of offering a fake wizard.
 */

const INSTALL_STAGES = [
  { title: "System preflight", detail: "RAM, disk, public IP, ports — all requirements met" },
  { title: "Installation claim", detail: "One-time claim accepted and bound to this server" },
  { title: "Owner account & MFA", detail: "Owner identity created with MFA enabled" },
  { title: "Capability detection", detail: "Installer wrote the signed capability set for this hardware" },
  { title: "Panel live", detail: "Panel healthy, agent connected" },
];

/** The installer stamped the capability file at claim time — fall back to that stamp. */
function panelVersionInstalledFallback(): string {
  return panelVersion.installed_at;
}

export default function InstallerStatusPage() {
  const now = useNow();
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const caps = useCapabilities();
  const [opId, setOpId] = useState<string | null>(null);

  const operation = useMemo(() => (opId === null ? undefined : list.find((o) => o.id === opId)), [opId, list]);
  const installedAudit = useMemo(
    () => db.audit.find((a) => a.action === "panel.installed"),
    []
  );

  const repair = () => {
    try {
      const op = runInstallerRepair();
      setOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      push(
        "success",
        "Repair accepted (202)",
        "The installer re-runs preflight and repairs module state. Websites keep serving; nothing is deleted."
      );
    } catch (e) {
      push("error", "Repair failed", e instanceof Error ? e.message : "The repair could not be submitted.");
    }
  };

  const capabilityDigest = caps[0]?.source_digest ?? "unknown";
  const detectedAt = caps[0]?.detected_at ?? installedAudit?.occurred_at ?? panelVersionInstalledFallback();

  return (
    <Screen
      id="UX-SUP-006"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "System" }, { label: "Installer status" }]}
    >
      <div className="flex flex-col gap-6">
        {/* Already-installed honest state */}
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status="succeeded" />
          <span className="text-sm font-medium text-ink">Installation complete</span>
          {installedAudit !== undefined && (
            <span className="text-xs text-ink-3" title={formatUtc(installedAudit.occurred_at)}>
              claimed {formatRelative(installedAudit.occurred_at, now)}
            </span>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Installation record" description="Evidence from the audit chain and the signed capability file.">
            <KeyValue
              columns={1}
              items={[
                { label: "Server", value: `${db.server.name} — ${db.server.provider_label}` },
                { label: "Claimed at", value: installedAudit !== undefined ? formatUtc(installedAudit.occurred_at) : "Before this audit window" },
                { label: "Agent", value: <span className="font-mono text-xs">{db.server.agent_version}</span>, mono: true },
                { label: "Capability set digest", value: <span className="break-all font-mono text-xs">{capabilityDigest}</span>, mono: true },
                { label: "Capabilities detected", value: formatUtc(detectedAt) },
              ]}
            />
          </Card>

          <Card title="Stages" description="Each stage completed during setup — not re-runnable from here.">
            <ol className="flex list-none flex-col gap-3 p-0">
              {INSTALL_STAGES.map((s) => (
                <li key={s.title} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                    <Icon name="check" size={12} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{s.title}</span>
                    <span className="block text-xs text-ink-2">{s.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Repair — the honest remaining action */}
        <section aria-labelledby="repair-section">
          <Card
            title="Repair"
            description="For an installation that is complete but behaving oddly: re-run preflight, repair module state, verify panel health. Safe — it never touches website content."
          >
            {operation !== undefined && !isTerminal(operation.status) ? (
              <PendingState operation={operation} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button icon="refresh" onClick={repair}>
                  Run installer repair
                </Button>
                <span className="text-xs text-ink-3">
                  There is nothing to resume — the claim finished. Repair only re-checks and fixes
                  module state.
                </span>
              </div>
            )}
          </Card>
        </section>

        {/* Re-install / v2 gate — honest explanation, no fake wizard */}
        <Callout tone="warning" title="Re-install means starting over — and it is not offered here">
          <p>
            A fresh install re-runs the claim, creates a new owner account and re-detects
            capabilities. Panel metadata (organizations, grants, audit chain) is reset; website
            content, databases and backups on the VPS itself are not deleted by the installer, but
            the panel stops managing them until re-imported.
          </p>
          <p className="mt-2">
            The guided fresh-install wizard is a v2 flow and is not enabled in this prototype. If you
            need a clean slate today, do it from the provider console and treat this server as a new
            install — or{" "}
            <Link href="/settings/data-transfer" className="font-medium text-accent hover:underline">
              export your configuration first
            </Link>
            .
          </p>
          <p className="mt-2">
            <Link href="/help" className="font-medium text-accent hover:underline">
              Read the re-install runbook in the help center
            </Link>
            .
          </p>
        </Callout>

        <div>
          <ButtonLink href="/settings/system" variant="secondary" size="sm">
            Back to system overview
          </ButtonLink>
        </div>
      </div>
    </Screen>
  );
}
