# NexusPanel — GUI Prototype

A **static, server-free** prototype of the NexusPanel hosting control panel, built
from the NexusPanel Stage 1–7 v2.0 specifications. Next.js 16 App Router +
React 19 + Tailwind v4, exported as plain static files (`output: "export"`) —
per **DEC-001 / ADR-002b**: the real panel is a static SPA served by
Nginx/Caddy with **no Node runtime on the server**. This prototype uses
Next.js only as a build-time exporter; `npm run build` produces `out/` which
any static file server can host.

All data is **mocked against the Stage 6 API contract** (`/api/v1`, snake_case,
problem+json errors, cursor pagination, `202 Accepted` + operation resources,
SSE-shaped operation events, money in minor units). When the Go control plane
exists, only `lib/api/*` internals change.

## Status

**Done and type-checked:**

- Design tokens (Stage 3 §4.2 exact palette, light/dark), type scale, radius, motion, reduced-motion
- Domain types (`lib/types.ts`), format helpers, server profiles + honest capability sets (`lib/profiles.ts`), personas (`lib/personas.ts`)
- Mock API core + bootstrap endpoints (`lib/api/`), shared demo dataset (`lib/mock/data.ts` — Wanjiku Digital, Nairobi: KES, .co.ke, M-Pesa)
- Async-operation engine (`lib/operations.ts`): 202+operation lifecycle, batch queue/yield, resumable SSE-shaped events
- Providers: persona / presentation mode / profile tier / theme / density / org / support-access, toasts, operation stream
- Screen registry: **all 184 screens** from Stage 3 §8 (`lib/screens.ts`, generated)
- UI kit (`components/ui/*`): Button, Card, StatusPill (DS-004), DataTable (DS-003), forms (DS-007), Modal/ConfirmDialog (DS-010)/ImpactReview (DS-009)/Drawer, Tabs, Toasts, EmptyState (DS-016), ErrorBlock, Breadcrumbs/Pagination/Stepper, CodeBlock/SecretField (DS-008)/LogViewer (DS-014), DiffViewer (DS-012), NotificationList (DS-018), TemplateCard (DS-027), UpgradeRecommendation (DS-028), AccessGrantBanner (DS-019)
- Common honest-state components (`components/common/*`): CapabilityBanner (DS-021), AllocationStrip (DS-022), BatchQueueIndicator (DS-023), PaymentPendingBanner (DS-026, live M-Pesa countdown), OperationTimeline (DS-011), LiveStatusLine (DS-025), UnavailableState
- App shell (`components/shell/*`): registry-driven sidebar with guided/standard/expert presentation modes and persona filtering, topbar (org switcher, profile switcher, ⌘K command palette DS-015, batch indicator, notifications), operation tray, mobile drawer + bottom shortcuts
- Landing page (`app/page.tsx`): persona-resolved default landing + the FLOW-013 Router ("What do you want to run?") with capability-aware cards and the timed "under 10 minutes" live-moment

**Pending (the screens themselves):**

- The **178 page routes + 6 route states** across the 15 modules
  (iam, overview, infrastructure, commercial, web, files, databases, dns,
  mail, ops, automation, ai, support, services, templates). The core, design
  system, and shell are complete; each screen page still needs to be authored
  against `docs/build-inputs/conventions.md` (screen-by-screen list with exact
  `app_path` per screen: `docs/build-inputs/screens.json`).
- ESLint flat-config needs a fix (FlatCompat crash); `npx tsc --noEmit` is the working gate.
- `npm run check:screens` stub exists — wire it to verify page coverage vs `lib/screens.ts`.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export → out/
npx serve out      # serve the static build
```

## Demo controls (top bar)

- **Persona** — the 8 personas of the persona matrix (router vs portfolio vs fleet landings)
- **Presentation** — Guided / Standard / Expert (identical permissions, disclosure only)
- **VPS tier** — Nano / Starter / Standard / Provider: watch every capability-honest
  state change (DS-021 banner, router cards, unavailable states with resource deltas)
- **⌘K** — command palette; the operation tray shows the 202+operation lifecycle live

## Layout

```
app/                 routes; (panel) group uses the shell; auth/setup/onboarding are bare
components/ui/       design-system kit (DS-001…028)
components/common/   honest-state + banner components
components/shell/    sidebar, topbar, operation tray, command palette
components/common/screen.tsx  <Screen id="UX-…"> frame — traceability + persona guard
lib/                 types, profiles, personas, api clients, mock data, operation engine
docs/build-inputs/   spec extractions used to generate this prototype
```
