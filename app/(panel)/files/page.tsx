"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState, Callout, SkeletonTable } from "@/components/ui/feedback";
import { Modal, ConfirmDialog } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/form";
import { KeyValue, ProgressBar } from "@/components/ui/misc";
import { Icon } from "@/components/ui/icons";
import { useToast, useOperationStream, useNow, useSession } from "@/components/providers";
import { ApiError } from "@/lib/api/core";
import {
  createFolder,
  deleteEntry,
  listDirectory,
  renameEntry,
  uploadFile,
  type DirectoryListing,
} from "@/lib/api/files";
import { displayPath, siteById, type FileNode } from "@/lib/mock/files";
import { db } from "@/lib/mock/data";
import { cx, formatBytes, formatDateTime, formatRelative, formatGb } from "@/lib/format";
import { SiteSelect, useContainerized } from "@/components/files/site-scope";
import { FolderTree } from "@/components/files/folder-tree";

/**
 * UX-FILE-001 — File manager (DS-013): scoped tree, breadcrumbs, permissions
 * and usage. Upload / new folder / rename go through 202 + files.write
 * operations; delete is a typed confirmation; download is read-only.
 */
export default function FileManagerPage() {
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const now = useNow();
  const containerized = useContainerized();

  const [siteId, setSiteId] = useState<string>("web_01JACME01");
  const [parts, setParts] = useState<string[]>([]);
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  // dialogs
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null);

  const site = siteById(siteId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listDirectory(siteId, parts)
      .then((res) => {
        if (!cancelled) {
          setListing(res);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.problem.detail : "The folder listing could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, parts, reloadKey]);

  const changeSite = useCallback((next: string) => {
    setSiteId(next);
    setParts([]);
    setSelectedName(null);
    setQuery("");
  }, []);

  const trackOp = useCallback(
    (opId: string, title: string) => {
      push("success", title, "Submitted — progress is in the operation tray. Success is verified server-side.");
      setFocusedId(opId);
      setTrayOpen(true);
      setReloadKey((k) => k + 1);
    },
    [push, setFocusedId, setTrayOpen]
  );

  const disk = useMemo(() => {
    const w = db.websites.find((x) => x.id === siteId);
    return w ? { allocated: w.usage.disk_gb.allocated, current: w.usage.disk_gb.current } : null;
  }, [siteId]);

  const openFolder = (name: string) => { setParts((prev) => [...prev, name]); setSelectedName(null); setQuery(""); };
  const viewHref = (node: FileNode) => `/files/view?path=${encodeURIComponent([...parts, node.name].join("/"))}&site=${siteId}`;
  const editHref = (node: FileNode) => `/files/edit?path=${encodeURIComponent([...parts, node.name].join("/"))}&site=${siteId}`;

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (row: FileNode) => (
        <span className="flex min-w-0 items-center gap-2">
          <Icon name={row.type === "directory" ? "folder" : "file"} size={16} className="shrink-0 text-ink-3" />
          <span className="min-w-0 break-all font-medium text-ink">{row.name}</span>
        </span>
      ),
    },
    { key: "type", header: "Type", render: (row: FileNode) => (row.type === "directory" ? "Folder" : row.mime ?? "File") },
    {
      key: "size_bytes",
      header: "Size",
      sortable: true,
      render: (row: FileNode) => (row.type === "directory" ? "—" : formatBytes(row.size_bytes ?? 0)),
    },
    {
      key: "modified_at",
      header: "Modified",
      sortable: true,
      render: (row: FileNode) => (
        <span title={formatDateTime(row.modified_at)}>{formatRelative(row.modified_at, now)}</span>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      render: (row: FileNode) => <span className="font-mono text-xs">{row.mode}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: FileNode) => (
        <div className="flex flex-wrap items-center gap-1">
          {row.type === "file" && (
            <>
              <ButtonLink href={viewHref(row)} variant="ghost" size="sm">
                View
              </ButtonLink>
              {(row.content !== undefined || row.mime === "text/html" || row.mime === "text/css") && (
                <ButtonLink href={editHref(row)} variant="ghost" size="sm">
                  Edit
                </ButtonLink>
              )}
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setRenameTarget(row)}>
            Rename
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row)} className="text-danger">
            Delete
          </Button>
        </div>
      ),
      className: "min-w-56",
    },
  ];

  const entries = listing?.entries ?? [];
  const visibleEntries = entries.filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = entries.find((entry) => entry.name === selectedName) ?? null;
  const selectFolder = (path: string[]) => { setParts(path); setSelectedName(null); setQuery(""); };


  return (
    <Screen
      id="UX-FILE-001"
      breadcrumbs={[{ label: "Files" }]}
      actions={
        <>
          <Button variant="secondary" icon="plus" onClick={() => setMkdirOpen(true)} disabled={site === undefined}>
            New folder
          </Button>
          <Button icon="upload" onClick={() => setUploadOpen(true)} disabled={site === undefined}>
            Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-line bg-surface p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">Workspace · Batch 04</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Your files, one clear workspace</h2>
              <p className="mt-1 text-sm text-ink-2">Browse a site-scoped tree, find files, inspect details and open the editor without leaving your project context.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/developer/sftp" variant="secondary" size="sm" icon="key">SFTP access</ButtonLink>
              <ButtonLink href="/databases" variant="secondary" size="sm" icon="database">Databases</ButtonLink>
            </div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SiteSelect value={siteId} onChange={changeSite} />
          {disk !== null && (
            <Card title="Disk usage for this site" className="self-start">
              <ProgressBar
                value={disk.current}
                max={disk.allocated}
                label={`${formatGb(disk.current)} used of ${formatGb(disk.allocated)} allocated`}
                showValue
                tone={disk.current / Math.max(disk.allocated, 0.1) > 0.8 ? "warning" : "accent"}
              />
              <p className="mt-2 text-xs text-ink-3">
                Allocation is a ceiling, not a reservation.{" "}
                <Link href="/files/uploads" className="text-accent hover:underline">
                  Upload manager
                </Link>{" "}
                ·{" "}
                <Link href="/files/operations" className="text-accent hover:underline">
                  Bulk operations
                </Link>
              </p>
            </Card>
          )}
        </div>

        <Callout tone="info">
          {site === undefined
            ? "Pick a website to browse its files."
            : containerized
              ? `Container-aware (Standard+): this tree is scoped to the site's container volume — paths display as ${displayPath(site, parts, true)}.`
              : `Not containerized (Nano/Starter): the file manager operates on the site document root directly — ${displayPath(site, parts, false)}.`}
        </Callout>

        <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
          <Button variant="link" size="sm" onClick={() => setParts([])} className="px-0">
            {site?.root_name ?? "root"}
          </Button>
          {parts.map((p, i) => (
            <span key={`${p}-${i}`} className="flex items-center gap-1">
              <span aria-hidden="true" className="text-ink-3">/</span>
              <Button
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => setParts((prev) => prev.slice(0, i + 1))}
              >
                {p}
              </Button>
            </span>
          ))}
        </nav>

        <div className="grid min-h-[440px] gap-3 lg:grid-cols-[minmax(180px,0.8fr)_minmax(0,2.4fr)] xl:grid-cols-[minmax(190px,0.75fr)_minmax(0,2fr)_minmax(200px,0.9fr)]">
          <aside className="min-w-0 rounded-card border border-line bg-surface p-3" aria-label="Site folder tree">
            <div className="mb-3 flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-sm font-semibold text-ink">Explorer</h3>
              <Button variant="ghost" size="sm" icon="refresh" onClick={() => setReloadKey((n) => n + 1)}>Refresh</Button>
            </div>
            {site && <FolderTree rootName={site.root_name} nodes={site.children} currentPath={parts} onNavigate={selectFolder} />}
            <p className="mt-4 rounded-lg bg-surface-2 p-2 text-xs text-ink-3">Restricted to the selected website root. Folder navigation cannot escape this scope.</p>
          </aside>
          <section className="min-w-0 rounded-card border border-line bg-surface" aria-label="Folder contents">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">{parts.at(-1) ?? site?.root_name ?? "Files"}</h3>
                <p className="text-xs text-ink-3">{entries.length} items · select a file for details</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowDetails((v) => !v)}>{showDetails ? "Hide details" : "Show details"}</Button>
            </div>
            <div className="border-b border-line p-3">
              <label htmlFor="file-search" className="sr-only">Search current folder</label>
              <Input id="file-search" placeholder="Search files in this folder…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {loading && <div className="p-3"><SkeletonTable rows={5} cols={4} /></div>}
            {!loading && error && <div className="p-3"><Callout tone="danger" title="Could not list this folder">{error}</Callout></div>}
            {!loading && !error && visibleEntries.length === 0 && (
              <div className="p-6 text-center text-sm text-ink-2">{query ? "No files match your search in this folder." : "This folder is empty. Upload a file or create a folder to get started."}</div>
            )}
            {!loading && !error && visibleEntries.length > 0 && (
              <div className="divide-y divide-line">
                {visibleEntries.map((entry) => (
                  <div key={entry.name} className={cx("flex items-center gap-2 px-3 py-2.5 hover:bg-surface-2", selectedName === entry.name && "bg-surface-2")}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { if (entry.type === "directory") openFolder(entry.name); else setSelectedName(entry.name); }} aria-label={entry.type === "directory" ? `Open folder ${entry.name}` : `Select file ${entry.name}`}>
                      <Icon name={entry.type === "directory" ? "folder" : "file-text"} size={17} className="shrink-0 text-accent" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{entry.name}</span>
                      <span className="hidden text-xs text-ink-3 sm:inline">{entry.type === "directory" ? "Folder" : formatBytes(entry.size_bytes ?? 0)}</span>
                    </button>
                    {entry.type === "file" ? <ButtonLink href={editHref(entry)} variant="ghost" size="sm" icon="edit">Edit</ButtonLink> : <Button variant="ghost" size="sm" onClick={() => openFolder(entry.name)} icon="chevron-right">Open</Button>}
                    <Button variant="ghost" size="sm" onClick={() => setSelectedName(entry.name)} icon="more-horizontal" aria-label={`Show details for ${entry.name}`} />
                  </div>
                ))}
              </div>
            )}
          </section>
          {showDetails && (
            <aside className="min-w-0 rounded-card border border-line bg-surface p-4 lg:col-span-2 xl:col-span-1" aria-label="Selected file details">
              <h3 className="border-b border-line pb-3 text-sm font-semibold text-ink">Details & actions</h3>
              {selected ? (
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2"><Icon name={selected.type === "directory" ? "folder" : "file"} size={22} className="text-accent" /><span className="break-all text-sm font-semibold text-ink">{selected.name}</span></div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs"><dt className="text-ink-3">Type</dt><dd>{selected.type === "directory" ? "Folder" : selected.mime ?? "File"}</dd><dt className="text-ink-3">Size</dt><dd>{selected.size_bytes === null ? "—" : formatBytes(selected.size_bytes)}</dd><dt className="text-ink-3">Mode</dt><dd className="font-mono">{selected.mode}</dd><dt className="text-ink-3">Owner</dt><dd>{selected.owner}</dd><dt className="text-ink-3">Version</dt><dd>{selected.version ?? "—"}</dd></dl>
                  {selected.type === "file" && selected.content !== undefined && <pre className="max-h-40 overflow-auto rounded-lg bg-surface-2 p-3 text-xs text-ink-2">{selected.content.slice(0, 550)}</pre>}
                  {selected.type === "file" && <><ButtonLink href={viewHref(selected)} variant="secondary" size="sm" icon="eye">Preview file</ButtonLink><ButtonLink href={editHref(selected)} size="sm" icon="edit">Open code editor</ButtonLink></>}
                  {selected.type === "directory" && <Button size="sm" onClick={() => openFolder(selected.name)} icon="folder">Open folder</Button>}
                  <Button variant="secondary" size="sm" onClick={() => setRenameTarget(selected)} icon="edit">Rename</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(selected)} icon="trash" className="text-danger">Delete…</Button>
                </div>
              ) : <p className="mt-4 text-sm text-ink-3">Select a file or use the details button on a folder to see metadata and available actions.</p>}
            </aside>
          )}
        </div>
      </div>

      {site !== undefined && (
        <UploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          siteId={site.site_id}
          folderParts={parts}
          onSubmitted={(op) => trackOp(op.id, "Upload submitted")}
        />
      )}
      {site !== undefined && (
        <MkdirModal
          open={mkdirOpen}
          onClose={() => setMkdirOpen(false)}
          siteId={site.site_id}
          folderParts={parts}
          onSubmitted={(op) => trackOp(op.id, "New folder submitted")}
        />
      )}
      {site !== undefined && renameTarget !== null && (
        <RenameModal
          open
          onClose={() => setRenameTarget(null)}
          siteId={site.site_id}
          parts={[...parts, renameTarget.name]}
          currentName={renameTarget.name}
          onSubmitted={(op) => trackOp(op.id, "Rename submitted")}
        />
      )}
      {site !== undefined && deleteTarget !== null && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title={`Delete ${deleteTarget.type === "directory" ? "folder" : "file"} ${deleteTarget.name}`}
          confirmLabel={`Delete ${deleteTarget.name}`}
          destructive
          typedConfirmation={deleteTarget.name}
          body={
            <>
              <p>
                This removes <span className="font-mono">{deleteTarget.name}</span> from{" "}
                <span className="font-mono">{displayPath(site, parts, containerized)}</span>
                {deleteTarget.type === "directory" ? " and everything inside it" : ""}. A 24-hour snapshot
                is kept in the trash before permanent deletion.
              </p>
              <p className="mt-2 text-xs">
                Type the name to confirm. Removal runs as a verified job — the listing updates when it completes.
              </p>
            </>
          }
          onConfirm={() => {
            deleteEntry(site.site_id, [...parts, deleteTarget.name])
              .then((op) => trackOp(op.id, "Delete submitted"))
              .catch((e: unknown) => push("error", "Delete failed", e instanceof ApiError ? e.problem.detail : "Unexpected error."));
          }}
        />
      )}
      <p className="text-xs text-ink-3">
        Breadcrumbs above are clickable. Keyboard: rows are reachable with Tab; Enter opens folders. Mobile
        shows the folder list first and single-file view (Stage 3 §7). Last refreshed {formatRelative(new Date().toISOString(), now)}.
      </p>
    </Screen>
  );
}

function fileSitesFallback() {
  return { site_id: "", label: "", kind: "static" as const, root_name: "", children: [] };
}

/* ------------------------------------------------------------------ */

function UploadModal({
  open,
  onClose,
  siteId,
  folderParts,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  folderParts: string[];
  onSubmitted: (op: { id: string }) => void;
}) {
  const { push } = useToast();
  const [filename, setFilename] = useState("");
  const [sizeMb, setSizeMb] = useState("1");
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFilename("");
      setSizeMb("1");
      setOverwrite(false);
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const op = await uploadFile({
        siteId,
        folderParts,
        filename: filename.trim(),
        sizeBytes: Math.round(Number(sizeMb) * 1024 * 1024),
        overwrite,
      });
      onSubmitted(op);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.problem.code === "UPLOAD_CONFLICT") {
        setError(`${e.problem.detail} Tick "overwrite" to replace it.`);
      } else {
        setError(e instanceof ApiError ? e.problem.detail : "The upload could not be queued.");
        push("error", "Upload failed", e instanceof ApiError ? e.problem.detail : "Unexpected error.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload a file"
      description="Bounded upload — max 100 MB per file. Larger transfers use SFTP."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={filename.trim() === ""} onClick={() => void submit()}>
            Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="File name" htmlFor="upload-name" required hint="Relative to the current folder.">
          <Input id="upload-name" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="banner-november.webp" autoComplete="off" />
        </Field>
        <Field label="Size (MB)" htmlFor="upload-size" required hint="The prototype simulates the transfer; the operation pipeline is the real one.">
          <Input id="upload-size" type="number" min="0.1" step="0.1" value={sizeMb} onChange={(e) => setSizeMb(e.target.value)} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
          <span>
            Overwrite a file with the same name
            <span className="mt-0.5 block text-xs text-ink-2">The previous version stays in the 24-hour trash.</span>
          </span>
        </label>
        {error !== null && (
          <Callout tone="warning" title="Upload conflict">
            {error}
          </Callout>
        )}
      </div>
    </Modal>
  );
}

function MkdirModal({
  open,
  onClose,
  siteId,
  folderParts,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  folderParts: string[];
  onSubmitted: (op: { id: string }) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New folder"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={name.trim() === ""}
            onClick={() => {
              setBusy(true);
              setError(null);
              createFolder(siteId, folderParts, name.trim())
                .then((op) => {
                  onSubmitted(op);
                  onClose();
                })
                .catch((e: unknown) => setError(e instanceof ApiError ? e.problem.detail : "Unexpected error."))
                .finally(() => setBusy(false));
            }}
          >
            Create folder
          </Button>
        </>
      }
    >
      <Field label="Folder name" htmlFor="mkdir-name" required>
        <Input id="mkdir-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>
      {error !== null && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
    </Modal>
  );
}

function RenameModal({
  open,
  onClose,
  siteId,
  parts,
  currentName,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  parts: string[];
  currentName: string;
  onSubmitted: (op: { id: string }) => void;
}) {
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Rename ${currentName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={name.trim() === "" || name === currentName}
            onClick={() => {
              setBusy(true);
              setError(null);
              renameEntry(siteId, parts, name.trim())
                .then((op) => {
                  onSubmitted(op);
                  onClose();
                })
                .catch((e: unknown) => setError(e instanceof ApiError ? e.problem.detail : "Unexpected error."))
                .finally(() => setBusy(false));
            }}
          >
            Rename
          </Button>
        </>
      }
    >
      <Field label="New name" htmlFor="rename-name" required>
        <Input id="rename-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>
      {error !== null && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
    </Modal>
  );
}
