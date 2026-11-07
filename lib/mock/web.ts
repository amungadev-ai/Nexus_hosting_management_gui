import type { Iso8601, Operation, WorkloadCategory } from "@/lib/types";

/**
 * Web-module fixture extensions (websites, apps, deployments, git, env,
 * processes, logs, redirects, staging, bindings). Extends lib/mock/data.ts —
 * never mutates the shared dataset. Kenya-context entities reference the
 * shared `db` records (Wanjiku Digital, Acme Consulting, kilishop.co.ke).
 */

export interface DeploymentFixture {
  id: string; // dep_01J…
  app_id: string;
  release_id: string; // rel_01J…
  commit_sha: string;
  commit_message: string;
  branch: string;
  source: "git" | "upload";
  actor_id: string;
  actor_label: string;
  status: "succeeded" | "failed";
  created_at: Iso8601;
  finished_at: Iso8601;
  artifact_digest: string;
  operation_id: string; // paired Operation in depOperations
  health_after: "healthy" | "degraded" | "unknown";
  error?: { code: string; detail: string; retryable: boolean };
}

/** Operations belonging to dep fixtures — history, not engine-seeded. */
export const depOperations: Operation[] = [
  {
    id: "op_01JDR1OP",
    kind: "app.release.deploy",
    title: "Deploy orders-api 8f2c1ab",
    status: "succeeded",
    workload_category: "serving",
    actor_id: "usr_01JDEV02",
    organization_id: "org_01JKV7Q4N2",
    resource_ref: { type: "deployment", id: "dep_01JDR01A", name: "orders-api" },
    steps: [
      { key: "step_1", title: "Clone repository (main @ 8f2c1ab)", status: "succeeded", occurred_at: "2026-11-06T12:00:10Z" },
      { key: "step_2", title: "Install dependencies (npm ci)", status: "succeeded", occurred_at: "2026-11-06T12:01:40Z" },
      { key: "step_3", title: "Build bundle", status: "succeeded", occurred_at: "2026-11-06T12:03:20Z" },
      { key: "step_4", title: "Release to serving container", status: "succeeded", occurred_at: "2026-11-06T12:05:00Z" },
      { key: "step_5", title: "Health check /healthz", status: "succeeded", occurred_at: "2026-11-06T12:05:50Z" },
    ],
    progress: { completed_steps: 5, total_steps: 5 },
    created_at: "2026-11-06T12:00:00Z",
    started_at: "2026-11-06T12:00:10Z",
    finished_at: "2026-11-06T12:06:05Z",
    last_verified_at: "2026-11-06T12:06:05Z",
    correlation_id: "req_01JDR1CR",
  },
  {
    id: "op_01JDR2OP",
    kind: "app.release.deploy",
    title: "Deploy orders-api 4b91de7",
    status: "succeeded",
    workload_category: "serving",
    actor_id: "usr_01JDEV02",
    organization_id: "org_01JKV7Q4N2",
    resource_ref: { type: "deployment", id: "dep_01JDR02B", name: "orders-api" },
    steps: [
      { key: "step_1", title: "Clone repository (main @ 4b91de7)", status: "succeeded", occurred_at: "2026-11-05T16:20:05Z" },
      { key: "step_2", title: "Install dependencies (npm ci)", status: "succeeded", occurred_at: "2026-11-05T16:21:30Z" },
      { key: "step_3", title: "Build bundle", status: "succeeded", occurred_at: "2026-11-05T16:23:00Z" },
      { key: "step_4", title: "Release to serving container", status: "succeeded", occurred_at: "2026-11-05T16:24:40Z" },
      { key: "step_5", title: "Health check /healthz", status: "succeeded", occurred_at: "2026-11-05T16:25:20Z" },
    ],
    progress: { completed_steps: 5, total_steps: 5 },
    created_at: "2026-11-05T16:20:00Z",
    started_at: "2026-11-05T16:20:05Z",
    finished_at: "2026-11-05T16:25:30Z",
    last_verified_at: "2026-11-05T16:25:30Z",
    correlation_id: "req_01JDR2CR",
  },
  {
    id: "op_01JDR3OP",
    kind: "app.release.deploy",
    title: "Deploy orders-api 1a3f9c2",
    status: "succeeded",
    workload_category: "serving",
    actor_id: "usr_01JDEV02",
    organization_id: "org_01JKV7Q4N2",
    resource_ref: { type: "deployment", id: "dep_01JDR03C", name: "orders-api" },
    steps: [
      { key: "step_1", title: "Clone repository (main @ 1a3f9c2)", status: "succeeded", occurred_at: "2026-10-25T08:40:00Z" },
      { key: "step_2", title: "Install dependencies (npm ci)", status: "succeeded", occurred_at: "2026-10-25T08:41:10Z" },
      { key: "step_3", title: "Build bundle", status: "succeeded", occurred_at: "2026-10-25T08:42:30Z" },
      { key: "step_4", title: "Release to serving container", status: "succeeded", occurred_at: "2026-10-25T08:44:00Z" },
      { key: "step_5", title: "Health check /healthz", status: "succeeded", occurred_at: "2026-10-25T08:44:45Z" },
    ],
    progress: { completed_steps: 5, total_steps: 5 },
    created_at: "2026-10-25T08:40:00Z",
    started_at: "2026-10-25T08:40:00Z",
    finished_at: "2026-10-25T08:44:50Z",
    last_verified_at: "2026-10-25T08:44:50Z",
    correlation_id: "req_01JDR3CR",
  },
  {
    id: "op_01JDR4OP",
    kind: "app.release.deploy",
    title: "Deploy orders-api c77e013",
    status: "failed",
    workload_category: "serving",
    actor_id: "usr_01JDEV02",
    organization_id: "org_01JKV7Q4N2",
    resource_ref: { type: "deployment", id: "dep_01JDR04D", name: "orders-api" },
    steps: [
      { key: "step_1", title: "Clone repository (main @ c77e013)", status: "succeeded", occurred_at: "2026-11-06T09:15:00Z" },
      { key: "step_2", title: "Install dependencies (npm ci)", status: "succeeded", occurred_at: "2026-11-06T09:16:20Z" },
      { key: "step_3", title: "Build bundle", status: "failed", occurred_at: "2026-11-06T09:18:10Z" },
      { key: "step_4", title: "Release to serving container", status: "pending" },
      { key: "step_5", title: "Health check /healthz", status: "pending" },
    ],
    progress: { completed_steps: 2, total_steps: 5 },
    created_at: "2026-11-06T09:15:00Z",
    started_at: "2026-11-06T09:15:00Z",
    finished_at: "2026-11-06T09:18:40Z",
    correlation_id: "req_01JDR4CR",
    error: {
      code: "APP_BUILD_FAILED",
      detail:
        "Build step failed: TypeScript compilation found 3 errors in src/payments/mpesa.ts. The previous release (8f2c1ab) is still serving traffic — nothing was replaced.",
      retryable: true,
    },
  },
];

export const webDeployments: DeploymentFixture[] = [
  {
    id: "dep_01JDR01A",
    app_id: "app_01JORDR01",
    release_id: "rel_01JDR01R",
    commit_sha: "8f2c1ab",
    commit_message: "Add retry backoff to M-Pesa STK polling",
    branch: "main",
    source: "git",
    actor_id: "usr_01JDEV02",
    actor_label: "Kevin Otieno (Developer)",
    status: "succeeded",
    created_at: "2026-11-06T12:00:00Z",
    finished_at: "2026-11-06T12:06:05Z",
    artifact_digest: "sha256:12cd44ef…",
    operation_id: "op_01JDR1OP",
    health_after: "healthy",
  },
  {
    id: "dep_01JDR02B",
    app_id: "app_01JORDR01",
    release_id: "rel_01JDR02R",
    commit_sha: "4b91de7",
    commit_message: "Switch session cache to LRU eviction",
    branch: "main",
    source: "git",
    actor_id: "usr_01JDEV02",
    actor_label: "Kevin Otieno (Developer)",
    status: "succeeded",
    created_at: "2026-11-05T16:20:00Z",
    finished_at: "2026-11-05T16:25:30Z",
    artifact_digest: "sha256:9ab1002c…",
    operation_id: "op_01JDR2OP",
    health_after: "healthy",
  },
  {
    id: "dep_01JDR04D",
    app_id: "app_01JORDR01",
    release_id: "rel_01JDR04R",
    commit_sha: "c77e013",
    commit_message: "Increase DB pool to 20 connections",
    branch: "main",
    source: "git",
    actor_id: "usr_01JDEV02",
    actor_label: "Kevin Otieno (Developer)",
    status: "failed",
    created_at: "2026-11-06T09:15:00Z",
    finished_at: "2026-11-06T09:18:40Z",
    artifact_digest: "sha256:—",
    operation_id: "op_01JDR4OP",
    health_after: "unknown",
    error: {
      code: "APP_BUILD_FAILED",
      detail:
        "Build step failed: TypeScript compilation found 3 errors in src/payments/mpesa.ts. The previous release is still serving traffic.",
      retryable: true,
    },
  },
  {
    id: "dep_01JDR03C",
    app_id: "app_01JORDR01",
    release_id: "rel_01JDR03R",
    commit_sha: "1a3f9c2",
    commit_message: "Initial deploy of orders-api",
    branch: "main",
    source: "git",
    actor_id: "usr_01JDEV02",
    actor_label: "Kevin Otieno (Developer)",
    status: "succeeded",
    created_at: "2026-10-25T08:40:00Z",
    finished_at: "2026-10-25T08:44:50Z",
    artifact_digest: "sha256:77aa01d0…",
    operation_id: "op_01JDR3OP",
    health_after: "healthy",
  },
];

export interface EnvVarFixture {
  key: string;
  value: string | null; // null = secret, never returned after persistence (write-only)
  is_secret: boolean;
  set_at: Iso8601;
  set_by: string;
}

export const webEnvVars: EnvVarFixture[] = [
  { key: "NODE_ENV", value: "production", is_secret: false, set_at: "2026-10-25T08:30:00Z", set_by: "Kevin Otieno" },
  { key: "PORT", value: "3000", is_secret: false, set_at: "2026-10-25T08:30:00Z", set_by: "Kevin Otieno" },
  { key: "CACHE_TTL_SECONDS", value: "300", is_secret: false, set_at: "2026-11-05T16:19:00Z", set_by: "Kevin Otieno" },
  { key: "DATABASE_URL", value: null, is_secret: true, set_at: "2026-11-05T10:00:00Z", set_by: "Kevin Otieno" },
  { key: "MPESA_CONSUMER_SECRET", value: null, is_secret: true, set_at: "2026-10-25T08:31:00Z", set_by: "Jane Wanjiku" },
];

export interface GitConnectionFixture {
  id: string; // git_01J…
  app_id: string;
  provider: "github" | "gitlab";
  repository_ref: string;
  branch: string;
  deploy_key_permissions: "read-only";
  webhook_url: string;
  last_deployed_sha: string;
  connected_at: Iso8601;
}

export const webGitConnections: GitConnectionFixture[] = [
  {
    id: "git_01JGIT01",
    app_id: "app_01JORDR01",
    provider: "github",
    repository_ref: "wanjiku-digital/orders-api",
    branch: "main",
    deploy_key_permissions: "read-only",
    webhook_url: "https://panel.wanjiku.digital/api/v1/hooks/github/git_01JGIT01",
    last_deployed_sha: "8f2c1ab",
    connected_at: "2026-10-25T08:32:00Z",
  },
];

export interface ProcessFixture {
  id: string; // prc_01J…
  app_id: string;
  name: string;
  command: string;
  replicas: number;
  state: "running" | "stopped" | "restarting";
  restart_policy: "on-failure" | "always" | "never";
  workload_category: WorkloadCategory;
  note?: string;
}

export const webProcesses: ProcessFixture[] = [
  {
    id: "prc_01JWEB01",
    app_id: "app_01JORDR01",
    name: "web",
    command: "node dist/main.js",
    replicas: 1,
    state: "running",
    restart_policy: "on-failure",
    workload_category: "serving",
    note: "Serves the API on port 3000 — the serving process your traffic hits.",
  },
  {
    id: "prc_01JWRK02",
    app_id: "app_01JORDR01",
    name: "queue-worker",
    command: "node dist/worker.js",
    replicas: 2,
    state: "running",
    restart_policy: "on-failure",
    workload_category: "serving",
    note: "Drains the payment-reconciliation queue.",
  },
  {
    id: "prc_01JIMG03",
    app_id: "app_01JIMGW02",
    name: "worker",
    command: "python worker.py",
    replicas: 2,
    state: "running",
    restart_policy: "on-failure",
    workload_category: "batch",
    note: "Batch worker — yields to site traffic when the server is busy. This is normal.",
  },
];

/** App logs — already redacted at source (secrets never reach the UI). */
export const appLogLines: { ts: string; severity: "info" | "warn" | "error"; message: string }[] = [
  { ts: "15:01:02", severity: "info", message: "GET /healthz 200 2ms" },
  { ts: "15:01:44", severity: "info", message: "POST /v1/orders 201 41ms" },
  { ts: "15:02:10", severity: "warn", message: "M-Pesa poll attempt 3 late by 800ms — backing off (config MPESA_CALLBACK_TIMEOUT=[redacted])" },
  { ts: "15:02:31", severity: "info", message: "GET /v1/orders/4821 200 12ms" },
  { ts: "15:03:05", severity: "error", message: "DATABASE_URL=[redacted] connection pool at 18/20 — consider raising the ceiling" },
  { ts: "15:03:07", severity: "info", message: "pool released to 12/20" },
  { ts: "15:04:19", severity: "info", message: "GET /healthz 200 1ms" },
  { ts: "15:05:52", severity: "warn", message: "session cache eviction running — CACHE_TTL_SECONDS=300" },
];

export interface RedirectFixture {
  id: string; // rdr_01J…
  website_id: string;
  match: string;
  destination: string;
  permanent: boolean;
  priority: number;
  test: "passed" | "pending" | "conflict";
  test_note?: string;
}

export const websiteRedirects: RedirectFixture[] = [
  {
    id: "rdr_01JHTTP01",
    website_id: "web_01JACME01",
    match: "http://acmeconsulting.co.ke/$",
    destination: "https://acmeconsulting.co.ke/$1",
    permanent: true,
    priority: 10,
    test: "passed",
    test_note: "Forwards to HTTPS — verified 2026-11-05.",
  },
  {
    id: "rdr_01JWWWX02",
    website_id: "web_01JACME01",
    match: "https://www.acmeconsulting.co.ke/$",
    destination: "https://acmeconsulting.co.ke/$1",
    permanent: true,
    priority: 20,
    test: "passed",
    test_note: "www → apex, no loop detected.",
  },
  {
    id: "rdr_01JSVCV03",
    website_id: "web_01JACME01",
    match: "/services(/.*)?$",
    destination: "/what-we-do$1",
    permanent: false,
    priority: 30,
    test: "pending",
    test_note: "Created just now — first test runs with the next apply.",
  },
];

export interface StagingFixture {
  id: string; // stg_01J…
  website_id: string;
  name: string;
  url: string;
  created_at: Iso8601;
  synced_at: Iso8601;
  drift: string;
}

export const websiteStaging: StagingFixture[] = [
  {
    id: "stg_01JSTG01",
    website_id: "web_01JACME01",
    name: "acme-consulting-staging",
    url: "https://stg.acmeconsulting.co.ke",
    created_at: "2026-11-03T10:00:00Z",
    synced_at: "2026-11-06T11:00:00Z",
    drift: "In sync with production (last synced 11:00).",
  },
  {
    id: "stg_01JSTG02",
    website_id: "web_01JKILI02",
    name: "kili-shop-staging",
    url: "https://stg.kilishop.co.ke",
    created_at: "2026-10-31T09:30:00Z",
    synced_at: "2026-11-04T18:00:00Z",
    drift: "2 days behind production — WooCommerce 9.4 update not applied here yet.",
  },
];

export interface BindingFixture {
  id: string; // bnd_01J…
  resource_type: "website" | "application";
  resource_id: string;
  hostname: string;
  is_primary: boolean;
  tls: "active" | "pending" | "none";
  tls_certificate_id?: string;
}

export const websiteBindings: BindingFixture[] = [
  {
    id: "bnd_01JACME01",
    resource_type: "website",
    resource_id: "web_01JACME01",
    hostname: "acmeconsulting.co.ke",
    is_primary: true,
    tls: "active",
    tls_certificate_id: "crt_01JACME01",
  },
  {
    id: "bnd_01JACME02",
    resource_type: "website",
    resource_id: "web_01JACME01",
    hostname: "www.acmeconsulting.co.ke",
    is_primary: false,
    tls: "active",
    tls_certificate_id: "crt_01JACME01",
  },
  {
    id: "bnd_01JKILI01",
    resource_type: "website",
    resource_id: "web_01JKILI02",
    hostname: "kilishop.co.ke",
    is_primary: true,
    tls: "active",
    tls_certificate_id: "crt_01JKILI02",
  },
  {
    id: "bnd_01JAPX01",
    resource_type: "application",
    resource_id: "app_01JORDR01",
    hostname: "api.wanjiku.co.ke",
    is_primary: true,
    tls: "none",
  },
];

/** Runtime catalog — only versions actually installed/supported (no invented options). */
export const RUNTIME_CATALOG: {
  runtime_kind: "node" | "php" | "python";
  version: string;
  support_state: "supported";
}[] = [
  { runtime_kind: "node", version: "22 LTS", support_state: "supported" },
  { runtime_kind: "node", version: "20 LTS", support_state: "supported" },
  { runtime_kind: "php", version: "8.3", support_state: "supported" },
  { runtime_kind: "php", version: "8.2", support_state: "supported" },
  { runtime_kind: "python", version: "3.12", support_state: "supported" },
];

export function deploymentsForApp(appId: string): DeploymentFixture[] {
  return webDeployments
    .filter((d) => d.app_id === appId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function deploymentOperation(deploy: DeploymentFixture): Operation | undefined {
  return depOperations.find((op) => op.id === deploy.operation_id);
}
