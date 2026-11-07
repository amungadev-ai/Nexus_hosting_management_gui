import type { Iso8601, WorkloadCategory } from "@/lib/types";

/**
 * Files / editor / developer-access fixtures (Stage 3 §8.6, FLOW-007, §11).
 *
 * Scoped file trees per website — acme-consulting is a static site rooted at
 * public/, kili-shop is WordPress rooted at wp-content/. Paths are RELATIVE
 * to the site root; the container-aware display prefix (Standard+ shows
 * container paths like /app/wp-content/uploads, Nano shows the document root)
 * is computed by displayPrefix(). lib/api/files.ts mutates these trees the
 * same way the real agent would (files.write_atomic).
 */

export interface FileNode {
  name: string;
  type: "file" | "directory";
  size_bytes: number | null;
  modified_at: Iso8601;
  mime?: string;
  mode: string; // octal, e.g. "0644"
  owner: string;
  group: string;
  /** UTF-8 content for text files; binary files have none (preview disabled). */
  content?: string;
  version?: number; // bumped on every successful files.write
  children?: FileNode[];
}

export interface FileSite {
  site_id: string; // matches db.websites ids
  label: string;
  kind: "static" | "php";
  /** Document-root folder shown at the top of the tree (FLOW-007 step 1). */
  root_name: string;
  children: FileNode[];
}

const T = (d: string, h: number, m: number) => `2026-11-${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

const ACME_INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Acme Consulting — Nairobi</title>
    <link rel="stylesheet" href="/assets/css/styles.css" />
  </head>
  <body>
    <header>
      <img src="/assets/img/logo.svg" alt="Acme Consulting" width="120" />
      <nav><a href="/">Home</a> <a href="/about.html">About</a></nav>
    </header>
    <main>
      <h1>Business advisory for East African SMEs</h1>
      <p>Tax, bookkeeping and company registration. Westlands, Nairobi.</p>
    </main>
  </body>
</html>
`;

const ACME_CSS = `:root {
  --brand: #14532d;
  --paper: #f7f9fc;
}
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: var(--paper);
  color: #172033;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
}
`;

const ACME_JS = `document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#contact-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    window.alert("Asante! We will get back to you within one business day.");
  });
});
`;

const KILI_STYLE = `/*
Theme Name: Kili Store
Author: Wanjiku Digital
Version: 1.4.2
*/
.site-header {
  background: #0b3d2e;
  color: #fff;
  padding: 12px 20px;
}
.product-card img {
  border-radius: 8px;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}
.kenyan-flag-badge {
  border: 1px solid #b91c1c;
  color: #b91c1c;
  font-size: 12px;
  padding: 2px 6px;
}
`;

const KILI_FUNCTIONS = `<?php
/**
 * Kili Store theme setup.
 */
function kili_store_setup() {
  add_theme_support( 'title-tag' );
  add_theme_support( 'post-thumbnails' );
  register_nav_menus( array(
    'primary' => __( 'Primary Menu', 'kili-store' ),
  ) );
}
add_action( 'after_setup_theme', 'kili_store_setup' );

function kili_store_enqueue() {
  wp_enqueue_style( 'kili-store', get_stylesheet_uri(), array(), '1.4.2' );
}
add_action( 'wp_enqueue_scripts', 'kili_store_enqueue' );
`;

const KILI_ADV_CACHE = `<?php
/**
 * WP Rocket drop-in — do not edit. Regenerated on every cache clear.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
define( 'WP_ROCKET_CACHE_PATH', WP_CONTENT_DIR . '/wp-rocket-cache/' );
`;

const KILI_DEBUG = `[06-Nov-2026 09:12:44 UTC] WooCommerce: payment gateway M-Pesa (STK Push) handshake ok — order #1041
[06-Nov-2026 11:38:02 UTC] PHP Warning: Undefined array key "phone_number" in wp-content/plugins/woo-mpesa/includes/callback.php on line 88
[06-Nov-2026 11:38:02 UTC] PHP Notice: retrying Daraja callback verification (attempt 2/3)
[06-Nov-2026 14:02:19 UTC] WooCommerce: order #1043 marked paid via M-Pesa receipt QK47HJ2N9F
`;

const ACME_ACCESS_LOG = `203.0.113.44 - - [06/Nov/2026:09:02:11 +0300] "GET / HTTP/2.0" 200 1842 "-" "Mozilla/5.0"
197.232.81.14 - - [06/Nov/2026:09:04:56 +0300] "GET /assets/css/styles.css HTTP/2.0" 200 412 "-" "Mozilla/5.0"
105.160.20.8 - - [06/Nov/2026:10:22:03 +0300] "GET /about.html HTTP/2.0" 200 1408 "-" "Safari/17.6"
`;

export const fileSites: FileSite[] = [
  {
    site_id: "web_01JACME01",
    label: "acme-consulting (static)",
    kind: "static",
    root_name: "public",
    children: [
      {
        name: "index.html",
        type: "file",
        size_bytes: 742,
        modified_at: T("05", 16, 42),
        mime: "text/html",
        mode: "0644",
        owner: "www-data",
        group: "www-data",
        content: ACME_INDEX,
        version: 7,
      },
      {
        name: "about.html",
        type: "file",
        size_bytes: 1108,
        modified_at: T("04", 11, 9),
        mime: "text/html",
        mode: "0644",
        owner: "www-data",
        group: "www-data",
        version: 3,
      },
      {
        name: "robots.txt",
        type: "file",
        size_bytes: 68,
        modified_at: T("01", 9, 0),
        mime: "text/plain",
        mode: "0644",
        owner: "www-data",
        group: "www-data",
        content: "User-agent: *\nAllow: /\nSitemap: https://acmeconsulting.co.ke/sitemap.xml\n",
        version: 1,
      },
      {
        name: "assets",
        type: "directory",
        size_bytes: null,
        modified_at: T("05", 16, 40),
        mode: "0755",
        owner: "www-data",
        group: "www-data",
        children: [
          {
            name: "css",
            type: "directory",
            size_bytes: null,
            modified_at: T("05", 16, 40),
            mode: "0755",
            owner: "www-data",
            group: "www-data",
            children: [
              {
                name: "styles.css",
                type: "file",
                size_bytes: 536,
                modified_at: T("05", 16, 40),
                mime: "text/css",
                mode: "0644",
                owner: "www-data",
                group: "www-data",
                content: ACME_CSS,
                version: 4,
              },
            ],
          },
          {
            name: "js",
            type: "directory",
            size_bytes: null,
            modified_at: T("04", 11, 12),
            mode: "0755",
            owner: "www-data",
            group: "www-data",
            children: [
              {
                name: "main.js",
                type: "file",
                size_bytes: 291,
                modified_at: T("04", 11, 12),
                mime: "application/javascript",
                mode: "0644",
                owner: "www-data",
                group: "www-data",
                content: ACME_JS,
                version: 2,
              },
            ],
          },
          {
            name: "img",
            type: "directory",
            size_bytes: null,
            modified_at: T("03", 15, 30),
            mode: "0755",
            owner: "www-data",
            group: "www-data",
            children: [
              { name: "logo.svg", type: "file", size_bytes: 2140, modified_at: T("03", 15, 30), mime: "image/svg+xml", mode: "0644", owner: "www-data", group: "www-data" },
              { name: "hero.webp", type: "file", size_bytes: 48120, modified_at: T("03", 15, 31), mime: "image/webp", mode: "0644", owner: "www-data", group: "www-data" },
            ],
          },
        ],
      },
      {
        name: ".well-known",
        type: "directory",
        size_bytes: null,
        modified_at: T("02", 8, 15),
        mode: "0755",
        owner: "root",
        group: "root",
        children: [
          {
            name: "acme-challenge",
            type: "directory",
            size_bytes: null,
            modified_at: T("02", 8, 15),
            mode: "0755",
            owner: "root",
            group: "root",
            children: [],
          },
        ],
      },
    ],
  },
  {
    site_id: "web_01JKILI02",
    label: "kili-shop (WordPress)",
    kind: "php",
    root_name: "wp-content",
    children: [
      {
        name: "themes",
        type: "directory",
        size_bytes: null,
        modified_at: T("05", 14, 20),
        mode: "0755",
        owner: "www-data",
        group: "www-data",
        children: [
          {
            name: "kili-store",
            type: "directory",
            size_bytes: null,
            modified_at: T("05", 14, 20),
            mode: "0755",
            owner: "www-data",
            group: "www-data",
            children: [
              {
                name: "style.css",
                type: "file",
                size_bytes: 512,
                modified_at: T("05", 14, 20),
                mime: "text/css",
                mode: "0644",
                owner: "www-data",
                group: "www-data",
                content: KILI_STYLE,
                version: 9,
              },
              {
                name: "functions.php",
                type: "file",
                size_bytes: 634,
                modified_at: T("05", 14, 18),
                mime: "application/x-php",
                mode: "0644",
                owner: "www-data",
                group: "www-data",
                content: KILI_FUNCTIONS,
                version: 5,
              },
            ],
          },
        ],
      },
      {
        name: "plugins",
        type: "directory",
        size_bytes: null,
        modified_at: T("01", 10, 5),
        mode: "0755",
        owner: "www-data",
        group: "www-data",
        children: [
          { name: "woocommerce", type: "directory", size_bytes: null, modified_at: T("01", 10, 5), mode: "0755", owner: "www-data", group: "www-data", children: [] },
          { name: "woo-mpesa", type: "directory", size_bytes: null, modified_at: T("02", 9, 45), mode: "0755", owner: "www-data", group: "www-data", children: [] },
        ],
      },
      {
        name: "uploads",
        type: "directory",
        size_bytes: null,
        modified_at: T("06", 10, 30),
        // Flagged by the permissions screen: world-writable upload dir.
        mode: "0777",
        owner: "www-data",
        group: "www-data",
        children: [
          {
            name: "2026",
            type: "directory",
            size_bytes: null,
            modified_at: T("06", 10, 30),
            mode: "0755",
            owner: "www-data",
            group: "www-data",
            children: [
              {
                name: "11",
                type: "directory",
                size_bytes: null,
                modified_at: T("06", 10, 30),
                mode: "0755",
                owner: "www-data",
                group: "www-data",
                children: [
                  { name: "product-kiondo-basket.jpg", type: "file", size_bytes: 246800, modified_at: T("06", 10, 12), mime: "image/jpeg", mode: "0664", owner: "www-data", group: "www-data" },
                  { name: "banner-black-friday.webp", type: "file", size_bytes: 118400, modified_at: T("06", 10, 30), mime: "image/webp", mode: "0664", owner: "www-data", group: "www-data" },
                  { name: "invoice-october.pdf", type: "file", size_bytes: 92400, modified_at: T("05", 8, 2), mime: "application/pdf", mode: "0664", owner: "www-data", group: "www-data" },
                ],
              },
              {
                name: "10",
                type: "directory",
                size_bytes: null,
                modified_at: "2026-10-02T09:00:00Z",
                mode: "0755",
                owner: "www-data",
                group: "www-data",
                children: [
                  { name: "shop-launch-banner.png", type: "file", size_bytes: 204800, modified_at: "2026-10-02T09:00:00Z", mime: "image/png", mode: "0664", owner: "www-data", group: "www-data" },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "advanced-cache.php",
        type: "file",
        size_bytes: 218,
        modified_at: T("06", 6, 0),
        mime: "application/x-php",
        mode: "0644",
        owner: "www-data",
        group: "www-data",
        content: KILI_ADV_CACHE,
        version: 12,
      },
      {
        name: "debug.log",
        type: "file",
        size_bytes: 52100,
        modified_at: T("06", 14, 2),
        mime: "text/plain",
        mode: "0640",
        owner: "www-data",
        group: "adm",
        content: KILI_DEBUG,
        version: 40,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Tree helpers                                                        */
/* ------------------------------------------------------------------ */

export function siteById(siteId: string): FileSite | undefined {
  return fileSites.find((s) => s.site_id === siteId);
}

/** Resolve a node relative to the site root; [] is the root itself. */
export function findNode(site: FileSite, parts: string[]): FileNode | undefined {
  let children = site.children;
  let found: FileNode | undefined;
  for (const part of parts) {
    found = children.find((c) => c.name === part);
    if (!found) return undefined;
    children = found.children ?? [];
  }
  return found;
}

/** Container-aware display prefix (Stage 3 §8.6 note, DS-013). */
export function displayPrefix(site: FileSite, containerized: boolean): string {
  if (containerized) return `/app/${site.root_name}`;
  return site.kind === "php" ? "/var/www/kilishop.co.ke" : "/var/www/acmeconsulting.co.ke";
}

export function displayPath(site: FileSite, parts: string[], containerized: boolean): string {
  const rel = parts.length === 0 ? "" : `/${parts.join("/")}`;
  return `${displayPrefix(site, containerized)}${rel}`;
}

/* ------------------------------------------------------------------ */
/* SFTP / SSH / deploy keys (UX-FILE-007, UX-FILE-011)                 */
/* ------------------------------------------------------------------ */

export interface SftpCredential {
  site_id: string;
  host: string;
  port: number;
  username: string;
  /** One-time secret — after reveal it is never shown again (DS-008). */
  password_once: string;
  max_upload_bytes: number;
}

export const sftpCredentials: SftpCredential[] = [
  {
    site_id: "web_01JKILI02",
    host: "sftp.nairobi-01.wanjiku.digital",
    port: 22,
    username: "kilishop_web",
    password_once: "Kili-SFTP-2026-q8Xz41",
    max_upload_bytes: 104857600,
  },
  {
    site_id: "web_01JACME01",
    host: "sftp.nairobi-01.wanjiku.digital",
    port: 22,
    username: "acme_web",
    password_once: "Acme-SFTP-2026-9fTq02",
    max_upload_bytes: 104857600,
  },
];

export interface DevKey {
  id: string; // key_01J…
  name: string;
  kind: "ssh_public" | "deploy";
  fingerprint: string;
  scopes: string[];
  public_key?: string;
  created_at: Iso8601;
  last_used_at: Iso8601 | null;
  expires_at: Iso8601 | null;
}

/** Mutable — lib/api/files.ts adds and revokes entries. */
export const devKeys: DevKey[] = [
  {
    id: "key_01JLAPTOP1",
    name: "Jane's laptop",
    kind: "ssh_public",
    fingerprint: "SHA256:f8Jk2vNqP7rTz0mWa1YcX4dEb6uHj3sKo9gLi5vBn2M",
    scopes: ["files.read", "files.write"],
    public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB4x8mQf2Tz0mWa1YcX4dEb jane@wanjiku-laptop",
    created_at: "2026-10-26T10:00:00Z",
    last_used_at: "2026-11-06T09:41:00Z",
    expires_at: null,
  },
  {
    id: "key_01JDEPLOY2",
    name: "kilishop-deploy (GitHub Actions)",
    kind: "deploy",
    fingerprint: "SHA256:9aQr4tNwM2kXz7pVb0YeC6dFa3uIj1sHo5gKk8vCn4P",
    scopes: ["files.read"],
    created_at: "2026-11-01T08:30:00Z",
    last_used_at: "2026-11-06T06:10:00Z",
    expires_at: "2026-12-01T00:00:00Z",
  },
];

/* ------------------------------------------------------------------ */
/* Cron / scheduled tasks (UX-FILE-009)                                */
/* ------------------------------------------------------------------ */

export interface CronTask {
  id: string; // aut_01J…
  name: string;
  expression: string;
  timezone: string;
  command: string;
  workload_category: WorkloadCategory;
  state: "active" | "paused";
  last_run_at: Iso8601 | null;
  next_run_at: Iso8601;
  last_status: "succeeded" | "failed" | "running" | null;
  log_lines: { ts: string; severity: "info" | "warn" | "error"; message: string }[];
}

/** Mutable — lib/api/files.ts creates, pauses and resumes entries. */
export const cronTasks: CronTask[] = [
  {
    id: "aut_01JWPCRON1",
    name: "kili-shop wp-cron",
    expression: "*/15 * * * *",
    timezone: "Africa/Nairobi",
    command: "wp-cron.php — kili-shop scheduled tasks",
    workload_category: "batch",
    state: "active",
    last_run_at: "2026-11-06T14:45:00Z",
    next_run_at: "2026-11-06T15:00:00Z",
    last_status: "succeeded",
    log_lines: [
      { ts: "2026-11-06T14:45:02Z", severity: "info", message: "wp-cron started (hook: woocommerce_scheduled_sales)" },
      { ts: "2026-11-06T14:45:09Z", severity: "info", message: "2 hooks processed, 0 failures" },
    ],
  },
  {
    id: "aut_01JCATAPI2",
    name: "Nightly catalog import",
    expression: "0 3 * * *",
    timezone: "Africa/Nairobi",
    command: "php /var/www/kilishop.co.ke/wp-content/plugins/woo-mpesa/bin/import-catalog.php",
    workload_category: "batch",
    state: "active",
    last_run_at: "2026-11-06T03:00:14Z",
    next_run_at: "2026-11-07T03:00:00Z",
    last_status: "failed",
    log_lines: [
      { ts: "2026-11-06T03:00:16Z", severity: "info", message: "source feed fetched (2 340 rows, 18 MB)" },
      { ts: "2026-11-06T03:04:41Z", severity: "error", message: "import aborted: feed row 1 842 has duplicate SKU — nothing committed" },
      { ts: "2026-11-06T03:04:41Z", severity: "info", message: "transaction rolled back, database unchanged" },
    ],
  },
  {
    id: "aut_01JSSLCHK3",
    name: "Certificate expiry check",
    expression: "0 6 * * *",
    timezone: "Africa/Nairobi",
    command: "nexuspanel-agent check tls-expiry --warn-days 14",
    workload_category: "batch",
    state: "active",
    last_run_at: "2026-11-06T06:00:05Z",
    next_run_at: "2026-11-07T06:00:00Z",
    last_status: "succeeded",
    log_lines: [{ ts: "2026-11-06T06:00:07Z", severity: "info", message: "3 certificates checked, none expiring within 14 days" }],
  },
  {
    id: "aut_01JCACHE4",
    name: "Weekly cache warm (acme-consulting)",
    expression: "0 4 * * 1",
    timezone: "Africa/Nairobi",
    command: "curl -s https://acmeconsulting.co.ke/ > /dev/null",
    workload_category: "batch",
    state: "paused",
    last_run_at: "2026-11-02T04:00:03Z",
    next_run_at: "2026-11-09T04:00:00Z",
    last_status: "succeeded",
    log_lines: [{ ts: "2026-11-02T04:00:05Z", severity: "info", message: "warmed 4 URLs in 1.2s" }],
  },
];

/* ------------------------------------------------------------------ */
/* Upload manager records (UX-FILE-005)                                */
/* ------------------------------------------------------------------ */

export interface UploadRecord {
  id: string; // up_01J…
  site_id: string;
  path: string; // folder the upload targets
  filename: string;
  size_bytes: number;
  state: "completed" | "failed" | "conflict" | "in_progress";
  started_at: Iso8601;
  error?: string;
}

/** Mutable — lib/api/files.ts appends new uploads. */
export const uploads: UploadRecord[] = [
  { id: "up_01JUP0104", site_id: "web_01JKILI02", path: "wp-content/uploads/2026/11", filename: "product-kiondo-basket.jpg", size_bytes: 246800, state: "completed", started_at: "2026-11-06T10:12:00Z" },
  { id: "up_01JUP0105", site_id: "web_01JKILI02", path: "wp-content/uploads/2026/11", filename: "banner-black-friday.webp", size_bytes: 118400, state: "completed", started_at: "2026-11-06T10:30:00Z" },
  { id: "up_01JUP0106", site_id: "web_01JKILI02", path: "wp-content/uploads/2026/11", filename: "catalogue-full.pdf", size_bytes: 118_400_000, state: "failed", started_at: "2026-11-06T11:02:00Z", error: "Upload exceeds the 100 MB per-file limit. Compress the PDF or upload via SFTP in parts." },
];

/** Per-file upload cap (Stage 6 §4.8: max_bytes on POST /uploads). */
export const MAX_UPLOAD_BYTES = 104857600;
