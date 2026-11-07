# NexusPanel GUI prototype — generator conventions (BINDING for all module agents)

Project: `/home/z/my-project/nexuspanel-gui` — Next.js 16 App Router, React 19,
Tailwind v4, TypeScript strict. **Static export only** (`output: "export"`,
already configured). No server actions, no API routes, no dynamic server
features, no external dependencies beyond package.json.

Read these before writing anything:
- `scripts/spec/design_system.md` — tokens, DS-001…028 contracts, states taxonomy, a11y
- `scripts/spec/screens.json` / `screens.md` — your screen slice (IDs, routes, audiences, summaries)
- `scripts/spec/api_fixtures.md` — API conventions, enums, operation lifecycle (§5), M-Pesa (§7)

Core files that already exist (import, never re-create):
- `lib/types.ts` — all domain types (snake_case API fields)
- `lib/format.ts` — cx, formatMoney/formatMb/formatGb/formatMillicores, formatRelative/DateTime/Date/Utc, maskPhone, seededSeries, sparklinePath
- `lib/profiles.ts` — PROFILES, capabilitiesFor(profile), capabilityFor(profile, key), CAPABILITY_META
- `lib/personas.ts` — PERSONAS, PERSONA_BY_ID, PRESENTATION_MODES
- `lib/mock/data.ts` — the shared demo dataset `db` (websites, apps, domains, certificates, serviceInstances, templates, invoices, payments, operations, audit, notifications, backups, incidents, sessions, apiTokens, approvals, recommendations, organizations, users, server)
- `lib/api/core.ts` — requestId, newId, problem, ApiError, failWith, sleep, withLatency, ok, paginated
- `lib/api/me.ts` — getMe, getMyCapabilities(profile), getPersonaMatrix, landingFor, requestStepUp
- `lib/operations.ts` — `operations` engine singleton: submit({kind,title,resource_ref,workload_category,step_titles,outcome?,error?,partial?,actor_id,organization_id}), list(), get(), eventsFor(id, lastEventId?), subscribe(fn), cancel(id); isTerminal()
- `components/providers.tsx` — useSession (persona, presentation, profile, firstRun, theme, density, organizationId, supportAccess), useToast().push(kind,title,body), useOperationStream (list, trayOpen, setTrayOpen, focusedId, setFocusedId), useCapabilities, useCapability(key), useLanding, useNow()
- `components/ui/icons.tsx` — `<Icon name={IconName} size? strokeWidth? className? />`
- `components/common/screen.tsx` — `<Screen id="UX-…" breadcrumbs? description? actions?>` renders header, traceability chip, v2 chip, persona guard
- `app/page.tsx` exports `RouterIntro` (FLOW-013 six cards); `components/router/live-moment.tsx` exports `LiveMoment`

## File layout per module

For each screen in your slice, create EXACTLY one page file at
`app/(panel)/<app_path>/page.tsx` (app_path is in `lib/screens.ts`).
Bare-group screens (auth/setup/onboarding — none except iam module) go to
`app/<path>/page.tsx` without `(panel)`.

- **Non-param routes:** the page file starts with `"use client";` and renders
  the screen directly.
- **Param routes** (`[site]`, `[app]`, …): page.tsx is a SERVER file (no
  `"use client"`) that exports:
  ```tsx
  export const dynamicParams = false;
  export function generateStaticParams() {
    return db.websites.map((w) => ({ site: w.id }));  // your module's fixtures
  }
  export default async function Page({ params }: { params: Promise<{ site: string }> }) {
    const { site } = await params;
    return <WebsiteDetail siteId={site} />;
  }
  ```
  …and a `"use client"` view component in `components/<module>/<name>-view.tsx`
  that receives the id as a plain prop and looks up the fixture.
- Module-specific reusable UI goes in `components/<module>/`.
- Module mock data extensions go in `lib/mock/<module>.ts` (import `db` from
  `@/lib/mock/data`, extend/add typed arrays — e.g. DNS records, log lines,
  file trees, metric series). Module API clients go in `lib/api/<module>.ts`.

## Screen implementation rules (every screen, no exceptions)

1. Wrap in `<Screen id="UX-…" breadcrumbs={[…]}>`; pass `description` only to
   override the registry summary; pass primary CTA(s) via `actions`.
2. Honest states (DS-016, states taxonomy): every list screen renders its
   populated fixture data by default AND handles: empty (why + first action),
   loading (skeleton), capability-unavailable (via `<UnavailableState>` when
   the governing capability is unavailable on the current profile), and failed
   where meaningful. Never a bare greyed button without a reason.
3. **Capability gating:** check `useCapability("<key>").state` before offering
   capability-bound actions; unavailable → show reason + resource delta +
   upgrade path copy from `CAPABILITY_META`. Render `FEATURE_DISABLED`/v2
   surfaces as informative gates (phase-v2 chip comes free via `<Screen>`),
   never as hidden menus.
4. Mutations: call your module's `lib/api/<module>.ts` function, which calls
   `operations.submit({…})` (202+operation pattern), then `push("success", …)`
   toast (acknowledgement only) and, where useful, `setTrayOpen(true)`. NEVER
   mark completion client-side — success arrives when the operation reaches
   `succeeded` with `postcondition_verified` semantics.
5. Destructive actions: `<ConfirmDialog>` naming the exact target ("Delete
   website acme-consulting"). High-risk changes: `<ImpactReview>` before
   submit. Sensitive ops: `requestStepUp()` first.
6. Statuses: `<StatusPill>` (DS-004) always icon + text, with freshness
   (`formatRelative(last_verified_at, useNow())`, DS-025 "last checked").
   Metrics unavailable → display "Unavailable", never 0.
7. Money: minor units via `formatMoney`; KES everywhere; VAT 16% rows.
8. Kenya-context sample data only from `db` + your module file (Acme
   Consulting, kilishop.co.ke, Safaricom +2547…, M-Pesa).
9. Wire cross-links: rows link to their detail screens; operations link to
   `/activity/jobs/:job`; payments to `/commercial/payments/:id/pending`.
10. A11y: labelled inputs (never placeholder-as-label), focus rings are global,
    touch targets ≥ 24px (buttons default 40px), tables have `<th scope>`,
    icon-only buttons need `aria-label`. Responsive: tables become cards /
    horizontal scroll with sticky identity column below `md`; no critical
    action hidden behind hover.
11. Dark mode + density come free from tokens — use token utilities only
    (`bg-surface`, `text-ink-2`, `border-line`, `bg-accent-soft`…). Never raw
    hex, never colors outside the palette.
12. TypeScript strict: no `any`, no non-null `!` on possibly-missing data,
    handle undefined fixture lookups with an honest not-found state.
13. NO TODO/placeholder markers; no `console.log`; no `fetch(`; no
    `next/image` optimizer (use plain `<img>` with unoptimized semantics if
    ever needed — prefer inline SVG).

## UI kit you must import (components/ui/*, components/common/*)

The design-system agent provides (contract = design_system.md §3):
`Button`, `Card`, `StatusPill`, `DataTable`, `Field/Input/Select/Textarea/Switch/Checkbox`,
`Modal`, `ConfirmDialog`, `ImpactReview`, `Drawer`, `Tabs`, `ToastViewport`,
`EmptyState`, `UnavailableState`, `Callout`, `Skeleton`, `Spinner`,
`Breadcrumbs`, `Pagination`, `Stepper`, `CodeBlock`, `SecretField`, `LogViewer`,
`CopyButton`, `KeyValue`, `ProgressBar`, `AllocationStrip` (DS-022),
`BatchQueueIndicator` (DS-023), `PaymentPendingBanner` (DS-026),
`OperationTimeline` (DS-011), `CapabilityBanner` (DS-021), `LiveStatusLine`
(DS-025), `DiffViewer` (DS-012), `NotificationList` (DS-018), `TemplateCard`
(DS-027), `UpgradeRecommendation` (DS-028), `AccessGrantBanner` (DS-019).

Import paths: `@/components/ui/<file>` where the file name matches the
component family (button.tsx, card.tsx, badge.tsx (StatusPill), table.tsx,
form.tsx, overlay.tsx (Modal/ConfirmDialog/ImpactReview/Drawer), tabs.tsx,
toast.tsx, feedback.tsx (EmptyState/UnavailableState/Callout/Skeleton/Spinner),
nav.tsx (Breadcrumbs/Pagination/Stepper), code.tsx (CodeBlock/SecretField/LogViewer/CopyButton),
misc.tsx (KeyValue/ProgressBar/DiffViewer/NotificationList/TemplateCard/UpgradeRecommendation/AccessGrantBanner)),
`@/components/common/capability-banner.tsx` (CapabilityBanner),
`@/components/common/allocation-strip.tsx` (AllocationStrip),
`@/components/common/batch-queue.tsx` (BatchQueueIndicator),
`@/components/common/payment-banner.tsx` (PaymentPendingBanner),
`@/components/common/operation-timeline.tsx` (OperationTimeline),
`@/components/common/states.tsx` (LiveStatusLine),
`@/components/shell/*` (AppShell, Sidebar, Topbar, OperationTray, CommandPalette).

## Shell integration (shell agent only)

`components/shell/app-shell.tsx` default-exports nothing; it exports
`AppShell` used by `app/(panel)/layout.tsx`. Sidebar nav is generated from
`SCREENS`/`MODULES` grouped by module, filtered by persona audiences and
presentation mode (guided → router/portfolio/help + "Advanced tools" sheet;
standard → grouped; expert → expanded + compact density). Topbar: org
switcher, search (opens CommandPalette), batch indicator, notifications, help,
theme, user menu with persona/presentation/profile switches. OperationTray
reads useOperationStream; CommandPalette lists screens capability-aware.

## Definition of done per screen

- Page file exists at the exact app_path; `"use client"` rules above followed.
- `<Screen>` frame; registry title used; breadcrumbs correct.
- Populated default state from fixtures + empty + capability + (where
  meaningful) failed states.
- All buttons either navigate, open a modal/wizard step, or submit an
  operation — no dead controls.
- Cross-links resolve to real routes in the registry.
