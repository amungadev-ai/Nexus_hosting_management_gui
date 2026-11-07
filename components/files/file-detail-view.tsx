"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, SkeletonText } from "@/components/ui/feedback";
import { CodeBlock } from "@/components/ui/code";
import { KeyValue } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/feedback";
import { useNow } from "@/components/providers";
import { readFile, type ReadFileResult } from "@/lib/api/files";
import { ApiError } from "@/lib/api/core";
import { siteById } from "@/lib/mock/files";
import { formatBytes, formatDateTime, formatRelative } from "@/lib/format";

/** UX-FILE-002 — File detail and preview: metadata, MIME preview, safe download. */
export function FileDetailView() {
  const params = useSearchParams();
  const now = useNow();
  const pathParam = params.get("path") ?? "";
  const siteId = params.get("site") ?? "web_01JACME01";
  const parts = pathParam === "" ? [] : pathParam.split("/").filter((p) => p !== "");

  const [result, setResult] = useState<ReadFileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    readFile(siteId, parts)
      .then((res) => {
        if (!cancelled) {
          setResult(res);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.problem.detail : "The file could not be read.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathParam, siteId]);

  if (pathParam === "") {
    return (
      <div className="rounded-card border border-line bg-surface">
        <EmptyState
          icon="file"
          title="No file selected"
          body="Open the file manager and pick a file to inspect its metadata and a safe preview."
          action={{ label: "Open file manager", href: "/files" }}
        />
      </div>
    );
  }

  const site = siteById(siteId);
  const node = result?.node;

  const download = () => {
    if (node?.content === undefined) return;
    const blob = new Blob([node.content], { type: node.mime ?? "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = node.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex flex-col gap-4">
      {loading && (
        <Card title="Reading file…">
          <SkeletonText lines={4} />
        </Card>
      )}
      {!loading && error !== null && (
        <Callout tone="danger" title="Could not read this file">
          {error}{" "}
          <Link href="/files" className="text-accent hover:underline">
            Back to the file manager
          </Link>
        </Callout>
      )}
      {!loading && error === null && node !== undefined && (
        <>
          <Card
            title={node.name}
            description={`${node.mime ?? "application/octet-stream"} · modified ${formatRelative(node.modified_at, now)} (${formatDateTime(node.modified_at)})`}
            actions={
              <>
                {node.content !== undefined && (
                  <Button variant="secondary" icon="download" onClick={download}>
                    Download
                  </Button>
                )}
                <ButtonLink href={`/files/edit?path=${encodeURIComponent(pathParam)}&site=${siteId}`} variant="primary" icon="edit">
                  Edit
                </ButtonLink>
              </>
            }
          >
            <KeyValue
              columns={2}
              items={[
                { label: "Website scope", value: site?.label ?? siteId },
                { label: "Size", value: formatBytes(node.size_bytes ?? 0) },
                { label: "Permissions", value: <span className="font-mono">{node.mode}</span>, mono: true },
                { label: "Owner", value: `${node.owner}:${node.group}` },
                { label: "Content version", value: `v${result?.version ?? 1} — checked on save (If-Match)` },
                { label: "Path", value: `/${parts.join("/")}`, mono: true },
              ]}
            />
          </Card>

          {node.content !== undefined ? (
            <CodeBlock code={node.content} language={node.mime ?? "text"} />
          ) : (
            <Callout tone="info" title="Binary file — preview disabled">
              Images, PDFs and archives are not rendered in the panel. Download is limited to text files in this
              prototype; use SFTP for a byte-safe transfer.
            </Callout>
          )}
          <p className="text-xs text-ink-3">
            Previews never include secrets: the reader redacts anything matching credential patterns, and
            previewed content is excluded from telemetry (FLOW-007 step 10).
          </p>
        </>
      )}
    </div>
  );
}
