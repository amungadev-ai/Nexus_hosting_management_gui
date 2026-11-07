import type { Operation } from "@/lib/types";
import { db } from "@/lib/mock/data";
import {
  cronTasks,
  devKeys,
  fileSites,
  findNode,
  sftpCredentials,
  uploads,
  MAX_UPLOAD_BYTES,
  type CronTask,
  type DevKey,
  type FileNode,
  type FileSite,
  type UploadRecord,
} from "@/lib/mock/files";
import { operations } from "@/lib/operations";
import { ApiError, newId, ok, problem, requestId, withLatency } from "@/lib/api/core";

export type { CronTask, DevKey };

/**
 * Mock API client for /hosting-accounts/{id}/files, uploads, terminal and
 * SFTP (Stage 6 §4.8). Mutations follow the 202 + operation pattern through
 * the operations engine; the fixture tree is mutated the way the real agent
 * would apply files.write_atomic when the operation verifies.
 */

function actor(): { actor_id: string; organization_id: string } {
  return { actor_id: db.currentUser, organization_id: db.currentOrganization };
}

function fileOp(
  title: string,
  site: FileSite,
  stepTitles: string[],
  extra?: Partial<Parameters<typeof operations.submit>[0]>
): Operation {
  return operations.submit({
    kind: "files.write", // agent action files.write_atomic (Stage 6 §6.8)
    title,
    resource_ref: { type: "website", id: site.site_id, name: site.label },
    workload_category: "serving",
    step_titles: stepTitles,
    ...actor(),
    ...extra,
  });
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export interface DirectoryListing {
  site: FileSite;
  path_parts: string[];
  entries: FileNode[];
}

/** GET /hosting-accounts/{id}/files?path=… */
export async function listDirectory(siteId: string, parts: string[]): Promise<DirectoryListing> {
  return withLatency(() => {
    const site = fileSites.find((s) => s.site_id === siteId);
    if (!site) {
      throw new ApiError(problem(404, "NOT_FOUND", "Website not found", "The file manager scope does not include this website."));
    }
    const node = findNode(site, parts);
    if (parts.length > 0 && (!node || node.type !== "directory")) {
      throw new ApiError(problem(404, "NOT_FOUND", "Folder not found", "That folder does not exist under the permitted root for this website."));
    }
    return { site, path_parts: parts, entries: node ? (node.children ?? []) : site.children };
  });
}

export interface ReadFileResult {
  node: FileNode;
  version: number;
}

/** GET /hosting-accounts/{id}/file-content?path=… (text files only). */
export async function readFile(siteId: string, parts: string[]): Promise<ReadFileResult> {
  return withLatency(() => {
    const site = fileSites.find((s) => s.site_id === siteId);
    const node = site ? findNode(site, parts) : undefined;
    if (!site || !node || node.type !== "file") {
      throw new ApiError(problem(404, "NOT_FOUND", "File not found", "That file does not exist under the permitted root for this website."));
    }
    return { node, version: node.version ?? 1 };
  });
}

/* ------------------------------------------------------------------ */
/* Mutations — 202 + operation (files.write)                           */
/* ------------------------------------------------------------------ */

/** POST …/file-operations action=upload (Stage 6 §4.8: bounded upload). */
export async function uploadFile(opts: {
  siteId: string;
  folderParts: string[];
  filename: string;
  sizeBytes: number;
  overwrite: boolean;
}): Promise<Operation> {
  const site = fileSites.find((s) => s.site_id === opts.siteId);
  if (!site) throw new ApiError(problem(404, "NOT_FOUND", "Website not found", "No permitted root matches this website."));
  if (opts.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      problem(422, "UPLOAD_TOO_LARGE", "Upload too large", "The file is larger than the 100 MB per-file limit. Use SFTP for big transfers.", {
        errors: [{ field: "size_bytes", code: "LIMIT_REACHED" }],
      })
    );
  }
  const folder = opts.folderParts.length === 0 ? undefined : findNode(site, opts.folderParts);
  const target = folder ?? site;
  const existing = (target.children ?? []).find((c) => c.name === opts.filename);
  if (existing !== undefined && !opts.overwrite) {
    throw new ApiError(problem(409, "UPLOAD_CONFLICT", "File already exists", `A file named ${opts.filename} already exists in that folder. Choose overwrite or rename the upload.`));
  }

  // The fixture tree receives the entry when the operation verifies; for the
  // prototype we record the row up-front with in_progress state.
  const record: UploadRecord = {
    id: newId("up"),
    site_id: opts.siteId,
    path: opts.folderParts.join("/"),
    filename: opts.filename,
    size_bytes: opts.sizeBytes,
    state: "in_progress",
    started_at: new Date().toISOString(),
  };
  uploads.unshift(record);

  const op = fileOp(`Upload ${opts.filename} — ${site.label}`, site, [
    "Validate name, size and permitted root",
    "Transfer bytes with checksum",
    "Write atomically into the site root",
    "Verify checksum and listing",
  ]);
  if (existing !== undefined) {
    existing.size_bytes = opts.sizeBytes;
    existing.modified_at = new Date().toISOString();
  } else {
    target.children = target.children ?? [];
    target.children.push({
      name: opts.filename,
      type: "file",
      size_bytes: opts.sizeBytes,
      modified_at: new Date().toISOString(),
      mime: mimeFor(opts.filename),
      mode: "0664",
      owner: "www-data",
      group: "www-data",
      version: 1,
    });
  }
  markUploadWhenVerified(op.id, record.id);
  return op;
}

/** POST …/file-operations action=rename. */
export async function renameEntry(siteId: string, parts: string[], newName: string): Promise<Operation> {
  const site = requireSite(siteId);
  const node = findNode(site, parts);
  if (!node) throw new ApiError(problem(404, "NOT_FOUND", "Not found", "That file or folder no longer exists."));
  const parent = findNode(site, parts.slice(0, -1));
  const siblings = (parent ? parent.children : site.children) ?? [];
  if (siblings.some((c) => c.name === newName && c !== node)) {
    throw new ApiError(problem(409, "NAME_CONFLICT", "Name already in use", `An entry named ${newName} already exists in this folder.`));
  }
  const oldName = node.name;
  node.name = newName;
  node.modified_at = new Date().toISOString();
  return fileOp(`Rename ${oldName} → ${newName} — ${site.label}`, site, [
    "Validate name and target folder",
    "Move atomically (same filesystem)",
    "Verify listing",
  ]);
}

/** POST …/file-operations action=mkdir. */
export async function createFolder(siteId: string, folderParts: string[], name: string): Promise<Operation> {
  const site = requireSite(siteId);
  const parent = folderParts.length === 0 ? undefined : findNode(site, folderParts);
  const target = parent ?? site;
  if ((target.children ?? []).some((c) => c.name === name)) {
    throw new ApiError(problem(409, "NAME_CONFLICT", "Folder already exists", `A folder named ${name} already exists here.`));
  }
  target.children = target.children ?? [];
  target.children.push({
    name,
    type: "directory",
    size_bytes: null,
    modified_at: new Date().toISOString(),
    mode: "0755",
    owner: "www-data",
    group: "www-data",
    children: [],
  });
  return fileOp(`Create folder ${name} — ${site.label}`, site, [
    "Validate permitted root",
    "Create directory 0755",
    "Verify listing",
  ]);
}

/** POST …/file-operations action=delete (typed confirmation happens in the UI). */
export async function deleteEntry(siteId: string, parts: string[]): Promise<Operation> {
  const site = requireSite(siteId);
  const parent = findNode(site, parts.slice(0, -1));
  const name = parts[parts.length - 1];
  const siblings = (parent ? parent.children : site.children) ?? [];
  const idx = siblings.findIndex((c) => c.name === name);
  if (idx < 0) throw new ApiError(problem(404, "NOT_FOUND", "Not found", "That file or folder no longer exists."));
  const [removed] = siblings.splice(idx, 1);
  const label = removed.type === "directory" ? "folder" : "file";
  return fileOp(`Delete ${label} ${name} — ${site.label}`, site, [
    "Snapshot entry into the 24h trash",
    "Remove from the site root",
    "Verify listing",
  ]);
}

/** PUT …/file-content — atomic write with version precondition. */
export async function saveFileContent(siteId: string, parts: string[], content: string, baseVersion: number): Promise<Operation> {
  const site = requireSite(siteId);
  const node = findNode(site, parts);
  if (!node || node.type !== "file") {
    throw new ApiError(problem(404, "NOT_FOUND", "File not found", "That file no longer exists on the server."));
  }
  if ((node.version ?? 1) !== baseVersion) {
    throw new ApiError(
      problem(412, "VERSION_MISMATCH", "File changed on the server", "Someone else saved this file while you were editing. Copy your changes, then reload and reapply.")
    );
  }
  node.content = content;
  node.version = baseVersion + 1;
  node.size_bytes = new TextEncoder().encode(content).length;
  node.modified_at = new Date().toISOString();
  return fileOp(`Save ${node.name} — ${site.label}`, site, [
    "Version check (If-Match)",
    "Write atomically",
    "Verify checksum",
  ]);
}

/** POST …/file-operations action=chmod / chown — permissions apply. */
export async function applyPermissions(siteId: string, entries: { parts: string[]; mode: string }[]): Promise<Operation> {
  const site = requireSite(siteId);
  for (const e of entries) {
    const node = findNode(site, e.parts);
    if (node) node.mode = e.mode;
  }
  return fileOp(`Apply permissions to ${entries.length} entr${entries.length === 1 ? "y" : "ies"} — ${site.label}`, site, [
    "Preview effective modes (dangerous flags flagged)",
    "Apply chmod",
    "Re-read modes and verify",
  ]);
}

/** POST …/file-operations bulk archive/move/delete (UX-FILE-004). */
export async function bulkOperation(
  siteId: string,
  action: "archive" | "delete" | "move",
  entries: string[],
  destination?: string
): Promise<Operation> {
  const site = requireSite(siteId);
  const verb = action === "archive" ? "Archive" : action === "delete" ? "Delete" : `Move to ${destination ?? "…"}`;
  return fileOp(`${verb} ${entries.length} items — ${site.label}`, site, [
    "Enumerate targets and snapshot to trash",
    "Apply operation atomically",
    "Verify listing and integrity",
  ]);
}

/* ------------------------------------------------------------------ */
/* Upload manager                                                      */
/* ------------------------------------------------------------------ */

export function listUploads(): UploadRecord[] {
  return uploads;
}

export function markUploadCompleted(uploadId: string): void {
  const rec = uploads.find((u) => u.id === uploadId);
  if (rec) rec.state = "completed";
}

export function markUploadFailed(uploadId: string, error: string): void {
  const rec = uploads.find((u) => u.id === uploadId);
  if (rec) {
    rec.state = "failed";
    rec.error = error;
  }
}

function markUploadWhenVerified(opId: string, uploadId: string): void {
  operations.subscribe((op) => {
    if (op.id !== opId) return;
    if (op.status === "succeeded") markUploadCompleted(uploadId);
    if (op.status === "failed" || op.status === "cancelled") {
      markUploadFailed(uploadId, "The write job did not verify. Retry the upload.");
    }
  });
}

/* ------------------------------------------------------------------ */
/* SFTP (UX-FILE-011) + keys (UX-FILE-007) + terminal (UX-FILE-008)    */
/* ------------------------------------------------------------------ */

export function sftpFor(siteId: string) {
  return sftpCredentials.find((s) => s.site_id === siteId) ?? sftpCredentials[0];
}

/** POST /sftp-credentials/reset — credential rotation is a real agent job. */
export async function resetSftpPassword(siteId: string): Promise<Operation> {
  const cred = sftpCredentials.find((s) => s.site_id === siteId) ?? sftpCredentials[0];
  cred.password_once = `SFTP-${newId("r").slice(4)}-temp`;
  return operations.submit({
    kind: "sftp.password.reset",
    title: `Reset SFTP password — ${cred.username}`,
    resource_ref: { type: "website", id: siteId, name: "kili-shop" },
    workload_category: "serving",
    step_titles: ["Verify step-up token", "Rotate password on the agent", "Invalidate active SFTP sessions"],
    ...actor(),
  });
}

export function listDevKeys(): DevKey[] {
  return devKeys;
}

/** POST /ssh-keys → 201 (public-key registry; private keys never uploaded). */
export async function addPublicKey(name: string, publicKey: string): Promise<DevKey> {
  return withLatency(() => {
    const trimmed = publicKey.trim();
    if (!trimmed.startsWith("ssh-ed25519 ") && !trimmed.startsWith("ssh-rsa ")) {
      throw new ApiError(problem(422, "INVALID_PUBLIC_KEY", "Not a public key", "Paste a public key line starting with ssh-ed25519 or ssh-rsa. Private keys are never uploaded."));
    }
    const key: DevKey = {
      id: newId("key"),
      name,
      kind: "ssh_public",
      fingerprint: `SHA256:${newId("f").slice(4)}${newId("f").slice(4)}`,
      scopes: ["files.read", "files.write"],
      public_key: trimmed,
      created_at: new Date().toISOString(),
      last_used_at: null,
      expires_at: null,
    };
    devKeys.unshift(key);
    return key;
  }, 500);
}

/** POST /deploy-keys → 201; the private half is shown once (DS-008). */
export async function generateDeployKey(name: string): Promise<{ key: DevKey; private_key_once: string }> {
  return withLatency(() => {
    const key: DevKey = {
      id: newId("key"),
      name,
      kind: "deploy",
      fingerprint: `SHA256:${newId("f").slice(4)}${newId("f").slice(4)}`,
      scopes: ["files.read"],
      public_key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${newId("k").slice(4).toLowerCase()} deploy-${name.replace(/\s+/g, "-").toLowerCase()}`,
      created_at: new Date().toISOString(),
      last_used_at: null,
      expires_at: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
    };
    devKeys.unshift(key);
    return { key, private_key_once: `-----BEGIN OPENSSH PRIVATE KEY-----\n${newId("p")}${newId("p")}${newId("p")}\n-----END OPENSSH PRIVATE KEY-----` };
  }, 650);
}

/** DELETE /ssh-keys/{id} → 204 (audit event; no operation needed). */
export async function revokeKey(keyId: string): Promise<void> {
  await withLatency(() => {
    const idx = devKeys.findIndex((k) => k.id === keyId);
    if (idx >= 0) devKeys.splice(idx, 1);
    return ok({ revoked: keyId, request_id: requestId() });
  }, 400);
}

export interface TerminalSession {
  session_id: string;
  expires_at: string;
  scope: string;
}

/** POST /hosting-accounts/{id}/terminal-sessions → 201 (time-limited, audited). */
export async function openTerminalSession(): Promise<TerminalSession> {
  return withLatency(() => {
    return {
      session_id: newId("term"),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      scope: "kili-shop container shell — files.write scope, every command audited",
    };
  }, 500);
}

/* ------------------------------------------------------------------ */
/* Cron / scheduled tasks (UX-FILE-009)                                */
/* ------------------------------------------------------------------ */

export function listCronTasks(): CronTask[] {
  return cronTasks;
}

/** POST /automations → 201. */
export async function createCronTask(input: {
  name: string;
  expression: string;
  timezone: string;
  command: string;
}): Promise<CronTask> {
  return withLatency(() => {
    if (!/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(input.expression.trim())) {
      throw new ApiError(problem(422, "INVALID_CRON", "Invalid cron expression", "Use five fields: minute hour day-of-month month day-of-week, e.g. 0 3 * * *."));
    }
    const task: CronTask = {
      id: newId("aut"),
      name: input.name,
      expression: input.expression.trim(),
      timezone: input.timezone,
      command: input.command,
      workload_category: "batch", // derived from command pattern (Stage 6 §4.19)
      state: "active",
      last_run_at: null,
      next_run_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      last_status: null,
      log_lines: [],
    };
    cronTasks.unshift(task);
    return task;
  }, 450);
}

/** PATCH /automations/{id} — pause/resume is a quick, audited change. */
export async function setCronPaused(taskId: string, paused: boolean): Promise<CronTask> {
  return withLatency(() => {
    const task = cronTasks.find((t) => t.id === taskId);
    if (!task) throw new ApiError(problem(404, "NOT_FOUND", "Task not found", "That scheduled task no longer exists."));
    task.state = paused ? "paused" : "active";
    return task;
  }, 300);
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

function requireSite(siteId: string): FileSite {
  const site = fileSites.find((s) => s.site_id === siteId);
  if (!site) throw new ApiError(problem(404, "NOT_FOUND", "Website not found", "No permitted root matches this website."));
  return site;
}

function mimeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const table: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    txt: "text/plain",
    log: "text/plain",
    md: "text/markdown",
    php: "application/x-php",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    gz: "application/gzip",
    zip: "application/zip",
  };
  return table[ext] ?? "application/octet-stream";
}
