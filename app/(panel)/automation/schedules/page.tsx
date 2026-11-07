"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table";
import { StatusPill } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { scheduledJobs, type ScheduledJob } from "@/lib/mock/automation";
import { submitScheduleCreate, submitScheduleState } from "@/lib/api/automation";
import { formatRelative } from "@/lib/format";

/**
 * UX-AUTO-003 /automation/schedules — next/last runs, timezone, ownership.
 * Create uses presets + custom cron; pause/resume submit operations.
 */
const PRESETS = [
  { value: "nightly", label: "Nightly at 02:00 (0 2 * * *)" },
  { value: "weekly", label: "Weekly, Monday 06:00 (0 6 * * 1)" },
  { value: "hourly", label: "Hourly (0 * * * *)" },
  { value: "custom", label: "Custom cron…" },
];

export default function SchedulesPage() {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const base = useFixture(() => scheduledJobs);
  const [jobs, setJobs] = useState<ScheduledJob[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState("nightly");
  const [cron, setCron] = useState("0 2 * * *");

  const view = jobs ?? base;

  const create = () => {
    const label = name.trim() || "New scheduled job";
    const op = submitScheduleCreate(label);
    setFocusedId(op.id);
    setTrayOpen(true);
    push("success", "Schedule submitted", `${label} — first run computed when the operation verifies.`);
    setOpen(false);
    setName("");
  };

  const toggle = (j: ScheduledJob) => {
    const pause = j.state === "active";
    const op = submitScheduleState(j.name, pause);
    setFocusedId(op.id);
    setTrayOpen(true);
    setJobs((view ?? []).map((x) => (x.id === j.id ? { ...x, state: pause ? "paused" : "active" } : x)));
    push("info", pause ? "Pause submitted" : "Resume submitted", `${j.name} — the change applies when the operation verifies.`);
  };

  return (
    <Screen
      id="UX-AUTO-003"
      breadcrumbs={[{ label: "Automation", href: "/automation" }, { label: "Schedules" }]}
      actions={
        <Button icon="plus" onClick={() => setOpen(true)}>
          Create schedule
        </Button>
      }
    >
      <Callout tone="info" className="mb-4">
        All times are Africa/Nairobi (UTC+3); cron expressions are stored in UTC. Jobs that
        do heavy work are classified as batch and yield to site traffic.
      </Callout>

      {view === null ? (
        <SkeletonTable rows={3} cols={6} />
      ) : view.length === 0 ? (
        <Callout tone="warning" title="No scheduled jobs">
          Nightly backups, weekly reports and cache warmers live here. Create one to start.
        </Callout>
      ) : (
        <TableCard<ScheduledJob>
          title="Scheduled jobs"
          caption="Cron schedules with next and last runs"
          rowKey={(j) => j.id}
          rows={view}
          columns={[
            { key: "name", header: "Job", render: (j) => <span className="font-medium text-ink">{j.name}</span>, className: "sticky left-0 bg-surface" },
            { key: "cron", header: "Expression", render: (j) => <span className="font-mono text-xs">{j.cron}</span> },
            { key: "timezone", header: "Timezone" },
            { key: "last_run_at", header: "Last run", render: (j) => formatRelative(j.last_run_at, now) },
            { key: "next_run_at", header: "Next run", render: (j) => (j.state === "active" ? formatRelative(j.next_run_at, now) : "— paused") },
            { key: "last_outcome", header: "Last outcome", render: (j) => <StatusPill status={j.last_outcome === "succeeded" ? "succeeded" : j.last_outcome === "failed" ? "failed" : "unknown"} /> },
            { key: "owner", header: "Owner" },
            {
              key: "state",
              header: "State",
              render: (j) => (
                <div className="flex items-center gap-2">
                  <StatusPill status={j.state === "active" ? "active" : "cancelled"} />
                  <Button variant="ghost" size="sm" icon={j.state === "active" ? "pause" : "play"} onClick={() => toggle(j)}>
                    {j.state === "active" ? "Pause" : "Resume"}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create scheduled job"
        description="Pick a preset or write a cron expression. Heavy jobs run as batch and queue politely."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create}>Create schedule</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Job name" htmlFor="sched-name" required>
            <Input id="sched-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nightly database dump" />
          </Field>
          <Field label="Schedule preset" htmlFor="sched-preset">
            <Select
              id="sched-preset"
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                if (e.target.value === "nightly") setCron("0 2 * * *");
                if (e.target.value === "weekly") setCron("0 6 * * 1");
                if (e.target.value === "hourly") setCron("0 * * * *");
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          {preset === "custom" && (
            <Field label="Cron expression" htmlFor="sched-cron" required>
              <Input id="sched-cron" value={cron} onChange={(e) => setCron(e.target.value)} className="font-mono" />
            </Field>
          )}
          <p className="text-xs text-ink-3">
            Timezone: Africa/Nairobi (UTC+3). The job runs as you (the owner); the schedule is
            visible to every auditor in the organization.
          </p>
        </div>
      </Modal>
    </Screen>
  );
}
