"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { PROFILE_CAPABILITIES, PROFILE_ORDER, PROFILES } from "@/lib/profiles";
import { planVpsUpgrade, rescanHardware } from "@/lib/api/support";
import { isTerminal } from "@/lib/operations";
import { formatGb, formatMb } from "@/lib/format";
import { useOperationStream, useSession, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { Callout, EmptyState, ErrorBlock } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import type { ProfileId } from "@/lib/types";

/**
 * UX-SUP-009 /system/upgrade — the VPS ladder (UXD-032). Current profile from
 * the session switcher, target tiers with honest resource deltas from
 * PROFILES, the capabilities each tier unlocks, "Plan upgrade" (a plan
 * operation — the resize itself happens at the provider), and the rescan step
 * that picks up the new capability set after the provider finishes.
 */

const DELTA_ROWS: { key: "ram_mb" | "vcpu" | "disk_gb"; label: string; format: (v: number) => string }[] = [
  { key: "ram_mb", label: "RAM", format: formatMb },
  { key: "vcpu", label: "vCPU", format: (v) => `${v} vCPU` },
  { key: "disk_gb", label: "Disk", format: formatGb },
];

function capabilitiesUnlocked(from: ProfileId, to: ProfileId): string[] {
  const before = new Map(PROFILE_CAPABILITIES[from].map((c) => [c.capability_key, c.state]));
  return PROFILE_CAPABILITIES[to]
    .filter((c) => c.state === "available" && before.get(c.capability_key) !== "available")
    .map((c) => c.capability_key);
}

export default function VpsUpgradePage() {
  const { profile } = useSession();
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [selected, setSelected] = useState<ProfileId | null>(null);
  const [planOpId, setPlanOpId] = useState<string | null>(null);
  const [rescanOpId, setRescanOpId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planOperation = useMemo(
    () => (planOpId === null ? undefined : list.find((o) => o.id === planOpId)),
    [planOpId, list]
  );
  const rescanOperation = useMemo(
    () => (rescanOpId === null ? undefined : list.find((o) => o.id === rescanOpId)),
    [rescanOpId, list]
  );

  const current = PROFILES[profile];
  const currentIndex = PROFILE_ORDER.indexOf(profile);
  const plannedTarget = selected !== null ? PROFILES[selected] : null;
  const unlocked = selected !== null ? capabilitiesUnlocked(profile, selected) : [];
  const currentUnavailable = PROFILE_CAPABILITIES[profile].filter((c) => c.state === "unavailable").length;

  const plan = () => {
    if (selected === null) return;
    setError(null);
    try {
      const op = planVpsUpgrade(PROFILES[selected].label);
      setPlanOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      push(
        "success",
        "Upgrade plan submitted (202)",
        "NexusPanel coordinates with your provider — the resize happens on their side. Nothing changes on this VPS until they complete it and you rescan."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "The plan could not be submitted.");
    }
  };

  const rescan = () => {
    setError(null);
    try {
      const op = rescanHardware();
      setRescanOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      push(
        "info",
        "Hardware rescan requested",
        "The installer re-detects hardware and diffs the capability set. New capabilities appear when the rescan verifies."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "The rescan could not be submitted.");
    }
  };

  return (
    <Screen
      id="UX-SUP-009"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "System" }, { label: "VPS upgrade" }]}
      actions={
        <Button variant="secondary" icon="refresh" onClick={rescan} disabled={rescanOperation !== undefined && !isTerminal(rescanOperation.status)}>
          Rescan hardware
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="max-w-3xl text-sm text-ink-2">
          The ladder-climbing flow: see what your current VPS can run, plan a bigger tier with
          honest deltas, and after your provider resizes the machine, rescan hardware to unlock the
          new capability set.
        </p>

        {/* Current profile */}
        <Card
          title={`Current tier — ${current.label}`}
          description={current.summary}
          actions={<Chip tone="accent">{current.tagline}</Chip>}
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2">
            <span className="flex items-center gap-1.5">
              <Icon name="cpu" size={14} className="text-ink-3" />
              {current.specs.vcpu} vCPU
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="layers" size={14} className="text-ink-3" />
              {formatMb(current.specs.ram_mb)} RAM
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="hard-drive" size={14} className="text-ink-3" />
              {formatGb(current.specs.disk_gb)} disk
            </span>
            <span className="flex items-center gap-1.5">
              <StatusPill status={currentUnavailable === 0 ? "available" : "unavailable"} />
              {currentUnavailable === 0
                ? "every capability runs"
                : `${currentUnavailable} capabilities cannot run on this tier`}
            </span>
          </div>
        </Card>

        {/* Plan operation / rescan operation feedback */}
        {planOperation !== undefined && !isTerminal(planOperation.status) && (
          <PendingState operation={planOperation}>
            <p className="text-xs text-ink-2">
              The plan is validated against the target tier and sent to your provider with the
              capability delta. You approve nothing else here — the resize is provider-side.
            </p>
          </PendingState>
        )}
        {planOperation?.status === "succeeded" && plannedTarget !== null && (
          <Callout tone="success" title={`Plan ready — ${plannedTarget.label}`}>
            Your provider has the plan and the maintenance window proposal. When the resize is done,
            come back and run{" "}
            <button type="button" className="font-medium text-accent hover:underline" onClick={rescan}>
              Rescan hardware
            </button>{" "}
            to pick up the new capability set.
          </Callout>
        )}
        {planOperation?.status === "failed" && (
          <ErrorBlock
            code={planOperation.error?.code ?? "VPS_PLAN_FAILED"}
            detail={planOperation.error?.detail ?? "The upgrade plan could not be submitted. Retry, or contact support."}
            correlationId={planOperation.correlation_id}
          />
        )}
        {rescanOperation !== undefined && !isTerminal(rescanOperation.status) && (
          <PendingState operation={rescanOperation} />
        )}
        {rescanOperation?.status === "succeeded" && (
          <Callout tone="success" title="Rescan verified">
            The capability set was re-detected and diffed. New availability appears across the panel
            immediately — check the{" "}
            <Link href="/overview/capabilities" className="font-medium text-accent hover:underline">
              capability overview
            </Link>
            .
          </Callout>
        )}

        {error !== null && (
          <Callout tone="danger" title="Action failed">
            {error}
          </Callout>
        )}

        {/* Target tiers */}
        <section aria-labelledby="target-tiers">
          <h2 id="target-tiers" className="text-sm font-semibold text-ink">
            Target tiers
          </h2>
          {currentIndex === PROFILE_ORDER.length - 1 ? (
            <div className="mt-3">
              <EmptyState
                icon="check-circle"
                title="You are on the top tier"
                body="The Provider tier is the largest profile in this prototype. If you need more headroom, contact your provider about dedicated hardware — the panel rescan will pick it up the same way."
                secondaryAction={{ label: "Rescan hardware anyway", onClick: rescan }}
              />
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PROFILE_ORDER.map((id) => {
                const def = PROFILES[id];
                const idx = PROFILE_ORDER.indexOf(id);
                const upgrade = idx > currentIndex;
                const isSelected = selected === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={!upgrade}
                    onClick={() => setSelected(id)}
                    className={
                      "flex flex-col items-start gap-2 rounded-card border p-4 text-left transition-colors " +
                      (isSelected && upgrade
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface hover:border-line-strong") +
                      (!upgrade ? " cursor-not-allowed opacity-60" : "")
                    }
                  >
                    <span className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{def.label}</span>
                      <Chip tone={upgrade ? "success" : "neutral"}>{def.tagline}</Chip>
                    </span>
                    {upgrade ? (
                      <span className="flex flex-col gap-0.5 text-xs text-ink-2">
                        {DELTA_ROWS.map((row) => {
                          const delta = def.specs[row.key] - current.specs[row.key];
                          return (
                            <span key={row.key}>
                              +{row.format(delta)} {row.label}
                            </span>
                          );
                        })}
                        <span className="mt-1 text-ink">
                          Unlocks {capabilitiesUnlocked(profile, id).length} capabilities that cannot run today
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-2">
                        {idx === currentIndex ? "This is your current tier." : "Below your current tier — the ladder only climbs."}
                      </span>
                    )}
                    <span className="text-xs text-ink-3">{def.db}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Plan review */}
        {plannedTarget !== null && currentIndex < PROFILE_ORDER.length - 1 && (
          <Card
            title={`Plan review — ${current.label} → ${plannedTarget.label}`}
            description="What the plan contains. Submitting it does not change this VPS."
          >
            <KeyValue
              columns={2}
              items={[
                { label: "RAM", value: `${formatMb(current.specs.ram_mb)} → ${formatMb(plannedTarget.specs.ram_mb)} (+${formatMb(plannedTarget.specs.ram_mb - current.specs.ram_mb)})` },
                { label: "vCPU", value: `${current.specs.vcpu} → ${plannedTarget.specs.vcpu}` },
                { label: "Disk", value: `${formatGb(current.specs.disk_gb)} → ${formatGb(plannedTarget.specs.disk_gb)} (+${formatGb(plannedTarget.specs.disk_gb - current.specs.disk_gb)})` },
                {
                  label: "Capabilities unlocked",
                  value:
                    unlocked.length === 0
                      ? "None — the delta is headroom only"
                      : `${unlocked.length} (e.g. ${unlocked.slice(0, 3).join(", ")})`,
                },
              ]}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button icon="zap" onClick={plan} disabled={planOperation !== undefined && !isTerminal(planOperation.status)}>
                Plan upgrade
              </Button>
              <span className="max-w-md text-xs text-ink-3">
                Honest note: the resize is coordinated with your provider (Leaseweb for this demo
                server). NexusPanel cannot resize the VPS itself — it plans, and it verifies with a
                rescan afterwards.
              </span>
            </div>
          </Card>
        )}
      </div>
    </Screen>
  );
}
