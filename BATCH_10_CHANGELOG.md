# NexusPanel GUI — Batch 10 (v1.0.0-rc.2)

## Implemented
- Added `/workspace/finish`, a searchable, task-first integration guide connecting AI, audit, support and settings.
- Four interactive journeys with 16 contextual review steps, per-journey progress and reset. Review state is local to the component, not evidence of a completed server action.
- Added `Workspace guide` to the primary sidebar and updated its batch indicator.
- Registered `UX-SUP-012` for the new route.
- Registered the pre-existing password recovery route as `UX-IAM-019`, closing the screen registry coverage gap.
- Fixed a serious misleading audit claim: the prior Verify Chain button always reported success without calculating any hashes. Removed the false verification control and replaced it with a clear warning that the demo's abbreviated hashes cannot be cryptographically verified. CSV export remains available.
- All previous management screens and mock data retained.

## Validation evidence
- `npm run check:screens`: **194 registered definitions** (188 pages, 6 states); all registered pages present; no unregistered page files.
- TypeScript transpilation syntax checks passed on all four changed `.ts`/`.tsx` files.
- All 14 destination routes in the new guide were verified against physical page files.
- ZIP integrity verified after packaging.
- `npm run build` attempted but failed with `next: not found` (project dependencies are not installed). **Do not claim a successful production build, strict typecheck or browser QA.**
- Responsive classes exist in the new guide, but mobile/desktop visual QA is outstanding.

## Remaining before production use
1. Install dependencies, run `npm run build`, `npx tsc --noEmit` and lint, and resolve any errors.
2. Test all persona and capability paths in real browsers (desktop/tablet/mobile) and keyboard-only navigation.
3. Replace simulated APIs with authenticated, authorized Go control-plane APIs and a privileged agent.
4. Implement real audit cryptographic verification using complete hashes and trusted evidence.
5. Security-review recovery, MFA, session, support-grant and AI approval flows.
6. Implement actual provisioning, DNS, email, backups, payments and server management; run integration tests on disposable infrastructure first.
7. Review screen-registry IDs against canonical spec: Batch-specific extensions are currently tracked in the same registry.

No real VPS, mail, payment or hosting resources were changed.
