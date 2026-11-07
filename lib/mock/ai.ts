import type { Iso8601 } from "@/lib/types";
import { db } from "@/lib/mock/data";

/**
 * AI-module fixtures (§4.18). Reports are evidence-backed and read-only:
 * findings carry evidence, confidence, and a typed suggested action the user
 * must approve (DS-017 plan card; "AI proposes, you approve").
 */

export type Confidence = "high" | "medium" | "low";

export interface FindingEvidence {
  type: "metric" | "log" | "state";
  ref: string;
  summary: string;
}

export interface Finding {
  id: string;
  title: string;
  detail: string;
  evidence: FindingEvidence[];
  confidence: Confidence;
  suggested_action: {
    label: string;
    risk: "low" | "medium" | "high";
    plan_id: string; // → /assistant/plans/[plan]
    before: string;
    after: string;
    affected: string[];
    downtime: string;
    reversibility: string;
  } | null;
}

export interface DiagnosticReport {
  id: string; // rep_01J…
  incident_id: string | null;
  title: string;
  created_at: Iso8601;
  context_scope: string;
  diagnosis: string;
  uncertainty: string;
  findings: Finding[];
}

export interface AiPlan {
  id: string; // aip_01J…
  title: string;
  operation_kind: string;
  risk: "low" | "medium" | "high";
  steps: { order: number; action: string; detail: string }[];
  impact: { before: string; after: string; affected: string[]; downtime: string; reversibility: string };
  diff: { path: string; before: string; after: string }[];
  permission_check: { allowed: boolean; reason: string };
  policy_note: string;
}

export interface AiRun {
  id: string; // arun_01J…
  plan_id: string;
  title: string;
  status: "awaiting_approval" | "running" | "succeeded" | "failed" | "stopped";
  /** When the run was created (the plan was approved / queued). */
  created_at: Iso8601;
  /** What data the run analyzed — inputs are recorded, redacted. */
  inputs: string[];
  steps: { title: string; status: "pending" | "running" | "succeeded" | "failed" | "stopped"; note: string }[];
  observed: string;
  rollback: string;
}

const T = (h: number, m: number) =>
  `2026-11-06T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

export const diagnosticReports: DiagnosticReport[] = [
  {
    id: "rep_01JMEM01",
    incident_id: "inc_01JINC01",
    title: "orders-api memory pressure",
    created_at: T(14, 41),
    context_scope: "resource app_01JORDR01 · logs last 1h · redacted",
    diagnosis:
      "orders-api sits above 80% of its memory ceiling because the /orders endpoint keeps an unbounded in-memory cache. The cache grows with unique order IDs until the cgroup limit is hit, then the OOM killer restarts the app (1 kill in 7 days).",
    uncertainty:
      "The cache-growth pattern matches the memory curve with high confidence, but a slow leak in the websocket layer would look similar over a 7-day window. Verify by watching memory.current after a restart before raising the ceiling.",
    findings: [
      {
        id: "f_01",
        title: "In-memory cache without eviction on /orders",
        detail: "memory.current climbs ~6 MB/hour and never drops, while request rate is flat — the cache keeps every order ID seen since start.",
        evidence: [
          { type: "metric", ref: "app_01JORDR01/memory.peak", summary: "490 MB peak of 512 MB ceiling (24h p99)" },
          { type: "log", ref: "orders-api/14:58", summary: "memory.current 390 MB of memory.max 400 MB — approaching limit" },
        ],
        confidence: "high",
        suggested_action: {
          label: "Restart orders-api now and cap memory.max at 640 MB",
          risk: "medium",
          plan_id: "aip_01JRESTART1",
          before: "orders-api running since Oct 25 · memory.max 400 MB",
          after: "orders-api restarted · memory.max 640 MB (within VPS headroom)",
          affected: ["orders-api", "kili-shop checkout"],
          downtime: "Brief — seconds of connection resets during restart",
          reversibility: "Fully reversible — restart again; ceiling rolls back to 400 MB",
        },
      },
      {
        id: "f_02",
        title: "1 OOM kill on Nov 3 (13:22)",
        detail: "The kernel killed the largest process when memory.max was hit; the app restarted itself. No data corruption, but in-flight checkouts failed.",
        evidence: [
          { type: "state", ref: "cgroup/memory.events", summary: "oom_kill_count 1 in the last 7 days" },
          { type: "log", ref: "agent/2026-11-03 13:22", summary: "memory.events: oom_kill recorded for app_01JORDR01" },
        ],
        confidence: "high",
        suggested_action: null,
      },
      {
        id: "f_03",
        title: "Cache library supports TTL eviction",
        detail: "The app's cache layer exposes a TTL option that is currently disabled — enabling it (env CACHE_TTL=900) bounds growth without a code change.",
        evidence: [
          { type: "state", ref: "app_01JORDR01/environment", summary: "CACHE_TTL not set (values redacted in UI)" },
        ],
        confidence: "medium",
        suggested_action: {
          label: "Set CACHE_TTL=900 on orders-api environment",
          risk: "low",
          plan_id: "aip_01JCACHETTL2",
          before: "CACHE_TTL unset — cache never evicts",
          after: "CACHE_TTL=900 — entries expire after 15 minutes",
          affected: ["orders-api"],
          downtime: "None — env change applies on the next restart",
          reversibility: "Fully reversible — unset the variable",
        },
      },
    ],
  },
  {
    id: "rep_01JHEALTH02",
    incident_id: null,
    title: "team-cloud (Nextcloud) failing health checks",
    created_at: T(14, 52),
    context_scope: "resource svc_01JNEXT03 · logs last 15m · redacted",
    diagnosis:
      "team-cloud refuses connections on :8080 while its container reports running. The health check fails 3×/15m — likely the app restarted into a degraded state after its volume filled to 22 GB of 100 GB. No ransomware indicators; access log shows normal Nairobi traffic.",
    uncertainty:
      "Whether the failure is the app process or its database connection cannot be separated from the panel's evidence alone — the runbook step 'read the app's own log' decides it.",
    findings: [
      {
        id: "f_01",
        title: "Process up, port closed",
        detail: "The container is running but nothing listens on :8080 — a process-level crash loop or a failed start hook.",
        evidence: [
          { type: "log", ref: "team-cloud/14:47", summary: "health check failed: connection refused on :8080 (3 of 3 probes)" },
          { type: "state", ref: "svc_01JNEXT03/last_health_status", summary: "unhealthy" },
        ],
        confidence: "high",
        suggested_action: {
          label: "Restart team-cloud container",
          risk: "low",
          plan_id: "aip_01JRESTART2",
          before: "team-cloud: running but port 8080 closed",
          after: "team-cloud: restarted, health check expected to pass",
          affected: ["team-cloud"],
          downtime: "Seconds during container restart",
          reversibility: "Fully reversible — restart is idempotent",
        },
      },
    ],
  },
];

export const aiPlans: AiPlan[] = [
  {
    id: "aip_01JRESTART1",
    title: "Restart orders-api and raise memory.max to 640 MB",
    operation_kind: "app.process.restart + resource.limit.update",
    risk: "medium",
    steps: [
      { order: 1, action: "resource.limit.update", detail: "Set memory.max 400 MB → 640 MB (validated against VPS headroom)" },
      { order: 2, action: "app.process.restart", detail: "Restart orders-api; connections drain before stop" },
      { order: 3, action: "workload.verify_cgroup", detail: "Read back memory.max and confirm it applied" },
      { order: 4, action: "health_check", detail: "Watch memory.current for 30 minutes; verify it stays under 80%" },
    ],
    impact: {
      before: "memory.max 400 MB · cache unbounded · 1 OOM kill in 7d",
      after: "memory.max 640 MB · process restarted · headroom verified",
      affected: ["orders-api", "kili-shop checkout"],
      downtime: "Brief — seconds of connection resets",
      reversibility: "Rollback: restore memory.max 400 MB (restart again if needed)",
    },
    diff: [{ path: "cgroup/app_01JORDR01/memory.max", before: "419430400", after: "671088640" }],
    permission_check: { allowed: true, reason: "actor has server.manage and workload.usage.read" },
    policy_note: "The policy engine validates this plan again at execution — approval here is not a bypass.",
  },
  {
    id: "aip_01JCACHETTL2",
    title: "Set CACHE_TTL=900 on orders-api",
    operation_kind: "app.environment.update + app.process.restart",
    risk: "low",
    steps: [
      { order: 1, action: "app.environment.update", detail: "Add CACHE_TTL=900 (value stored write-only, redacted in UI/logs)" },
      { order: 2, action: "app.process.restart", detail: "Restart to load the new environment" },
      { order: 3, action: "metrics.read", detail: "Confirm memory.current plateaus under 300 MB" },
    ],
    impact: {
      before: "CACHE_TTL unset — cache grows without bound",
      after: "CACHE_TTL=900 — entries evict after 15 minutes",
      affected: ["orders-api"],
      downtime: "None until the restart",
      reversibility: "Fully reversible — unset the variable and restart",
    },
    diff: [{ path: "env/orders-api/CACHE_TTL", before: "(unset)", after: "900" }],
    permission_check: { allowed: true, reason: "actor has website.deploy on app_01JORDR01's org" },
    policy_note: "Secrets stay redacted; the plan stores names, never values.",
  },
  {
    id: "aip_01JRESTART2",
    title: "Restart team-cloud container",
    operation_kind: "service.instance.restart",
    risk: "low",
    steps: [
      { order: 1, action: "service.container.restart", detail: "Restart svc_01JNEXT03; stop is graceful with 30s timeout" },
      { order: 2, action: "service.health_check", detail: "Poll :8080 health endpoint until it answers" },
    ],
    impact: {
      before: "running, port closed, health checks failing",
      after: "restarted, health check passing (or escalated to the runbook)",
      affected: ["team-cloud"],
      downtime: "Seconds",
      reversibility: "Idempotent — restart again if the first does not clear it",
    },
    diff: [],
    permission_check: { allowed: true, reason: "actor has service.manage" },
    policy_note: "If the restart does not clear the failure, the runbook escalates to volume inspection — no automatic destructive step.",
  },
];

export const aiRuns: AiRun[] = [
  {
    id: "arun_01JRUN01",
    plan_id: "aip_01JRESTART2",
    title: "Restart team-cloud (approved by Jane Wanjiku)",
    status: "succeeded",
    created_at: T(14, 53),
    inputs: [
      "resource svc_01JNEXT03 — state, last health status",
      "logs team-cloud — last 15 minutes, secrets redacted",
      "report rep_01JHEALTH02 — diagnosis and approved finding",
    ],
    steps: [
      { title: "Approval recorded", status: "succeeded", note: "Jane Wanjiku approved after impact review, 14:53" },
      { title: "Policy validation", status: "succeeded", note: "service.manage present; plan hash bound" },
      { title: "Graceful container stop", status: "succeeded", note: "Connections drained in 4s" },
      { title: "Container start", status: "succeeded", note: "Started; process attached to volume" },
      { title: "Health check :8080", status: "succeeded", note: "200 OK at 14:54 — 2 consecutive passes" },
    ],
    observed: "team-cloud answers on :8080 again; last 3 health checks passed. Memory plateaus at 420 MB of its 800 MB ceiling.",
    rollback: "Not needed — if the health check had failed 3×, the run would stop and escalate to the runbook (volume inspection), never deleting data.",
  },
  {
    id: "arun_01JRUN02",
    plan_id: "aip_01JRESTART1",
    title: "Restart orders-api + ceiling raise (awaiting approval)",
    status: "awaiting_approval",
    created_at: T(14, 45),
    inputs: [
      "resource app_01JORDR01 — memory metrics (24h p99), cgroup limits",
      "logs orders-api — last 1 hour, secrets redacted",
      "report rep_01JMEM01 — diagnosis and approved finding",
    ],
    steps: [
      { title: "Plan generated", status: "succeeded", note: "plan bound to hash sha256:81bb…, expires in 30 min" },
      { title: "Second-person approval", status: "pending", note: "Requested from the owner — expires 2026-11-06T18:30Z" },
      { title: "resource.limit.update", status: "pending", note: "Queued behind approval" },
      { title: "app.process.restart", status: "pending", note: "Queued behind approval" },
    ],
    observed: "Nothing has executed yet — no changes have been made to the workload.",
    rollback: "Any executed prefix rolls back before escalation (ceiling restored, process restarted).",
  },
];

/** Canned assistant answers for the workspace (evidence-cited, DS-017 style). */
export const assistantPrompts: { id: string; prompt: string; answer: { headline: string; body: string; citations: string[]; action?: { label: string; href: string } } }[] = [
  {
    id: "p1",
    prompt: "Why is orders-api using so much memory?",
    answer: {
      headline: "Unbounded cache growth on /orders",
      body: "The endpoint caches every order ID seen since start with no eviction. memory.current climbs ~6 MB/hour while request rate stays flat — the signature of growth, not traffic. One OOM kill already happened on Nov 3.",
      citations: ["metric app_01JORDR01/memory.peak (490 MB of 512 MB)", "log orders-api 14:58 — approaching limit", "cgroup memory.events: 1 oom_kill in 7d"],
      action: { label: "Open the full diagnostic report", href: "/assistant/diagnostics/rep_01JMEM01" },
    },
  },
  {
    id: "p2",
    prompt: "Why did team-cloud fail its health checks?",
    answer: {
      headline: "Process up, port closed",
      body: "The container reports running but nothing listens on :8080, so all 3 probes fail. Most likely a crash loop after a degraded start. A restart is the safe first step; the runbook covers volume inspection if it recurs.",
      citations: ["log team-cloud 14:47 — connection refused (3 of 3 probes)", "state svc_01JNEXT03/last_health_status = unhealthy"],
      action: { label: "Open the full diagnostic report", href: "/assistant/diagnostics/rep_01JHEALTH02" },
    },
  },
  {
    id: "p3",
    prompt: "Was last night's backup verified?",
    answer: {
      headline: "Completed and uploaded; one verification failed",
      body: "All three nightly snapshots completed and uploaded to B2. The Nov 6 restore-test of wanjiku-blog failed on a checksum mismatch — no live files were touched, and tonight's run replaces the snapshot. acme-consulting and kili-shop verified earlier this week.",
      citations: ["backup.completed events 02:00–02:07", "verification ver_01JVER03 — failed (checksum)", "verification ver_01JVER02 — passed Nov 5"],
      action: { label: "Open backup verification", href: "/backups/verify" },
    },
  },
  {
    id: "p4",
    prompt: "Which workload is closest to its limits?",
    answer: {
      headline: "orders-api, then team-cloud",
      body: "orders-api runs at 95% of its memory ceiling (380 of 400 MB) with throttling risk; team-cloud is degraded and sits at 86% of its ceiling. The image-worker yields under traffic by design — its throttling is normal batch behavior.",
      citations: ["metrics/resources app_01JORDR01 — peak 490 MB", "metrics/resources svc_01JNEXT03 — current 690 MB of 800 MB"],
      action: { label: "Open memory pressure view", href: "/monitoring/pressure" },
    },
  },
];

export const aiRemediationHistory: {
  id: string;
  occurred_at: Iso8601;
  action: string;
  report_id: string;
  status: "succeeded" | "failed" | "awaiting_approval";
  actor: string;
}[] = [
  { id: "hist_01", occurred_at: T(14, 54), action: "Restart team-cloud container", report_id: "rep_01JHEALTH02", status: "succeeded", actor: "Jane Wanjiku (Owner)" },
  { id: "hist_02", occurred_at: T(14, 45), action: "Propose CACHE_TTL=900 on orders-api", report_id: "rep_01JMEM01", status: "awaiting_approval", actor: "AI proposal" },
  { id: "hist_03", occurred_at: "2026-11-05T09:12:00Z", action: "Rotate PHP session directory (disk cleanup)", report_id: "rep_01JDISK09", status: "succeeded", actor: "Jane Wanjiku (Owner)" },
];

export const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-5-mini", "gpt-4.1-mini", "o4-mini"] },
  { id: "anthropic", label: "Anthropic", models: ["claude-sonnet-4.5", "claude-haiku-4.5"] },
  { id: "google", label: "Google AI", models: ["gemini-2.5-flash", "gemini-2.5-pro"] },
  { id: "openrouter", label: "OpenRouter (bring your own route)", models: ["auto-route", "meta-llama/llama-3.3-70b"] },
];

export const currentUserName = db.users.find((u) => u.id === db.currentUser)?.display_name ?? "Owner";
