# NexusPanel GUI — Batch 04 (v0.5)

## Scope
Files, code editor, SFTP, and database discoverability. Builds directly on Batch 03 v0.4 without removing its existing screens, API fixtures, operations, personas, or domain workflows.

## Implemented
- Redesigned `/files` into a responsive three-region workspace: recursive folder tree, searchable current-folder file list, and selectable file/folder details pane.
- Preserved website-scoped root selection, capability-aware path display, breadcrumbs, usage meter, upload/new folder dialogs, rename, typed-confirmation delete, and mock operation-tray submission.
- Added accessible folder navigation with expand/collapse, active-path styling, and folder-tree synchronization.
- Added file details with MIME/type, size, mode, owner, version, text preview (when fixture content exists), and contextual actions for preview, editor, rename and delete.
- Added explicit cross-navigation between file explorer, database inventory, and SFTP access. Kept database instances and filesystem tools separate rather than combining their lifecycles.
- Improved database landing page context while retaining the Nano unavailable state and existing database detail screens.
- Added SFTP scope guidance; retained existing credentials, key-management and reset flows.

## Known prototype limitations
- All data, filesystem changes, SFTP credentials and operations remain simulated; no host filesystem or database is accessed.
- Folder search matches the current folder only, not recursively. The folder tree shows directories, not individual files.
- Upload modal simulates metadata/transfer, not browser File API upload. File editing remains in the existing dedicated editor route, rather than embedded Monaco.
- Mock API currently applies some fixture changes at submission time even though the operation tray models asynchronous verification; backend implementation must make mutations atomic and authoritative.
- Persona authorization is illustrative; production API policy must enforce every operation.

## Validation
- Screen registry: 186 entries (180 pages, 6 in-page states); all registered pages present. One pre-existing unregistered `/auth/recovery` page remains.
- Modified TSX files parsed/transpiled without TypeScript syntax diagnostics.
- Production build and browser end-to-end tests not run; project dependencies are not installed in this container.

## How to run
```
npm install
npm run dev
```
Sign in at `http://localhost:3000/auth/sign-in` and open **Files & Databases** or go directly to `/files`, `/databases`, or `/developer/sftp`.

## Next
Batch 05 — Email: mailbox creation, routing, forwarding, webmail, deliverability and queue troubleshooting as connected journeys.
