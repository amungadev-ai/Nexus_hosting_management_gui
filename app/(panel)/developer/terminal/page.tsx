"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { CodeBlock, CopyButton } from "@/components/ui/code";
import { UnavailableState, LiveStatusLine } from "@/components/common/states";
import { useCapability, useSession, useToast } from "@/components/providers";
import { openTerminalSession, type TerminalSession } from "@/lib/api/files";
import { db } from "@/lib/mock/data";

const SESSION_SCRIPT = `$ nexus-agent exec --scope kili-shop --audited
kili-shop:/app$ wp plugin list --status=active --field=name
woocommerce
woo-mpesa
wp-rocket
kili-shop:/app$ wp cache flush
Success: Database flushed.
kili-shop:/app$ df -h /app
Filesystem      Size  Used Avail Use% Mounted on
overlay          100G   41G   59G  41% /app
kili-shop:/app$ exit
— session closed, 4 commands audited (term_01J…)`;

/** UX-FILE-008 + UX-FILE-010 — Web terminal, incl. the honest Nano/Starter
 * unavailable state sharing this route (terminal.exec capability). */
export default function WebTerminalPage() {
  const term = useCapability("terminal.exec");
  const { persona } = useSession();
  const { push } = useToast();
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [opening, setOpening] = useState(false);

  if (term.state === "unavailable") {
    return (
      <Screen
        id="UX-FILE-008"
        breadcrumbs={[{ label: "Developer", href: "/developer/access" }, { label: "Web terminal" }]}
      >
        <div className="flex flex-col gap-4">
          {/* UX-FILE-010 (state) — honest Nano state on the shared route. */}
          <UnavailableState capabilityKey="terminal.exec">
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/developer/sftp" variant="secondary" icon="upload">
                View SFTP details
              </ButtonLink>
            </div>
          </UnavailableState>
          <Callout tone="info" title="What works instead">
            SFTP covers file transfer on every profile, and the code editor covers quick text edits — most
            terminal tasks have a safer, audited equivalent.
          </Callout>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      id="UX-FILE-008"
      breadcrumbs={[{ label: "Developer", href: "/developer/access" }, { label: "Web terminal" }]}
      description="Session warning, scope, audit and inactivity timeout."
      actions={
        session === null ? (
          <Button
            icon="terminal"
            loading={opening}
            onClick={() => {
              setOpening(true);
              openTerminalSession()
                .then(setSession)
                .then(() => push("info", "Session opened", "Every command is audited. The session closes after 30 minutes idle."))
                .finally(() => setOpening(false));
            }}
          >
            Open session
          </Button>
        ) : (
          <Button
            variant="destructive"
            icon="power"
            onClick={() => {
              setSession(null);
              push("info", "Session closed", "The audit record keeps the commands that ran.");
            }}
          >
            Close session
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {persona === "storage_user" && (
          <Callout tone="warning" title="Disabled by default for customer roles">
            Terminal access for customer accounts is off until an owner explicitly enables it (NP-FILE-013).
            This demo user is an owner, so the surface is available.
          </Callout>
        )}
        <Card title="Before you open a session">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>
              Scope: one site container ({db.websites[1]?.name ?? "kili-shop"}), <span className="font-mono">files.write</span> —
              not a root shell on the host.
            </li>
            <li>Every command is written to the audit trail with the correlation ID.</li>
            <li>The session ends after 30 minutes of inactivity, or when you close it.</li>
            <li>Opening a session is itself an audited event visible in Activity.</li>
          </ul>
          <LiveStatusLine at={db.server.last_seen_at} label="Server agent" />
        </Card>

        {session === null ? (
          <Callout tone="info" title="No active session">
            Open a session to see the embedded terminal. Nothing runs until you do.
          </Callout>
        ) : (
          <>
            <div className="rounded-card border border-line bg-[#0b1020] p-1">
              <CodeBlock
                code={SESSION_SCRIPT}
                className="bg-[#0b1020] text-[#f3f6fc] [&_code]:text-[#d7e2f5]"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-3">
                Session <span className="font-mono">{session.session_id}</span> · scope {session.scope} · expires{" "}
                {new Date(session.expires_at).toLocaleTimeString()}
              </p>
              <CopyButton text={SESSION_SCRIPT} label="Copy transcript" />
            </div>
            <Callout tone="warning" title="Prototype — no live shell">
              This transcript is a scripted demo. The real terminal streams over the agent&apos;s Unix socket and
              is never exposed directly to the browser; input is typed through the same audited action catalog
              as every other mutation.
            </Callout>
          </>
        )}
      </div>
    </Screen>
  );
}
