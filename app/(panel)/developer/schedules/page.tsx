"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlay";
import { Drawer } from "@/components/ui/overlay";
import { DataTable } from "@/components/ui/table";
import { Chip, StatusPill, type StatusPillStatus } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { LogViewer } from "@/components/ui/code";
import { useToast, useNow } from "@/components/providers";
import { createCronTask, listCronTasks, setCronPaused, type CronTask } from "@/lib/api/files";
import { ApiError } from "@/lib/api/core";
import { formatDateTime, formatRelative } from "@/lib/format";

/** UX-FILE-009 — Cron and scheduled tasks (v1 /automations surface). */
export default function SchedulesPage() {
  const { push } = useToast();
  const now = useNow();
  const [tasks, setTasks] = useState<CronTask[]>([...listCronTasks()]);
  const [createOpen, setCreateOpen] = useState(false);
  const [logsFor, setLogsFor] = useState<CronTask | null>(null);

  const refresh = () => setTasks([...listCronTasks()]);

  return (
    <Screen
      id="UX-FILE-009"
      breadcrumbs={[{ label: "Developer", href: "/developer/access" }, { label: "Schedules" }]}
      description="Expression, timezone, last/next run and logs. Scheduled commands run as batch workloads — they queue when sites are busy."
      actions={<Button icon="plus" onClick={() => setCreateOpen(true)}>Create task</Button>}
    >
      <div className="flex flex-col gap-4">
        {tasks.length === 0 ? (
          <EmptyState icon="calendar" title="No scheduled tasks" body="Create one to run a command on a schedule — wp-cron, catalog imports, cache warmers." action={{ label: "Create task", onClick: () => setCreateOpen(true) }} />
        ) : (
          <DataTable
            caption="Scheduled tasks"
            rows={tasks}
            rowKey={(t) => t.id}
            columns={[
              { key: "name", header: "Task", render: (t: CronTask) => <span className="font-medium">{t.name}</span> },
              { key: "expression", header: "Expression", render: (t: CronTask) => <span className="font-mono text-xs">{t.expression}</span> },
              { key: "timezone", header: "Timezone", render: (t: CronTask) => t.timezone },
              { key: "last_run_at", header: "Last run", render: (t: CronTask) => (t.last_run_at ? formatRelative(t.last_run_at, now) : "Never") },
              { key: "last_status", header: "Result", render: (t: CronTask) => t.last_status === null ? "—" : <StatusPill status={t.last_status === "succeeded" ? "succeeded" : t.last_status === "failed" ? "failed" : "running"} /> },
              { key: "next_run_at", header: "Next run", render: (t: CronTask) => <span title={formatDateTime(t.next_run_at)}>{formatRelative(t.next_run_at, now)}</span> },
              { key: "state", header: "State", render: (t: CronTask) => (t.state === "active" ? <Chip tone="success">Active</Chip> : <Chip>Paused</Chip>) },
              {
                key: "actions",
                header: "Actions",
                render: (t: CronTask) => (
                  <span className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setLogsFor(t)}>
                      Logs
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCronPaused(t.id, t.state === "active")
                          .then(() => {
                            refresh();
                            push("success", t.state === "active" ? "Task paused" : "Task resumed", `${t.name} — change is audited.`);
                          })
                          .catch((e: unknown) => push("error", "Change failed", e instanceof ApiError ? e.problem.detail : "Unexpected error."));
                      }}
                    >
                      {t.state === "active" ? "Pause" : "Resume"}
                    </Button>
                  </span>
                ),
              },
            ]}
          />
        )}
        <Callout tone="info" title="Batch, not forgotten">
          Scheduled commands run at low priority: when a site is serving traffic they queue and resume when the
          server is idle. A paused task keeps its history and resumes on its next slot.
        </Callout>
      </div>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          refresh();
          setCreateOpen(false);
          push("success", "Task created", "The first run is scheduled within the next hour.");
        }}
      />
      <Drawer open={logsFor !== null} onClose={() => setLogsFor(null)} title={logsFor?.name ?? "Logs"}>
        {logsFor === null ? null : logsFor.log_lines.length === 0 ? (
          <p className="text-sm text-ink-2">No runs recorded yet for this task.</p>
        ) : (
          <LogViewer lines={logsFor.log_lines} />
        )}
      </Drawer>
    </Screen>
  );
}

function CreateTaskModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [expression, setExpression] = useState("0 3 * * *");
  const [timezone, setTimezone] = useState("Africa/Nairobi");
  const [command, setCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create scheduled task"
      description="Five-field cron expression. The workload category is derived from the command pattern."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            disabled={name.trim() === "" || command.trim() === ""}
            onClick={() => {
              setBusy(true);
              setError(null);
              createCronTask({ name: name.trim(), expression, timezone, command: command.trim() })
                .then(() => {
                  setBusy(false);
                  onCreated();
                })
                .catch((e: unknown) => {
                  setBusy(false);
                  setError(e instanceof ApiError ? e.problem.detail : "Unexpected error.");
                });
            }}
          >
            Create task
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Task name" htmlFor="cron-name" required>
          <Input id="cron-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Cron expression" htmlFor="cron-expr" required hint="minute hour day month weekday — e.g. 0 3 * * * runs at 03:00.">
          <Input id="cron-expr" value={expression} onChange={(e) => setExpression(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Timezone" htmlFor="cron-tz" required>
          <Select id="cron-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
            <option value="UTC">UTC</option>
          </Select>
        </Field>
        <Field label="Command" htmlFor="cron-cmd" required hint="Runs in the site scope, as the site user — not as root.">
          <Textarea id="cron-cmd" value={command} onChange={(e) => setCommand(e.target.value)} rows={2} className="font-mono text-xs" />
        </Field>
        {error !== null && <Callout tone="danger">{error}</Callout>}
      </div>
    </Modal>
  );
}
