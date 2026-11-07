"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { CodeBlock } from "@/components/ui/code";
import { Field, Select } from "@/components/ui/form";

/**
 * UX-AUTO-005 /developer/api — versioned endpoints, examples and scopes.
 * "Try safe requests" replays canned GET responses; mutations always link to
 * tokens/operations instead of executing from the explorer.
 */
const ENDPOINTS: { method: string; path: string; scope: string; sample: string }[] = [
  {
    method: "GET",
    path: "/api/v1/operations?workload_category=batch",
    scope: "server.read",
    sample: `{"data":[{"id":"op_01BEXAMPLE","kind":"backup.create","workload_category":"batch","status":"queued","queue_position":3}],"page":{"next_cursor":null}}`,
  },
  {
    method: "GET",
    path: "/api/v1/metrics/resources/{id}",
    scope: "workload.usage.read",
    sample: `{"allocated":{"ram_max_bytes":536870912,"cpu_weight":100},"current":{"ram_bytes":268435456,"cpu_percent":8.1},"typical_7d":{"ram_bytes":322122547},"peak_24h":{"ram_bytes":503316480},"throttled_seconds_24h":0,"oom_kills_7d":0}`,
  },
  {
    method: "GET",
    path: "/api/v1/audit-logs",
    scope: "audit.read",
    sample: `{"data":[{"id":"aud_01EXAMPLE","action":"website.publish","outcome":"success","occurred_at":"2026-11-06T15:00:00Z","previous_hash":"sha256:0ab1…","record_hash":"sha256:1bc2…"}]}`,
  },
  {
    method: "POST",
    path: "/api/v1/backups",
    scope: "backup.restore",
    sample: `202 Accepted → {"data":{"operation_id":"op_01BEXAMPLE","workload_category":"batch"}} — every mutation returns an operation, never instant state.`,
  },
];

export default function ApiExplorerPage() {
  const [selected, setSelected] = useState(0);
  const endpoint = ENDPOINTS[selected];
  const safe = endpoint.method === "GET";

  return (
    <Screen
      id="UX-AUTO-005"
      breadcrumbs={[{ label: "Developer" }, { label: "API explorer" }]}
      actions={
        <ButtonLink href="/settings/api-tokens" variant="secondary" icon="key">
          API tokens
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="Versioned namespace /api/v1">
          Stable machine-readable error codes, cursor pagination, idempotency keys on every
          mutation, and 202+operation responses for anything that changes state.
        </Callout>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Endpoints" description="Representative v1 endpoints and their scopes">
            <Field label="Pick an endpoint" htmlFor="api-endpoint">
              <Select id="api-endpoint" value={String(selected)} onChange={(e) => setSelected(Number(e.target.value))}>
                {ENDPOINTS.map((ep, i) => (
                  <option key={ep.path} value={String(i)}>
                    {ep.method} {ep.path}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip tone="accent">{endpoint.method}</Chip>
              <Chip tone="neutral">scope: {endpoint.scope}</Chip>
              {safe ? <Chip tone="success">safe to try</Chip> : <Chip tone="warning">mutation — returns 202 + operation</Chip>}
            </div>
          </Card>

          <Card
            title="Example response"
            description={safe ? "Live-shaped sample from the mock contract" : "Mutations never run from the explorer — use a token and idempotency key"}
            footer={
              safe ? (
                <ButtonLink
                  href="#"
                  variant="secondary"
                  size="sm"
                >
                  Try safe request
                </ButtonLink>
              ) : undefined
            }
          >
            <CodeBlock language="json" code={endpoint.sample} maxHeight={220} />
          </Card>
        </div>

        <Card title="Auth" description="How the SPA and your scripts authenticate">
          <ul className="flex list-none flex-col gap-1.5 p-0 text-sm text-ink-2">
            <li>• Browser sessions use HttpOnly cookies — no bearer tokens in localStorage.</li>
            <li>• API/service tokens are hashed at rest, scoped to named capabilities, expiring, secret shown once at creation.</li>
            <li>• Every mutation accepts an Idempotency-Key; retries are safe.</li>
            <li>• Step-up MFA binds to action + resource for sensitive endpoints (firewall, suspension, payment reversal).</li>
          </ul>
        </Card>
      </div>
    </Screen>
  );
}
