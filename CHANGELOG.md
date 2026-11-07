# Changelog

## 2026-11-07 — Post-overhaul review pass (integration review of 086b9e9)

### Review verdict on the Batch 01–10 overhaul (commit 086b9e9)

All 11 new registered screens were reviewed screen-by-screen for the
"hardcoded UI" concern. **Verdict: the new guided surfaces are genuinely
functional, not hardcoded.** Every reviewed screen reads the demo dataset
(`lib/mock/*`), gates actions through `useCapability`, and routes mutations
through the operations engine (`operations.submit` → operation tray → toast):

| Screen | Wiring verified |
| --- | --- |
| UX-OPS-019 `/operations/center` | Status counters computed from backup/webhook/service fixtures + live session operations; playbooks link to real registry routes |
| UX-PROT-001 `/launch/web` | Per-option capability gating (`website.static/php`, `app.node`) with upgrade path when unavailable |
| UX-IAM-019 `/auth/recovery` | Demo-only form, honest framing |
| UX-INF-019 `/infrastructure/center` | Persona-filtered journeys (ids match `lib/personas.ts`), fixture stats |
| UX-COM-019 `/commercial/center` | Persona allow-list + `commercial.surface` capability gate, fixture counters |
| UX-DB-011 `/databases/manage` | Static-export-safe query-param route reusing the six database views (`lib/database-routes.ts`) |
| UX-DNS-016 `/domains/setup` | Real `checkDnsPropagation` operation, terminal-state checks from the operation stream |
| UX-MAIL-013/014 `/email`, `/email/setup` | Capability-driven cards; test send goes through `sendTestEmail` operation with toast + tray |
| UX-SUP-012 `/workspace/finish` | Session-aware, real links only |
| UX-SVC-009 `/services/setup` | Template catalog + RAM preflight from `PROFILES`/`allocatedRamMb`, capability gating |
| Rewrites: `/auth/sign-in`, `/apps/new`, `/files`, sidebar | Signed into the iam mock API; app wizard submits via `provisionApp`; file manager runs 202 operations; sidebar audience filters match the persona registry |

### Fixes applied during this review

- `app/(panel)/audit/page.tsx` — restored missing `formatUtc` import (type-check
  regression from the overhaul).
- `app/auth/sign-in/page.tsx` — the marketing panel no longer shows invented
  numbers: "Websites / Applications / Services healthy" now derive from
  `db.websites`, `db.applications` and `lib/mock/ops.serviceHealth`, and the
  status chip reflects actual (demo) service health instead of an
  unconditional "All systems operational".

### Registry state

- 195 screens registered (189 pages + 6 route states), full page-file coverage.
- `npx tsc --noEmit`: 0 errors.

## 2026-11-07 — Batch 01–10 GUI overhaul (community: amungadev-ai, commit 086b9e9)

- 11 new guided screens registered in `lib/screens.ts` (UX-OPS-019, UX-PROT-001,
  UX-IAM-019, UX-INF-019, UX-COM-019, UX-DB-011, UX-DNS-016, UX-MAIL-013/014,
  UX-SUP-012, UX-SVC-009) plus per-batch notes in `BATCH_01..10_CHANGELOG.md`.
- Database routing fix: static-export-safe `/databases/manage` hub with
  `databaseHref(id, tab)` for runtime-created mock instances.
- Sidebar redesign with persona-aware `audience` filtering; previous sidebar
  preserved as `components/shell/legacy-sidebar.tsx`.
- Rebuilt `/auth/sign-in` (MFA + recovery steps, anti-enumeration demo copy),
  `/apps/new` (5-step guided Node.js deployment), `/files` (tree + list manager),
  `/onboarding` refresh, new `FolderTree` component, email workspace.
- Per-batch details: see `BATCH_01_CHANGELOG.md` … `BATCH_10_CHANGELOG.md`.

## 2026-11-06 — Initial prototype (commits fad2cf8, ab01b1f, 408bec6)

- 184-screen Stage-6 registry, architecture core, design system, app shell,
  operation engine with batch/serving lanes, capability system, all 15 modules.
