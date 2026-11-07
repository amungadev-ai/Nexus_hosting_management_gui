"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { ImpactReview } from "@/components/ui/overlay";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { useToast, useOperationStream, useNow } from "@/components/providers";
import { applyPermissions } from "@/lib/api/files";
import { fileSites, findNode, type FileNode } from "@/lib/mock/files";
import { formatRelative } from "@/lib/format";
import { SiteSelect, useContainerized } from "@/components/files/site-scope";

/** UX-FILE-006 — File permissions: ownership, mode preview, security impact. */
export default function FilePermissionsPage() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const now = useNow();
  const containerized = useContainerized();
  const [siteId, setSiteId] = useState("web_01JKILI02");
  const [draftModes, setDraftModes] = useState<Record<string, string>>({});
  const [reviewOpen, setReviewOpen] = useState(false);

  const site = fileSites.find((s) => s.site_id === siteId);

  const entries = useMemo(() => {
    const out: { node: FileNode; trail: string[] }[] = [];
    const walk = (nodes: FileNode[], trail: string[]) => {
      for (const n of nodes) {
        out.push({ node: n, trail: [...trail, n.name] });
        if (n.type === "directory") walk(n.children ?? [], [...trail, n.name]);
      }
    };
    if (site) walk(site.children, []);
    return out;
  }, [site]);

  const worldWritable = entries.filter((e) => (draftModes[e.trail.join("/")] ?? e.node.mode).endsWith("7") || (draftModes[e.trail.join("/")] ?? e.node.mode).endsWith("2"));

  const pending = entries
    .filter((e) => draftModes[e.trail.join("/")] !== undefined && draftModes[e.trail.join("/")] !== e.node.mode)
    .map((e) => ({ parts: e.trail, mode: draftModes[e.trail.join("/")] }));

  const apply = () => {
    applyPermissions(siteId, pending)
      .then((op) => {
        push("success", "Permissions job submitted", `Operation ${op.id} — modes are re-read and verified after apply.`);
        setFocusedId(op.id);
        setTrayOpen(true);
        setDraftModes({});
        setReviewOpen(false);
      })
      .catch(() => push("error", "Apply failed", "The permission change could not be queued."));
  };

  return (
    <Screen
      id="UX-FILE-006"
      breadcrumbs={[{ label: "Files", href: "/files" }, { label: "Permissions" }]}
      actions={
        <Button disabled={pending.length === 0} onClick={() => setReviewOpen(true)}>
          Apply changes ({pending.length})
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <SiteSelect value={siteId} onChange={(v) => { setSiteId(v); setDraftModes({}); }} />
        {worldWritable.length > 0 && (
          <Callout tone="warning" title={`${worldWritable.length} world-writable entr${worldWritable.length === 1 ? "y" : "ies"} detected`}>
            World-writable files or folders (group/other write bits) let any process on the server modify the
            site. The uploads folder ships 0777 by default on some stacks — 0775 or 0755 is the safe choice.
          </Callout>
        )}
        <Callout tone="info">
          Modes preview before apply. Dangerous changes (world-writable, setuid, chown to root) are held for
          impact review — the agent refuses unsafe chown/chmod on the site root (FLOW-007 step 10).
          Paths are {containerized ? "container paths (/app/…)" : "document-root paths"}.
        </Callout>
        <DataTable
          caption="Ownership and modes"
          rows={entries}
          rowKey={(e) => e.trail.join("/")}
          columns={[
            { key: "name", header: "Entry", render: (e: { node: FileNode; trail: string[] }) => <span className="break-all font-mono text-xs">/{e.trail.join("/")}</span> },
            { key: "owner", header: "Owner", render: (e: { node: FileNode }) => `${e.node.owner}:${e.node.group}` },
            {
              key: "mode",
              header: "Mode",
              render: (e: { node: FileNode; trail: string[] }) => {
                const key = e.trail.join("/");
                const draft = draftModes[key];
                return (
                  <Select
                    aria-label={`Mode for ${e.node.name}`}
                    value={draft ?? e.node.mode}
                    onChange={(ev) => setDraftModes((prev) => ({ ...prev, [key]: ev.target.value }))}
                    className="w-28"
                  >
                    <option value="0755">0755 dir-safe</option>
                    <option value="0775">0775 group-write</option>
                    <option value="0777">0777 world-writable</option>
                    <option value="0644">0644 file-safe</option>
                    <option value="0664">0664 group-write</option>
                    <option value="0640">0640 owner+group</option>
                    <option value="0600">0600 private</option>
                  </Select>
                );
              },
            },
            { key: "modified_at", header: "Modified", render: (e: { node: FileNode }) => formatRelative(e.node.modified_at, now) },
            {
              key: "flags",
              header: "Flags",
              render: (e: { node: FileNode; trail: string[] }) => {
                const mode = draftModes[e.trail.join("/")] ?? e.node.mode;
                const flags: React.ReactNode[] = [];
                if (mode.endsWith("7") || mode.endsWith("2")) flags.push(<Chip key="ww" tone="warning">world-writable</Chip>);
                if (e.node.owner === "root" && e.node.type === "file") flags.push(<Chip key="root" tone="neutral">root-owned</Chip>);
                return flags.length > 0 ? <span className="flex flex-wrap gap-1">{flags}</span> : "—";
              },
            },
          ]}
        />
      </div>

      <ImpactReview
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={apply}
        title={`Review: chmod on ${pending.length} entries`}
        submitLabel="Apply permissions"
        impact={{
          before: pending.map((p) => `/${p.parts.join("/")}`).join("\n"),
          after: pending.map((p) => `${p.parts[p.parts.length - 1]} → ${p.mode}`).join("\n"),
          affectedResources: pending.map((p) => p.parts[p.parts.length - 1]),
          downtimeEstimate: "None — modes change without a restart",
          reversibility: "Reversible — previous modes are in the audit trail and the trash snapshot",
        }}
      >
        {pending.some((p) => p.mode === "0777") && (
          <p className="font-medium text-warning">
            You are making at least one entry world-writable. Any process on this VPS will be able to change it.
          </p>
        )}
      </ImpactReview>
    </Screen>
  );
}
