# NexusPanel GUI — Batch 08 (v0.9)

## Scope
Commercial, hosting customers, reseller workflows, billing and licensing.

## Delivered
- Added `/commercial/center`, a responsive task-first Business Center, with `UX-COM-019` screen-registry entry.
- Five selectable workflows: offer hosting packages, manage customers, run reseller operations, review billing/payments, and manage licensing.
- Each journey has a four-step interactive checklist, reset action, progress indicator and contextual links to existing detailed screens.
- Persona-specific navigation and journeys: provider, reseller, support/billing/auditor, hosting customer and solo owner have different entry points; developers receive an explicit no-commercial-tasks state.
- Persona-aware business sidebar: customer and owner previews do not display customer-account administration shortcuts.
- Commercial metrics reuse existing mock fixtures. Capability messaging distinguishes unavailable profile from the UI preview.
- Sensitive reconciliation and M-Pesa configuration shortcuts are withheld for non-provider personas in the guided journey.
- Preserved all existing customer, account, package, reseller, invoice, payment, licensing, usage and gateway screens.
- Added honest disclaimers: no real payments, no real account provisioning, no real licensing; UI personas are not authorization.

## Validation
- Screen registry: 191 definitions (185 pages, 6 states), all registered pages present.
- Existing unregistered `/auth/recovery` page remains.
- TypeScript transpilation syntax checks passed for modified files.
- ZIP integrity checked.
- Full Next.js production build, strict typecheck and browser-interaction testing **not performed**. Existing prototype remains a simulated implementation draft.

## Next
Batch 09 — infrastructure, fleet, agents and provider operations.
