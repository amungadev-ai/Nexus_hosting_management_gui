# NexusPanel GUI — Batch 02 (v0.3)

## Scope and implementation

This batch continues the **original uploaded Next.js/React prototype** through Batch 01, retaining its screen registry, existing page routes, mocked `/api/v1` adapter contracts, operations tray, domain wizard, deployment views, persona preview, and file manager.

### Added

1. **Connected publishing launcher** at `/launch/web`: a visually distinct entry point for static sites, PHP websites, and Node.js applications. It shows capability status and honest reasons when a workload cannot run, explains the connected publishing journey, and links to the existing specialized flows.
2. **Five-stage Node.js wizard** at `/apps/new`: Project → Source → Runtime → Domain → Review, with responsive summary sidebar, field validation, Git/upload intent, runtime and command settings, advanced environment-key parsing, preview vs existing-domain choice, preflight summary, explicit user confirmation, and queued-operation acknowledgement.
3. **Cross-module navigation**: dashboard primary action and website quick action now enter the connected launcher; website creation includes a link to the specialized Node.js app flow. The application wizard links back to the launcher and to DNS management.
4. **Registry traceability**: `UX-PROT-001` is a Batch 02 extension and is explicitly marked as needing reconciliation with canonical Stage 3. Existing `UX-WEB-008` remains the application wizard ID.

### Preserved

- Original website creation wizard, domain/DNS connection screens, app deployment history and detail views, logs, process management, settings, persona controls, simulated operations and the remaining pages.
- Mock API `provisionApp` contract and asynchronous operation tray. A queued operation is **not** displayed as a verified live service.

### Explicit limitations and follow-up

- The mock `provisionApp` API does **not** yet accept domain binding or environment values; the wizard displays domain intent but does not claim to configure DNS, certificates or secrets. The existing domain-management flow is linked instead.
- Upload mode records the intent to upload after creating the app; no real file is uploaded in this wizard.
- No real Git access, domain verification, DNS mutation, HTTPS issuance, server provisioning, or persistent app creation occurs in the prototype.
- `npm run check:screens` confirms all registered pages exist. The original unregistered `auth/recovery` page remains a known pre-existing coverage warning.
- Full TypeScript/Next.js build and browser tests are **not verified** in this environment because project dependencies are not installed. Run `npm install`, `npm run build`, and browser acceptance tests before treating this as release-ready.

### Suggested Batch 03

Domains, DNS, HTTPS and actual connected resource-domain interactions, followed by the file explorer and database workflows.
