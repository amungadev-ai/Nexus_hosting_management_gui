"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table";
import { StatusPill, Chip } from "@/components/ui/badge";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { SecretField } from "@/components/ui/code";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { EVENT_TAXONOMY, webhookDeliveries, webhookEndpoints, type WebhookDelivery, type WebhookEndpoint } from "@/lib/mock/automation";
import { submitWebhookCreate, submitWebhookRedeliver, submitWebhookTest } from "@/lib/api/automation";
import { formatRelative } from "@/lib/format";

/**
 * UX-AUTO-004 /automation/webhooks — endpoints, signing secrets (shown once)
 * and delivery retries. The event picker uses the §5.4 outbound taxonomy.
 */
export default function WebhooksPage() {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const endpoints = useFixture(() => webhookEndpoints);
  const deliveries = useFixture(() => webhookDeliveries);
  const [created, setCreated] = useState<WebhookEndpoint | null>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleEvent = (ev: string) =>
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));

  const create = () => {
    const clean = url.trim();
    if (!/^https:\/\/.+/.test(clean)) {
      setError("Deliveries are HTTPS-only — enter an https:// URL (SSRF/egress checks run on the server).");
      return;
    }
    if (events.length === 0) {
      setError("Subscribe to at least one event from the taxonomy.");
      return;
    }
    const op = submitWebhookCreate(clean, events);
    setFocusedId(op.id);
    setTrayOpen(true);
    setCreated({
      id: op.id,
      url: clean,
      events,
      state: "active",
      secret_masked: "whsec_01JNEW••••••••",
      created_at: new Date().toISOString(),
      last_delivery_at: null,
    });
    push("success", "Webhook submitted", "The signing secret is shown once — copy it now.");
    setOpen(false);
    setUrl("");
    setEvents([]);
    setError(null);
  };

  const redeliver = (d: { id: string; event_type: string }) => {
    const op = submitWebhookRedeliver(d.id);
    setFocusedId(op.id);
    setTrayOpen(true);
    push("info", "Redeliver requested", `${d.event_type} — a governed replay creates a new attempt.`);
  };

  const test = (w: WebhookEndpoint) => {
    const op = submitWebhookTest(w.url);
    setFocusedId(op.id);
    setTrayOpen(true);
    push("info", "Test delivery queued", "A signed ping event is on its way.");
  };

  return (
    <Screen
      id="UX-AUTO-004"
      breadcrumbs={[{ label: "Automation", href: "/automation" }, { label: "Webhooks" }]}
      actions={
        <Button icon="plus" onClick={() => setOpen(true)}>
          Create webhook
        </Button>
      }
    >
      {endpoints === null ? (
        <SkeletonTable rows={2} cols={4} />
      ) : endpoints.length === 0 && created === null ? (
        <Callout tone="info" title="No webhooks yet">
          Webhooks push panel events (payments, deployments, backups) to your systems over
          HTTPS with an HMAC signature.
        </Callout>
      ) : (
        <div className="flex flex-col gap-4">
          {[...(endpoints ?? []), ...(created !== null ? [created] : [])].map((w) => (
            <TableCard<WebhookDelivery>
              key={w.id}
              title={w.url}
              caption={`Webhook ${w.id}`}
              rowKey={(d) => d.id}
              rows={(deliveries ?? []).filter((d) => d.webhook_id === w.id)}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={w.state === "active" ? "active" : "cancelled"} />
                  <Button variant="secondary" size="sm" icon="zap" onClick={() => test(w)}>
                    Send test
                  </Button>
                  <Button variant="ghost" size="sm" icon="key">
                    Rotate secret
                  </Button>
                </div>
              }
              columns={[
                { key: "event_type", header: "Event", render: (d) => <span className="font-mono text-xs">{d.event_type}</span>, className: "sticky left-0 bg-surface" },
                { key: "attempt", header: "Attempt" },
                { key: "status_code", header: "Status", render: (d) => (d.status_code !== null ? String(d.status_code) : "—") },
                { key: "status", header: "Delivery", render: (d) => <StatusPill status={d.status === "delivered" ? "succeeded" : d.status === "failed" ? "failed" : "pending"} /> },
                { key: "last_attempt_at", header: "Last attempt", render: (d) => formatRelative(d.last_attempt_at, now) },
                { key: "detail", header: "Detail" },
                {
                  key: "actions",
                  header: "",
                  render: (d) => (
                    <Button variant="secondary" size="sm" icon="refresh" onClick={() => redeliver(d)}>
                      Redeliver
                    </Button>
                  ),
                },
              ]}
            />
          ))}
        </div>
      )}

      <Callout tone="info" className="mt-4" title="Signature + retries">
        Deliveries are signed with HMAC over timestamp + raw payload; retries use exponential
        backoff with jitter and dead-letter after 4 attempts. Replay is governed — every
        redelivery is audited.
      </Callout>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create webhook"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create}>Create webhook</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Endpoint URL" htmlFor="wh-url" required hint="HTTPS only. The server runs SSRF/egress checks before first delivery.">
            <Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.your-system.example/nexus" className="font-mono" />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Subscribe to events (§5.4 taxonomy)</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EVENT_TAXONOMY.map((group) => (
                <div key={group.group} className="rounded-control border border-line p-3">
                  <p className="mb-1.5 text-xs font-semibold text-ink-2">{group.group}</p>
                  <div className="flex flex-col gap-1.5">
                    {group.events.map((ev) => (
                      <Checkbox
                        key={ev}
                        label={<span className="font-mono text-xs">{ev}</span>}
                        checked={events.includes(ev)}
                        onChange={() => toggleEvent(ev)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
          {events.length > 0 && (
            <p className="text-xs text-ink-3">
              {events.length} event{events.length === 1 ? "" : "s"} selected: {events.join(", ")}
            </p>
          )}
          {error !== null && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </Modal>

      {created !== null && (
        <Modal open onClose={() => setCreated(null)} title="Signing secret — shown once" description="Store it now; it is never displayed again.">
          <SecretField label={`whsec for ${created.url}`} value="whsec_01JNEW9xTq4Lm2Vb8Hs5Wd1Kp0Zr7Yc3Fj6Ng2QvXt" />
          <div className="mt-4 flex flex-wrap gap-2">
            {created.events.map((ev) => (
              <Chip key={ev} tone="accent">
                {ev}
              </Chip>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Verify the <span className="font-mono">X-Nexus-Signature</span> header (HMAC-SHA256 over
            timestamp + body, 5-minute replay window) before trusting any payload.
          </p>
        </Modal>
      )}
    </Screen>
  );
}
