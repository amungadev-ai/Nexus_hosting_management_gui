# NexusPanel — Design System & App-Shell Build Input

Extracted from `NexusPanel_Stage 3_Complete_UI_UX_Specification_v2.0.md` (primary, read in full) and `NexusPanel_Stage 4_Technical_System_Architecture_and_Engineering_Design_v2.0.md` (SPA/frontend sections only). Stage 3 §0: this is a **behavioral UI specification, not pixel-perfect Figma artwork**. Design target: "Premium, calm, fast, approachable hosting UX with deep expert controls." Stage 3 status: comprehensive draft, NOT implementation-approved; anything marked PROPOSED in the spec is subject to approval. UXD-002 design direction: "Neutral surfaces + restrained indigo accent."

---

## 1. Design tokens

### 1.1 Color tokens — EXACT values from spec (Stage 3 §4.2 "Visual tokens — proposed starting palette, not approved brand identity")

The spec DOES give exact hex values for both light and dark themes. They are labeled "proposed starting palette" (not approved brand identity), but the values themselves are explicit — treat them as the canonical palette for the prototype.

| Token | Light | Dark | Rule (from spec) |
|---|---|---|---|
| `color.canvas` | `#F7F9FC` | `#0B1020` | Neutral backgrounds |
| `color.surface` | `#FFFFFF` | `#121A2B` | Layered surfaces |
| `color.text.primary` | `#172033` | `#F3F6FC` | Contrast validated |
| `color.text.secondary` | `#526079` | `#B0BCD0` | Never convey status by color alone |
| `color.accent` | `#465CF5` | `#8794FF` | Brand action; validate contrast |
| `color.success` | `#177A53` | `#55D7A1` | Pair with icon and text |
| `color.warning` | `#946200` | `#F4C46A` | Pair with icon and text |
| `color.danger` | `#C23545` | `#FF8793` | Reserved for risk and failure |
| `color.border` | `#DDE4EE` | `#2A354A` | Subtle structural boundaries |

Semantic role notes from elsewhere in the spec:
- Accent = "brand action" — restrained indigo (UXD-002). Danger is "reserved for risk and failure" — do not reuse for informational states.
- Status colors must always be paired with icon AND text (never color-only).
- Spec defines NO muted/info token, no hover/pressed tints, no chart palette. Derived hover/active tints, an informational `color.info`, and surface-elevation variants: **PROPOSED (not in spec)** — derive from the palette above (e.g., accent at reduced opacity; canvas/surface layering for elevation).

### 1.2 Dark mode rules

- Themes: **light / dark / system** plus **compact density** option (UXD-015).
- Every color token has an explicit dark value in the §4.2 table (above) — dark is token-for-token parallel, not an ad-hoc inversion.
- Dark `accent` lightens (`#465CF5` → `#8794FF`) to hold contrast; "contrast validated" is a stated rule for text tokens and "validate contrast" for accent.
- White-label/reseller brand overrides (UXD-016, UX-COM-009, UX-AUTO-009) must stay "within accessibility constraints."

### 1.3 Typography

From Stage 3 §4.2:
- **Family:** "modern system/Inter-like sans" — system UI stack or Inter. Exact family is not fixed: **PROPOSED (not in spec)** to use Inter with a system-font fallback stack.
- **Type scale:** `12 / 14 / 16 / 20 / 24 / 32` px — "clear scale," exactly these steps.
- **Body minimum:** 14px "where feasible."
- **Monospace font** required for logs, paths, keys, environment variables and code. Exact mono family: **PROPOSED (not in spec)** (e.g., a common programming ligature-free mono).
- Token naming for the six scale steps (map to e.g. caption/body-lg/h4/h3/h2/h1): **PROPOSED (not in spec)** — the px values are exact, the semantic names are not.

### 1.4 Spacing, radius, density, motion, icons

- **Spacing:** 4px base grid; allowed steps `8 / 12 / 16 / 24 / 32 / 48`.
- **Radius:** `6px` compact controls; `10–12px` cards; `16px` modal. (Use 10 or 12 for cards — **PROPOSED (not in spec)**: pick 12px cards as the single card value.)
- **Elevation/shadows:** "avoid excessive decorative shadows." No shadow values given. A minimal 2–3-step elevation scale: **PROPOSED (not in spec)**. Stage 3 §17 lists "elevation" as a required token deliverable, so the prototype needs one.
- **Density:** comfortable default; compact density for expert tables (user-selectable via preferences, UXD-015).
- **Motion:** `120–240ms` subtle transitions; **must respect reduced-motion** (prefers-reduced-motion).
- **Icons:** one consistent stroke family; **always text-label destructive actions** (icon alone never enough for destructive). No icon set named: **PROPOSED (not in spec)** (any single consistent stroke set, e.g. Lucide).

### 1.5 Z-index

Not specified anywhere in the spec. Required stacking contexts implied by the shell: sticky topbar, capability banner, context drawer, operation tray, command palette, dialog, toast. Full scale: **PROPOSED (not in spec)** — e.g. base 0 / sticky 100 / drawer 200 / overlay 300 / modal 400 / palette 500 / toast 600.

### 1.6 Breakpoints (Stage 3 §13 — "Breakpoints (proposed)")

| Token | Value | Label in spec |
|---|---|---|
| `bp.small-mobile` | `< 640px` | small mobile |
| `bp.large-mobile-tablet` | `640–1023px` | large mobile/tablet |
| `bp.desktop` | `≥ 1024px` | desktop |
| `bp.wide` | `≥ 1440px` | wide |

Rule: "Responsive rules must be content-based, not solely device labels." A design QA gate requires no critical task blocked at **320px** viewport and support for **200% zoom**.

---

## 2. App shell anatomy

### 2.1 Shell regions (Stage 3 §4.1, in order)

1. **Global top bar:** brand, organization switcher, server/account context, search/command palette, activity, help, theme, user menu.
2. **Navigation:** grouped sections, active item, collapse, unread incident indicator, permission filtering.
3. **Page header:** breadcrumb, title, short description, observed status + freshness, one primary CTA, contextual actions. (Always: breadcrumbs, page title, resource status, scope badge, primary action in consistent locations — §3 navigation rules.)
4. **Main region:** summary cards, resource tables, detail tabs, wizards and editors; "avoid dashboard-only dead ends."
5. **Context drawer:** non-destructive inspection, logs, inline help, AI explanation; deep links supported.
6. **Operation tray:** persistent progress across navigation, approval requests, failed jobs and recovery actions. (This is the spec's "operations drawer" — the term used in Stage 3 is **operation tray**.)
7. **Toast:** acknowledgement only; durable results belong in the activity center. **Never use toast as sole error presentation.**
8. **Capability banner** (v2): persistent wherever any capability is unavailable; honest, not alarming; expands to explanation + upgrade path.
9. **Batch workload indicator** (v2): small queue indicator in the shell ("3 jobs queued, 1 running"), clickable to the batch jobs view.
10. **Allocation/usage strip** (v2): compact strip below the page header on workload detail pages — allocated / typical / peak / current.

### 2.2 Navigation structure and the guided-vs-menu IA relationship

- Desktop: **collapsible left sidebar** with pinned favorites. Tablet: **compact rail + drilldown**. Mobile: **drawer + bottom shortcuts** fixed set: Overview, Resources, Activity, Search, More.
- Menu labels adapt to persona, but **resource identity and URL structure remain stable**.
- Unavailable module shows a **disabled explanatory state only when discovery is useful**; prohibited resources must NOT be discoverable.
- **Primary IA (architectural constraint, §0 "guided-default rule"):** the **guided router is the primary IA** for personas whose job is "get something new working"; the **service portfolio (UX-OV-001) is the primary IA** for personas whose job is "manage what I already have" (it "replaces the dashboard" as the primary surface); the **27-area menu is the secondary IA**, reachable via **"Advanced tools"** on the router or from the portfolio view. "If the default landing is the menu, the lay person drowns — that is cPanel's failure mode."
- `GET /` resolves the default landing page per persona (jobs-to-be-done). UXD-021: Router for new users; service portfolio for returning users — **release gate**.
- First-run router (FLOW-013): six cards — A website / An application / A self-hosted app / Data & storage / Infrastructure / I'm not sure yet — under "Welcome to NexusPanel. What do you want to run?", with "I'm not sure yet →" fallback below. After the first path the user lands on the service portfolio with a follow-up checklist ("Your first site is live / Connect your domain / Enable automatic backups / Invite a collaborator").
- The router is **context-free** — it appears before any organization/account context is established.

### 2.3 Presentation modes: Guided / Standard / Expert

- **Persona ≠ permission.** "Guided / Standard / Expert are presentation modes. Permissions are identical across modes. The API enforces permissions; the UI reflects them." Anti-pattern called out in the spec: `if (role === 'reseller') showCustomerMenu()` — that is the permission model leaking into the UI.
- UXD-005: progressive disclosure, same permissions. UXD-033: **Guided → Expert toggle; same permissions; presentation only**. UXT-029 pass criteria: "User switches modes; permissions identical; presentation clear."
- What each mode shows (all the spec defines — no further per-mode inventory exists): Guided = router/portfolio/guided flows front-and-center with the full menu demoted behind "Advanced tools"; Expert = expert tables in compact density and deep controls surfaced (density and progressive disclosure are the mechanism). The spec never hides permitted capability by mode — disclosure, not removal.
- Where the toggle lives is **not specified** (top bar/user menu is the natural home) — **PROPOSED (not in spec)**: user menu, next to theme.

### 2.4 Persona and profile switching

- **Context model (§2):** top-left **organization switcher**; secondary **account/project/server selector**; **breadcrumb identifies current scope**. Switching must **clear scoped search, filters, cached details and active selections**. Multiple memberships ⇒ never assume the same role across organizations (UXD-004: explicit switcher + persistent breadcrumbs).
- **Persistent banner** required for: temporary support access, maintenance, impersonation-like delegated view, read-only mode (DS-019 access grant banner: scope, actor, reason, expiry, revoke link).
- **User menu** (top bar) holds theme and user-level items; **personal preferences** screen UX-IAM-012 `/settings/profile`: theme, language, timezone, density, notifications.
- Persona table (landing contexts) and jobs-to-be-done table drive the router; personas are jobs-to-be-done, not permission identities.

### 2.5 Notification / operation surfaces

- **Notification center** (DS-018): severity, read state, deep links, per-channel preferences; in-app plus optional email/webhook; dedupe; mandatory critical-notifications policy. Includes batch completion and batch-queued notifications.
- **Operation tray** (shell #6): durable, cross-navigation progress; approvals; failed jobs + recovery actions.
- **Batch queue indicator** (DS-023) in the shell on all breakpoints.
- **Activity center** (`/activity` UX-OV-004): user-visible operation stream with actor, scope, submitted/observed state, approvals, correlation ID and safe logs. Toasts only acknowledge.

---

## 3. DS component catalog (DS-001 … DS-028)

28 components total. "States / behavior" column is quoted from §4.3; every component additionally inherits the global state taxonomy in §5 below where applicable (loading/empty/error/stale/permission/job states). Standard interactive states to build for all: default, hover, focus-visible, active, disabled, loading; plus empty/error where the component holds content.

| ID | Component | Spec contract ("States / behavior") | Build notes: variants / extra rules from spec |
|---|---|---|---|
| DS-001 | App shell / nav | Expanded/collapsed/mobile, active, keyboard navigation | Desktop collapsible sidebar w/ pinned favorites; tablet rail+drilldown; mobile drawer + bottom shortcuts; unread incident indicator; permission filtering |
| DS-002 | Organization/context switcher | Search, recent, permission-aware, pending-work warning | Switch clears scoped search/filters/cache/selections; no assumed role across orgs |
| DS-003 | Resource table | Sort/filter/search, cursor pagination, row selection, bulk scope validation | Bulk ops show count, scope, per-item results; compact density for expert tables; collapses to cards or horizontal scroll w/ sticky identity column |
| DS-004 | Status pill | Healthy/degraded/pending/offline/unknown, freshness tooltip | Variants: healthy / degraded / pending / offline / unknown; never color-only — pair icon + text |
| DS-005 | Capacity meter | Used/reserved/available, units, threshold, accessible text | Distinguish allocation (ceiling) vs usage; accessible text mandatory |
| DS-006 | Multi-step wizard | Stepper, back, draft, preflight, review, job handoff | On narrow screens keep step title, progress, back controls; drafts retained during navigation |
| DS-007 | Form field | Label, hint, validation, error summary, keyboard focus | Labels never rely on placeholders; required/optional explicit; preserve input on recoverable errors; inline + summary validation, server authoritative |
| DS-008 | Code/secret field | Mask by default, copy permissions, no analytics capture | One-time reveal ("Secret copied. It will not be shown again."); never in screenshots/telemetry |
| DS-009 | **Impact review** | Before/after, affected resources, downtime, reversibility, approval | **Full contract:** the universal action sequence ends "…review impact → authorize/approve → submit → track → verify → audit/recover." Resource actions "launch impact review and durable jobs; UI cannot mark completion before verification." Destructive ops must explain retention and recovery; restore shows "enumerate overwritten resources and downtime"; firewall shows diff + lockout warning + alternate access path; never equate completed file copy with verified service recovery |
| DS-010 | Confirmation dialog | Exact target, consequences, typed confirmation for high risk | Every destructive label names its target ("Delete website" not "Delete"); full-height sheet on narrow screens; focus restoration after close |
| DS-011 | **Job timeline (operation timeline)** | Queued/running/waiting/partial/success/failed/cancelled, logs | **Full contract:** one timeline per operation with stages queued / running / waiting / partial / success / failed / cancelled plus logs. Deployment lifecycle: queued → building → releasing → starting → health-checking → verified, with log stream and rollback where supported. "No false green success" while pending; success requires observed result + timestamp; partial shows per-step outcomes + remaining risk; failed shows safe error code, reason, correlation ID; browser refresh must rehydrate operation status. AI/verification rule: the AI (or any component) never claims success before verification. Batch variants: batch-queued ("Will run when server is idle" + queue position), batch-running (progress bar with low-priority indicator), batch-paused (reason: serving-workload contention; resume when idle or force with warning) |
| DS-012 | Diff viewer | Syntax highlighting, changed lines, safe secret redaction | Used for env/config/DNS changes and conflict resolution; secrets redacted |
| DS-013 | File tree/editor | Expand, rename, upload, tabs, dirty indicator, conflict resolution | Lazy loading, virtualized large folders, search, drag-drop with confirmation; container-aware paths on Standard+; mobile: folder list first, single-file view |
| DS-014 | Log viewer | Live/pause, severity, time, filter, copy/export, redact | Streaming with labeled disconnect/last update; no raw secrets; no infinite client retries |
| DS-015 | Command palette | Scoped search, keyboard shortcuts, no permission leaks | Capability-aware commands: "Deploy Nextcloud" only if available; if unavailable shows reason + upgrade path; mutation commands open guarded wizards, no silent execution |
| DS-016 | Empty/disabled state | Reason, prerequisites, next action, no misleading upsell | The honest-state primitive; see §5 states taxonomy; "no dead ends" — every failure offers retry, repair, support or diagnostic path |
| DS-017 | AI plan card | Evidence, suggested actions, risks, approvals, execution state | AI proposes; user approves; policy engine validates again at execution; v1 = read-only diagnosis + proposed-action approval |
| DS-018 | Notification center | Severity, read state, deep links, per-channel preferences | In-app + optional email/webhook; dedupe; mandatory critical notifications |
| DS-019 | Access grant banner | Scope, actor, reason, expiry, revoke link | Persistent banner for support access / delegated view / read-only / maintenance |
| DS-020 | Responsive tabs/drawers | Deep-linkable, accessible focus, preserved selection | Context drawer deep links supported; focus restored after close |
| DS-021 | **Capability banner** | Unavailable capabilities with reason and resource delta; upgrade link; dismissible but persistent on overview | **Full contract (§2/§4.1/FLOW-014/§13):** "persistent on installations where any capability is unavailable. It is honest, not alarming: 'Your VPS cannot run: WordPress (needs 150 MB more), Databases (needs 250 MB more), Image transformation (needs 2 vCPU).' Clicking expands the explanation and the upgrade path." Copy (§14): "Your VPS cannot run WordPress because it needs 150 MB more RAM. Upgrade to a 2 GB VPS to enable PHP hosting and WordPress." Never a greyed-out button without explanation; never "disabled" or "not available on your plan" language — say "your VPS cannot run this because it needs 150 MB more RAM." Collapsible on mobile with primary text visible without expanding. Instrumented: does the user click Upgrade from it? |
| DS-022 | **Allocation/usage strip** | Allocated / typical / peak / current, with sparkline; per-workload and per-server | **Full contract:** compact strip below the page header on every workload page (UXD-024); answers "am I close to my limits?" (UXT-023). Data: current / typical (7-day p50) / peak (24h p99) / throttled seconds / OOM events (Stage 4 `GET /resources/{id}/usage`); server-level aggregate at UX-OV-009. Terminology: allocation is a ceiling, not a reservation — "this workload may use up to X"; typical/peak are measured ("typical 0.4 vCPU (7-day p50), peak 1.5 vCPU (24h p99)"). Becomes horizontal scroll on mobile, not wrap; each workload stays reachable |
| DS-023 | **Batch queue indicator** | Queued/running counts; clickable to batch jobs view; informational, not error | **Full contract:** "small queue indicator in the shell showing batch jobs (transforms, backups, builds) that are queued or running. '3 jobs queued, 1 running' — clickable to the batch jobs view. This is how batch workloads are made visible without being alarming." Batch = image transforms, backups, builds, AI diagnostics, migrations — "runs low-priority, queues under contention, completes eventually." Copy: "Your backup is queued. It will run when your websites are idle, usually within minutes." Throttled copy: "Your image transforms are running at reduced speed to keep your sites responsive. This is normal." Remains in the shell on all breakpoints — "important for understanding why a build/backup is slow." Queued is the honest state, never "failed" or "slow" |
| DS-024 | Router card | Six-card layout: icon, title, one-line description, "Get started" | Used only in first-run router (FLOW-013); capability-aware availability (available / "Not available on this VPS — needs 200 MB more RAM" / "runs, but tight" on Starter with resource delta); stacks vertically on mobile, 2×3 grid tablet, 3×2 desktop; fully tappable; below the six cards: "I'm not sure yet →" (no-match falls back to capability display + guided tour) |
| DS-025 | **Live status line** | "Last checked 12 seconds ago" — visible on every resource page; distinguishes observed from desired | Trustworthy-state principle: distinguish desired / pending / observed actual state; show last checked; offline/stale shows last seen with no live-health claim ("Last contact with this server was 12 minutes ago. Current health is unknown.") |
| DS-026 | **Pending payment banner** | Async payment state (M-Pesa pending, Stripe processing); shows state + retry/wait action | **Full contract:** async-first payment state machine `initiated → pending → {confirmed | failed | expired | reversed}` (Stage 4 ADR-005d); card resolves pending in <1s, mobile money 10s–2min — UI must hold a live pending state, not fake instant success. Copy (§14): "We've sent a payment request to your phone. Enter your M-Pesa PIN to complete the payment. Waiting for confirmation…" (Wait / retry / cancel). Screen UX-COM-015 shows "Awaiting M-Pesa confirmation — check your phone" or "Processing card payment" with appropriate timing. Confirmed: "Payment received. Your subscription is active." Unmatched callback: "We received a payment notification we couldn't match to an invoice. An administrator will review it within 24 hours." (admin-only reconciliation UX-COM-017) |
| DS-027 | **Template card** | ServiceTemplate catalog item: icon, name, category, resource profile, deploy button | Catalog categories: CMS, files, dev, analytics, monitoring, database, cache; v1 catalog ships 5–10 templates (WordPress, Nextcloud, Gitea, Ghost, n8n, Uptime Kuma); catalog is data, not code; unavailable on Nano shows honest state (Docker requirement + upgrade path) |
| DS-028 | **Upgrade recommendation** | "Consider upgrading" with evidence (peak RAM > 80%, OOM kills, CPU contention); link to upgrade flow | Evidence-based only; copy: "Your peak RAM has been above 80% for 7 days. Consider upgrading to a 4 GB VPS for more headroom." (View evidence / upgrade). Auto-generated suggestions at `/overview/recommendations`; memory-pressure copy: "Your Node app is using 380 MB of its 400 MB limit. If it hits the limit, it will be restarted. Consider upgrading or reducing usage." |

**Mutation/form grammar that cuts across all components:** disable duplicate submit; idempotency key on every mutation; retain draft during navigation; browser refresh rehydrates operation status; server validation authoritative; high-risk actions use step-up MFA and/or second-person approval per policy; never optimistic "success" for DNS propagation, TLS issuance, deployment health or restore.

---

## 4. Cross-cutting UI requirements (UXR-###)

**Anomaly:** Stage 3 §0 declares the identifier `UXR-###` for "cross-cutting requirements," but **no `UXR-###` item exists anywhere in the document** (grep-verified; the only occurrence is the scheme declaration itself). The de-facto cross-cutting requirements are the §0 v2 design rules, §1 principles, §5 mutations rules, and the UXD-### register. They are listed here one-per-line so the prototype can implement them; assign UXR IDs only if the parent build wants synthetic ones (marked as synthetic).

Named cross-cutting rules (verbatim rules from §0 "Additional design rules"):
1. **Guided-default rule** — guided router is the primary IA for "get something new working" personas; service portfolio for "manage what I already have"; menu is secondary via "Advanced tools"; architectural constraint, not UI preference.
2. **Persona ≠ permission** — Guided/Standard/Expert are presentation modes with identical permissions; never branch UI on role.
3. **Capability display is honest** — unavailable capability shows reason + resource delta, never a bare greyed-out button.
4. **Allocation is a ceiling, not a reservation** — every workload shows current / typical (7-day p50) / peak (24h p99); upgrade recommendation exists because allocation ≠ usage.
5. **Batch workloads are visible as batch** — queue state, not errors: "Queued, will run when server is idle."
6. **The Nano experience is complete, not cut-down** — full panel, honest capability set, no greyed-out menus, no fake features.

Additional cross-cutting rules (one line each, from §0/§1/§4.4/§5/§6/§10/§13):
- UI never bypasses server-side authorization, policy, quota, approval or agent controls; hidden buttons are not a security boundary.
- Universal action sequence: inspect → configure → validate → review impact → authorize/approve → submit operation → track progress → verify actual result → audit/recover.
- Unsupported, unavailable, disabled and unauthorized are different states with different explanations.
- Every screen maps to Stage 2 requirements, authorized API actions, success/error states, analytics events and E2E tests; screens are never evidence a backend feature works.
- WCAG 2.2 AA target with keyboard and screen reader support; all primary workflows keyboard-operable.
- Trustworthy state: distinguish desired / pending / observed; failed jobs never display as successful.
- No dead ends: every failure offers retry, repair, support or diagnostic path.
- Fast perception: skeletons; optimistic UI only for non-authoritative state; no fabricated success during async work.
- Multi-tenant clarity: scope and permissions surfaced before actions; zero cross-tenant resources in search.
- AI with consent: AI drafts plans, never silently runs privileged actions.
- Every privileged mutation has visible progress and audit links; every destructive operation explains retention and recovery.
- Context always evident (organization, account, server, resource); no accidental cross-tenant edits.
- Content rules: consistent nouns (Website, Application, Hosting Account, Server, DNS Zone, Mailbox, Backup, Restore, Deployment, Job, Approval); "domain" ≠ website; plain language first, expert terms in expandable help; destructive labels name their target; distinguish saved / submitted / running / verified; absolute timestamp + relative age; user timezone for dates, UTC for audits.
- Metric unavailable ⇒ display "Unavailable," never zero; dashboard metrics show source, measurement period, last refresh.
- Never show raw stack traces, SQL, passwords, tokens, private keys or unredacted env vars to general users; provide correlation IDs for support.
- Search only authorized scopes; no hidden tenant hints; result shows type, name, context, status.
- Telemetry: only the named coarse events (screen_viewed, wizard_started, wizard_step_completed, preflight_failed, operation_submitted, operation_verified, operation_failed, help_opened, approval_decided) plus v2 funnel events; never secrets, sensitive paths, email contents, SQL, terminal input or arbitrary logs.

---

## 5. States taxonomy (Stage 3 §5 — every screen inherits this)

Core matrix (state → presentation → available actions):

| State | Presentation | Available actions |
|---|---|---|
| Initial loading | Skeleton matching content, accessible loading announcement | Cancel navigation where safe |
| Empty | Explain why empty, contextual first action | Create/import or learn |
| Loading more | Inline progress, preserve previous rows | Cancel filter or retry |
| Pending | Visible job ID and stage, no false green success | View job, safe cancel if supported |
| Awaiting approval | Approver, reason, expiry, proposed impact | Approve/reject only with permission |
| Success (verified) | Observed result and timestamp | View resource, audit, next step |
| Partial success | Per-step outcomes, remaining risk | Retry failed steps, compensating plan |
| Failed | Safe error code, reason, correlation ID | Retry when safe, diagnostics, support |
| Offline/stale | Last seen, no live-health claim | Refresh, inspect last state |
| Unauthorized | Generic denial, no resource existence leak | Request access when permitted |
| Unsupported | Capability mismatch and prerequisites | Change topology/adapter |
| Quota exceeded | Current/reserved/limit, upgrade/request flow | Free capacity or request quota |
| Conflict/concurrent edit | Show versions/diff and owner if allowed | Reload, merge, force only with policy |
| Maintenance | Banner, estimated window if known | View status, schedule permitted action |
| Recovery required | Prominent incident status and out-of-band runbook | Guided recovery, support |

v2 additions:

| State | Presentation | Available actions |
|---|---|---|
| Capability unavailable | Honest explanation with resource delta and upgrade link | View upgrade path, choose alternative |
| Batch queued | "Will run when server is idle" with queue position | View queue, remove from queue if supported |
| Batch running | Progress bar with low priority indicator | Pause if supported (rare) |
| Batch paused | Reason (serving workload contention) | Resume when idle, or force (with warning) |
| Memory pressure | "This workload is close to its memory limit; consider upgrading" | View metrics, adjust workload, upgrade |
| Throttled | "This batch workload is yielding to site traffic" — informational, not error | View metrics, no action required |
| Pending payment | Async payment state (M-Pesa pending, Stripe processing) | Wait, retry, cancel |
| Payment callback unmatched | "We received a payment notification we couldn't match to an invoice" | Manual reconciliation (admin only) |
| Router no-match | "Let's see what your VPS can do first" | Fall back to capability display + guided tour |

Explicit distinction the spec insists on: **unsupported ≠ unavailable ≠ disabled ≠ unauthorized** — different states, different explanations. Example honest-state screens: databases on Nano ("Databases are not available on this VPS because the panel's metadata DB already consumes the available SQLite budget. Upgrade to Standard…"), terminal on Nano ("Terminal is not available on this VPS because sites are not containerized. SFTP works for file transfer."), authoritative DNS v1 ("Authoritative DNS hosting is coming in v2…"), templates on Nano (Docker required), AI without LLM key. Release gate: **zero dead-end states** — every unavailable capability shows reason + upgrade path.

---

## 6. Accessibility requirements

- **Target: WCAG 2.2 AA** ("Accessibility by default — WCAG 2.2 AA target, keyboard and screen reader; automated and manual audit").
- All primary workflows keyboard-operable; keyboard-only wizard test (UXT-009): all fields, errors, steps, confirmations operable.
- Screen reader dialogs (UXT-010): correct labels, focus trap and restoration, announcements.
- Skeleton loading carries an accessible loading announcement.
- Touch targets: **≥ 24×24 CSS px minimum** (WCAG 2.2 AA), **preferably 40–44px** for common actions.
- Keyboard focus visible and never obscured.
- Support 200% zoom, text resizing, high contrast, reduced motion.
- No color-only status — status colors always paired with icon and text.
- Accessible error summary (forms) plus focus restoration after modal close.
- Keyboard shortcuts must not override browser/screen reader shortcuts without user control.
- No critical task blocked at 320px viewport (measurable UX target + UXT-011 with 200% zoom).
- Destructive actions always text-labeled (icon alone insufficient).
- Localization readiness: prepare copy for localization and pluralization, IDN/punycode display, 24-hour vs 12-hour time, units and user time zones; "Test RTL before claiming support."
- Contrast: text tokens "contrast validated"; accent must "validate contrast"; white-label brand overrides stay within accessibility constraints.

---

## 7. Responsive rules

**Breakpoints:** small mobile <640px; large mobile/tablet 640–1023px; desktop ≥1024px; wide ≥1440px. Rules must be content-based, not solely device labels.

Mandated behaviors:
- Navigation: desktop collapsible sidebar w/ pinned favorites → tablet compact rail + drilldown → mobile drawer + bottom shortcuts (Overview, Resources, Activity, Search, More).
- Tables collapse to cards or horizontal scroll with sticky identity column.
- Destructive actions never become hidden behind inaccessible hover.
- Dialogs become full-height sheets on narrow screens; multi-step wizards retain step title, progress and back controls.
- Code editor supports reduced capability on mobile with explicit limitations (file manager mobile: folder list first, single-file view/edit, limited bulk actions, no desktop-keyboard assumption).
- Router cards: stack vertically on mobile; 2×3 grid on tablet; 3×2 on desktop; each card fully tappable.
- Capability banner: collapsible on mobile; primary text ("Your VPS cannot run WordPress") stays visible without expanding.
- Allocation/usage strip: horizontal scroll on mobile, not a wrap; each workload remains reachable.
- Batch queue indicator: stays in the shell on all breakpoints.
- 320px viewport + 200% zoom: no loss of critical content/actions (UXT-011).
- Mobile file upload: progress, conflict handling, retry, accessible status (UXT-016).

---

## 8. Stage 4 frontend constraints (SPA serving, bundle discipline, capability gating)

- **Stack (ADR-002, rewritten in v2 — DEC-001, sign-off required):** Go control plane + Go agent + **static SPA frontend**. Rationale: a 512 MB Nano VPS requires a panel footprint of **~40 MB**, which "TypeScript + Node + Next.js SSR cannot meet, but Go + static SPA can."
- **ADR-002b:** "Static SPA is the correct frontend for an authenticated dashboard. SSR is for content sites that need SEO; a hosting panel is the opposite. Removing SSR saves ~200 MB RAM and removes a process. **The SPA is served by Nginx (Nano) or Caddy (Standard+) as static files.**" Named options: **React + Vite, or Svelte** (repo layout: `apps/web/ # Static SPA (React + Vite, or Svelte)`).
- **ADR-006:** UI = static SPA + **shared design system**, rationale "accessibility and runtime compatibility."
- **ANOMALY for this build:** Stage 4 explicitly rules out Next.js SSR / a Node runtime on the panel host. If the prototype is built with Next.js (as the parent task states), it must be used **only as a static export** (`output: 'export'`, no server actions/SSR/ISR) or replaced with plain Vite — the architectural constraint is "static files behind Nginx/Caddy, no Node process."
- **Bundle discipline:** no explicit KB budget is stated; the constraint is operational (40 MB total panel footprint, ~200 MB RAM saved by dropping SSR) — i.e., keep the SPA lean, no server runtime, static assets only. Screens are "a logical route/view, not necessarily a separate frontend bundle or page file" (Stage 3 §8) — code-splitting granularity is free.
- **Capability-gated rendering:** profiles (Nano/Starter/Standard/Provider) are "narrative bundles"; the **capability flags are the mechanism**, read by the installer from a **signed data file** (capability spoofing is a listed threat — records come from the server, never client input). Every creating endpoint checks the capability record first: `POST /websites` on Nano is rejected with **`CAPABILITY_UNAVAILABLE` + resource delta**. The capability gate runs **before** the policy engine ("can this server run X at all?" precedes "can this actor do X to Y?"). UI consequence (Stage 3): render honest unavailable states with reason + delta + upgrade path; never merely hide or grey out; prohibited (permission, not capability) resources are not discoverable at all.
- **API contract the SPA must be written against (ARCH-005/006):** versioned namespace `/api/v1`; OpenAPI generated/checked; every mutation accepts an **idempotency key** and returns an **operation resource** (`202 Accepted` → `{operationId, resourceId, status:"queued"}`) and "must not imply that requested state is already active." Read endpoints expose `desiredState`, `observedState`, `health`, `lastVerifiedAt`, `generation`, `pendingOperationId`; cursor-based pagination; error responses carry stable code, correlation ID, safe message, retryability, optional remediation link. `GET /resources/{id}/usage` returns current / typical (7d p50) / peak (24h p99) / throttled seconds / OOM events — the data source for the allocation/usage strip.
- **Payments:** async-first state machine `initiated → pending → {confirmed | failed | expired | reversed}`; M-Pesa Daraja reference, Stripe second; UI must treat `pending` as long-lived (10 s–2 min for mobile money).
- **Security stance:** no shell commands from browser or AI directly to root; default deny checked at API entry and again at job execution; the agent must not rely on client-provided role strings; browser → panel is HTTPS 443 with authenticated sessions.
- **Release gate that shapes the shell:** `GET /` resolves the persona landing (router for new users, service portfolio for returning users); a non-technical user must go from install to a live one-page site in **under 10 minutes without touching a menu**.
