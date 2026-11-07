# NexusPanel GUI — Batch 06 (v0.7)

## Implemented
- Added `/services/setup`: a four-stage task-first guided setup experience (goal → template → capability/resource preflight → deployment handoff).
- Seven user goals: website, storage, image transformation, asset delivery, cache/search/queue, automation, and self-hosted apps.
- Searchable goal-filtered catalog backed by existing `db.templates` data, with selected-template state and contextual descriptions.
- Host-profile awareness using the existing session profile and capability records (`service.docker`, `service.storage`), with estimated free RAM versus template ceiling.
- Explicitly separates demo preflight from the existing deployment wizard's authoritative checks and asynchronous operation status.
- New call-to-action panel in Platform Services, plus catalog links to the guided setup.
- Registered `UX-SVC-009` without removing any existing screen definitions.
- Preserved all prior routes, the mock API adapters, persona switcher, operations tray, and existing template deploy workflow.

## Verification
- `node scripts/check-screens.mjs`: 189 registered screens, 183 page definitions, 6 state definitions. All registered pages present. One pre-existing unregistered `/auth/recovery` page.
- TypeScript transpilation syntax checks passed for three changed TSX files.
- Archive integrity checked after packaging.
- Full `next build`, typecheck with installed dependencies, and browser-interaction testing **not run**. Do not treat this as a production-tested build.

## Known limitations
- Service templates and resource usage are mock data; no host-side installation occurs.
- Resource fit is indicative, not a Nano compatibility certification.
- Catalog filtering depends on templates currently present; categories without published entries show an empty-state message.
- The guided flow delegates actual deployment to the existing wizard, and does not itself create an operation.
- Client-side persona gating is for presentation only, never security authorization.
