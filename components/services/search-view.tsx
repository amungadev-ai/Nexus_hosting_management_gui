"use client";

import React, { useState } from "react";
import { findServiceInstance, templateForKey, SEARCH_INDEXES } from "@/lib/mock/services";
import { useCapability, useOperationStream, useToast } from "@/components/providers";
import { restartService, stopService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/core";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine, NotFoundInline, PendingState } from "@/components/common/states";
import { AllocationStrip } from "@/components/common/allocation-strip";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { CopyButton } from "@/components/ui/code";
import { KeyValue } from "@/components/ui/misc";
import { formatMb } from "@/lib/format";
import type { Operation, ServiceInstance } from "@/lib/types";
import type { SearchIndexStat } from "@/lib/mock/services";

/** UX-SVC-009 — Search instance (Meilisearch): index size, docs, connection. */
export default function SearchView({ instanceId }: { instanceId: string }) {
  const instance = findServiceInstance(instanceId);
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();
  const docker = useCapability("service.docker");
  const [pendingOp, setPendingOp] = useState<Operation | null>(null);

  if (instance === undefined || templateForKey(instance.template_key)?.category !== "search") {
    return (
      <Screen id="UX-SVC-009" breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: "Search" }]}>
        <NotFoundInline what="search instance" />
      </Screen>
    );
  }

  const run = async (action: (i: ServiceInstance) => Promise<{ data: { operation: Operation } }>, done: string) => {
    try {
      const res = await action(instance);
      setPendingOp(res.data.operation);
      push("success", done, "Submitted as a verified job.");
      setTrayOpen(true);
    } catch (e) {
      push("error", "Action failed", e instanceof ApiError ? e.problem.detail : "Try again or contact support.");
    }
  };

  const columns: DataTableColumn<SearchIndexStat>[] = [
    { key: "index", header: "Index", render: (r) => <span className="font-mono text-xs">{r.index}</span> },
    { key: "documents", header: "Documents", render: (r) => <span className="tabular-nums">{r.documents.toLocaleString()}</span> },
    { key: "size_mb", header: "Size", render: (r) => <span className="tabular-nums">{formatMb(r.size_mb)}</span> },
  ];

  return (
    <Screen
      id="UX-SVC-009"
      breadcrumbs={[{ label: "Platform services", href: "/services" }, { label: instance.name }]}
      actions={
        <>
          <Button icon="refresh" onClick={() => void run(restartService, "Restart submitted")} disabled={docker.state === "unavailable"}>
            Restart
          </Button>
          <Button variant="secondary" icon="power" onClick={() => void run(stopService, "Stop submitted")} disabled={docker.state === "unavailable"}>
            Stop
          </Button>
          <ButtonLink href="/settings/templates/transfer" variant="ghost">
            Export
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">Meilisearch {instance.version}</Chip>
          <Chip tone="neutral">{instance.exposure}</Chip>
          <span className="font-mono text-xs text-ink-2">{instance.hostname}</span>
          <LiveStatusLine at={instance.usage.updated_at} label="Search health" />
        </div>

        <AllocationStrip usage={instance.usage} />

        <DataTable
          caption="Indexes"
          columns={columns}
          rows={SEARCH_INDEXES}
          rowKey={(r) => r.index}
          emptyState={<Callout tone="info">No indexes yet — create one via the Meilisearch API once a site is attached.</Callout>}
        />

        <Card title="Connection details">
          <KeyValue
            items={[
              { label: "Host", value: <span className="flex items-center gap-2"><span>{instance.hostname}</span><CopyButton text={instance.hostname ?? ""} /></span>, mono: true },
              { label: "Port", value: "7700", mono: true },
              { label: "API key", value: "search key scoped per index — master key never leaves the server", mono: false },
            ]}
          />
        </Card>

        {pendingOp !== null && <PendingState operation={pendingOp} />}

        <Callout tone="info" title="Restarting search">
          A restart briefly interrupts indexing; search queries fail over to no-results rather than errors. The
          job verifies the health endpoint before it reports success.
        </Callout>
      </div>
    </Screen>
  );
}
