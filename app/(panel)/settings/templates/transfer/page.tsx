"use client";

import React, { useMemo, useState } from "react";
import { db } from "@/lib/mock/data";
import { exportTemplateInstance, importTemplateArtifact } from "@/lib/api/support";
import { isTerminal } from "@/lib/operations";
import { formatRelative } from "@/lib/format";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { PendingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Select, Textarea } from "@/components/ui/form";
import { KeyValue } from "@/components/ui/misc";
import { CodeBlock } from "@/components/ui/code";
import { Callout, EmptyState, ErrorBlock } from "@/components/ui/feedback";

/**
 * UX-SUP-010 /settings/templates/transfer — ServiceTemplate export/import.
 * The v1 migration path (registry: NEW in v2 spec, active in this prototype):
 * export an instance as an OCI-compatible artifact + manifest, import it on a
 * new VPS with the sha256 digest. Batch operations throughout.
 */

const MANIFEST_EXAMPLE = `{
  "kind": "nexuspanel/service-template",
  "template": "minio",
  "instance": "media-store",
  "artifact": "oci://wanjiku-backups/templates/media-store:2026-11-06",
  "digest": "sha256:9f1c02ba7d54e8a1",
  "created_at": "2026-11-06T12:00:00Z"
}`;

export default function TemplateTransferPage() {
  const now = useNow();
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const instances = db.serviceInstances;

  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "");
  const [exportOpId, setExportOpId] = useState<string | null>(null);
  const [digest, setDigest] = useState("");
  const [importOpId, setImportOpId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const exportOperation = useMemo(
    () => (exportOpId === null ? undefined : list.find((o) => o.id === exportOpId)),
    [exportOpId, list]
  );
  const importOperation = useMemo(
    () => (importOpId === null ? undefined : list.find((o) => o.id === importOpId)),
    [importOpId, list]
  );

  const selectedInstance = instances.find((i) => i.id === instanceId);

  const exportInstance = () => {
    if (selectedInstance === undefined) return;
    setExporting(true);
    try {
      const op = exportTemplateInstance(selectedInstance.id, selectedInstance.name);
      setExportOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      push(
        "success",
        "Export accepted (202)",
        "The volume is packaged as an OCI-compatible artifact with a signed manifest. The digest appears in the job output when the export verifies."
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
      const op = importTemplateArtifact(digest);
      setImportOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      setDigest("");
      push(
        "success",
        "Import accepted (202)",
        "The artifact signature is verified first; the instance is restored and health-checked before the panel reports it running."
      );
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "The artifact could not be imported.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Screen
      id="UX-SUP-010"
      breadcrumbs={[{ label: "Settings" }, { label: "Template transfer" }]}
      description="Export a ServiceTemplate instance (storage bucket, self-hosted app, database, cache) as an OCI-compatible artifact + manifest, and import it on a new VPS. This is the supported v1 migration path between installs."
    >
      <div className="flex flex-col gap-6">
        <Callout tone="info" title="How transfer works">
          Export quiesces writes, packages the instance volume, signs the manifest and verifies the
          digest — the instance keeps serving where it can. On the target VPS, paste the digest to
          import. Nothing is deleted from the source by an export.
        </Callout>

        {/* Export */}
        <section aria-labelledby="tpl-export" className="flex flex-col gap-3">
          <h2 id="tpl-export" className="text-sm font-semibold text-ink">
            Export an instance
          </h2>
          {exportOperation !== undefined && !isTerminal(exportOperation.status) && (
            <PendingState operation={exportOperation}>
              <p className="text-xs text-ink-2">
                Batch job — packaging yields to site traffic. The signed manifest and sha256 digest
                land in the job output; copy them for the target VPS.
              </p>
            </PendingState>
          )}
          {exportOperation?.status === "failed" && (
            <ErrorBlock
              code={exportOperation.error?.code ?? "TEMPLATE_EXPORT_FAILED"}
              detail={exportOperation.error?.detail ?? "The export did not complete. The instance is unchanged — you can retry."}
              correlationId={exportOperation.correlation_id}
            />
          )}
          {instances.length === 0 ? (
            <EmptyState
              icon="box"
              title="No instances to export"
              body="Deploy a self-hosted template or storage bucket first — exports package running instances, not the catalog."
              action={{ label: "Browse the template catalog", href: "/templates" }}
            />
          ) : (
            <Card>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <Field
                  label="Instance"
                  htmlFor="tpl-instance"
                  hint="Storage, self-hosted apps, databases and caches all transfer the same way."
                  className="flex-1"
                >
                  <Select id="tpl-instance" value={instanceId} onChange={(e) => setInstanceId(e.target.value)}>
                    {instances.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.template_key}) — {i.state}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button icon="download" onClick={exportInstance} loading={exporting} disabled={selectedInstance === undefined}>
                  Export as OCI artifact
                </Button>
              </div>
              {selectedInstance !== undefined && (
                <div className="mt-4 border-t border-line pt-3">
                  <KeyValue
                    columns={2}
                    items={[
                      { label: "Hostname", value: <span className="font-mono text-xs">{selectedInstance.hostname}</span>, mono: true },
                      { label: "Version", value: selectedInstance.version },
                      { label: "Health", value: <Chip tone={selectedInstance.health === "healthy" ? "success" : "warning"}>{selectedInstance.health}</Chip> },
                      { label: "Created", value: formatRelative(selectedInstance.created_at, now) },
                    ]}
                  />
                </div>
              )}
            </Card>
          )}
        </section>

        {/* Import */}
        <section aria-labelledby="tpl-import">
          <Card
            title="Import on this VPS"
            description="Run this on the target install. The digest must match the one printed next to the exported artifact."
          >
            <div className="flex flex-col gap-4">
              <CodeBlock language="manifest example" code={MANIFEST_EXAMPLE} maxHeight={220} />
              <Field
                label="Artifact digest"
                htmlFor="tpl-digest"
                error={importError ?? undefined}
                hint="Format sha256:<hex> — shown next to the exported artifact and in the export job output."
              >
                <Textarea
                  id="tpl-digest"
                  value={digest}
                  onChange={(e) => setDigest(e.target.value)}
                  rows={2}
                  spellCheck={false}
                  placeholder="sha256:9f1c02ba7d54e8a1"
                  className="font-mono text-xs"
                />
              </Field>
              {importOperation !== undefined && !isTerminal(importOperation.status) && (
                <PendingState operation={importOperation} />
              )}
              {importOperation?.status === "failed" && (
                <ErrorBlock
                  code={importOperation.error?.code ?? "TEMPLATE_IMPORT_FAILED"}
                  detail={importOperation.error?.detail ?? "The import stopped before starting the instance. Nothing was replaced — you can retry."}
                  correlationId={importOperation.correlation_id}
                />
              )}
              {importOperation?.status === "succeeded" && (
                <Callout tone="success" title="Import verified">
                  Signature verified, volume restored, instance running and health-checked. It now
                  appears under its template family.
                </Callout>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button icon="upload" onClick={submitImport} loading={importing} disabled={digest.trim() === ""}>
                  Import artifact
                </Button>
                <Chip tone="neutral">Batch — verifies signature before restoring the volume</Chip>
              </div>
            </div>
          </Card>
        </section>

        <div>
          <p className="text-xs text-ink-3">
            Moving a whole cPanel/DirectAdmin/Plesk server instead? That source-platform import is
            planned for v2 — see the migration hub for what the panel supports today.
          </p>
        </div>
      </div>
    </Screen>
  );
}
