#!/usr/bin/env node
/**
 * Screen-coverage checker: every kind:"page" screen in lib/screens.ts must have
 * a page.tsx at its app_path — under app/(panel) normally, or under app/ for
 * the bare group (/auth/*, /setup/*, /onboarding). Also reports page files that
 * don't map to any registered screen (except the root landing and not-found).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = fs.readFileSync(path.join(root, "lib", "screens.ts"), "utf8");

const lineRe = /^  \{ id: "([^"]+)", route: "([^"]*)", app_path: (null|"[^"]*"),.*kind: "(page|state)"/;
const screens = [];
for (const line of src.split("\n")) {
  const m = lineRe.exec(line);
  if (m) screens.push({ id: m[1], route: m[2], app_path: m[3] === "null" ? null : m[3].slice(1, -1), kind: m[4] });
}
if (screens.length === 0) {
  console.error("check:screens — could not parse lib/screens.ts");
  process.exit(2);
}

const BARE = ["/auth/", "/setup/", "/onboarding"];
const isBare = (p) => BARE.some((b) => p === b.replace(/\/$/, "") || p.startsWith(b));

function existsAt(screen) {
  if (!screen.app_path) return null;
  const candidates = [path.join(root, "app", "(panel)", screen.app_path, "page.tsx")];
  if (isBare(screen.app_path)) candidates.push(path.join(root, "app", screen.app_path, "page.tsx"));
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

const missing = [];
const covered = new Set();
for (const s of screens) {
  if (s.kind !== "page") continue;
  const f = existsAt(s);
  if (f) covered.add(path.relative(path.join(root, "app"), f));
  else missing.push(`${s.id}  ${s.route}  →  app/(panel)${s.app_path}/page.tsx`);
}

// Actual page files
const actual = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "page.tsx") actual.push(path.relative(path.join(root, "app"), p));
  }
})(path.join(root, "app"));

const extras = actual.filter((f) => f !== "page.tsx" && !covered.has(f));
const states = screens.filter((s) => s.kind === "state").map((s) => s.id).join(", ");

console.log(`registry: ${screens.length} screens (pages: ${screens.filter((s) => s.kind === "page").length}, states: ${screens.filter((s) => s.kind === "state").length})`);
console.log(`page files on disk: ${actual.length}`);
console.log(`states (in-page, no file required): ${states}`);
if (missing.length) {
  console.log(`\nMISSING ${missing.length}:`);
  for (const m of missing) console.log("  " + m);
}
if (extras.length) {
  console.log(`\nUNREGISTERED page files ${extras.length}:`);
  for (const e of extras) console.log("  " + e);
}
if (!missing.length && !extras.length) console.log("\n✔ full coverage");
process.exit(missing.length ? 1 : 0);
