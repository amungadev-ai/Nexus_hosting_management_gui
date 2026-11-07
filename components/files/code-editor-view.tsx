"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, SkeletonText, EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast, useOperationStream } from "@/components/providers";
import { ApiError } from "@/lib/api/core";
import { readFile, saveFileContent, type ReadFileResult } from "@/lib/api/files";
import { siteById } from "@/lib/mock/files";

/** UX-FILE-003 — Code editor (reduced capability build): mono textarea,
 * line-count hint, unsaved-changes guard, Save → files.write operation,
 * Cancel reverts. */
export function CodeEditorView() {
  const params = useSearchParams();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const pathParam = params.get("path") ?? "";
  const siteId = params.get("site") ?? "web_01JACME01";
  const parts = pathParam === "" ? [] : pathParam.split("/").filter((p) => p !== "");

  const [result, setResult] = useState<ReadFileResult | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [dirtyGuardOpen, setDirtyGuardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = result !== null && draft !== (result.node.content ?? "");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readFile(siteId, parts)
      .then((res) => {
        if (!cancelled) {
          setResult(res);
          setDraft(res.node.content ?? "");
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

  // Guard against losing edits to a refresh / tab close.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (pathParam === "") {
    return (
      <div className="rounded-card border border-line bg-surface">
        <EmptyState
          icon="edit"
          title="No file selected"
          body="Pick an editable text file from the file manager to open it in the editor."
          action={{ label: "Open file manager", href: "/files" }}
        />
      </div>
    );
  }

  const site = siteById(siteId);
  const lines = draft.split("\n").length;
  const editable = result?.node.content !== undefined;

  const save = () => {
    if (result === null) return;
    setBusy(true);
    saveFileContent(siteId, parts, draft, result.version)
      .then((op) => {
        push("success", "Save submitted", `Operation ${op.id} — success is verified server-side.`);
        setFocusedId(op.id);
        setTrayOpen(true);
        setSaveOpen(false);
        setResult({ node: { ...result.node, content: draft, version: result.version + 1 }, version: result.version + 1 });
      })
      .catch((e: unknown) => {
        setSaveOpen(false);
        push(
          "error",
          "Save failed",
          e instanceof ApiError ? e.problem.detail : "Unexpected error."
        );
        setError(e instanceof ApiError && e.problem.code === "VERSION_MISMATCH" ? e.problem.detail : null);
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-4">
      {loading && (
        <Card title="Opening file…">
          <SkeletonText lines={5} />
        </Card>
      )}
      {!loading && error !== null && error !== null && (
        <Callout tone="danger" title="Editor unavailable">
          {error}{" "}
          <Link href="/files" className="text-accent hover:underline">
            Reload from the file manager
          </Link>
        </Callout>
      )}
      {!loading && error === null && result !== null && (
        <>
          <Card
            title={`${result.node.name} — ${site?.label ?? siteId}`}
            description={`v${result.version} · ${result.node.mime ?? "text"} · saved copy reverts with Cancel`}
            actions={
              <>
                <Button
                  variant="secondary"
                  onClick={() => (dirty ? setDirtyGuardOpen(true) : undefined)}
                  disabled={!dirty}
                >
                  Cancel (revert)
                </Button>
                <Button icon="check" disabled={!editable || !dirty} loading={busy} onClick={() => setSaveOpen(true)}>
                  Save
                </Button>
              </>
            }
          >
            {!editable && (
              <Callout tone="warning" title="Binary file">
                Only text files open in the editor. Use the file manager preview or SFTP for everything else.
              </Callout>
            )}
            <label htmlFor="editor-area" className="text-sm font-medium text-ink">
              File content
            </label>
            <textarea
              id="editor-area"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              disabled={!editable}
              rows={20}
              className="w-full rounded-control border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink focus:border-accent disabled:opacity-60"
            />
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
              <span>{lines} lines · {draft.length} characters</span>
              <span>{dirty ? "You have unsaved changes" : "No unsaved changes"}</span>
              <span className="font-mono">/{parts.join("/")}</span>
            </p>
          </Card>

          <ConfirmDialog
            open={saveOpen}
            onClose={() => setSaveOpen(false)}
            onConfirm={save}
            title={`Save ${result.node.name}`}
            confirmLabel="Save file"
            body={
              <>
                <p>
                  The write goes out as a <span className="font-mono">files.write</span> operation with a version
                  check (If-Match v{result.version}). Success means the agent verified the checksum — the editor
                  never claims success before that.
                </p>
                {dirty && <p className="mt-2 text-xs">You have unsaved changes that will be included.</p>}
              </>
            }
          />
          <ConfirmDialog
            open={dirtyGuardOpen}
            onClose={() => setDirtyGuardOpen(false)}
            onConfirm={() => {
              setDraft(result?.node.content ?? "");
              push("info", "Changes reverted", "The editor is back to the last saved copy.");
            }}
            title="You have unsaved changes"
            confirmLabel="Discard changes"
            destructive
            body={`Closing now discards ${lines} lines of edits to ${result?.node.name ?? "this file"}. Save first if you want to keep them.`}
          />
        </>
      )}
    </div>
  );
}
