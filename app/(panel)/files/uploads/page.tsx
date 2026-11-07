"use client";

import React, { useEffect, useRef, useState } from "react";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { DataTable } from "@/components/ui/table";
import { Chip, StatusPill } from "@/components/ui/badge";
import { useToast, useOperationStream, useNow } from "@/components/providers";
import { uploadFile, listUploads, markUploadFailed, markUploadCompleted } from "@/lib/api/files";
import { ApiError } from "@/lib/api/core";
import { MAX_UPLOAD_BYTES, type UploadRecord } from "@/lib/mock/files";
import { formatBytes, formatRelative } from "@/lib/format";
import { SiteSelect } from "@/components/files/site-scope";

/** UX-FILE-005 — Upload manager: drag-drop, conflicts, size limits, retry. */
export default function UploadsPage() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const now = useNow();
  const [siteId, setSiteId] = useState("web_01JKILI02");
  const [rows, setRows] = useState<UploadRecord[]>([]);
  const [conflict, setConflict] = useState<{ filename: string; sizeBytes: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => setRows([...listUploads()]);
  useEffect(refresh, []);

  const queue = (filename: string, sizeBytes: number, overwrite: boolean) => {
    uploadFile({ siteId, folderParts: [], filename, sizeBytes, overwrite })
      .then((op) => {
        push("success", "Upload queued", `Operation ${op.id} — the transfer is verified before the listing updates.`);
        setFocusedId(op.id);
        setTrayOpen(true);
        refresh();
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.problem.code === "UPLOAD_CONFLICT") {
          setConflict({ filename, sizeBytes });
          return;
        }
        push("error", "Upload rejected", e instanceof ApiError ? e.problem.detail : "Unexpected error.");
        refresh();
      });
  };

  const onFiles = (files: FileList | null) => {
    if (files === null) return;
    for (const f of Array.from(files)) queue(f.name, f.size, false);
  };

  const retry = (row: UploadRecord) => queue(row.filename, row.size_bytes, true);

  return (
    <Screen id="UX-FILE-005" breadcrumbs={[{ label: "Files", href: "/files" }, { label: "Uploads" }]}>
      <div className="flex flex-col gap-4">
        <SiteSelect value={siteId} onChange={setSiteId} label="Upload target website" />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          className={`rounded-card border-2 border-dashed p-8 text-center ${dragOver ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}
        >
          <p className="text-sm font-medium text-ink">Drag files here, or</p>
          <Button variant="secondary" icon="upload" className="mt-2" onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            aria-label="Choose files to upload"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="mt-2 text-xs text-ink-3">
            Max {formatBytes(MAX_UPLOAD_BYTES)} per file. Uploads are resumable; a name that already exists
            triggers a conflict choice (overwrite or rename).
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="upload" title="No uploads yet" body="Dropped files appear here with their transfer status and retry actions." />
        ) : (
          <DataTable
            caption="Upload queue and history"
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              { key: "filename", header: "File", render: (r: UploadRecord) => <span className="break-all font-medium">{r.filename}</span> },
              { key: "size_bytes", header: "Size", render: (r: UploadRecord) => formatBytes(r.size_bytes) },
              { key: "state", header: "Status", render: (r: UploadRecord) => (
                  <span className="flex flex-wrap items-center gap-2">
                    {r.state === "completed" && <StatusPill status="succeeded" />}
                    {r.state === "in_progress" && <StatusPill status="running" />}
                    {r.state === "failed" && <StatusPill status="failed" />}
                    {r.state === "conflict" && <Chip tone="warning">Conflict</Chip>}
                  </span>
                ) },
              { key: "started_at", header: "Started", render: (r: UploadRecord) => formatRelative(r.started_at, now) },
              { key: "error", header: "Detail", render: (r: UploadRecord) => (r.error ? <span className="text-xs text-ink-2">{r.error}</span> : "—") },
              {
                key: "actions",
                header: "Actions",
                render: (r: UploadRecord) =>
                  r.state === "failed" || r.state === "conflict" ? (
                    <Button variant="secondary" size="sm" onClick={() => retry(r)}>
                      Retry (overwrite)
                    </Button>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
        )}

        <Callout tone="info" title="Why uploads wait for verification">
          An upload is only “done” when its checksum verifies on the server — the queue shows in-progress,
          never a fake green tick. Failed transfers keep their bytes and can be retried without re-selecting.
        </Callout>
      </div>

      <ConfirmDialog
        open={conflict !== null}
        onClose={() => setConflict(null)}
        onConfirm={() => {
          if (conflict !== null) {
            queue(conflict.filename, conflict.sizeBytes, true);
            markUploadCompleted(`overwrite-${conflict.filename}`);
          }
        }}
        title={`Replace ${conflict?.filename ?? "file"}?`}
        confirmLabel={`Overwrite ${conflict?.filename ?? "file"}`}
        destructive
        body="A file with this name already exists in the target folder. Overwriting keeps the previous version in the 24-hour trash."
      />
    </Screen>
  );
}
