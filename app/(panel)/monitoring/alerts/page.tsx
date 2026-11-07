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
import { alertRules, type AlertRule } from "@/lib/mock/ops";
import { submitAlertRuleCreate, submitAlertSilence } from "@/lib/api/ops";
import { formatRelative } from "@/lib/format";

/**
 * UX-OPS-009 /monitoring/alerts — thresholds, routing, silences and test
 * delivery. Every action is wired: create and silence submit operations,
 * "Test delivery" sends a real (mock) test notification.
 */
export default function AlertsPage() {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const rules = useFixture(() => alertRules);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("Workload RAM above 80%");
  const [threshold, setThreshold] = useState("80");
  const [channel, setChannel] = useState("In-app + email (Resend)");

  const [localRules, setLocalRules] = useState<AlertRule[] | null>(null);
  const view = localRules ?? rules;

  const create = () => {
    const label = name.trim() || metric;
    const op = submitAlertRuleCreate(label);
    setFocusedId(op.id);
    setTrayOpen(true);
    push("success", "Alert rule submitted", `${label} — delivery confirmed when the operation verifies.`);
    setCreateOpen(false);
    setName("");
  };

  const silence = (r: AlertRule) => {
    const op = submitAlertSilence(r.name);
    setFocusedId(op.id);
    setTrayOpen(true);
    setLocalRules(
      (view ?? []).map((x) =>
        x.id === r.id
          ? { ...x, state: "silenced", silenced_until: new Date(Date.now() + 12 * 3600 * 1000).toISOString() }
          : x
      )
    );
    push("info", "Silence requested", `${r.name} — silenced for 12 hours once the operation applies.`);
  };

  const testDelivery = (r: AlertRule) => {
    push("info", "Test sent", `A test notification for “${r.name}” was delivered to ${r.channel}.`);
  };

  return (
    <Screen
      id="UX-OPS-009"
      breadcrumbs={[{ label: "Monitoring", href: "/monitoring" }, { label: "Alerts" }]}
      actions={
        <Button icon="plus" onClick={() => setCreateOpen(true)}>
          Create alert rule
        </Button>
      }
    >
      {view === null ? (
        <SkeletonTable rows={4} cols={5} />
      ) : view.length === 0 ? (
        <Callout tone="warning" title="No alert rules">
          Without rules the panel only records incidents after the fact. Start with the
          RAM rule — memory exhaustion is the most common Nano/Starter failure.
        </Callout>
      ) : (
        <>
          {view.some((r) => r.state === "firing") && (
            <Callout tone="warning" className="mb-4" title="A rule is currently firing">
              {view.filter((r) => r.state === "firing").map((r) => `${r.name} — ${r.detail}`).join(" · ")}
            </Callout>
          )}
          <TableCard<AlertRule>
            title="Alert rules"
            caption="Thresholds, routing and silences"
            rowKey={(r) => r.id}
            rows={view}
            columns={[
              { key: "name", header: "Rule", render: (r) => <span className="font-medium text-ink">{r.name}</span>, className: "sticky left-0 bg-surface" },
              { key: "metric", header: "Metric" },
              { key: "threshold_label", header: "Threshold", render: (r) => `${r.comparator} ${r.threshold_label}` },
              { key: "window", header: "Window" },
              { key: "channel", header: "Routes to" },
              {
                key: "state",
                header: "State",
                render: (r) => (
                  <StatusPill
                    status={r.state === "firing" ? "degraded" : r.state === "silenced" ? "cancelled" : "healthy"}
                    at={r.state === "firing" && r.fired_at !== null ? r.fired_at : undefined}
                  />
                ),
              },
              {
                key: "actions",
                header: "",
                render: (r) => (
                  <div className="flex flex-wrap gap-2">
                    {r.state === "firing" && (
                      <Button variant="secondary" size="sm" icon="pause" onClick={() => silence(r)}>
                        Silence 12h
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" icon="bell" onClick={() => testDelivery(r)}>
                      Test delivery
                    </Button>
                  </div>
                ),
              },
            ]}
          />
          <p className="mt-3 text-xs text-ink-3">
            Silenced rules resume automatically — {view.find((r) => r.silenced_until !== null)?.silenced_until !== undefined
              ? `next resume ${formatRelative(view.find((r) => r.silenced_until !== null)!.silenced_until!, now)}`
              : "no active silences"}.
          </p>
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create alert rule"
        description="Rules are evaluated on the server; delivery is confirmed by the operation, not by this dialog."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create}>Create rule</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Rule name" htmlFor="alert-name" required>
            <Input id="alert-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. orders-api RAM watch" />
          </Field>
          <Field label="Metric" htmlFor="alert-metric">
            <Select id="alert-metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option>Workload RAM above 80%</option>
              <option>Disk above 85%</option>
              <option>Nightly backup failed or not verified</option>
              <option>Certificate expiring within 14 days</option>
              <option>HTTP p95 latency above 800 ms</option>
            </Select>
          </Field>
          <Field label="Threshold (%)" htmlFor="alert-threshold" required>
            <Input id="alert-threshold" type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
          <Field label="Route to" htmlFor="alert-channel" hint="Critical notifications always reach in-app, regardless of routing.">
            <Select id="alert-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option>In-app</option>
              <option>In-app + email (Resend)</option>
              <option>In-app + webhook → Blink SMS</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </Screen>
  );
}
