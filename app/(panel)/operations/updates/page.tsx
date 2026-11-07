"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill, Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { CodeBlock } from "@/components/ui/code";
import { KeyValue } from "@/components/ui/misc";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { maintenanceWindow, panelUpdate } from "@/lib/mock/ops";
import { submitUpdateApply, submitUpdateCheck } from "@/lib/api/ops";
import { formatRelative } from "@/lib/format";

/**
 * UX-OPS-017 /operations/updates — panel self-update: current version,
 * "Check for updates" → operation, changelog (CodeBlock), maintenance-window
 * note, compatibility table and the rollback contract.
 */
export default function UpdatesPage() {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [knownVersion, setKnownVersion] = useState<string | null>(panelUpdate.available_version);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const check = () => {
    const op = submitUpdateCheck();
    setFocusedId(op.id);
    setTrayOpen(true);
    setKnownVersion(panelUpdate.available_version);
    push("info", "Update check submitted", "The release channel is queried and the signature verified before any result is trusted.");
  };

  const apply = () => {
    if (knownVersion === null) return;
    const op = submitUpdateApply(knownVersion);
    setFocusedId(op.id);
    setTrayOpen(true);
    setScheduleOpen(false);
    push("success", "Update scheduled", `Panel ${knownVersion} applies inside ${maintenanceWindow.human}.`);
  };

  return (
    <Screen
      id="UX-OPS-017"
      breadcrumbs={[{ label: "Operations" }, { label: "Updates" }]}
      actions={
        <>
          <Button variant="secondary" icon="refresh" onClick={check}>
            Check for updates
          </Button>
          {knownVersion !== null && (
            <Button icon="calendar" onClick={() => setScheduleOpen(true)}>
              Schedule update
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Installed" description="Control plane version">
            <p className="text-2xl font-semibold text-ink">{panelUpdate.current_version}</p>
            <p className="mt-1 text-xs text-ink-3">
              {panelUpdate.channel} channel · installed {formatRelative(panelUpdate.installed_at, now)}
            </p>
          </Card>
          <Card title="Available" description="Latest release on the channel">
            {knownVersion === null ? (
              <p className="text-sm text-ink-2">You are up to date — run a check to confirm.</p>
            ) : (
              <>
                <p className="flex items-center gap-2 text-2xl font-semibold text-ink">
                  {knownVersion} <Chip tone="accent">update available</Chip>
                </p>
                <p className="mt-1 text-xs text-ink-3">Released {formatRelative(panelUpdate.available_released_at, now)}</p>
              </>
            )}
          </Card>
          <Card title="Maintenance window" description="When changes apply">
            <p className="text-sm text-ink">{maintenanceWindow.human}</p>
            <p className="mt-1 text-xs text-ink-3">{maintenanceWindow.note}</p>
          </Card>
        </div>

        {knownVersion !== null && (
          <Callout tone="info" title="Scheduling">
            The update is staged now and applies inside your maintenance window
            ({maintenanceWindow.human}). Your websites keep serving — the update touches
            the control plane only. Batch jobs pause briefly.
          </Callout>
        )}

        <Card title="Changelog" description={knownVersion === null ? "No pending release" : `${panelUpdate.current_version} → ${knownVersion}`}>
          <CodeBlock language="changelog" code={panelUpdate.changelog.join("\n")} maxHeight={180} />
        </Card>

        <Card title="Compatibility" description="Verified against this installation before the release is offered">
          <ul className="divide-y divide-line">
            {panelUpdate.compatibility.map((c) => (
              <li key={c.component} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {c.component} <span className="font-normal text-ink-3">· current {c.current}</span>
                  </p>
                  <p className="text-xs text-ink-3">{c.detail}</p>
                </div>
                <StatusPill status={c.state === "compatible" ? "succeeded" : "pending"} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Rollback contract">
          <p className="text-sm text-ink-2">{panelUpdate.rollback}</p>
          <div className="mt-3">
            <KeyValue
              items={[
                { label: "Pre-update backup", value: "Panel database snapshot is taken before the first step runs" },
                { label: "Health check", value: "Post-update checks must pass before success is reported" },
                { label: "Agent", value: `Agent ${panelUpdate.agent_version} stays compatible — no agent restart needed` },
              ]}
            />
          </div>
        </Card>
      </div>

      {scheduleOpen && knownVersion !== null && (
        <Callout tone="warning" title={`Confirm schedule — panel ${knownVersion}`}>
          <p>
            The update is staged now and applies inside {maintenanceWindow.human}. The tray
            tracks the operation; success only after the post-update health check passes.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={apply}>
              Confirm schedule
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
          </div>
        </Callout>
      )}
    </Screen>
  );
}
