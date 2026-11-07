"use client";

import React, { useMemo, useState } from "react";
import { dataExports } from "@/lib/mock/support";
import { exportAccountData, importDataArchive } from "@/lib/api/support";
import { isTerminal } from "@/lib/operations";
import { formatGb } from "@/lib/format";
import { useOperationStream, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { Field, Textarea } from "@/components/ui/form";
import { Callout, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/code";
import { DataExportStatePill, ExportFreshnessLine, useFixture } from "@/components/support/shared";

/**
 * UX-SUP-004 /settings/data-transfer — import/export center. Export requests
 * submit a redacted data.export batch operation; past exports list from
 * fixtures with digests; the import side validates a pasted manifest before
 * submitting the data.import operation. Honest about what an export contains
 * — and what it never contains (secrets).
 */

export default function DataTransferPage() {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const [exportOpId, setExportOpId] = useState<string | null>(null);
  const [manifest, setManifest] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importOpId, setImportOpId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const rows = useFixture(() => [...dataExports]);

  const exportOperation = useMemo(
    () => (exportOpId === null ? undefined : list.find((o) => o.id === exportOpId)),
    [exportOpId, list]
  );
  const importOperation = useMemo(
    () => (importOpId === null ? undefined : list.find((o) => o.id === importOpId)),
    [importOpId, list]
  );

  const requestExport = () => {
    setExporting(true);
    try {
      const op = exportAccountData();
      setExportOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      push(
        "success",
        "Export requested (202)",
        "The archive is built as a batch job with secrets redacted. It appears below with its digest when it is ready."
      );
    } catch (e) {
      push("error", "Export failed", e instanceof Error ? e.message : "The export could not be requested.");
    } finally {
      setExporting(false);
    }
  };

  const submitImport = () => {
    setImportError(null);
    setImporting(true);
    try {
      const op = importDataArchive(manifest);
      setImportOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      setManifest("");
      push(
        "success",
        "Import accepted (202)",
        "The archive is checksum-verified and secret-scanned before anything is applied."
      );
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "The archive could not be imported.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Screen
      id="UX-SUP-004"
      breadcrumbs={[{ label: "Settings" }, { label: "Data transfer" }]}
      actions={
        <Button icon="download" onClick={requestExport} loading={exporting}>
          Request export
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="max-w-3xl text-sm text-ink-2">
          Config exports, redaction and access control. You own your data: request a
          machine-readable archive of this organization&apos;s configuration at any time, and import
          one back on this or another install.
        </p>

        {/* Export side */}
        <section aria-labelledby="export-section" className="flex flex-col gap-4">
          <h2 id="export-section" className="text-sm font-semibold text-ink">
            Export your data
          </h2>
          {exportOperation !== undefined && !isTerminal(exportOperation.status) && (
            <PendingState operation={exportOperation}>
              <p className="text-xs text-ink-2">
                Batch job — the archive is packaged when the server is idle and verified with a
                checksum before it is listed below.
              </p>
            </PendingState>
          )}
          <Callout tone="info" title="What an export contains — and what it never contains">
            Included: organization and member metadata, website and app configuration, DNS guidance
            records, backup policies, invoice history. Never included: passwords, API tokens, TLS
            private keys, M-Pesa credentials — those fields are replaced with
            <span className="font-mono"> [redacted] </span>
            before packaging, and the redaction pass is a step on the job itself.
          </Callout>

          {rows === null ? (
            <SkeletonTable rows={2} cols={4} />
          ) : (
            <DataTable
              caption="Past exports"
              rowKey={(e) => e.id}
              rows={rows}
              columns={[
                {
                  key: "scope_label",
                  header: "Scope",
                  className: "sticky left-0 bg-surface",
                  render: (e) => <span className="text-ink">{e.scope_label}</span>,
                },
                { key: "state", header: "Status", render: (e) => <DataExportStatePill state={e.state} /> },
                { key: "size_mb", header: "Size", render: (e) => formatGb(e.size_mb) },
                {
                  key: "digest",
                  header: "Integrity digest",
                  render: (e) => (
                    <span className="flex items-center gap-1.5">
                      <code className="break-all font-mono text-xs text-ink-3">{e.digest}</code>
                      {e.download_available && <CopyButton text={e.digest} label="Copy digest" />}
                    </span>
                  ),
                },
                {
                  key: "requested_at",
                  header: "Freshness",
                  render: (e) => <ExportFreshnessLine requestedAt={e.requested_at} expiresAt={e.expires_at} />,
                },
              ]}
              emptyState={
                <EmptyState
                  icon="download"
                  title="No exports yet"
                  body="Request an export to get a redacted, checksum-verified archive of this organization's configuration. Archives stay downloadable for 14 days."
                  action={{ label: "Request export", onClick: requestExport }}
                />
              }
            />
          )}
          <p className="text-xs text-ink-3">
            Archives expire 14 days after they are built and are then deleted from the server. The
            digest lets you verify a copy you downloaded.
          </p>
        </section>

        {/* Import side */}
        <section aria-labelledby="import-section">
          <Card
            title="Import a configuration archive"
            description="Paste the manifest JSON that came with an export archive. The importer refuses anything that is not a NexusPanel export."
          >
            <div className="flex flex-col gap-4">
              <Field
                label="Manifest JSON"
                htmlFor="import-manifest"
                error={importError ?? undefined}
                hint='Must parse as JSON and include "kind": "nexuspanel-export".'
              >
                <Textarea
                  id="import-manifest"
                  value={manifest}
                  onChange={(e) => setManifest(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={'{\n  "kind": "nexuspanel-export",\n  "version": 1,\n  "digest": "sha256:…",\n  "sections": ["websites", "policies"]\n}'}
                />
              </Field>
              {importOperation !== undefined && !isTerminal(importOperation.status) && (
                <PendingState operation={importOperation} />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={submitImport} loading={importing} disabled={manifest.trim() === ""} icon="upload">
                  Import archive
                </Button>
                <Chip tone="neutral">Access control: imports are audited and never auto-apply secrets</Chip>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </Screen>
  );
}
