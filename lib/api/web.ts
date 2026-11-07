import type { Application, Operation, Website } from "@/lib/types";
import type { SubmitSpec } from "@/lib/operations";
import { db } from "@/lib/mock/data";
import { ok, sleep, withLatency } from "@/lib/api/core";
import { operations } from "@/lib/operations";

/**
 * Web-module API client (mock). Every mutation goes through
 * operations.submit() — the 202 + operation pattern — and the UI treats the
 * returned operation as an acknowledgement only: success arrives when the
 * operation reaches a verified terminal state. When the Go control plane
 * exists, each function swaps its body for fetch("/api/v1/…") of the same shape.
 */

export interface OperationAccepted {
  operation: Operation;
  request_id: string;
}

type OpInput = Omit<SubmitSpec, "actor_id" | "organization_id">;

async function submitOp(spec: OpInput): Promise<OperationAccepted> {
  await sleep(200);
  const operation = operations.submit({
    ...spec,
    actor_id: db.currentUser,
    organization_id: db.currentOrganization,
  });
  return { operation, request_id: operation.correlation_id };
}

// ---------------------------------------------------------------------------
// Reads (GET /websites, /applications)
// ---------------------------------------------------------------------------

export async function listWebsites(): Promise<Website[]> {
  return withLatency(() => db.websites);
}

export async function getWebsite(siteId: string): Promise<Website | undefined> {
  return withLatency(() => db.websites.find((w) => w.id === siteId));
}

export async function listApplications(): Promise<Application[]> {
  return withLatency(() => db.applications);
}

export async function getApplication(appId: string): Promise<Application | undefined> {
  return withLatency(() => db.applications.find((a) => a.id === appId));
}

// ---------------------------------------------------------------------------
// Websites
// ---------------------------------------------------------------------------

export interface ProvisionWebsiteInput {
  name: string;
  title: string;
  kind: "static" | "php" | "node";
  primary_domain: string;
  use_preview_hostname: boolean;
  source: "upload" | "git";
  git_url?: string;
}

export async function provisionWebsite(input: ProvisionWebsiteInput) {
  return submitOp({
    kind: "website.provision",
    title: `Provision ${input.name}${input.kind === "php" ? " (PHP)" : input.kind === "node" ? " (Node)" : ""}`,
    resource_ref: { type: "website", id: `web_new_${input.name}`, name: input.name },
    workload_category: "serving",
    step_titles: [
      "Validate capability fit",
      input.source === "git" ? "Clone source repository" : "Stage uploaded files",
      "Create web root",
      "Configure nginx site",
      "Issue TLS certificate",
      "Health check",
    ],
  });
}

export async function deployWebsiteNow(siteId: string, siteName: string) {
  return submitOp({
    kind: "website.deploy",
    title: `Deploy ${siteName} (current release)`,
    resource_ref: { type: "website", id: siteId, name: siteName },
    workload_category: "serving",
    step_titles: [
      "Validate current release",
      "Upload artifact",
      "Release to web root",
      "Reload nginx",
      "Health check",
    ],
  });
}

export async function uploadWebsiteDeploy(siteId: string, siteName: string, fileName: string) {
  return submitOp({
    kind: "website.deploy",
    title: `Deploy ${siteName} from ${fileName}`,
    resource_ref: { type: "website", id: siteId, name: siteName },
    workload_category: "serving",
    step_titles: [
      `Validate ${fileName}`,
      "Upload archive",
      "Release to web root",
      "Reload nginx",
      "Health check",
    ],
  });
}

export async function deleteWebsite(siteId: string, siteName: string) {
  return submitOp({
    kind: "website.delete",
    title: `Delete website ${siteName}`,
    resource_ref: { type: "website", id: siteId, name: siteName },
    workload_category: "serving",
    step_titles: [
      "Snapshot for retention window",
      "Remove nginx site config",
      "Release TLS certificate",
      "Remove web root",
      "Verify removal",
    ],
  });
}

export async function applyWebsiteSettings(siteId: string, siteName: string) {
  return submitOp({
    kind: "website.configure",
    title: `Apply configuration — ${siteName}`,
    resource_ref: { type: "website", id: siteId, name: siteName },
    workload_category: "serving",
    step_titles: [
      "Validate nginx config (dry run)",
      "Apply document root + redirects",
      "Reload nginx",
      "Health check",
    ],
  });
}

export async function previewWebsiteSettings(siteId: string) {
  await sleep(350);
  return {
    valid: true as const,
    config_diff: [
      { path: "root", from: "/var/www/acme-consulting/current", to: "/var/www/acme-consulting/current" },
      { path: "error_page", from: "(default)", to: "/50x.html" },
    ],
    site_id: siteId,
  };
}

export async function createStaging(siteId: string, siteName: string) {
  return submitOp({
    kind: "website.staging.create",
    title: `Create staging copy of ${siteName}`,
    resource_ref: { type: "website", id: siteId, name: siteName },
    workload_category: "batch",
    step_titles: [
      "Snapshot production files",
      "Copy database-less site content",
      "Attach staging hostname",
      "Verify staging loads",
    ],
  });
}

export async function promoteStaging(stagingName: string, siteName: string) {
  return submitOp({
    kind: "website.staging.promote",
    title: `Promote ${stagingName} to ${siteName}`,
    resource_ref: { type: "website", id: siteName, name: stagingName },
    workload_category: "serving",
    step_titles: [
      "Diff staging vs production",
      "Swap release symlink",
      "Reload nginx",
      "Health check production URL",
    ],
  });
}

export async function addRedirect(siteId: string, siteName: string, match: string) {
  return submitOp({
    kind: "website.redirect.create",
    title: `Add redirect ${match} — ${siteName}`,
    resource_ref: { type: "website", id: siteId, name: siteName },
    workload_category: "serving",
    step_titles: ["Validate against existing rules (loop + conflict)", "Add rule", "Reload nginx", "Test redirect"],
  });
}

export async function removeRedirect(siteId: string, siteName: string, match: string) {
  return submitOp({
    kind: "website.redirect.remove",
    title: `Remove redirect ${match} — ${siteName}`,
    resource_ref: { type: "website", id: siteId, name: siteName },
    workload_category: "serving",
    step_titles: ["Remove rule", "Reload nginx", "Confirm rule gone"],
  });
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export interface ProvisionAppInput {
  name: string;
  runtime: "node" | "php" | "python";
  runtime_version: string;
  source: "git" | "upload";
  repo_url?: string;
  branch?: string;
  build_command: string;
  start_command: string;
  env_count: number;
}

export async function provisionApp(input: ProvisionAppInput) {
  return submitOp({
    kind: "app.provision",
    title: `Provision ${input.name} (${input.runtime} ${input.runtime_version})`,
    resource_ref: { type: "application", id: `app_new_${input.name}`, name: input.name },
    workload_category: "serving",
    step_titles: [
      "Preflight: capability fit + port conflict",
      input.source === "git" ? `Clone ${input.repo_url ?? "repository"}` : "Stage uploaded source",
      "Install dependencies",
      "Build (batch-priority build step)",
      "Release serving container",
      "Health check",
    ],
  });
}

export async function deployApp(appId: string, appName: string) {
  return submitOp({
    kind: "app.release.deploy",
    title: `Deploy ${appName} (latest commit)`,
    resource_ref: { type: "application", id: appId, name: appName },
    workload_category: "serving",
    step_titles: [
      "Clone repository (latest main)",
      "Install dependencies",
      "Build bundle",
      "Release to serving container",
      "Health check",
    ],
  });
}

export async function restartApp(appId: string, appName: string) {
  return submitOp({
    kind: "app.process.restart",
    title: `Restart ${appName}`,
    resource_ref: { type: "application", id: appId, name: appName },
    workload_category: "serving",
    step_titles: ["Stop process gracefully", "Start process", "Health check"],
  });
}

export async function scaleProcess(appName: string, processName: string, replicas: number) {
  return submitOp({
    kind: "app.process.scale",
    title: `Scale ${appName}/${processName} to ${replicas} replica${replicas === 1 ? "" : "s"}`,
    resource_ref: { type: "application", id: appName, name: processName },
    workload_category: "serving",
    step_titles: [`Start ${replicas} process group`, "Health check each replica"],
  });
}

export async function rollbackDeployment(appName: string, toSha: string) {
  return submitOp({
    kind: "app.release.rollback",
    title: `Roll back ${appName} to ${toSha}`,
    resource_ref: { type: "application", id: appName, name: toSha },
    workload_category: "serving",
    step_titles: [
      "Verify previous artifact is retained",
      "Point release symlink to previous artifact",
      "Reload process",
      "Health check",
    ],
  });
}

export async function retryDeployment(appName: string, commitSha: string) {
  return submitOp({
    kind: "app.release.deploy",
    title: `Retry deploy ${appName} @ ${commitSha} (attempt 2)`,
    resource_ref: { type: "application", id: appName, name: commitSha },
    workload_category: "serving",
    step_titles: [
      "Clone repository",
      "Install dependencies",
      "Build bundle (attempt 2)",
      "Release to serving container",
      "Health check",
    ],
  });
}

export async function updateEnvVars(appName: string, keys: string[]) {
  return submitOp({
    kind: "app.environment.update",
    title: `Update environment — ${appName} (${keys.length} variable${keys.length === 1 ? "" : "s"})`,
    resource_ref: { type: "application", id: appName, name: appName },
    workload_category: "serving",
    step_titles: [
      "Validate keys (duplicates, reserved names)",
      "Encrypt secret values",
      "Apply and restart process",
      "Health check",
    ],
  });
}

export async function updateRuntime(appName: string, version: string) {
  return submitOp({
    kind: "app.runtime.update",
    title: `Update ${appName} runtime to ${version}`,
    resource_ref: { type: "application", id: appName, name: appName },
    workload_category: "serving",
    step_titles: ["Validate version against installed catalog", "Rebuild with new runtime", "Release container", "Health check"],
  });
}

export async function connectGit(appName: string, repo: string) {
  return submitOp({
    kind: "app.git.connect",
    title: `Connect ${repo} to ${appName}`,
    resource_ref: { type: "application", id: appName, name: repo },
    workload_category: "serving",
    step_titles: [
      "Register repository (scoped read-only deploy key)",
      "Install webhook",
      "Test fetch access",
    ],
  });
}

export async function disconnectGit(appName: string, repo: string) {
  return submitOp({
    kind: "app.git.disconnect",
    title: `Disconnect ${repo} from ${appName}`,
    resource_ref: { type: "application", id: appName, name: repo },
    workload_category: "serving",
    step_titles: ["Revoke deploy key", "Remove webhook"],
  });
}

export async function attachDomain(resourceId: string, resourceName: string, hostname: string) {
  return submitOp({
    kind: "website.binding.add",
    title: `Attach ${hostname} to ${resourceName}`,
    resource_ref: { type: "website", id: resourceId, name: resourceName },
    workload_category: "serving",
    step_titles: [
      "Verify domain ownership + uniqueness",
      "Add server_name binding",
      "Reload nginx",
      "Request TLS certificate",
    ],
  });
}

export async function detachDomain(resourceId: string, resourceName: string, hostname: string) {
  return submitOp({
    kind: "website.binding.remove",
    title: `Detach ${hostname} from ${resourceName}`,
    resource_ref: { type: "website", id: resourceId, name: resourceName },
    workload_category: "serving",
    step_titles: ["Remove server_name binding", "Reload nginx", "Confirm hostname gone"],
  });
}

/** Best-effort cancel for batch jobs (Stage 6 §5.1 — cannot promise reversal). */
export async function cancelBatchOperation(operationId: string, title: string) {
  await sleep(150);
  const op = operations.cancel(operationId);
  return {
    operation: op,
    cancelled: op?.status === "cancelled",
    request_id: `req_${operationId.slice(-8)}`,
    title,
  };
}
