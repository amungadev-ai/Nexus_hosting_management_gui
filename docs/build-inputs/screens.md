# NexusPanel — Stage 3 UI/UX Specification v2.0 — Screen inventory (build input)

Source: `upload/NexusPanel_Stage 3_Complete_UI_UX_Specification_v2.0.md` (1165 lines, read in full).
Machine-readable counterpart: `scripts/spec/screens.json` (same content).

## Extraction conventions

- **Screen count: 184** UX-* screen definitions across **15 module groups** (spec section 8.1-8.15), **15 FLOW-* journeys** (section 9).
- Routes are the **exact strings from the doc**; routes suffixed `(state)` are honest-state screens sharing the base route with another screen (implement as a route state, not a separate route). All routes are *proposed patterns* pending API/URL architecture approval (spec section 7).
- **Phase** = product release scope as stated by the doc. Screens marked **NEW in v2** are new in this spec revision; where the doc ties them to the v1 product experience (router, service portfolio, capability display, DNS guidance, external SMTP, honest states, batch/allocation views, Platform Services, Self-hosted Templates, VPS upgrade) they are phase **v1**. Features the doc explicitly **defers to v2+** (commercial UI except licensing, authoritative DNS zone editor/DNSSEC/infrastructure, self-hosted email, databases, plugin marketplace, white-label) are phase **v2**. No screen is marked v3.
- **Audiences** are the doc's labels, lowercased: `all`, `authorized`, plus qualified forms (`authorized admins`, `authorized members`, `authorized auditors`, `authorized opt-in`, `explicit privileged scope`, `billing authorized`, `admin only`, `approvers`) and roles (`owner`, `customer`, `developer`, `reseller`, `provider`, `support`). Audience labels are descriptive only — server policy resolves the actual actor/resource/action/scope at runtime.
- The doc's stated screen counts (v1: 138; v2: 'approximately 165') are inconsistent with its own tables: the catalog enumerates **184** definitions (48 of them new/changed in spec v2). The tables are authoritative.

## Totals

| Module | Spec | Screens | v1 | v2 |
|---|---|---|---|---|
| Identity, onboarding and settings | 8.1 | 12 | 12 | 0 |
| Overview and navigation | 8.2 | 10 | 10 | 0 |
| Servers, fleet and service roles | 8.3 | 13 | 13 | 0 |
| Hosting accounts, reseller and commercial operations | 8.4 | 18 | 1 | 17 |
| Websites, domains and application deployments | 8.5 | 20 | 20 | 0 |
| Files, editor and developer access | 8.6 | 11 | 11 | 0 |
| Databases and administration | 8.7 | 10 | 1 | 9 |
| Domains, DNS and SSL | 8.8 | 15 | 11 | 4 |
| Email hosting and deliverability | 8.9 | 12 | 2 | 10 |
| Backups, monitoring, incidents and security | 8.10 | 21 | 21 | 0 |
| Automation, integrations and developer APIs | 8.11 | 9 | 6 | 3 |
| AI assistant and diagnostics | 8.12 | 7 | 7 | 0 |
| Support, migration and lifecycle | 8.13 | 11 | 11 | 0 |
| Platform Services (new module in v2) | 8.14 | 10 | 10 | 0 |
| Self-hosted Templates (new module in v2) | 8.15 | 5 | 5 | 0 |
| **Total** | 8 | **184** | **141** | **43** |

## Screen catalog by module

### 8.1 — Identity, onboarding and settings

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-IAM-001 | `/setup/welcome` | Welcome / installation claim | owner | v1 | Start setup; View docs | One-time enrollment entry: shows system prerequisites and the installation claim expiry. | — |
| UX-IAM-002 | `/setup/owner` | Owner account and MFA | owner | v1 | Verify; Continue | Create the owner identity with password/passkey and MFA. | Bootstrap prerequisite for the router (FLOW-013 entry condition). |
| UX-IAM-003 | `/onboarding` | First-run router | owner, customer, reseller | v1 | Pick a card; I'm not sure yet | NEW in v2: 'What do you want to run?' six-card router; routes each card to its flow and falls back to capability display + guided tour. | NEW in v2 (spec): reframed from v1 'First-run checklist'; the checklist becomes a follow-up after routing, not the first screen. Six cards (DS-024): A website / An application / A self-hosted app / Data & storage / Infrastructure / I'm not sure yet. Spec cross-reference anomaly: screen says 'See 9 FLOW-001 for detail' but the router is specified in FLOW-013 (FLOW-001 is superseded). Release-gate feature (UXD-021/022, UXT-019/020). |
| UX-IAM-004 | `/auth/sign-in` | Sign-in and recovery | all | v1 | Sign in; Recover | Secure authentication with MFA and account recovery that does not expose whether accounts exist. | — |
| UX-IAM-005 | `/settings/organizations` | Organizations | owner, provider | v1 | Create; Switch | List owned organizations and memberships. | — |
| UX-IAM-006 | `/settings/organizations/:org` | Organization detail | authorized members | v1 | Edit; Invite | Manage organization name, roles, limits and policy. | — |
| UX-IAM-007 | `/settings/members` | Users and invitations | owner, provider, reseller | v1 | Invite; Revoke | Member list with invitations, expiry and revocation. | — |
| UX-IAM-008 | `/settings/access` | Roles and access policies | authorized admins | v1 | Create role; Test permission | Permissions, inherited scopes and effective-access preview. | — |
| UX-IAM-009 | `/settings/sessions` | Sessions and devices | all | v1 | Revoke session | Session inventory with last-active and revoke. | — |
| UX-IAM-010 | `/settings/api-tokens` | API tokens | authorized | v1 | Create; Rotate; Revoke | Token scopes, expiry and last used; one-time secret reveal. | Field spec in 10: least privilege, explicit lifetime, copy once, never displayed again. |
| UX-IAM-011 | `/settings/support-access` | Support access grants | owner, provider, support | v1 | Request; Approve; Revoke | Time-limited support access with scope and justification. | Displays the DS-019 access grant banner (scope, actor, reason, expiry, revoke link). |
| UX-IAM-012 | `/settings/profile` | Personal preferences | all | v1 | Save preferences | Theme, language, timezone, density and notification preferences. | — |

### 8.2 — Overview and navigation

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-OV-001 | `/overview` | Service portfolio | all | v1 | Open; Create; Upgrade | NEW in v2: the primary surface for personas whose job is 'manage what I already have'. Lists everything the user runs (websites, apps, self-hosted services, storage buckets, databases), each with health, usage and quick actions. | NEW in v2 (spec): replaces the v1 'Role-aware overview'. Default landing for returning users; where the user lands after a router path completes (FLOW-013) with the follow-up checklist (first site live / connect domain / enable backups / invite collaborator). Role-specific dashboards (12) are reframed as portfolio views. UXD-026 is a release gate. |
| UX-OV-002 | `/overview/capabilities` | Capability overview | all | v1 | Upgrade; Learn more | NEW in v2: honest display of what this VPS can and cannot run, with resource deltas and upgrade link (DS-021). | NEW in v2 (spec): replaces the v1 'Overview' dashboard for Nano/Starter installations; also reached from 'What can my VPS run?'. Not the default landing for any persona. UXD-031 (Nano honest experience) is a release gate. |
| UX-OV-003 | `/search` | Resource search | all | v1 | Open result | Permission-scoped search across resources, including platform services and templates; results carry type, name, context and status with no cross-tenant hints. | v2 additions: search includes storage buckets, self-hosted services and templates ('deploy Nextcloud'). |
| UX-OV-004 | `/activity` | Activity and jobs | all | v1 | Inspect; Retry | Operations, approvals, outcomes and progress (including batch jobs) with actor, scope, submitted/observed state and correlation ID. | — |
| UX-OV-005 | `/activity/jobs/:job` | Job detail | authorized | v1 | Retry; Cancel when supported | Job timeline, logs, impact and retry safety (DS-011). | — |
| UX-OV-006 | `/approvals` | Approvals inbox | approvers | v1 | Approve; Reject | Pending approvals with proposed impact, approver and expiry. | — |
| UX-OV-007 | `/notifications` | Notifications | all | v1 | Open; Mark read | Alerts with severity, read status and per-channel preferences (DS-018). | v2 addition: batch completion and batch queued notifications ('Your backup is queued, will run when the server is idle'). |
| UX-OV-008 | `/help` | Help center | all | v1 | Search; Contact support | Contextual docs, glossary, troubleshooting and support entry; hosts the 'What can my VPS run?' article. | v2 addition: the 'What can my VPS run?' article reads the capability set and explains it in plain language — the primary lay-person help entry point. |
| UX-OV-009 | `/overview/usage` | Allocation and usage | all | v1 | Drill down; Adjust ceilings; Upgrade | NEW in v2: server-level view of allocation / typical (7-day p50) / peak (24h p99) / current across all workloads. | NEW in v2 (spec). Server-level aggregate; the per-workload counterpart is UX-OPS-018 at /monitoring/usage (same title, different scope). Answers 'am I close to my limits?' (UXT-023). |
| UX-OV-010 | `/overview/recommendations` | Upgrade recommendations | all | v1 | View evidence; Upgrade | NEW in v2: auto-generated upgrade suggestions with evidence — peak RAM above 80% for 7 days, OOM kills, CPU contention (DS-028). | NEW in v2 (spec). |

### 8.3 — Servers, fleet and service roles

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-INF-001 | `/infrastructure/servers` | Server inventory | owner, provider | v1 | Enroll; Filter | Server health, version, capacity, roles and region. | — |
| UX-INF-002 | `/infrastructure/servers/:server` | Server detail | authorized admins | v1 | Manage; Diagnose | CPU/RAM/disk/IPs, heartbeat, modules and incidents. | — |
| UX-INF-003 | `/infrastructure/servers/new` | Enroll server wizard | owner, provider | v1 | Generate token; Approve | Enrollment token, prerequisites and trust verification. | — |
| UX-INF-004 | `/infrastructure/roles` | Service roles | provider | v1 | Assign; Review | Service role assignment, conflicts and capacity. | — |
| UX-INF-005 | `/infrastructure/topology` | Fleet topology | provider | v1 | Inspect; Plan | Nodes, zones, roles and failure domains. | — |
| UX-INF-006 | `/infrastructure/placement` | Placement planner | provider | v1 | Preview; Approve | Eligible servers and capacity reservation. | — |
| UX-INF-007 | `/infrastructure/maintenance` | Maintenance and drain | provider | v1 | Schedule; Cancel | Maintenance windows, workload impact and drain progress. | — |
| UX-INF-008 | `/infrastructure/agents` | Agent health and upgrades | provider | v1 | Plan upgrade; Recover | Agent versions, trust, drift and upgrade jobs. | — |
| UX-INF-009 | `/infrastructure/modules` | Installed modules | owner, provider | v1 | Install; Disable | Adapters, dependencies, ownership and install status. | — |
| UX-INF-010 | `/infrastructure/servers/:server/diagnostics` | Server diagnostics | authorized admins | v1 | Run safe checks | Read-only health evidence and runbook. | — |
| UX-INF-011 | `/infrastructure/capabilities` | Capability detection | owner, provider | v1 | Rescan; View evidence; Export | NEW in v2: detailed view of the installer's 5-step detection — detected hardware, floor/typical/ceiling per capability, overcommit warnings, and blockers (port 25, PTR, no public IP). | NEW in v2 (spec). Foundation of the honest capability display (FLOW-014 entry: installer produced a capability set). |
| UX-INF-012 | `/infrastructure/rescan` | Hardware rescan | owner, provider | v1 | Rescan; Apply new capability set | NEW in v2: post-upgrade re-detection showing new capabilities that became available after a hardware change. | NEW in v2 (spec). Part of the VPS upgrade ladder together with UX-SUP-009 ('rescan hardware' is a first-class flow, UXD-032). |
| UX-INF-013 | `/infrastructure/servers/:server/cgroups` | cgroup metrics | authorized admins | v1 | Drill down; Adjust ceilings | NEW in v2: per-workload cgroup metrics (cpu.stat, memory.current, memory.peak, memory.events, io.stat, pids.current) as current / typical / peak. | NEW in v2 (spec). Data source behind the allocation/usage strip (DS-022) and UXT-030. |

### 8.4 — Hosting accounts, reseller and commercial operations

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-COM-001 | `/commercial/accounts` | Hosting accounts | provider, reseller | v2 | Create; Suspend | Owned hosting accounts with state, package and limits. | Commercial UI is deferred to v2+ for customer-facing UI (data model and API are v1). A v1 single-owner installation shows no commercial surface. UX-COM-012 is the sole v1 exception. |
| UX-COM-002 | `/commercial/accounts/:account` | Account detail | authorized | v2 | Manage; Transfer | Sites, users, quotas, subscriptions and health for a hosting account. | Commercial surface deferred to v2+ (8.4 note). |
| UX-COM-003 | `/commercial/accounts/new` | Account creation wizard | provider, reseller | v2 | Review; Provision | Customer, package, region, limits and approval; provisions the account. | Commercial surface deferred to v2+; used by FLOW-003. |
| UX-COM-004 | `/commercial/packages` | Packages | provider, reseller | v2 | Create; Clone | Resource quotas, features and pricing rules. | Commercial surface deferred to v2+. Field spec in 10: prevent overselling unless approved policy. |
| UX-COM-005 | `/commercial/packages/:package` | Package editor | authorized | v2 | Save; Publish | Limits, overrides, versions and entitlements. | Commercial surface deferred to v2+. |
| UX-COM-006 | `/commercial/usage` | Quota and usage | authorized | v2 | Inspect; Export | Metered/reserved/actual usage with source freshness. | Commercial surface deferred to v2+. |
| UX-COM-007 | `/commercial/customers` | Customers | provider, reseller | v2 | Invite; Assign | Customer organizations, contacts and services. | Commercial surface deferred to v2+. |
| UX-COM-008 | `/commercial/resellers` | Resellers | provider | v2 | Create; Suspend | Reseller subtree, grants, limits and branding. | Commercial surface deferred to v2+. |
| UX-COM-009 | `/commercial/branding` | Reseller portal branding | reseller, provider | v2 | Preview; Publish | Logo, domain, colors and email-template preview. | Commercial surface deferred to v2+; white-label branding also deferred per 8.11. |
| UX-COM-010 | `/commercial/subscriptions` | Subscriptions | billing authorized | v2 | Adjust; Cancel | Plans, renewals, state and grace periods. | Commercial surface deferred to v2+. |
| UX-COM-011 | `/commercial/invoices` | Invoices and payments | billing authorized | v2 | View; Export | Invoices, payments, refunds and reconciliation. | Commercial surface deferred to v2+. |
| UX-COM-012 | `/commercial/licenses` | Licensing | provider | v1 | Activate; Renew | License state, seats/nodes and activation. | Sole commercial screen active in v1: 'A v1 installation with a single owner sees no commercial surface; the owner uses the license activation flow (UX-COM-012) to activate the panel.' Audience label in the doc is 'Provider' although the v1 actor is the owner — ambiguity flagged. |
| UX-COM-013 | `/commercial/integrations` | Commerce integrations | provider | v2 | Connect; Test | Gateway adapters, credentials and test mode. | Commercial surface deferred to v2+. |
| UX-COM-014 | `/commercial/payment-methods` | Payment methods | billing authorized | v2 | Add; Remove; Set default | NEW in v2: managed payment methods (M-Pesa phone, Stripe card) as tokenized references — never raw card data. | NEW in v2 (spec); within the commercial surface deferred to v2+. |
| UX-COM-015 | `/commercial/payments/:id/pending` | Payment pending | billing authorized | v2 | Wait; Retry; Cancel | NEW in v2: the async payment waiting state — 'Awaiting M-Pesa confirmation — check your phone' or 'Processing card payment' with appropriate timing (DS-026). | NEW in v2 (spec); implements the global 'Pending payment' state (5) and M-Pesa copy (14). UXD-029 requires approval. |
| UX-COM-016 | `/commercial/payments` | Payment history | billing authorized | v2 | Filter; Export; Reconcile unmatched | NEW in v2: list of payments with state (pending/confirmed/failed/reversed), provider reference and reconciliation status. | NEW in v2 (spec). |
| UX-COM-017 | `/commercial/payments/reconcile` | Payment reconciliation | admin only | v2 | Match; Refund; Dispute | NEW in v2: manual reconciliation for unmatched payment callbacks (webhook received but no matching invoice, or invoice marked paid but no callback). | NEW in v2 (spec); implements the 'Payment callback unmatched' global state (5). |
| UX-COM-018 | `/commercial/integrations/mpesa` | M-Pesa settings | admin only | v2 | Test; Save; Enable | NEW in v2: Daraja credentials (sandbox + production), panel-generated callback URL, and a required test transaction before enabling. | NEW in v2 (spec); field specs in 10 (callback URL read-only and copyable; test transaction required before enabling). UXD-030. |

### 8.5 — Websites, domains and application deployments

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-WEB-001 | `/websites` | Websites list | owner, customer, developer | v1 | Create; Filter | Websites with domain, runtime, SSL, health and account. | — |
| UX-WEB-002 | `/websites/new` | Create website wizard | authorized | v1 | Validate; Provision | Domain, root, runtime, placement, TLS and preview before provisioning. | Wizard adapts to the capability set: on Nano only static is offered; on Starter, static plus one of {PHP, Node, small DB}; the capability strip (UX-WEB-019) explains why. Preview-hostname option per UXD-007. Website path of FLOW-001/FLOW-013. |
| UX-WEB-003 | `/websites/:site` | Website overview | authorized | v1 | Open; Manage | Observed health, URLs, resource usage and recent jobs, with the live status line (DS-025). | — |
| UX-WEB-004 | `/websites/:site/settings` | Website configuration | authorized | v1 | Preview; Apply | Document root, redirects, PHP/HTTP settings and staging. | — |
| UX-WEB-005 | `/websites/:site/staging` | Staging environments | authorized | v1 | Create; Promote | Staging copies, sync and promotion impact. | — |
| UX-WEB-006 | `/websites/:site/redirects` | Redirects and aliases | authorized | v1 | Create; Test | Redirect rules with loop and conflict detection and test results. | — |
| UX-WEB-007 | `/apps` | Applications list | owner, customer, developer | v1 | New app | Applications with runtime, process, deployments and health. | — |
| UX-WEB-008 | `/apps/new` | New app wizard | authorized | v1 | Preflight; Deploy | Git/upload/existing source, runtime, build/start commands, environment variables and URL with preflight validation. | Detailed in FLOW-002 and 10 field specs. On Nano this flow is not offered (router card shows honest unavailable state); on Starter it is borderline — the installer confirms fit first. |
| UX-WEB-009 | `/apps/:app` | Application overview | authorized | v1 | Deploy; Restart | URL, build, runtime, process and recent deploys; allocation/usage strip (DS-022) below the page header. | — |
| UX-WEB-010 | `/apps/:app/deployments` | Deployment history | authorized | v1 | Compare; Rollback | Commit, actor, logs, health and rollback eligibility. | — |
| UX-WEB-011 | `/apps/:app/deployments/:deploy` | Deployment detail | authorized | v1 | Inspect; Retry | Build/run timeline, errors, artifact and verification. | — |
| UX-WEB-012 | `/apps/:app/environment` | Environment variables | authorized | v1 | Import; Edit; Rotate | Scoped secrets with paste/import .env, duplicate validation and masked display (DS-008). | Field specs in 10: parse KEY=VALUE with quotes/comments/newlines, duplicate detection, preview parsed names with masked values, no accidental analytics. |
| UX-WEB-013 | `/apps/:app/runtime` | Runtime configuration | authorized | v1 | Validate; Save | Supported runtime versions (from actual installed/supported versions, no invented options), startup command, ports and limits. | — |
| UX-WEB-014 | `/apps/:app/processes` | Processes and workers | authorized | v1 | Scale; Restart | Process states, restart policy and queue workers. | — |
| UX-WEB-015 | `/apps/:app/git` | Git connections | authorized | v1 | Connect; Disconnect | Repo, branch, webhook and deploy-key permissions. | — |
| UX-WEB-016 | `/apps/:app/logs` | Application logs | authorized | v1 | Search; Export | Structured logs with streaming, filters and redaction (DS-014). | Secret values must be redacted from job logs (FLOW-002). |
| UX-WEB-017 | `/apps/:app/domains` | Domains attached to resource | authorized | v1 | Attach; Detach | Hostnames, routing and TLS status for domains attached to the app. | — |
| UX-WEB-018 | `/domains/connect` | Domain connection wizard | authorized | v1 | Copy record; Check propagation; Continue | NEW in v2: the killer feature for the lay person — shows the exact A/AAAA/CNAME record to add at the registrar, polls for propagation, confirms when live, then offers SSL. | NEW in v2 (spec), promoted from settings. v1 DNS guidance companion to UX-DNS-014. |
| UX-WEB-019 | `/websites/:site/capabilities` | Website capability strip | authorized | v1 | Upgrade; Adjust | NEW in v2: shows what the site can and cannot do (PHP? Node? DB? Transform?) based on the installer capability set and container fit. | NEW in v2 (spec). Explains why the creation wizard offers fewer options on Nano/Starter. |
| UX-WEB-020 | `/websites/:site/batch` | Batch jobs for site | authorized | v1 | View queue; Cancel if supported | NEW in v2: the site's batch jobs (builds, backups, transforms) with queue state — shown as queued, not failed. | NEW in v2 (spec). |

### 8.6 — Files, editor and developer access

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-FILE-001 | `/files` | File manager | authorized | v1 | Upload; New; Rename | Scoped tree, breadcrumbs, permissions and usage (DS-013). | Container-aware on Standard+ — the tree is scoped to the site's container volume and shows container paths (e.g. /app/wp-content/uploads); on Nano it operates on the site document root directly (FLOW-007, 11). |
| UX-FILE-002 | `/files/view` | File detail and preview | authorized | v1 | Download; Inspect | Metadata, MIME preview and safe download. | — |
| UX-FILE-003 | `/files/edit` | Code editor | authorized | v1 | Save; Revert | Tabs, syntax highlighting, save, lint if supported, and conflict diff. | Detailed design in 11: language detection, find/replace, save state, conflict diff; reduced capability on mobile. |
| UX-FILE-004 | `/files/operations` | Bulk file operations | authorized | v1 | Review; Submit | Multi-select archive/move/delete with impact review. | — |
| UX-FILE-005 | `/files/uploads` | Upload manager | authorized | v1 | Upload; Retry | Drag-drop, resumable status, conflicts and size limits. | — |
| UX-FILE-006 | `/files/permissions` | File permissions | authorized | v1 | Review; Apply | Ownership, ACL/mode preview and security implications. | — |
| UX-FILE-007 | `/developer/access` | SFTP/SSH access | authorized | v1 | Add key; Revoke | Keys, access scopes, expiry and revocation. | — |
| UX-FILE-008 | `/developer/terminal` | Web terminal | explicit privileged scope | v1 | Open; Close | Session warning, scope, audit and inactivity timeout. | Disabled by default for customer roles (NP-FILE-013, UXD-011). On Standard+ a scoped container shell is available when explicitly enabled; on Nano the terminal is not available at all (UX-FILE-010 state). |
| UX-FILE-009 | `/developer/schedules` | Cron and scheduled tasks | authorized | v1 | Create; Pause | Expression, timezone, last/next run and logs. | — |
| UX-FILE-010 | `/developer/terminal (state)` | Terminal unavailable | authorized | v1 | View SFTP; Upgrade | NEW in v2: honest Nano state — 'Terminal is not available on this VPS because sites are not containerized. SFTP works for file transfer.' | NEW in v2 (spec). State screen sharing the /developer/terminal route with UX-FILE-008 — implement as a route state, not a separate route. |
| UX-FILE-011 | `/developer/sftp` | SFTP setup | authorized | v1 | Copy SFTP details; Add key | NEW in v2: panel-managed SFTP endpoint, per-site credentials and key upload — the primary file-transfer path on Nano. | NEW in v2 (spec). On Standard+ both SFTP and container shell are available. |

### 8.7 — Databases and administration

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-DB-001 | `/databases` | Databases list | authorized | v2 | Create | Databases with engine, version, host, size and backups. | Databases ship in v2 on Standard+ (8.7: unavailable on Nano, borderline on Starter); v1 shows the honest unavailable state UX-DB-009 instead. |
| UX-DB-002 | `/databases/new` | Create database wizard | authorized | v2 | Review; Create | Engine, name, owner, server and quotas. | Detailed in FLOW-006 (deferred to v2+). |
| UX-DB-003 | `/databases/:db` | Database overview | authorized | v2 | Manage; Backup | Connection, users, size, health and recent operations. | Ships in v2 on Standard+. |
| UX-DB-004 | `/databases/:db/users` | Database users and grants | authorized | v2 | Create; Rotate | Least-privilege grants, rotation and host restrictions. | Field spec in 10: explain host vs DB user and storage quota. |
| UX-DB-005 | `/databases/:db/admin` | Database administration | authorized | v2 | Launch tool | Safe admin-tool launch with restricted scopes. | Ships in v2 on Standard+. |
| UX-DB-006 | `/databases/:db/transfers` | Import/export jobs | authorized | v2 | Import; Export | File/source, size, checks, status and impact. | Ships in v2 on Standard+; batch/import jobs are batch workloads. |
| UX-DB-007 | `/databases/:db/backups` | Database backups and restores | authorized | v2 | Restore preview | Snapshots, consistency and restore target. | Ships in v2 on Standard+. |
| UX-DB-008 | `/infrastructure/databases` | Database service settings | provider | v2 | Plan change | Engine modules, capacity, maintenance and upgrades. | Ships in v2 on Standard+. |
| UX-DB-009 | `/databases (state)` | Databases unavailable | authorized | v1 | Upgrade; Learn more | NEW in v2: honest Nano state — 'Databases are not available on this VPS because the panel's metadata DB already consumes the available SQLite budget. Upgrade to Standard to enable MariaDB/Postgres.' | NEW in v2 (spec). State screen sharing the /databases route with UX-DB-001. |
| UX-DB-010 | `/databases/:db/service` | Database as ServiceTemplate | authorized | v2 | Manage as service; Export | NEW in v2: shows the database as a service instance (container, volume, credentials, health check, backup policy), unifying the UI with the ServiceTemplate primitive. | NEW in v2 (spec); databases ship in v2 as ServiceTemplate instances. |

### 8.8 — Domains, DNS and SSL

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-DNS-001 | `/domains` | Domains inventory | authorized | v1 | Add domain | Ownership, registrar, delegation, SSL and expiration. | — |
| UX-DNS-002 | `/domains/new` | Domain onboarding wizard | authorized | v1 | Preflight; Activate | Domain, ownership, DNS mode, zone and nameservers. | FLOW-004 nine-screen sequence; for v1 the flow is reframed as DNS guidance mode (UX-DNS-014 + UX-WEB-018). |
| UX-DNS-003 | `/domains/:domain` | Domain detail | authorized | v1 | Manage | DNS status, verification and attached sites/apps. | — |
| UX-DNS-004 | `/domains/:domain/verify` | Ownership verification | authorized | v1 | Verify; Retry | TXT challenge, TTL, polling and errors. | — |
| UX-DNS-005 | `/domains/:domain/delegation` | Delegation checklist | authorized | v1 | Recheck | Registrar NS/glue, observed NS and propagation. | Never promise global propagation completion (FLOW-004 guardrail). |
| UX-DNS-006 | `/dns/zones/:zone` | DNS zone editor | authorized | v2 | Add; Edit; Delete | Record table, TTL, conflicts, syntax and diff (DS-012). | Zone editor is v2+: authoritative DNS hosting is deferred to v2+; the v1 primary DNS experience is guidance mode (UX-DNS-014). Field spec in 10. |
| UX-DNS-007 | `/dns/zones/:zone/review` | DNS zone change review | authorized | v2 | Approve; Apply | Before/after, affected records and propagation. | v2+ (authoritative DNS deferred). |
| UX-DNS-008 | `/dns/zones/:zone/dnssec` | DNSSEC | authorized | v2 | Enable; Rotate | Keys, DS records, registrar instructions and rollover. | DNSSEC is v2+ (authoritative DNS deferred). Field spec in 10: warn of resolution outage from mismatched DS. |
| UX-DNS-009 | `/infrastructure/dns` | DNS infrastructure | provider | v2 | Manage roles | Primary/secondary DNS, health, replication and zones. | Secondary/authoritative DNS infrastructure is v2+ (8.8 note). |
| UX-DNS-010 | `/certificates` | SSL certificates | authorized | v1 | Request; Inspect | Issued/pending/expiring certificates, SANs and renewal. | SSL issuance is v1 (FLOW-001 step 11; FLOW-014 'live in 60 seconds with SSL'). |
| UX-DNS-011 | `/certificates/new` | Certificate issuance wizard | authorized | v1 | Issue | Domains, ACME challenge, prerequisites and validation. | — |
| UX-DNS-012 | `/certificates/:cert` | Certificate detail | authorized | v1 | Renew; Revoke | Chain, issuer, expiry, renewals and assignments. | — |
| UX-DNS-013 | `/websites/:site/https` | HTTPS policy | authorized | v1 | Preview; Apply | Redirect, HSTS, TLS modes and warnings. | — |
| UX-DNS-014 | `/domains/:domain/dns-guidance` | DNS guidance | authorized | v1 | Copy records; Poll propagation; Fix errors | NEW in v2: the v1 DNS mode — shows exact records to add at the registrar, polls propagation and diagnoses errors. The primary DNS experience for v1. | NEW in v2 (spec). FLOW-004 is reframed into this guidance mode for v1 ('enter domain' -> 'add this A record at your registrar' -> 'we'll poll until it propagates' -> 'SSL issued, site live'); the nine-screen authoritative sequence returns in v2. |
| UX-DNS-015 | `/dns/zones (state)` | Authoritative DNS unavailable | authorized | v1 | Use guidance; Learn more | NEW in v2: honest v1 state — 'Authoritative DNS hosting is coming in v2. For now, use the DNS guidance flow to point your domain at this server.' | NEW in v2 (spec). State screen sharing the /dns/zones route. |

### 8.9 — Email hosting and deliverability

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-MAIL-001 | `/email/domains/new` | Email domain setup | authorized | v2 | Configure; Verify | Mail role readiness with MX/SPF/DKIM/DMARC checks. | Self-hosted email is deferred to v2+ (8.9 note); v1 email = external SMTP (UX-MAIL-011) + external mailbox recommendation (UX-MAIL-012). FLOW-005 detail; on Nano email is unavailable and not offered. |
| UX-MAIL-002 | `/email/domains` | Email domains | authorized | v2 | Add; Manage | Mail domains with health, DNS and deliverability. | Self-hosted email deferred to v2+ (8.9). |
| UX-MAIL-003 | `/email/mailboxes` | Mailboxes | authorized | v2 | Create; Suspend | Mailbox accounts, quota, status and access. | Self-hosted email deferred to v2+; v1 recommends Zoho/Google Workspace for mailboxes (UX-MAIL-012). |
| UX-MAIL-004 | `/email/mailboxes/:box` | Mailbox detail | authorized | v2 | Edit; Reset | Quota, password, aliases, forwarding and logs. | Self-hosted email deferred to v2+. Field spec in 10 (address/quota/password policy). |
| UX-MAIL-005 | `/email/aliases` | Aliases and forwarders | authorized | v2 | Create; Test | Source/target with loop and restriction checks. | Self-hosted email deferred to v2+. |
| UX-MAIL-006 | `/email/lists` | Mailing lists | authorized | v2 | Create; Edit | Members, moderation and delivery policy. | Self-hosted email deferred to v2+. |
| UX-MAIL-007 | `/email/webmail` | Webmail launcher | authorized | v2 | Open webmail | SSO or separate login with safe redirect. | Self-hosted email deferred to v2+. |
| UX-MAIL-008 | `/email/deliverability` | Mail DNS health | authorized | v2 | Diagnose | SPF/DKIM/DMARC/PTR and reputation checks; never display 'deliverability guaranteed'. | Self-hosted email deferred to v2+. |
| UX-MAIL-009 | `/email/queue` | Mail queue and delivery logs | authorized | v2 | Retry; Inspect | Deferred/bounced messages with redacted logs. | Self-hosted email deferred to v2+. |
| UX-MAIL-010 | `/infrastructure/mail` | Mail server configuration | provider | v2 | Plan changes | Ports, TLS, spam, quotas and backups. | Self-hosted mail server is v2+; on Nano email is unavailable (port 25 + PTR blockers shown in UX-INF-011). |
| UX-MAIL-011 | `/email/external-smtp` | External SMTP settings | authorized | v1 | Add credentials; Test; Enable | NEW in v2: configure Resend / Postmark / Mailgun / SES for panel notifications and WordPress outbound mail — the v1 email path. | NEW in v2 (spec); self-hosted email is v2+. |
| UX-MAIL-012 | `/email/recommendation` | Mailbox recommendation | authorized | v1 | Open Zoho/Google; Learn more | NEW in v2: honest guidance — 'For mailboxes, we recommend Zoho or Google Workspace. Self-hosted mail is coming in v2.' | NEW in v2 (spec). |

### 8.10 — Backups, monitoring, incidents and security

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-OPS-001 | `/backups` | Backup overview | authorized | v1 | Create; Configure | Backup coverage, last verified restore and failed jobs. | On Nano backups are remote-only: UX-OPS-005 is the primary flow and the local destination is hidden; on Standard+ the UI warns if only local backups exist. |
| UX-OPS-002 | `/backups/policies` | Backup policies | authorized | v1 | Edit; Test | Schedules, scope, encryption, retention and destinations. | Field spec in 10: capacity and offsite readiness; UTC/timezone clarity; show effective retention and cost implications. |
| UX-OPS-003 | `/backups/sets` | Backup inventory | authorized | v1 | Inspect; Restore | Snapshots with size, integrity and expiry. | — |
| UX-OPS-004 | `/backups/restore` | Restore wizard | authorized | v1 | Review; Restore | Source, target, overwrite impact, dry-run and approval (FLOW-008); shows 'last verified restore' as a trust signal. | Typed target confirmation for irreversible overwrite; step-up MFA/approval; never equate completed file copy with verified service recovery. |
| UX-OPS-005 | `/backups/destinations` | Backup destinations | authorized | v1 | Connect; Test | Offsite providers, credentials and health; the primary backup flow on Nano (remote-only). | — |
| UX-OPS-006 | `/monitoring` | Monitoring overview | authorized | v1 | Drill down | CPU/RAM/disk, service health, latency and trends. | — |
| UX-OPS-007 | `/monitoring/metrics` | Metrics explorer | authorized | v1 | Chart; Export | Timeseries, comparison, filters and freshness. | — |
| UX-OPS-008 | `/monitoring/logs` | Log explorer | authorized | v1 | Stream; Export | Search, time range, severity and tenant scopes. | — |
| UX-OPS-009 | `/monitoring/alerts` | Alerts and policies | authorized | v1 | Create; Silence | Thresholds, routing, silences and test delivery. | — |
| UX-OPS-010 | `/incidents` | Incidents | authorized | v1 | Acknowledge; Assign | Severity, ownership, timeline and status. | — |
| UX-OPS-011 | `/incidents/:incident` | Incident detail | authorized | v1 | Resolve; Escalate | Evidence, runbook, actions and postmortem. | Entry point of FLOW-010 (AI-guided remediation). |
| UX-OPS-012 | `/security` | Security overview | authorized | v1 | Review findings | Threats, risky settings, MFA and patch status. | — |
| UX-OPS-013 | `/security/firewall` | Firewall rules | authorized admins | v1 | Dry-run; Approve | Rules, order, lockout preview, IPv4/IPv6 (FLOW-009). | Field spec in 10: CIDR/IP-family validation, shadowing/conflicts, preview effective rule order and lockout risk. |
| UX-OPS-014 | `/security/ssh` | SSH security | authorized admins | v1 | Add key; Test | Keys, access and safe change workflow. | — |
| UX-OPS-015 | `/security/isolation` | Isolation and policies | provider | v1 | Inspect; Plan | Tenant boundaries, process users, quotas and exceptions. | — |
| UX-OPS-016 | `/audit` | Audit trail | authorized auditors | v1 | Filter; Export | Actor/action/target, before-after and export controls. | Audits displayed in UTC (4.4). |
| UX-OPS-017 | `/operations/updates` | Updates and patches | authorized admins | v1 | Plan; Schedule | Available updates, compatibility, maintenance and rollback. | — |
| UX-OPS-018 | `/monitoring/usage` | Allocation and usage | authorized | v1 | Drill down; Adjust | NEW in v2: per-workload current / typical / peak / throttled view. | NEW in v2 (spec). Same title as UX-OV-009 but per-workload scope (UX-OV-009 is the server-level aggregate at /overview/usage). On mobile it becomes a horizontal scroll, not a wrap. |
| UX-OPS-019 | `/monitoring/batch` | Batch queue | authorized | v1 | Inspect; Cancel if supported | NEW in v2: all batch jobs (transforms, backups, builds, AI diagnostics, migrations) with queue state — '3 queued, 1 running, will yield to site traffic'. Informational, not error. | NEW in v2 (spec). Batch states: queued / running / paused / throttled (5). Target of the shell batch queue indicator (DS-023). |
| UX-OPS-020 | `/monitoring/pressure` | Memory pressure | authorized | v1 | Adjust ceiling; Upgrade | NEW in v2: workloads near memory.max, OOM kill history and upgrade recommendations. | NEW in v2 (spec); copy example in 14. |
| UX-OPS-021 | `/backups/verify` | Backup verification | authorized | v1 | Run verification; View history | NEW in v2: scheduled restore-test evidence — 'last verified restore: 3 days ago' per backup policy. | NEW in v2 (spec) and explicitly a v1 feature, not deferred: 'backup succeeded' is not the same as 'backup is restorable'. |

### 8.11 — Automation, integrations and developer APIs

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-AUTO-001 | `/automation` | Automation overview | authorized | v1 | Create | Jobs, triggers, rules and failures. | — |
| UX-AUTO-002 | `/automation/workflows/new` | Workflow builder | authorized | v1 | Test; Publish | Triggers, steps, approvals and dry-run. | — |
| UX-AUTO-003 | `/automation/schedules` | Scheduled jobs | authorized | v1 | Create; Pause | Next/last runs, timezone and ownership. | — |
| UX-AUTO-004 | `/automation/webhooks` | Webhooks | authorized | v1 | Create; Test | Endpoints, signing secrets and delivery retries. | — |
| UX-AUTO-005 | `/developer/api` | API explorer | authorized | v1 | Try safe requests | Versioned endpoints, examples and scopes. | — |
| UX-AUTO-006 | `/integrations` | Integrations | authorized | v1 | Connect; Revoke | Connected services, health and permissions. | — |
| UX-AUTO-007 | `/plugins` | Plugin marketplace | authorized | v2 | Inspect; Install | Verified modules with publisher and compatibility. | Plugin marketplace deferred to v2+ (8.11 note); the v1 'marketplace' is the ServiceTemplate catalog (UX-TPL-001). |
| UX-AUTO-008 | `/plugins/:plugin` | Plugin detail and consent | authorized | v2 | Approve; Install | Scopes, data access, upgrade policy and warnings. | Plugin marketplace deferred to v2+. |
| UX-AUTO-009 | `/settings/branding` | White-label settings | reseller, provider | v2 | Publish | Brand tokens, assets, domain and preview. | White-label branding deferred to v2+ (8.11 note); paired with UX-COM-009 reseller portal branding. |

### 8.12 — AI assistant and diagnostics

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-AI-001 | `/assistant` | AI assistant workspace | authorized opt-in | v1 | Ask; Attach resource | Chat with scoped context, evidence citations and history (DS-017). | AI with consent: AI drafts plans, never silently runs privileged actions. |
| UX-AI-002 | `/assistant/diagnostics/:report` | AI diagnostic report | authorized | v1 | Review; Export | Read-only evidence, uncertainty and likely causes. | — |
| UX-AI-003 | `/assistant/plans/:plan` | AI proposed change | authorized | v1 | Edit; Request approval | Exact actions, risks, impact and policy checks — AI proposes, user approves, policy engine validates; no silent mutations. | v1 ships read-only diagnostics + proposed-action approval (NP-AI-012); autonomous action execution is v4+. |
| UX-AI-004 | `/assistant/runs/:run` | AI execution timeline | authorized | v1 | Monitor; Stop if safe | Approval, job stages, observed results and rollback; the AI never claims success before verification (NP-AI-008). | — |
| UX-AI-005 | `/settings/ai` | AI settings and consent | owner, provider | v1 | Enable; Revoke | Provider selection, retention, scopes and opt-in. | — |
| UX-AI-006 | `/assistant (state)` | AI diagnostic first-run | authorized | v1 | Ask; Approve; Reject | NEW in v2: the v1 default AI experience — AI reads logs/metrics/state, proposes typed actions with approval, the policy engine validates, the job executes: 'AI can diagnose and propose; you approve; the policy engine decides.' | NEW in v2 (spec). State variant sharing the /assistant route with UX-AI-001. |
| UX-AI-007 | `/assistant (state)` | AI unavailable | authorized | v1 | Configure; Disable AI | NEW in v2: honest state when no LLM API key is configured — 'AI diagnostics require an LLM API key. Add one in Settings -> AI.' | NEW in v2 (spec). State variant sharing the /assistant route. |

### 8.13 — Support, migration and lifecycle

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-SUP-001 | `/support` | Support center | all | v1 | Open ticket | Guides, tickets, diagnostics and safe data sharing. | — |
| UX-SUP-002 | `/migrations` | Migration hub | authorized | v1 | Start migration | Source platforms, compatibility and import status. | Migration from cPanel/DirectAdmin/Plesk is deferred to v2+; the v1 migration path is VPS-to-VPS via ServiceTemplate export/import (UX-SUP-009/010, UX-SUP-011 for conflicts). |
| UX-SUP-003 | `/migrations/new` | Migration wizard | authorized | v1 | Validate; Import | Inventory, dry-run, conflicts, cutover and rollback. | Source-platform (cPanel/DirectAdmin/Plesk) migration deferred to v2+; v1 path is ServiceTemplate export/import. |
| UX-SUP-004 | `/settings/data-transfer` | Import/export center | authorized | v1 | Export; Import | Config exports, redaction and access control. | — |
| UX-SUP-005 | `/settings/system` | System settings | owner, provider | v1 | Review; Save | Locale, URL, module policies, branding and email. | — |
| UX-SUP-006 | `/system/install` | Installer status | owner | v1 | Resume; Repair | Preflight, stages, recovery and logs. | — |
| UX-SUP-007 | `/system/updates` | Upgrade center | owner, provider | v1 | Plan; Upgrade | Versions, compatibility and backup requirement. | — |
| UX-SUP-008 | `/system/recovery` | Recovery center | owner, provider | v1 | View; Verify | Offline-safe runbooks and rescue modes. | — |
| UX-SUP-009 | `/system/upgrade` | VPS upgrade | owner, provider | v1 | Rescan; Apply; View plan | NEW in v2: the ladder-climbing flow — current capability set, available capabilities after hardware upgrade, migration options, and the 'rescan hardware' button. | NEW in v2 (spec). 'The ladder paying off': rescan hardware after upgrade, see new capabilities, apply (UXD-032). The doc cross-references this ID in the v1 migration-path sentence. |
| UX-SUP-010 | `/settings/templates/transfer` | ServiceTemplate export/import | authorized | v1 | Export; Import | NEW in v2: export a ServiceTemplate instance (storage bucket, self-hosted app, database, cache) as an OCI-compatible artifact + manifest; import on a new VPS. | NEW in v2 (spec). The v1 migration path (replaces cPanel/DirectAdmin/Plesk migration, which is v2+). Validated end-to-end by UXT-028. |
| UX-SUP-011 | `/migrations/:id/conflicts` | Migration conflict resolution | authorized | v1 | Resolve; Rollback | NEW in v2: conflicts between source and destination (name clashes, port conflicts, cert issues) with resolution options. | NEW in v2 (spec). |

### 8.14 — Platform Services (new module in v2)

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-SVC-001 | `/services` | Platform services overview | authorized | v1 | Create; Manage | List of provisioned platform services (storage buckets, transform pipelines, delivery endpoints, cache, queue, search) with health, usage and quick actions. | NEW module in spec v2 (8.14); 'Platform Service' = storage, transform, delivery, cache, queue, search, provisioned from ServiceTemplate records. Reachable from the router ('Data & storage') or the menu. |
| UX-SVC-002 | `/services/storage/new` | Create storage bucket wizard | authorized | v1 | Create; Copy endpoint/keys | Bucket name, visibility (public/private), region, quota and access keys. | FLOW-015 storage flow. Field specs in 10: S3 naming rules (lowercase, hyphens, 3-63 chars), 'public = anyone can read' warning with public-URL preview. |
| UX-SVC-003 | `/services/storage/:id` | Storage bucket detail | authorized | v1 | Rotate keys; View usage; Export | S3 endpoint, access keys (shown once), usage (storage/requests/bandwidth), consumed-by (which sites/apps use it) and lifecycle. | — |
| UX-SVC-004 | `/services/storage/:id/keys` | Storage access keys | authorized | v1 | Create; Revoke | Scoped keys, permissions, last used and revocation. | Field spec in 10: scoped (read-only/write-only/read-write) with least-privilege default. |
| UX-SVC-005 | `/services/transform/:id` | Transform pipeline | authorized | v1 | Configure; Apply; View batch queue | Resize/convert/crop rules; pre-transform on upload vs on-the-fly via URL params; cache policy; CPU allocation as a batch workload (cpu.weight=10, cpu.max=50% of cores). | FLOW-015 transform flow: 'Transforms will run when the server is idle. Under site traffic, they queue. Your sites stay responsive.' Field specs in 10 (named sizes with storage cost estimate; on-the-fly toggle with cache warning). |
| UX-SVC-006 | `/services/delivery/:id` | Delivery configuration | authorized | v1 | Enable integration; Test | Caddy cache config, optional Cloudflare/Bunny integration and bandwidth usage. | — |
| UX-SVC-007 | `/services/cache/:id` | Cache instance | authorized | v1 | Manage; Flush; Export | Redis/Memcached instance, memory limit, persistence and connection details. | — |
| UX-SVC-008 | `/services/queue/:id` | Queue instance | authorized | v1 | Manage; Purge | RabbitMQ-style queue, max depth and connection details. | — |
| UX-SVC-009 | `/services/search/:id` | Search instance | authorized | v1 | Manage; Export | Meilisearch-style search, index size and connection details. | — |
| UX-SVC-010 | `/services/consume/:id` | Consume service | authorized | v1 | Select site; Inject; Preview diff | One-click integration: attach a storage bucket to a website/app, inject credentials and update config (preview diff before confirming). | The storage service's value proposition: no .env editing, no copying keys between SaaS dashboards. Validated by UXT-026. |

### 8.15 — Self-hosted Templates (new module in v2)

| ID | Route | Title | Audience | Phase | Actions | Summary | Notes |
|---|---|---|---|---|---|---|---|
| UX-TPL-001 | `/templates` | Template catalog | authorized | v1 | Browse; Search; Deploy | Grid of available self-hosted apps: icon, name, category (CMS, files, dev, analytics, monitoring, database, cache), resource profile and deploy button (DS-027). | NEW module in spec v2 (8.15). The catalog is data, not code; the v1 catalog ships 5-10 templates (WordPress, Nextcloud, Gitea, Ghost, n8n, Uptime Kuma); v2+ expands to 20-30. The ServiceTemplate catalog is the v1 'marketplace'. |
| UX-TPL-002 | `/templates/:id` | Template detail | authorized | v1 | Review; Deploy | Description, resource profile (RAM floor/typical/ceiling, disk), prerequisites, screenshots and deploy button. | — |
| UX-TPL-003 | `/templates/:id/deploy` | Deploy template wizard | authorized | v1 | Review; Deploy | Hostname, admin credentials (generated, shown once), resource allocation and backup policy; preflight checks capability, port conflict and disk quota. | Field specs in 10: generated password shown once with copy, never displayed again; refuse allocation exceeding fit and show the delta. Copy example in 14 ('Deploying Nextcloud... usually takes 2-3 minutes'). |
| UX-TPL-004 | `/services/template/:id` | Self-hosted service detail | authorized | v1 | Open app; Manage; Export; Uninstall | App URL, admin login, health, resource usage, backups and export. | Route sits under /services (Platform Services IA) although it belongs to the TPL family. Unhealthy copy in 14: restart, restore, uninstall. |
| UX-TPL-005 | `/templates (state)` | Template unavailable | authorized | v1 | Upgrade; Learn more | NEW in v2: honest Nano state — 'Self-hosted templates require Docker, which is not available on this VPS. Upgrade to Standard to enable the catalog.' | NEW in v2 (spec). State screen sharing the /templates route with UX-TPL-001. |

## End-to-end journeys (spec section 9)

Preservation note (v2): FLOW-001..012 are secondary journeys reached from the router or the menu; FLOW-013 (Router) replaces FLOW-001 as the primary first-run; FLOW-014 (Nano experience) and FLOW-015 (Platform Services) are new. Flows marked 'deferred to v2+' are out of v1 build scope.

| Flow | Title | Spec | Screens |
|---|---|---|---|
| FLOW-001 | First-time VPS owner: from sign-in to first live website (superseded by FLOW-013 as primary first-run; website path preserved as its sub-flow) | 9 FLOW-001 | UX-IAM-003, UX-WEB-002, UX-WEB-003, UX-WEB-018, UX-DNS-014, UX-DNS-011, UX-OV-001 |
| FLOW-002 | Node.js application: Vercel-like ease with hosting-depth controls | 9 FLOW-002 | UX-WEB-008, UX-WEB-009, UX-WEB-010, UX-WEB-011, UX-WEB-012, UX-WEB-013, UX-WEB-014, UX-WEB-015, UX-WEB-016, UX-WEB-017 |
| FLOW-003 | Provider creates reseller, package and customer (deferred to v2+; data model complete from v1 but UI is not) | 9 FLOW-003 | UX-COM-003, UX-COM-004, UX-COM-008, UX-COM-007, UX-IAM-007 |
| FLOW-004 | DNS and domain onboarding — nine-screen guided sequence (reframed for v1 as DNS guidance mode, UX-DNS-014; the nine-screen authoritative sequence returns when authoritative DNS ships in v2) | 9 FLOW-004 | UX-DNS-002, UX-DNS-004, UX-DNS-005, UX-DNS-006, UX-DNS-007, UX-DNS-008, UX-DNS-014, UX-WEB-018 |
| FLOW-005 | Email domain activation (deferred to v2+; the v1 flow is external SMTP via UX-MAIL-011, mailboxes recommended via UX-MAIL-012) | 9 FLOW-005 | UX-MAIL-001, UX-MAIL-002, UX-MAIL-008, UX-MAIL-003, UX-MAIL-007 |
| FLOW-006 | Database creation, grant and safe import (deferred to v2+; unavailable on Nano, borderline on Starter, ships on Standard+ in v2 as a ServiceTemplate instance) | 9 FLOW-006 | UX-DB-002, UX-DB-003, UX-DB-004, UX-DB-006 |
| FLOW-007 | File manager and code editor | 9 FLOW-007 | UX-FILE-001, UX-FILE-002, UX-FILE-003, UX-FILE-005 |
| FLOW-008 | Backup restore and disaster recovery | 9 FLOW-008 | UX-OPS-003, UX-OPS-004, UX-OPS-021, UX-OPS-010 |
| FLOW-009 | Firewall or SSH change without lockout | 9 FLOW-009 | UX-OPS-013, UX-OPS-014 |
| FLOW-010 | AI-guided incident remediation (v1 = read-only diagnosis + proposed-action approval, NP-AI-012; autonomous multi-step remediation is v4+) | 9 FLOW-010 | UX-OPS-010, UX-OPS-011, UX-AI-001, UX-AI-002, UX-AI-003, UX-AI-004 |
| FLOW-011 | Multi-server role deployment and maintenance (deferred to v2+ with the Provider profile) | 9 FLOW-011 | UX-INF-001, UX-INF-002, UX-INF-003, UX-INF-004, UX-INF-005, UX-INF-006, UX-INF-007 |
| FLOW-012 | Reseller-branded customer onboarding (deferred to v2+) | 9 FLOW-012 | UX-COM-009, UX-COM-004, UX-COM-001, UX-COM-003 |
| FLOW-013 | The Router: 'What do you want to run?' (new in v2, replaces FLOW-001 as primary first-run) | 9 FLOW-013 | UX-IAM-003, UX-OV-002, UX-OV-001, UX-WEB-002, UX-WEB-008, UX-TPL-001, UX-TPL-003, UX-SVC-002, UX-INF-011 |
| FLOW-014 | The Nano layman experience (new in v2) | 9 FLOW-014 | UX-IAM-003, UX-WEB-002, UX-OV-001, UX-OV-002, UX-INF-011 |
| FLOW-015 | Platform Services (new in v2) | 9 FLOW-015 | UX-SVC-001, UX-SVC-002, UX-SVC-003, UX-SVC-005, UX-SVC-010, UX-TPL-001, UX-TPL-002, UX-TPL-003, UX-TPL-004 |

### FLOW-001 — First-time VPS owner: from sign-in to first live website (superseded by FLOW-013 as primary first-run; website path preserved as its sub-flow)

1. Entry: owner bootstrap complete, server enrolled, capability scan available
2. Pick 'A website' from the router (FLOW-013)
3. Enter domain or choose temporary preview hostname
4. Choose static/PHP/app type (constrained by capability set — Nano only offers static)
5. Choose source (upload/Git/starter)
6. Select eligible server / automatic placement
7. Inspect document root, disk, account, DNS/TLS prerequisites
8. Impact preview
9. Submit durable provisioning job
10. Timeline with actual checks
11. Verified preview and DNS delegation instructions
12. Optional SSL issuance once DNS validates
13. Failure handling: no eligible server, domain conflict, quota, DNS not delegated, install error, partial provisioning; exit is an accessible site or a clear blocked state with recovery link

### FLOW-002 — Node.js application: Vercel-like ease with hosting-depth controls

1. Entry: app creation permission and compatible Node adapter
2. Source: Git/upload/existing files
3. Repository/branch or file selection
4. Auto-detect package.json and suggested framework
5. Runtime version selected from actual installed/supported versions
6. Build command and working directory
7. Start command/startup file and app port
8. Environment variables via add rows, multiline bulk paste, or .env upload
9. Domains/preview URL
10. Resources, process count, restart policy
11. Review: secret names only, build/start commands, proxy/TLS and quota
12. Deploy job; lifecycle queued/building/releasing/starting/health-checking/verified with log stream and rollback where supported
13. Critical validation: reject duplicate keys, malformed multiline input, invalid port, path escape, missing start script, unsupported Node version, secrets in non-secret fields; redact values from job logs

### FLOW-003 — Provider creates reseller, package and customer (deferred to v2+; data model complete from v1 but UI is not)

1. Provider selects organization
2. Creates scoped reseller grant
3. Defines package with quotas, feature entitlements and pricing
4. Previews inherited limits
5. Invites reseller
6. Reseller creates hosting account/customer within delegated capacity
7. System reserves capacity and provisions resources
8. Customer receives onboarding invitation
9. Provider and reseller see only authorized subtree and billing data
10. Failures: quota exhausted, package changed during creation, invalid delegated permission, server placement failure, customer email already registered

### FLOW-004 — DNS and domain onboarding — nine-screen guided sequence (reframed for v1 as DNS guidance mode, UX-DNS-014; the nine-screen authoritative sequence returns when authoritative DNS ships in v2)

1. Intent: domain name and intended use (site, app, mail, DNS only)
2. Control model: external/manual DNS, future external API, or local authoritative DNS; never assume registrar ownership
3. Ownership proof: TXT token and validation status; do not confuse ownership with delegation
4. Preflight: collisions, existing MX/TXT, nameserver availability, TTL, DNSSEC, email dependencies
5. Zone proposal: preview records, detect conflicts, preserve existing email records unless explicitly changed
6. Nameserver delegation: registrar-specific instructions, glue only when required, independent secondary warning
7. Security: DNSSEC choices and DS instructions with risk explanation
8. Apply: diff, approval, operation ID, authoritative server health
9. Verify and recover: public resolution checks, propagation uncertainty, rollback guidance, record-level diagnostics
10. Guardrails: never promise global propagation completion; local authoritative DNS needs correct port reachability and an independent secondary for production resilience

### FLOW-005 — Email domain activation (deferred to v2+; the v1 flow is external SMTP via UX-MAIL-011, mailboxes recommended via UX-MAIL-012)

1. Choose domain
2. Check mail role availability and IP reputation/PTR prerequisites
3. Propose MX/SPF/DKIM/DMARC changes with diff
4. Create mailbox policy
5. Request DNS changes
6. Verify external observations
7. Activate mailboxes/webmail
8. Send/receive diagnostics
9. Failures: blocked outbound port 25, missing PTR, stale DNS, DKIM mismatch, unavailable mail node, partial configuration; never display 'deliverability guaranteed'

### FLOW-006 — Database creation, grant and safe import (deferred to v2+; unavailable on Nano, borderline on Starter, ships on Standard+ in v2 as a ServiceTemplate instance)

1. Select account and engine
2. Compatible node
3. Database name
4. Least-privilege user/grants
5. Quota/backup policy
6. Review
7. Provision job
8. Masked connection string with controlled copy
9. Optional import with schema/size checks and progress
10. Failures: duplicate name, engine missing, capacity, grant conflict, oversized import, partial restore

### FLOW-007 — File manager and code editor

1. Open account-scoped root
2. Browse tree with breadcrumb and virtualized rows
3. Select file
4. Preview metadata and contents
5. Edit in tabs with dirty markers
6. Save with version check
7. Show merge/diff on concurrent modification
8. Observe write job and status
9. Upload: drag/drop, progress, duplicate conflict choice, limits, resumability when supported
10. Security: no traversal outside permitted root, no unmasked secrets in previews/telemetry, symlink escape detection, dangerous chmod/chown preview

### FLOW-008 — Backup restore and disaster recovery

1. Select restore source
2. Validate integrity, encryption keys and target compatibility
3. Choose original/new destination
4. Enumerate overwritten resources and downtime
5. Offer verified backup checkpoint when possible
6. Step-up MFA/approval
7. Restore job with per-step status
8. Integrity and application health checks
9. Incident record and rollback options
10. Failures: offsite unavailable, corrupt backup, incompatible engine, missing key, insufficient disk, partial restore; never equate completed file copy with verified service recovery

### FLOW-009 — Firewall or SSH change without lockout

1. Inspect existing connectivity and session
2. Stage new rules/keys
3. Validate IPv4 and IPv6 and explicit management access
4. Show diff and lockout warning
5. Require alternate verified access path where feasible
6. Apply with timed automatic rollback mechanism if supported
7. Test connectivity from independent session
8. Commit only after verification; if timed rollback unavailable, label the operation higher risk and require out-of-band recovery

### FLOW-010 — AI-guided incident remediation (v1 = read-only diagnosis + proposed-action approval, NP-AI-012; autonomous multi-step remediation is v4+)

1. Open incident
2. AI reads only permitted, redacted evidence
3. Report observations vs hypotheses with uncertainty
4. Propose typed operations with affected resources, expected effect, prerequisites and rollback
5. User edits/approves
6. Policy engine evaluates
7. Job executes
8. AI displays actual observed results and unresolved symptoms
9. Constraints: no arbitrary root-shell execution; no automatic irreversible actions; the AI never claims success before verification

### FLOW-011 — Multi-server role deployment and maintenance (deferred to v2+ with the Provider profile)

1. Provider opens fleet
2. Enrolls agent using short-lived token
3. Verifies server identity
4. Inspects capability/resource profile
5. Assigns role and placement eligibility
6. Previews conflicts/impact
7. Provisions module
8. Verifies health
9. Schedules maintenance/cordon/drain
10. Tracks workload movement and failures; never call one-node deployment highly available

### FLOW-012 — Reseller-branded customer onboarding (deferred to v2+)

1. Reseller configures branding preview
2. Confirms domain/TLS
3. Creates package
4. Invites customer
5. Customer receives branded signup with clear operator identity
6. Customer sees only assigned hosting account and enabled features
7. Customer creates site/mail/database within quota
8. Support routes to reseller/provider per policy

### FLOW-013 — The Router: 'What do you want to run?' (new in v2, replaces FLOW-001 as primary first-run)

1. Entry: owner bootstrap complete (UX-IAM-002), server enrolled, capability scan available
2. Single page with six cards (icon, title, one-line description, 'Get started'): A website / An application / A self-hosted app / Data & storage / Infrastructure / I'm not sure yet; header 'Welcome to NexusPanel. What do you want to run?'; footer link 'I'm not sure yet'
3. Router reads the installer capability set and shows honest availability: Nano marks unavailable cards with the resource delta ('Not available on this VPS — needs 200 MB more RAM'); Starter shows borderline cards as 'runs, but tight' with the resource delta; Standard+ shows all cards fully available
4. Route per card: A website -> FLOW-001 website sub-flow; An application -> FLOW-002 (if capability available); A self-hosted app -> FLOW-015 (template catalog -> deploy); Data & storage -> FLOW-015 (storage) or FLOW-006 (database, v2+); Infrastructure -> depends on sub-choice; I'm not sure yet -> guided tour / capability display
5. Each card has a 'You're live' moment (e.g. site reachable at name.panel-host with SSL; app responds with logs visible; app's own login screen loads with admin credentials shown; bucket exists with S3 endpoint + keys and first upload succeeds)
6. After the first path the user lands on the service portfolio (UX-OV-001) with the follow-up checklist: 'Your first site is live / Connect your domain / Enable automatic backups / Invite a collaborator', each item linking to the relevant flow
7. 'I'm not sure yet' fallback: 'Let's see what your VPS can do first' -> capability display + guided tour (router no-match state)

### FLOW-014 — The Nano layman experience (new in v2)

1. Entry: a 512 MB VPS install; the installer ran 5-step detection and produced a capability set
2. First-run router shows six cards with honest availability: 'A website — Static sites work'; 'An application — Needs 200 MB more RAM — upgrade'; 'A self-hosted app — Needs Docker — upgrade'; 'Data & storage — File storage client (connect to external S3/B2), Databases need 250 MB more'; 'Infrastructure — Email needs port 25 + reverse DNS'; 'I'm not sure yet'
3. User picks 'A website' -> static site flow -> site live in 60 seconds with SSL
4. Service portfolio lists one site, live, with SSL; the capability banner persists: 'Your VPS can also run: storage client, remote backups, AI diagnostics. Your VPS cannot run: WordPress, Node, databases, transforms, email.'
5. If the user tries an unavailable capability (e.g. clicks 'An application'): 'Your VPS cannot run Node.js applications because the panel and OS already use most of your 512 MB RAM. Node needs 200 MB more. [Upgrade to a 2 GB VPS] [Learn what a 2 GB VPS can run]'
6. Rule: no greyed-out menus, no fake features — the product scales down honestly, not by hiding features (UXD-031 release gate; UXT-021)

### FLOW-015 — Platform Services (new in v2)

1. Storage bucket flow (1): user picks 'Data & storage' from the router or navigates to /services from the menu
2. Storage bucket flow (2): 'Storage -> Create bucket' wizard: bucket name, visibility (public/private), region, quota, access keys
3. Storage bucket flow (3): preflight — disk quota fit, MinIO health, port conflict
4. Storage bucket flow (4): provision job — create bucket, generate scoped keys, set public/private policy
5. Storage bucket flow (5): 'You're live' moment — bucket exists, S3 endpoint shown, access keys shown once with copy buttons, first upload succeeds
6. Storage bucket flow (6): usage dashboard — storage used, requests, bandwidth, top assets
7. Storage bucket flow (7): integration offer — 'Use this bucket for a website's media?' -> pick site -> inject endpoint and keys into site config -> preview diff -> confirm
8. Transform pipeline flow (1): from the storage bucket detail, 'Enable image transformation'
9. Transform pipeline flow (2): choose rules — pre-transform predictable sizes (thumbnail, medium, large) on upload vs on-the-fly transform via URL params
10. Transform pipeline flow (3): configure CPU allocation — batch workload with cpu.weight=10, cpu.max=50% of cores
11. Transform pipeline flow (4): confirm messaging — 'Transforms will run when the server is idle. Under site traffic, they queue. Your sites stay responsive.'
12. Transform pipeline flow (5): 'You're live' moment — pipeline active; upload an image -> auto-converted; serve ?w=800 -> resized
13. Self-hosted template flow (1): from /templates or 'A self-hosted app' from the router; browse catalog (WordPress, Nextcloud, Gitea, Ghost, n8n, Uptime Kuma)
14. Self-hosted template flow (2): pick Nextcloud -> deploy wizard — hostname, admin credentials (generated), resource allocation, backup policy
15. Self-hosted template flow (3): preflight — Docker capability, port conflict, disk quota, memory fit
16. Self-hosted template flow (4): provision job — pull signed image, create container, volume, reverse proxy route, SSL, admin credentials, health check
17. Self-hosted template flow (5): 'You're live' moment — Nextcloud's own login screen loads at cloud.name.panel-host with SSL; admin credentials shown once

## Personas and jobs-to-be-done (spec section 2)

Personas are jobs-to-be-done, not permission identities; a user can hold several simultaneously. The persona determines the default landing, the tenant view (organization -> membership -> account) answers 'what is this user permitted to do?'.

| Persona | Landing context | Primary navigation | Jobs-to-be-done | Default presentation | Boundaries |
|---|---|---|---|---|---|
| Solo VPS owner (owner) | Installation overview; router for new users, service portfolio for returning users (UXD-021) | Sites, Apps, Domains, Files, Databases, Backups, Server, Security | Website owner ('get a site online, securely'), app developer, self-hoster (Nextcloud/Gitea/n8n/own thing), storage user, infrastructure user (VPN/proxy/mail/DNS), explorer ('I bought a VPS and I'm not sure what to do'). Job is 'get something new working' -> guided router is the primary IA. | guided | Can administer owned installation; expert privileges require step-up |
| Hosting customer (customer) | Assigned hosting account | Overview, Sites, Apps, Domains, Email, Databases, Files, Backups | Manage what I already have (assigned sites, email, databases within an assigned hosting account). | portfolio | No infrastructure/provider operations unless delegated |
| Developer (developer) | Authorized project/workspace | Deployments, Files, Logs, Env, Databases | Deploy a backend, see logs (application flow); scoped to granted resources/actions. | guided | Scoped to granted resources/actions |
| Reseller (reseller) | Reseller organization; delegated dashboard | Customers, Packages, Accounts, Branding, Usage, Support | Sell hosting to others; manage customers, packages, accounts, branding, usage, support. | portfolio | Cannot exceed upstream quotas/permissions. Commercial UI deferred to v2+ — the reseller surface becomes active then. |
| Provider operator (provider) | Provider organization/fleet; fleet dashboard | Fleet, Accounts, Resellers, Packages, Billing, Security, Incidents | Run the fleet: fleet health, capacity, tenants, incidents, revenue indicators. | portfolio | High-risk operations gated and audited. Provider/reseller surfaces (FLOW-003, FLOW-011, FLOW-012) are deferred to v2+. |
| Support/billing/auditor (support) | Explicit function (Tickets/Grants, Invoices, Audit) | Tickets/Grants, Invoices, Audit | Explicit function: tickets/grants, invoices, audit; read-only or time-limited support as assigned. | function | Read-only or time-limited support access as assigned; support access shows a persistent scoped banner with expiry and audit (DS-019) |

Jobs-to-be-done table that drives the router (spec 2): Website owner -> Website flow; App developer -> Application flow; Self-hoster -> Self-hosted template flow; Storage user -> Storage flow; Infrastructure user -> Infrastructure flow; Explorer -> Guided tour; Reseller -> Delegated dashboard; Provider admin -> Fleet dashboard.

## Presentation modes (spec sections 0 and 18)

- **guided**: Primary IA for personas whose job is 'get something new working'. The six-card router (FLOW-013) is the first-run surface; the service portfolio is the ongoing surface; the menu (27-area IA) is secondary, reachable via 'Advanced tools'. Plain language first, expert terms in expandable help. If the default landing is the menu, the lay person drowns — that is cPanel's failure mode.
- **standard**: Intermediate presentation mode listed alongside guided and expert (0 [v2] design rules; UXD-005/033). The document names the mode but does not detail its behavior; permissions are identical across all modes.
- **expert**: Full 27-area menu IA ('Advanced tools') with compact density for expert tables and deep controls; same permissions as guided (persona != permission). Reached via the Guided -> Expert toggle (UXD-033, UXT-029).

## Cross-cutting rules

### Guided-default rule (spec 0, 2, 18 UXD-021/026)

GET / resolves the default landing page per persona (jobs-to-be-done, Stage 2 section 1.2). The guided router is the primary IA for personas whose job is 'get something new working'; the service portfolio is the primary IA for personas whose job is 'manage what I already have'; the menu (27-area IA) is the secondary IA, reachable via 'Advanced tools'. Default landing: router for new users, service portfolio for returning users (UXD-021 — release gate). The router is context-free: it appears before any organization/account context is established, and the answer determines the scope of the next screen. The capability banner is persistent on installations where any capability is unavailable (honest, not alarming, expands to explanation + upgrade path).

### Universal action sequence (spec 0)

inspect -> configure -> validate -> review impact -> authorize/approve -> submit operation -> track progress -> verify actual result -> audit/recover (section 0). UI cannot mark completion before verification; no optimistic 'success' for DNS propagation, TLS issuance, deployment health or restore.

### State taxonomy (spec 5 global states + v2 additions)

- initial loading
- empty
- loading more
- pending
- awaiting approval
- success (verified)
- partial success
- failed
- offline/stale
- unauthorized
- unsupported
- quota exceeded
- conflict/concurrent edit
- maintenance
- recovery required
- capability unavailable
- batch queued
- batch running
- batch paused
- memory pressure
- throttled
- pending payment
- payment callback unmatched
- router no-match

### Persona vs permission rule (spec 0)

Persona != permission. Guided/Standard/Expert are presentation modes; permissions are identical across modes. The API enforces permissions; the UI reflects them. Audience labels in the screen catalog are descriptive only — server policy resolves the actual actor/resource/action/scope at runtime. Never write `if (role === 'reseller') showCustomerMenu()` — that is the permission model leaking into the UI. Prohibited resources must not be discoverable; unavailable module shows a disabled explanatory state only when discovery is useful.

### Forms and validation (spec 5, 10)

Field-level specs in section 10 (v1 forms + v2 additions for storage/transform/template/M-Pesa). Labels never rely on placeholders; required/optional explicit; preserve user input on recoverable errors; validation is inline AND summarized, server validation remains authoritative; disable submission while policy check is pending; allow safe draft save; reveal sensitive values only after explicit permission and never in screenshots/telemetry; multiline bulk paste shows parsed counts, duplicates and warnings before applying; mutations use idempotency keys and disable duplicate submit; retain drafts during navigation; browser refresh must rehydrate operation status.

### Impact review pattern (spec 0, 4.3 DS-009/DS-010)

DS-009 Impact review: before/after, affected resources, downtime, reversibility, approval. The universal action sequence requires impact review before authorize/submit. High-risk actions use step-up MFA and/or second-person approval when policy requires; DS-010 confirmation dialog names the exact target and consequences with typed confirmation for high risk; destructive labels name their target ('Delete website', never bare 'Delete'). Every destructive operation must explain retention and recovery. Bulk operations show count, scope and per-item results.
