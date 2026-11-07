# NexusPanel GUI — Batch 03 (v0.4)

## Scope
Domains, DNS guidance, HTTPS, and connected website/application domain setup.

## Implemented
- New interactive `/domains/setup` four-step journey: domain selection, destination preview, copyable registrar DNS instructions, and separate DNS/HTTPS verification actions.
- Step navigation and guarded progression, fixture-backed domain and resource selectors, record-copy actions, acknowledgement that does **not** constitute verification, operation-tray integration for simulated DNS checks, and status separation between ownership, propagation and certificate issuance.
- Integrated guided entry from the Domains inventory, original `/domains/connect` wizard, and primary navigation.
- Kept all existing domain inventory, ownership verification, DNS guidance, DNS zones, DNSSEC, certificate management, app-domain settings and other detailed screens.
- Added `UX-DNS-016` to screen registry; package version 0.4.0.

## Deliberate prototype boundaries
- The selected destination is a **preview only**; this flow does not mutate site/app bindings. Dedicated resource tools remain available.
- Domain data, DNS resolver checks and certificate states are simulated fixtures. No live DNS query, registrar API call, ACME issuance or backend provisioning occurs.
- This batch does not add domain registration or authoritative DNS hosting.

## Validation
- `npm run check:screens`: 186 registry entries (180 pages + 6 states); all registered page files present. One pre-existing unregistered `/auth/recovery` page remains.
- `npm run build`: could not run because `next` is not installed in this container; npm dependencies are not bundled. Browser interaction and TypeScript compilation remain to be tested after `npm install`.

## Try it
```bash
npm install
npm run dev
```
Open `http://localhost:3000/auth/sign-in`, sign in using demo credentials described in README, then select **Domains & DNS** in the sidebar or visit `/domains/setup`.

## Next
Batch 04: file explorer, editor, SFTP and databases. Preserve tree navigation and add contextual file operations and role-aware filesystem boundaries.
