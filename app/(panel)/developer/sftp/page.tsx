"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { CopyButton, SecretField } from "@/components/ui/code";
import { KeyValue } from "@/components/ui/misc";
import { useToast } from "@/components/providers";
import { resetSftpPassword, sftpFor } from "@/lib/api/files";
import { requestStepUp } from "@/lib/api/me";
import { siteById } from "@/lib/mock/files";
import { formatBytes } from "@/lib/format";
import { SiteSelect } from "@/components/files/site-scope";

/** UX-FILE-011 — SFTP setup: the primary file-transfer path on Nano. */
export default function SftpPage() {
  const { push } = useToast();
  const [siteId, setSiteId] = useState("web_01JKILI02");
  const [resetOpen, setResetOpen] = useState(false);
  const cred = sftpFor(siteId);
  const site = siteById(siteId);
  const [password, setPassword] = useState(cred.password_once);

  return (
    <Screen
      id="UX-FILE-011"
      breadcrumbs={[{ label: "Developer", href: "/developer/access" }, { label: "SFTP" }]}
      description="Panel-managed SFTP endpoint, per-site credentials and key upload — the primary file-transfer path on Nano."
      actions={<Button variant="secondary" icon="refresh" onClick={() => setResetOpen(true)}>Reset password</Button>}
    >
      <div className="flex flex-col gap-4">
        <SiteSelect value={siteId} onChange={setSiteId} label="Website credentials" />
        <Card title="Connection details">
          <div className="flex flex-col gap-4">
            <KeyValue
              columns={2}
              items={[
                { label: "Host", value: cred.host, mono: true },
                { label: "Port", value: String(cred.port), mono: true },
                { label: "Username", value: cred.username, mono: true },
                { label: "Per-file size limit", value: formatBytes(cred.max_upload_bytes) },
              ]}
            />
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={`${cred.username}@${cred.host}:${cred.port}`} label="Copy connection string" />
              <ButtonLink href="/developer/access" variant="secondary" size="sm" icon="key">
                Manage keys instead
              </ButtonLink>
              <ButtonLink href="/files" variant="ghost" size="sm" icon="folder">
                Open file manager
              </ButtonLink>
            </div>
            <SecretField
              label="SFTP password (one-time reveal)"
              value={password}
              className="max-w-xl"
            />
            <p className="text-xs text-ink-3">
              After you hide it once, the panel cannot show the password again — use “Reset password” (it is a
              verified job on the agent, and step-up is required). Keys are preferred: add one under Developer
              access.
            </p>
          </div>
        </Card>
        <Callout tone="info" title="Suggested client settings">
          {site === undefined ? "" : `Site ${site.label} — `}SFTP over port 22, then browse to the site root
          shown in the file manager. File names and byte counts match the manager exactly; both read from the
          same permitted root, with no traversal outside it.
        </Callout>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          requestStepUp("sftp.password.reset", siteId)
            .then(() => resetSftpPassword(siteId))
            .then((op) => {
              const next = sftpFor(siteId);
              setPassword(next.password_once);
              push("success", "Password reset submitted", `Operation ${op.id} — the new secret replaces the old one once it verifies.`);
            })
            .catch(() => push("error", "Reset failed", "Step-up verification or the agent job did not complete."));
        }}
        title="Reset the SFTP password"
        confirmLabel="Reset password"
        body="Active SFTP sessions for this site are disconnected and the current password stops working. Step-up verification is required. The new secret is shown once, here."
      />
    </Screen>
  );
}
