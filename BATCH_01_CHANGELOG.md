# NexusPanel — GUI Batch 01 (v0.2)

Built from the user-supplied `nexuspanel-gui-prototype.zip`, not a new project.

## Changes
- Redesigned responsive sign-in with brand story, validation, password visibility, simulated MFA and recovery paths.
- Redesigned guided onboarding with clear three-stage journey; existing capability-aware router preserved.
- Replaced dense first-level sidebar with task-based grouped navigation; original screen-registry sidebar preserved under **All tools & detailed screens**.
- Enhanced portfolio overview with welcome panel, live mock resource counts and quick task launchers; original portfolio sections retained.
- Existing topbar persona/profile/theme controls, command palette, operation tray, mock APIs, deep routes, and file tree remain in place.
- Added shared visual styles and responsive treatments without replacing existing design tokens.

## Run
`npm install` then `npm run dev` and visit http://localhost:3000/auth/sign-in.

## Demo sign-in
Email: `jane@wanjiku.digital`; any password except `wrongpassword`; any six-digit MFA code except `000000`. This is intentionally simulated, not real security.

## Limitations / next batch
- Sidebar grouping is a **presentation** filter only, not an authorization system. Backend policy must remain authoritative.
- Original 184-screen registry and all existing routes retained; deeper screens have not all been individually retested.
- Dashboard numbers and status are mock fixtures.
- Batch 02 will unify website/app/domain provisioning flows.
