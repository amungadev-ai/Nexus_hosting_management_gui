"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { ImpactReview } from "@/components/ui/overlay";
import { DataTable } from "@/components/ui/table";
import { Checkbox, Field, Select } from "@/components/ui/form";
import { Chip } from "@/components/ui/badge";
import { useToast, useOperationStream } from "@/components/providers";
import { SiteSelect, useContainerized } from "@/components/files/site-scope";
import { bulkOperation } from "@/lib/api/files";
import { displayPath, findNode, siteById, type FileNode } from "@/lib/mock/files";

/**
 * UX-FILE-004 — Bulk file operations: multi-select archive/move/delete with
 * impact review, then a single 202 + files.write operation.
 */
export default function BulkFileOperationsPage() {
  return (
    <Screen id="UX-FILE-004" breadcrumbs={[{ label: "Files", href: "/files" }, { label: "Bulk operations" }]}>
      <BulkBody />
    </Screen>
  );
}

function BulkBody() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const containerized = useContainerized();
  const [siteId, setSiteId] = useState("web_01JKILI02");
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<"archive" | "delete" | "move">("delete");
  const [destination, setDestination] = useState("wp-content/uploads/2026/10");
  const [reviewOpen, setReviewOpen] = useState(false);

  const site = siteById(siteId);
  const targets: FileNode[] = useMemo(() => {
    if (!site) return [];
    const out: FileNode[] = [];
    const walk = (nodes: FileNode[], trail: string[]) => {
      for (const n of nodes) {
        if (n.type === "file" && n.size_bytes !== null && n.size_bytes > 50000) out.push(n);
        if (n.type === "directory") walk(n.children ?? [], [...trail, n.name]);
      }
    };
    walk(site.children, []);
    return out;
  }, [site]);

  const toggle = (name: string, on: boolean) =>
    setSelected((prev) => (on ? [...prev, name] : prev.filter((n) => n !== name)));

  const submit = () => {
    bulkOperation(siteId, action, selected, action === "move" ? destination : undefined)
      .then((op) => {
        push("success", "Bulk operation submitted", `Operation ${op.id} — per-item results appear in the job timeline.`);
        setFocusedId(op.id);
        setTrayOpen(true);
        setSelected([]);
        setReviewOpen(false);
      })
      .catch(() => push("error", "Bulk operation failed", "The operation could not be queued."));
  };

  if (!site) return <EmptyState title="No website scope" body="Pick a website in the file manager first." action={{ label: "Open file manager", href: "/files" }} />;

  return (
    <div className="flex flex-col gap-4">
      <Callout tone="info" title="Scope">
        Bulk operations are validated per item; the job reports per-item outcomes (DS-011 partial success).
        Shown candidates: files larger than 50 KB under {displayPath(site, [], containerized)}.
      </Callout>
      <SiteSelect value={siteId} onChange={(v) => { setSiteId(v); setSelected([]); }} />
      <DataTable
        caption="Bulk operation candidates"
        rows={targets}
        rowKey={(r) => r.name}
        columns={[
          {
            key: "select",
            header: "Select",
            render: (row: FileNode) => (
              <Checkbox checked={selected.includes(row.name)} onChange={(on) => toggle(row.name, on)} label={<span className="sr-only">Select {row.name}</span>} />
            ),
          },
          { key: "name", header: "Name" },
          { key: "size_bytes", header: "Size", render: (r: FileNode) => `${Math.round((r.size_bytes ?? 0) / 1024)} KB` },
          { key: "mime", header: "Type", render: (r: FileNode) => r.mime ?? "—" },
        ]}
        emptyState={<EmptyState title="No candidates" body="No files above the 50 KB threshold in this site tree." />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Operation" htmlFor="bulk-action" required>
          <Select id="bulk-action" value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
            <option value="delete">Delete (24h trash snapshot)</option>
            <option value="archive">Archive (.tar.gz into /backups)</option>
            <option value="move">Move to another folder</option>
          </Select>
        </Field>
        {action === "move" && (
          <Field label="Destination folder" htmlFor="bulk-dest" required>
            <Select id="bulk-dest" value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="wp-content/uploads/2026/10">wp-content/uploads/2026/10</option>
              <option value="wp-content/uploads/2026/11">wp-content/uploads/2026/11</option>
            </Select>
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={selected.length === 0} onClick={() => setReviewOpen(true)}>
          Review impact ({selected.length})
        </Button>
        <Chip tone={action === "delete" ? "danger" : "neutral"}>{selected.length} selected</Chip>
      </div>

      <ImpactReview
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={submit}
        title={`Review: ${action} ${selected.length} items in ${site.label}`}
        submitLabel={`Submit ${action} job`}
        impact={{
          before: selected.map((n) => `${n}: present`).join("\n") || "(nothing selected)",
          after:
            action === "delete"
              ? selected.map((n) => `${n}: removed (24h trash snapshot)`).join("\n")
              : action === "archive"
                ? selected.map((n) => `${n}: archived into /backups`).join("\n")
                : selected.map((n) => `${n}: moved to ${destination}`).join("\n"),
          affectedResources: selected,
          downtimeEstimate: "None — file operations do not restart the runtime",
          reversibility: action === "archive" ? "Fully reversible — extract the archive" : "Reversible within 24h from the trash snapshot",
        }}
      >
        {action === "delete" && (
          <p>
            Deletion keeps a 24-hour trash snapshot. After that window the space is reclaimed permanently —
            restore points from the nightly backup remain available via Backups.
          </p>
        )}
      </ImpactReview>
    </div>
  );
}
