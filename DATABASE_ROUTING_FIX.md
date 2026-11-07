# Database routing fix — v1.0.0-rc.3

## Root cause
`output: "export"` only pre-renders IDs returned by `generateStaticParams()`. The create-database mock generates IDs at runtime, which can never be present in the static export. Navigating to `/databases/<new-id>` therefore fails with a missing static param.

## Fix
- Added `/databases/manage?db=<id>&tab=<section>` as a **static page** with a client-side query selector wrapped in Suspense.
- Updated database creation, inventory, infrastructure inventory, section tabs and contextual actions to use this static route.
- Preserved all existing `/databases/[db]` pages for prebuilt fixture URLs and backward compatibility.
- Added the new route to the screen registry.

## Limitations
- The mock data is in-memory: created instances are not durable across full browser reloads, server restarts or independent client/server module contexts. The static route fixes the Next.js export error, not data persistence.
- Future production backend should use authenticated Go API resources and an SPA router or server rewrite to support arbitrary IDs.
- Check `npm run check:screens`, `npm run build`, and test creating a database and opening all six tabs. No production server changes made.
