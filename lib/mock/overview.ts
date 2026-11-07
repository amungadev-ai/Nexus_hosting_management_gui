import type {
  Application,
  Operation,
  OperationEvent,
  ServiceInstance,
  ServiceTemplate,
  UsageSnapshot,
  Website,
} from "@/lib/types";
import { db } from "@/lib/mock/data";
import { allServiceInstances, instanceHref as staticServiceHref, templateForKey } from "@/lib/mock/services";
import { SCREENS } from "@/lib/screens";
import { seededSeries } from "@/lib/format";

/**
 * Overview-module fixtures: server-level usage aggregation (UX-OV-009),
 * the resource search index (UX-OV-003), help-center articles (UX-OV-008)
 * and the SSE-shaped event-log replay for job detail (UX-OV-005).
 *
 * Everything here is derived from the shared dataset `db` — no parallel
 * truths. When the real API exists, these become GET /metrics/servers/{id},
 * GET /search and GET /help calls.
 */

/* ------------------------------------------------------------------ */
/* Usage aggregation (UX-OV-009)                                       */
/* ------------------------------------------------------------------ */

function sumUsage(rows: UsageSnapshot[]): UsageSnapshot {
  const empty: UsageSnapshot = {
    ram_mb: { allocated: 0, typical: 0, peak: 0, current: 0 },
    cpu_millicores: { allocated: 0, typical: 0, peak: 0, current: 0 },
    disk_gb: { allocated: 0, current: 0 },
    throttled_seconds_24h: 0,
    oom_events_7d: 0,
    updated_at: "1970-01-01T00:00:00Z",
  };
  return rows.reduce<UsageSnapshot>((acc, u) => ({
    ram_mb: {
      allocated: acc.ram_mb.allocated + u.ram_mb.allocated,
      typical: acc.ram_mb.typical + u.ram_mb.typical,
      peak: acc.ram_mb.peak + u.ram_mb.peak,
      current: acc.ram_mb.current + u.ram_mb.current,
    },
    cpu_millicores: {
      allocated: acc.cpu_millicores.allocated + u.cpu_millicores.allocated,
      typical: acc.cpu_millicores.typical + u.cpu_millicores.typical,
      peak: acc.cpu_millicores.peak + u.cpu_millicores.peak,
      current: acc.cpu_millicores.current + u.cpu_millicores.current,
    },
    disk_gb: {
      allocated: acc.disk_gb.allocated + u.disk_gb.allocated,
      current: acc.disk_gb.current + u.disk_gb.current,
    },
    throttled_seconds_24h: acc.throttled_seconds_24h + u.throttled_seconds_24h,
    oom_events_7d: acc.oom_events_7d + u.oom_events_7d,
    updated_at: u.updated_at > acc.updated_at ? u.updated_at : acc.updated_at,
  }), empty);
}

/** Server-level aggregate across every workload in the portfolio. */
export function aggregateUsage(): UsageSnapshot {
  return sumUsage([
    ...db.websites.map((w) => w.usage),
    ...db.applications.map((a) => a.usage),
    ...allServiceInstances().map((s) => s.usage),
  ]);
}

/** Sum of workload RAM ceilings (MB) — the "already allocated" number. */
export function allocatedRamMb(): number {
  return aggregateUsage().ram_mb.allocated;
}

/** Sum of workload disk usage (GB). */
export function allocatedDiskGb(): number {
  return aggregateUsage().disk_gb.current;
}

export interface WorkloadUsageRow {
  id: string;
  label: string;
  detail: string;
  href: string | null;
  usage: UsageSnapshot;
  /** 30-day seeded RAM series for the trend sparkline (MB). */
  ramSeries: number[];
}

function workloadRows(): WorkloadUsageRow[] {
  const rows: WorkloadUsageRow[] = [];
  const site: (w: Website) => WorkloadUsageRow = (w) => ({
    id: w.id,
    label: w.title,
    detail: `Website · ${w.kind}${w.php_version !== undefined ? ` ${w.php_version}` : ""} · ${w.primary_domain}`,
    href: `/websites/${w.id}`,
    usage: w.usage,
    ramSeries: seededSeries(w.id, 30, Math.max(4, w.usage.ram_mb.typical), Math.round(w.usage.ram_mb.allocated * 0.12)),
  });
  const app: (a: Application) => WorkloadUsageRow = (a) => ({
    id: a.id,
    label: a.name,
    detail: `Application · ${a.runtime} ${a.runtime_version}${a.category === "batch" ? " · batch" : ""}`,
    href: `/apps/${a.id}`,
    usage: a.usage,
    ramSeries: seededSeries(a.id, 30, Math.max(4, a.usage.ram_mb.typical), Math.round(a.usage.ram_mb.allocated * 0.12)),
  });
  const svc: (s: ServiceInstance) => WorkloadUsageRow = (s) => ({
    id: s.id,
    label: s.name,
    detail: `Platform service · ${s.template_key}`,
    href: null,
    usage: s.usage,
    ramSeries: seededSeries(s.id, 30, Math.max(4, s.usage.ram_mb.typical), Math.round(s.usage.ram_mb.allocated * 0.12)),
  });
  rows.push(...db.websites.map(site));
  rows.push(...db.applications.map(app));
  // Detail routes only exist for statically generated instances; runtime-installed
  // services appear in lists but their row links stay honest (null → not clickable).
  for (const s of allServiceInstances()) {
    const row = svc(s);
    row.href = staticServiceHref(s);
    rows.push(row);
  }
  return rows;
}

/** Per-workload usage rows for UX-OV-009 (memoize at the call site). */
export function workloadUsageRows(): WorkloadUsageRow[] {
  return workloadRows();
}

/** 30-day seeded series for the server aggregate strip. */
export function serverRamSeries(): number[] {
  const agg = aggregateUsage();
  return seededSeries("srv_01JNAI01-ram-30d", 30, agg.ram_mb.typical, Math.round(agg.ram_mb.allocated * 0.1));
}

/* ------------------------------------------------------------------ */
/* Resource search (UX-OV-003)                                         */
/* ------------------------------------------------------------------ */

export interface SearchResult {
  group: string;
  id: string;
  title: string;
  context: string;
  status: string;
  href: string;
}

function searchTemplates(q: string): SearchResult[] {
  const out: SearchResult[] = [];
  for (const t of db.templates) {
    if (!t.published) continue;
    const haystack = `${t.name} ${t.key} ${t.description} deploy ${t.category}`.toLowerCase();
    if (!haystack.includes(q)) continue;
    out.push({
      group: "Templates",
      id: t.key,
      title: t.name,
      context: `${categoryWord(t)} · typically ${t.ram_typical_mb} MB RAM · ${t.docker_required ? "needs Docker" : "no Docker"}`,
      status: t.published ? "published" : "draft",
      href: `/templates/${t.key}`,
    });
  }
  return out;
}

function categoryWord(t: ServiceTemplate): string {
  const map: Record<ServiceTemplate["category"], string> = {
    storage: "storage template",
    transform: "transform template",
    delivery: "delivery template",
    self_hosted_app: "self-hosted app",
    database: "database template",
    cache: "cache template",
    queue: "queue template",
    search: "search template",
  };
  return map[t.category];
}

/** Live grouped search over every authorized resource + screens. */
export function searchAll(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const results: SearchResult[] = [];

  for (const w of db.websites) {
    const hay = `${w.name} ${w.title} ${w.primary_domain}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        group: "Websites",
        id: w.id,
        title: w.title,
        context: `${w.kind} site · ${w.primary_domain}`,
        status: w.status,
        href: `/websites/${w.id}`,
      });
    }
  }
  for (const a of db.applications) {
    const hay = `${a.name} ${a.runtime} ${a.runtime_version}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        group: "Applications",
        id: a.id,
        title: a.name,
        context: `${a.runtime} app${a.category === "batch" ? " · batch workload" : ""}`,
        status: a.status,
        href: `/apps/${a.id}`,
      });
    }
  }
  for (const d of db.domains) {
    if (d.name.toLowerCase().includes(q)) {
      results.push({
        group: "Domains",
        id: d.id,
        title: d.name,
        context: `domain · ${d.registrar ?? "registrar not recorded"}`,
        status: d.state.replace(/_/g, " "),
        href: `/domains/${d.id}`,
      });
    }
  }
  for (const c of db.certificates) {
    if (c.domains.some((n) => n.toLowerCase().includes(q)) || `certificate ${c.issuer}`.toLowerCase().includes(q)) {
      results.push({
        group: "Certificates",
        id: c.id,
        title: c.domains.join(", "),
        context: `TLS certificate · ${c.issuer}`,
        status: c.status,
        href: `/certificates/${c.id}`,
      });
    }
  }
  for (const s of allServiceInstances()) {
    const tpl = templateForKey(s.template_key);
    const hay = `${s.name} ${s.template_key} ${tpl?.name ?? ""} ${s.hostname ?? ""}`.toLowerCase();
    if (hay.includes(q)) {
      const href = staticServiceHref(s);
      if (href !== null) {
        results.push({
          group: "Platform services",
          id: s.id,
          title: s.name,
          context: `${tpl?.name ?? s.template_key} · ${s.exposure} · ${s.hostname ?? "no hostname"}`,
          status: s.state,
          href,
        });
      }
    }
  }
  for (const i of db.invoices) {
    if (i.invoice_number.toLowerCase().includes(q) || `invoice ${i.state}`.includes(q)) {
      results.push({
        group: "Invoices",
        id: i.id,
        title: i.invoice_number,
        context: `invoice · ${(i.total.amount_minor / 100).toFixed(2)} ${i.total.currency} · due ${i.due_at.slice(0, 10)}`,
        status: i.state,
        href: "/commercial/invoices",
      });
    }
  }
  for (const p of db.payments) {
    const hay = `${p.id} ${p.provider_reference} ${p.provider}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        group: "Payments",
        id: p.id,
        title: p.provider_reference,
        context: `${p.provider} payment · ${(p.amount.amount_minor / 100).toFixed(2)} ${p.amount.currency} · ${p.phone_number ?? "no phone"}`,
        status: p.state,
        href: p.state === "pending" ? `/commercial/payments/${p.id}/pending` : "/commercial/payments",
      });
    }
  }
  results.push(...searchTemplates(q));

  // Screens match by title only; param screens resolve to their list route.
  const screenHits = SCREENS.filter(
    (s) => s.kind === "page" && !s.route.includes(":") && s.title.toLowerCase().includes(q)
  ).slice(0, 6);
  for (const s of screenHits) {
    results.push({
      group: "Screens",
      id: s.id,
      title: s.title,
      context: `${s.module_title} · ${s.route}`,
      status: "screen",
      href: s.route,
    });
  }

  return results;
}

export const SEARCH_HINT = "No results — try a domain, site or invoice number.";

/* ------------------------------------------------------------------ */
/* Job event log (UX-OV-005)                                           */
/* ------------------------------------------------------------------ */

/**
 * Replayed SSE log for seeded (historical) operations: the engine only
 * records events for operations it runs live, so history is reconstructed
 * from the operation's own steps and timestamps — clearly labelled as a
 * replay in the UI, never as a live stream.
 */
export function deriveOperationEvents(op: Operation): OperationEvent[] {
  const events: OperationEvent[] = [];
  const total = op.progress.total_steps;
  let done = 0;
  const push = (
    event: OperationEvent["event"],
    eventType: string,
    status: OperationEvent["data"]["status"],
    occurredAt: string,
    stepKey?: string
  ) => {
    events.push({
      id: `opevt_replay_${op.id.slice(-6)}_${String(events.length + 1).padStart(2, "0")}`,
      event,
      operation_id: op.id,
      data: {
        event_type: eventType,
        status,
        occurred_at: occurredAt,
        attempt: 1,
        progress: { completed_steps: done, total_steps: total },
        step_key: stepKey,
      },
    });
  };

  push("operation.updated", "operation.accepted", "pending", op.created_at);
  for (const step of op.steps) {
    if (step.occurred_at === undefined) continue;
    push("operation.updated", "step.started", "running", step.occurred_at, step.key);
    done += 1;
    push(
      "operation.updated",
      step.status === "failed" ? "step.failed" : "step.succeeded",
      step.status === "failed" ? "failed" : "succeeded",
      step.occurred_at,
      step.key
    );
  }
  if (op.finished_at !== undefined) {
    const terminalType =
      op.status === "succeeded"
        ? "operation.succeeded"
        : op.status === "failed"
          ? "operation.failed"
          : `operation.${op.status}`;
    const terminalStatus: OperationEvent["data"]["status"] =
      op.status === "succeeded" || op.status === "failed" ? op.status : "succeeded";
    events.push({
      id: `opevt_replay_${op.id.slice(-6)}_${String(events.length + 1).padStart(2, "0")}`,
      event: "operation.completed",
      operation_id: op.id,
      data: {
        event_type: terminalType,
        status: terminalStatus,
        occurred_at: op.finished_at,
        progress: { completed_steps: done, total_steps: total },
      },
    });
  }
  return events;
}

/** Serialize operation events into the SSE wire format (Stage 6 §5.3). */
export function sseLog(events: OperationEvent[]): string {
  return events
    .map((e) => `event: ${e.event}\nid: ${e.id}\ndata: ${JSON.stringify(e.data)}`)
    .join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Help center (UX-OV-008)                                             */
/* ------------------------------------------------------------------ */

export interface HelpArticle {
  title: string;
  body: string;
  href?: string;
}

export interface HelpSection {
  id: string;
  icon: "home" | "globe" | "database" | "credit-card" | "shield";
  title: string;
  articles: HelpArticle[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    icon: "home",
    title: "Getting started",
    articles: [
      {
        title: "What can my VPS run?",
        body: "Your panel reads the capability set the installer detected on this VPS — RAM floor, typical and ceiling per workload. The capability overview shows exactly what can run, what runs but is tight, and what cannot run with the reason why.",
        href: "/overview/capabilities",
      },
      {
        title: "Create your first website",
        body: "Pick “Add website”, enter your domain or use the temporary preview hostname, choose static or PHP, then submit. Provisioning is a durable job: you can close the tab and watch progress in Activity — the site is live only after the health check verifies it.",
        href: "/websites/new",
      },
      {
        title: "Where did my job go?",
        body: "Every mutation (deploy, backup, install) becomes an operation with an ID and a timeline. Toasts only acknowledge — the durable result, logs and correlation ID live in Activity → Jobs.",
        href: "/activity",
      },
    ],
  },
  {
    id: "domains-dns",
    icon: "globe",
    title: "Domains & DNS",
    articles: [
      {
        title: "Point a domain at this server",
        body: "V1 guides your DNS: open the domain, copy the exact A/AAAA or CNAME records shown, add them at your registrar, then run the propagation check. The panel never claims the site is live before its own check succeeds.",
        href: "/domains",
      },
      {
        title: "Domain vs website",
        body: "A domain is a name you own; a website is the thing serving traffic. Connect one to the other in Domains → the site record lists which hostname is primary and whether TLS was issued.",
        href: "/domains",
      },
      {
        title: "SSL certificates (HTTP-01)",
        body: "Certificates are issued via Let's Encrypt HTTP-01, so DNS must already point here. Renewal is automatic for active certificates; a failed renewal keeps the old certificate until its expiry — check the certificate detail for the last attempt.",
        href: "/certificates",
      },
    ],
  },
  {
    id: "backups",
    icon: "database",
    title: "Backups",
    articles: [
      {
        title: "“Backup succeeded” ≠ restorable",
        body: "A backup is only trusted after a verification (a real restore test to a disposable target). Backup verification shows the last verified restore per policy — if a snapshot was never restore-tested it is listed as unverified, not healthy.",
        href: "/backups/verify",
      },
      {
        title: "Backups are batch jobs",
        body: "Backups run low-priority and queue when your websites are busy — “queued, will run when idle” is normal, not a failure. On small VPS profiles backups are remote-only: point the destination at S3-compatible storage.",
        href: "/backups/policies",
      },
    ],
  },
  {
    id: "billing",
    icon: "credit-card",
    title: "Billing",
    articles: [
      {
        title: "Paying an invoice with M-Pesa",
        body: "Enter your Safaricom number and approve the STK push on your phone (10 s–2 min). The payment stays pending until the operator confirms — never assume success because the redirect returned. Failed or expired payments can be retried with a fresh request.",
        href: "/commercial/invoices",
      },
      {
        title: "Reading your invoice",
        body: "Amounts are shown in KES with 16% VAT as a separate line. A payment that cannot be matched to an invoice goes to reconciliation and is reviewed within 24 hours — it never disappears.",
        href: "/commercial/invoices",
      },
    ],
  },
  {
    id: "security",
    icon: "shield",
    title: "Security",
    articles: [
      {
        title: "Firewall changes can't lock you out",
        body: "Before a firewall rule is applied the panel preflights it against your current SSH source; a change that would cut your management path is rejected unless an alternate access path is verified. Every rule change is audited with before/after values.",
        href: "/security/firewall",
      },
      {
        title: "Step-up verification for sensitive actions",
        body: "High-risk actions (approvals, suspensions, reversals) ask for a fresh verification bound to that specific action and resource. It is short-lived on purpose — a stolen session still cannot approve anything without your second factor.",
        href: "/settings/sessions",
      },
    ],
  },
];
