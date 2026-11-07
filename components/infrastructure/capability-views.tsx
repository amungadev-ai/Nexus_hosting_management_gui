"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/badge";
import { CopyButton, LogViewer } from "@/components/ui/code";
import { KeyValue, ProgressBar } from "@/components/ui/misc";
import { PendingState } from "@/components/common/states";
import { useCapabilities, useOperationStream, useSession, useToast } from "@/components/providers";
import { db } from "@/lib/mock/data";
import { DETECTION_STEPS, detectionLogLines } from "@/lib/mock/infrastructure";
import { applyCapabilitySet, rescanCapabilities } from "@/lib/api/infrastructure";
import { PROFILES, CAPABILITY_META } from "@/lib/profiles";
import { formatMb } from "@/lib/format";
import { isTerminal } from "@/lib/operations";
import type { CapabilityRecord } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* UX-INF-011 — Capability detection                                   */
/* ------------------------------------------------------------------ */

export function CapabilitiesView() {
  const caps = useCapabilities();
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const [busy, setBusy] = useState(false);
  const [opId, setOpId] = useState<string | null>(null);
  const p = PROFILES[profile];
  const ops = useOperationStream().list;
  const op = opId !== null ? ops.find((o) => o.id === opId) ?? null : null;

  const digest = caps[0]?.source_digest ?? "unknown";
  const hardMaxMb = Math.round(p.specs.ram_mb * 1.2);
  const ceilingSum = caps.reduce((sum, c) => sum + c.ram_ceiling_mb, 0);
  const unavailable = caps.filter((c) => c.state === "unavailable");
  const borderline = caps.filter((c) => c.state === "borderline");

  const rescan = () => {
    setBusy(true);
    rescanCapabilities()
      .then((operation) => {
        setBusy(false);
        setOpId(operation.id);
        setFocusedId(operation.id);
        setTrayOpen(true);
        push("success", "Rescan submitted", `Operation ${operation.id} — the installer's 5-step detection runs read-only and re-signs the capability file.`);
      })
      .catch(() => {
        setBusy(false);
        push("error", "Rescan failed", "Could not queue the hardware rescan.");
      });
  };

  const exportJson = JSON.stringify(
    caps.map((c) => ({
      capability_key: c.capability_key,
      state: c.state,
      ram_floor_mb: c.ram_floor_mb,
      ram_typical_mb: c.ram_typical_mb,
      ram_ceiling_mb: c.ram_ceiling_mb,
      cpu_weight: c.cpu_weight,
      cpu_max_millicores: c.cpu_max_millicores,
      disk_floor_gb: c.disk_floor_gb,
      prerequisites: c.prerequisites,
      source_digest: c.source_digest,
    })),
    null,
    2
  );

  return (
    <Screen
      id="UX-INF-011"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Capability detection" }]}
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => document.getElementById("detection-evidence")?.scrollIntoView({ behavior: "smooth" })}
          >
            View evidence
          </Button>
          <CopyButton text={exportJson} label="Export (copy JSON)" />
          <Button icon="refresh" loading={busy} onClick={rescan}>Rescan capabilities</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {op !== null && (
          <PendingState operation={op}>
            <p className="text-sm text-ink-2">
              {op.status === "succeeded"
                ? "The rescan re-signed the capability file — the records below are the verified result."
                : "The rescan could not complete — nothing on the server changed."}
            </p>
          </PendingState>
        )}

        <Card title="Detected hardware" description={`What the installer read on ${db.server.name} — the capability floors below were fitted against these counters.`}>
          <KeyValue
            columns={2}
            items={[
              { label: "vCPU", value: String(p.specs.vcpu) },
              { label: "RAM", value: formatMb(p.specs.ram_mb) },
              { label: "Disk", value: `${p.specs.disk_gb} GB` },
              { label: "Hard overcommit limit", value: `${formatMb(hardMaxMb)} (RAM × 1.2)` },
            ]}
          />
          <div className="mt-4 max-w-xl">
            <ProgressBar
              value={Math.min(ceilingSum, hardMaxMb)}
              max={hardMaxMb}
              tone={ceilingSum > hardMaxMb ? "danger" : "accent"}
              label={`Ceiling sum across capabilities: ${formatMb(ceilingSum)} of ${formatMb(hardMaxMb)} — overcommit guard`}
              showValue
            />
            {ceilingSum > hardMaxMb && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
                <span aria-hidden="true">▲</span> Soft warning — full simultaneous use would exceed the guard (CPU is
                also soft-overcommitted at ~3× by design; ceilings, not reservations).
              </p>
            )}
          </div>
        </Card>

        <Card title="How the installer decided (5 steps)" description="Detection is a signed, repeatable procedure — the digest below covers its output.">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-2">
            {DETECTION_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs font-medium text-ink-2">Signed digest:</span>
            <code className="rounded-control bg-surface-2 px-2 py-1 font-mono text-xs text-ink">{digest}</code>
            <CopyButton text={digest} label="Copy digest" />
          </div>
        </Card>

        <section aria-label="Capability records" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">
            Capability records for {p.label}{" "}
            <span className="font-normal text-ink-2">
              ({caps.length} · {unavailable.length} unavailable · {borderline.length} borderline)
            </span>
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {caps.map((rec: CapabilityRecord) => (
              <div key={rec.capability_key} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {CAPABILITY_META[rec.capability_key]?.label ?? rec.capability_key}
                    </p>
                    <p className="font-mono text-[11px] text-ink-3">{rec.capability_key}</p>
                    <p className="text-xs text-ink-3">
                      {rec.workload_category} · cpu.weight {rec.cpu_weight}
                      {rec.cpu_max_millicores !== null ? ` · cpu.max ${rec.cpu_max_millicores} m` : ""}
                    </p>
                  </div>
                  <StatusPill status={rec.state} />
                </div>
                <p className="mt-2 text-xs text-ink-2">
                  RAM floor {formatMb(rec.ram_floor_mb)} · typical {formatMb(rec.ram_typical_mb)} · ceiling{" "}
                  {formatMb(rec.ram_ceiling_mb)}
                  {rec.disk_floor_gb !== null ? ` · disk ${rec.disk_floor_gb} GB` : ""}
                </p>
                {rec.reason !== null && (
                  <p className="mt-2 text-xs text-ink-2">
                    {rec.state === "borderline" ? "Borderline: " : "Why unavailable: "}
                    {rec.reason}
                  </p>
                )}
                {rec.delta !== undefined && rec.delta.ram_mb !== undefined && (
                  <p className="mt-1 text-xs font-medium text-warning">
                    Needs {formatMb(rec.delta.ram_mb)} more RAM{rec.delta.vcpu !== undefined ? ` + ${rec.delta.vcpu} vCPU` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <Card title="Recorded environment probes and blockers" description="Facts recorded during detection — the reason mail self-hosting is honestly unavailable here.">
          <KeyValue
            columns={2}
            items={[
              { label: "Docker socket", value: "Present (recorded at detection)" },
              { label: "Public IP", value: db.server.ip, mono: true },
              { label: "Outbound port 25", value: "Blocked by the VPS provider — self-hosted mail not offered; external SMTP relay unaffected" },
              { label: "cgroup", value: "v2 unified hierarchy" },
            ]}
          />
        </Card>

        <Card
          title="Detection evidence"
          description="The log from the installer's last detection run (already redacted)."
        >
          <div id="detection-evidence">
            <LogViewer lines={detectionLogLines} />
          </div>
          <p className="mt-3 text-xs text-ink-3">
            After a hardware change, run the{" "}
            <Link href="/infrastructure/rescan" className="text-accent hover:underline">hardware rescan</Link> to re-fit
            these floors.
          </p>
        </Card>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* UX-INF-012 — Hardware rescan flow                                   */
/* ------------------------------------------------------------------ */

export function RescanView() {
  const caps = useCapabilities();
  const { profile } = useSession();
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [rescanOpId, setRescanOpId] = useState<string | null>(null);
  const [applyOpId, setApplyOpId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = PROFILES[profile];

  const rescanOp = rescanOpId !== null ? list.find((o) => o.id === rescanOpId) ?? null : null;
  const applyOp = applyOpId !== null ? list.find((o) => o.id === applyOpId) ?? null : null;
  const digest = caps[0]?.source_digest ?? "unknown";
  const lastRescanAudit = db.audit.find((a) => a.action === "capability.rescan");
  const availableCount = caps.filter((c) => c.state === "available").length;

  const startRescan = () => {
    setBusy(true);
    rescanCapabilities()
      .then((op) => {
        setBusy(false);
        setRescanOpId(op.id);
        setFocusedId(op.id);
        setTrayOpen(true);
        push("success", "Rescan submitted", `Operation ${op.id} — hardware counters are re-read and floors re-fitted.`);
      })
      .catch(() => {
        setBusy(false);
        push("error", "Rescan failed", "Could not queue the hardware rescan.");
      });
  };

  const applySet = () => {
    setBusy(true);
    applyCapabilitySet()
      .then((op) => {
        setBusy(false);
        setApplyOpId(op.id);
        setFocusedId(op.id);
        setTrayOpen(true);
        push("success", "Capability set submitted", `Operation ${op.id} — new capabilities enable after verification.`);
      })
      .catch(() => {
        setBusy(false);
        push("error", "Apply failed", "Could not queue the capability set application.");
      });
  };

  const rescanRunning = rescanOp !== null && !isTerminal(rescanOp.status);
  const applyRunning = applyOp !== null && !isTerminal(applyOp.status);

  return (
    <Screen
      id="UX-INF-012"
      breadcrumbs={[{ label: "Infrastructure", href: "/infrastructure/servers" }, { label: "Hardware rescan" }]}
      actions={
        !rescanRunning && !applyRunning ? (
          <Button icon="refresh" loading={busy} onClick={startRescan}>Rescan capabilities</Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {rescanOp === null ? (
          <>
            <Card title="Before you rescan" description="What the 5-step detection will do on this server — read-only until you apply a new set.">
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-2">
                {DETECTION_STEPS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="mt-4 border-t border-line pt-3">
                <KeyValue
                  columns={2}
                  items={[
                    { label: "Current profile", value: `${p.label} — ${p.tagline}` },
                    { label: "Capabilities available now", value: `${availableCount} of ${caps.length}` },
                    { label: "Current digest", value: digest, mono: true },
                    {
                      label: "Last rescan",
                      value: lastRescanAudit !== undefined ? `${lastRescanAudit.actor_label} · audit ${lastRescanAudit.occurred_at.replace("T", " ").slice(0, 16)} UTC` : "none recorded",
                    },
                  ]}
                />
              </div>
            </Card>
            <Callout tone="info" title="The upgrade ladder: upgrade, rescan, apply">
              After you change the VPS plan (more RAM, more vCPU), rescan re-fits every capability floor against the new
              counters — nothing is invented, the panel only reports what the hardware now supports. On this demo you can
              simulate the upgrade by switching the profile in the user menu, then running the rescan. Applying a new set
              enables the capabilities that became available and re-verifies the metadata database.
            </Callout>
          </>
        ) : (
          <PendingState operation={rescanOp}>
            {rescanOp.status === "succeeded" ? (
              <Card title="Rescan complete — new capability set signed" description="The digest identifies this signed set; the records are the verified detection result.">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-ink-2">Digest:</span>
                  <code className="rounded-control bg-surface-2 px-2 py-1 font-mono text-xs text-ink">{digest}</code>
                  <CopyButton text={digest} label="Copy digest" />
                </div>
                <p className="mt-3 text-sm text-ink-2">
                  {availableCount} of {caps.length} capabilities are available on the detected hardware. Applying the set
                  enables what became available and verifies the metadata database — until applied, the running panel
                  keeps the previous set.
                </p>
                {!applyRunning && applyOp === null && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button icon="check" onClick={applySet}>Apply new capability set</Button>
                    <ButtonLink href="/infrastructure/capabilities" variant="secondary">Review records first</ButtonLink>
                  </div>
                )}
                {applyOp !== null && (
                  <PendingState operation={applyOp}>
                    <Callout tone="success" title="Capability set applied">
                      New capabilities are enabled and verified. See the full records under{" "}
                      <Link href="/infrastructure/capabilities" className="text-accent hover:underline">Capability detection</Link>.
                    </Callout>
                  </PendingState>
                )}
              </Card>
            ) : (
              <Callout tone="danger" title="Rescan did not complete">
                {rescanOp.error !== undefined ? rescanOp.error.detail : "The rescan job ended without success."} Nothing
                changed — the previous signed set is still active. You can retry the rescan from the button above.
              </Callout>
            )}
          </PendingState>
        )}

        <Callout tone="info" title="Where this fits">
          The rescan is the payoff of the{" "}
          <Link href="/system/upgrade" className="text-accent hover:underline">VPS upgrade ladder</Link> (UX-SUP-009):
          upgrade the plan, rescan the hardware, apply the new capability set — the honest way a Nano grows into a
          Standard without reinstalling.
        </Callout>
      </div>
    </Screen>
  );
}
