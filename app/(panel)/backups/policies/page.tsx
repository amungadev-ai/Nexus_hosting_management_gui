"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Checkbox, Field, Fieldset, Input, Select, Switch } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { backupPolicies } from "@/lib/mock/ops";
import { submitDestinationTest, submitPolicyUpdate } from "@/lib/api/ops";
import { formatRelative } from "@/lib/format";
import type { BackupPolicy } from "@/lib/mock/ops";

/**
 * UX-OPS-002 /backups/policies — schedules, scope, encryption, retention and
 * destinations (Stage 3 §10: capacity/offsite readiness, UTC/timezone clarity,
 * effective retention and cost implications).
 */
export default function BackupPoliciesPage() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const now = useNow();
  const policies = useFixture(() => backupPolicies);
  const [editing, setEditing] = useState<BackupPolicy | null>(null);

  const applyEdit = (p: BackupPolicy) => {
    const op = submitPolicyUpdate(p.name);
    setFocusedId(op.id);
    setTrayOpen(true);
    push("success", "Policy update submitted", `“${p.name}” — progress is in the operation tray.`);
    setEditing(null);
  };

  const testDestination = (p: BackupPolicy) => {
    const op = submitDestinationTest(p.destination_label, p.id);
    setFocusedId(op.id);
    setTrayOpen(true);
    push("info", "Destination test queued", `${p.destination_label} — the probe runs as a batch job.`);
  };

  return (
    <Screen
      id="UX-OPS-002"
      breadcrumbs={[{ label: "Backups", href: "/backups" }, { label: "Policies" }]}
      actions={
        <ButtonLink href="/backups/destinations" variant="secondary" icon="cloud">
          Destinations
        </ButtonLink>
      }
    >
      <Callout tone="info" className="mb-4">
        Schedule times are shown in Africa/Nairobi (UTC+3); the panel stores them in UTC.
        Effective retention is what survives, not what is written — a nightly backup kept
        30 days needs roughly 30 snapshots of storage at your destination.
      </Callout>

      {policies === null ? (
        <SkeletonTable rows={2} cols={5} />
      ) : policies.length === 0 ? (
        <Callout tone="warning" title="No backup policies yet">
          Without a policy nothing is backed up. Create one to cover your websites and
          services — nightly at 02:00 is the recommended starting point.
        </Callout>
      ) : (
        <div className="flex flex-col gap-4">
          {policies.map((p) => {
            const verified =
              p.last_verified_restore_at !== null
                ? `Last verified restore: ${formatRelative(p.last_verified_restore_at, now)}`
                : "Last verified restore: never — schedule one from Backups → Verify";
            return (
              <Card
                key={p.id}
                title={
                  <span className="flex items-center gap-2">
                    {p.name}
                    <StatusPill status={p.enabled ? "active" : "cancelled"} />
                  </span>
                }
                description={p.scope}
                actions={
                  <>
                    <Button variant="secondary" size="sm" icon="zap" onClick={() => testDestination(p)}>
                      Test destination
                    </Button>
                    <Button size="sm" icon="edit" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                  </>
                }
                footer={verified}
              >
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <p className="text-ink-2">
                    <span className="text-ink-3">Schedule:</span> {p.schedule_label} ({p.cron}, {p.timezone})
                  </p>
                  <p className="text-ink-2">
                    <span className="text-ink-3">Destination:</span> {p.destination_label}
                  </p>
                  <p className="text-ink-2">
                    <span className="text-ink-3">Retention:</span> {p.retention_days} days effective
                  </p>
                  <p className="text-ink-2">
                    <span className="text-ink-3">Encryption:</span> {p.encryption}
                  </p>
                  <p className="text-ink-2 sm:col-span-2">
                    <span className="text-ink-3">Cost implication:</span> ~
                    {p.covered_resources.length * 200} MB/night ≈{" "}
                    {Math.round((p.covered_resources.length * 200 * p.retention_days) / 1024)} GB stored
                    offsite — Backblaze B2 free tier covers 10 GB.
                  </p>
                </div>
                <p className="mt-3 text-xs text-ink-3">
                  Last run {formatRelative(p.last_run_at, now)} · covers {p.covered_resources.join(", ")}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <EditPolicyModal
          policy={editing}
          onClose={() => setEditing(null)}
          onSave={applyEdit}
        />
      )}
    </Screen>
  );
}

const SCHEDULE_PRESETS = [
  { value: "nightly", label: "Nightly at 02:00 (0 2 * * *)" },
  { value: "weekly", label: "Weekly, Sunday 03:00 (0 3 * * 0)" },
  { value: "hourly", label: "Every hour (0 * * * *)" },
  { value: "custom", label: "Custom cron…" },
];

function EditPolicyModal({
  policy,
  onClose,
  onSave,
}: {
  policy: BackupPolicy;
  onClose: () => void;
  onSave: (p: BackupPolicy) => void;
}) {
  const [preset, setPreset] = useState(
    policy.cron === "0 2 * * *" ? "nightly" : policy.cron === "0 3 * * 0" ? "weekly" : "custom"
  );
  const [cron, setCron] = useState(policy.cron);
  const [retention, setRetention] = useState(String(policy.retention_days));
  const [enabled, setEnabled] = useState(policy.enabled);
  const [dbConsistent, setDbConsistent] = useState(policy.consistency === "database-consistent");

  const scheduleLabel =
    preset === "nightly"
      ? "Every night at 02:00"
      : preset === "weekly"
        ? "Sundays at 03:00"
        : preset === "hourly"
          ? "Hourly"
          : `Custom (${cron})`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit policy — ${policy.name}`}
      description="Changes take effect from the next run; existing snapshots keep their retention."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                ...policy,
                cron: preset === "nightly" ? "0 2 * * *" : preset === "weekly" ? "0 3 * * 0" : preset === "hourly" ? "0 * * * *" : cron,
                schedule_label: scheduleLabel,
                retention_days: Number(retention) || policy.retention_days,
                enabled,
                consistency: dbConsistent ? "database-consistent" : "filesystem",
              })
            }
          >
            Save and apply
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Fieldset legend="Schedule" hint="Times are Africa/Nairobi (UTC+3); stored in UTC.">
          <Select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Schedule preset">
            {SCHEDULE_PRESETS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          {preset === "custom" && (
            <Field label="Cron expression" htmlFor="policy-cron" required>
              <Input id="policy-cron" value={cron} onChange={(e) => setCron(e.target.value)} className="font-mono" />
            </Field>
          )}
        </Fieldset>
        <Field
          label="Retention"
          htmlFor="policy-retention"
          hint="Snapshots older than this are deleted at the destination."
        >
          <Select id="policy-retention" value={retention} onChange={(e) => setRetention(e.target.value)}>
            {["7", "14", "30", "60", "90"].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox
          label="Database-consistent snapshots"
          description="Quiesce the database briefly so the snapshot is restorable to a live state. Adds a few seconds per run."
          checked={dbConsistent}
          onChange={setDbConsistent}
        />
        <Switch checked={enabled} onChange={setEnabled} label={enabled ? "Policy enabled" : "Policy paused"} />
      </div>
    </Modal>
  );
}
