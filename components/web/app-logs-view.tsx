"use client";

import React, { useMemo } from "react";
import { Screen } from "@/components/common/screen";
import { NotFoundInline } from "@/components/common/states";
import { useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { LogViewer } from "@/components/ui/code";
import { appLogLines } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";

/** UX-WEB-016 — Application logs: structured logs with filter and redaction (DS-014). */
export function AppLogsView({ appId }: { appId: string }) {
  const app = useMemo(() => db.applications.find((a) => a.id === appId), [appId]);
  const { push } = useToast();

  if (app === undefined) {
    return (
      <Screen id="UX-WEB-016" breadcrumbs={[{ label: "Applications", href: "/apps" }]}>
        <NotFoundInline what="application" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Applications", href: "/apps" },
    { label: app.name, href: `/apps/${app.id}` },
    { label: "Logs" },
  ];

  return (
    <Screen
      id="UX-WEB-016"
      breadcrumbs={crumbs}
      actions={
        <Button
          variant="secondary"
          icon="refresh"
          onClick={() => push("info", "Stream reconnected", "The log stream re-attached from the last event ID — no lines were missed or duplicated.")}
        >
          Reconnect stream
        </Button>
      }
    >
      <Callout tone="info" title="Redaction is enforced at source">
        Secret values (DATABASE_URL, MPESA_CONSUMER_SECRET, tokens) are replaced with{" "}
        <span className="font-mono text-xs">[redacted]</span> before logs leave the server — the UI never sees
        them, so nothing sensitive can leak through copy or export.
      </Callout>

      <LogViewer lines={appLogLines} live className="mt-4" />

      <Card title="Streaming & disconnection" className="mt-4">
        <p className="text-sm text-ink-2">
          The stream is labelled: when the agent disconnects, the viewer shows the last update time instead of
          pretending to be live, and reconnects resume from the last event ID (no infinite silent retries).
        </p>
      </Card>
    </Screen>
  );
}
