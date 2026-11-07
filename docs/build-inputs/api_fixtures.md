# NexusPanel — API Contract & Domain Enums (BUILD INPUT for mock-data layer)

**Sources:** Stage 6 — Complete API & Integration Specification v2.0 (`upload/NexusPanel_Stage 6_Complete_API_&_Integration_Specification_v2.0.md`, read fully) and Stage 5 — Complete Database & Data Architecture v2.0 (`upload/NexusPanel_Stage 5_...md`, read for enums/state machines). Both are DRAFTS for architecture review, not implemented APIs.

**Legend:** ✅ = JSON example appears (verbatim or trimmed) in the spec. ◆ = response shape reconstructed from fields the spec documents, but no example payload exists in the spec. ⚠ = gap/contradiction — see the note.

---

## 1. Conventions

- **Base path:** `/api/v1` (public REST, HTTPS JSON). Real-time events: authenticated SSE. Agent RPC: Unix socket in v1 (`/run/nexuspanel/agent.sock`, peer-credential checks) — never a public endpoint. mTLS only for remote agents in v2+.
- **Path naming:** collections are plural kebab-case nouns (`/organizations/{organizationId}/hosting-accounts`); `GET` retrieve, `POST` create/action, `PATCH` partial update, `DELETE` deletion request. No GET mutations.
- **JSON field naming:** `snake_case` (Go-idiomatic, `json:"created_at"` tags; OpenAPI generated from Go types).
- **ID format:** ⚠ Normative text says "All IDs are UUIDv7 strings — sortable by time, opaque, safe for URLs", but every example in the spec uses prefixed ULID-like opaque IDs (`web_01EXAMPLE`, `org_01EXAMPLE`, `req_01EXAMPLE`, `evt_01EXAMPLE`, `op_01EXAMPLE`, `cmd_01EXAMPLE`). For fixtures, use the prefixed-example style (`<kind>_<ulid>`); never numeric or tenant-encoding IDs.
- **Money:** integer minor units + explicit currency. `{"amount_minor": 15000, "currency": "KES"}` = 150.00 KES. Never float. Launch currencies: KES, USD, EUR, GBP. Kenya VAT 16% is the first tax rule row.
- **Timestamps:** RFC 3339 UTC (`2026-11-06T15:00:00Z`). Clients convert to local timezone.
- **Pagination:** cursor-based, deterministic order, bounded `limit` (default 25, max 100 unless documented). Query params: `limit`, `cursor`, `sort`, `filter[...]`, `include`, `fields[...]` (allowlisted per endpoint). List responses include `data[]` and `page.next_cursor` (nullable); cursors are opaque, signed/validated, scoped to filters/tenant. ⚠ Only the `page.next_cursor` field is named in the spec; `has_more` below is a fixture convenience.

  ✅ Example list envelope (single-resource example is verbatim §6.1; list wrapper derived):
  ```json
  {
    "data": [
      {
        "id": "web_01EXAMPLE",
        "type": "website",
        "organization_id": "org_01EXAMPLE",
        "name": "example-site",
        "status": "active",
        "version": 7,
        "created_at": "2026-11-06T15:00:00Z"
      }
    ],
    "page": {"next_cursor": null, "has_more": false},
    "meta": {"request_id": "req_01EXAMPLE"}
  }
  ```
- **Concurrency:** mutable resources SHOULD expose `ETag`; dangerous updates require `If-Match` (mismatch → `412`). Capability/persona-matrix caches send `If-None-Match` with the digest → `304 Not Modified` when unchanged.
- **Error envelope:** `application/problem+json` (RFC 9457 style), stable machine-readable codes. Never expose stack traces, internal paths, SQL or secrets.

  ✅ Example (verbatim §6.2):
  ```json
  {
    "type": "https://docs.nexuspanel.example/problems/quota-exceeded",
    "title": "Quota exceeded",
    "status": 409,
    "code": "QUOTA_EXCEEDED",
    "detail": "The hosting account has reached its website limit.",
    "request_id": "req_01EXAMPLE",
    "errors": [{"field": "hosting_account_id", "code": "LIMIT_REACHED"}]
  }
  ```

  HTTP semantics: `200` read/preview · `201` created · `202` operation accepted (provision, deploy, restore, **payment initiate**) · `204` no body · `400` malformed · `401` unauthenticated · `403` policy denies · `404` not found or cross-tenant concealment · `409` conflict (version/quota/desired state) · `412` ETag mismatch · `422` semantically invalid · `423` locked (resource under conflicting operation) · `429` rate limited (`Retry-After` header) · `5xx` platform/dependency failure with safe retry guidance.

  v2 error codes the frontend must render specially:
  | HTTP | Code | Meaning |
  |---|---|---|
  | 409 | `CAPABILITY_UNAVAILABLE` | Requested workload cannot run on this server (returned with reason + resource delta, e.g. `{required_ram_mb: 200, available_ram_mb: 120}`) |
  | 409 | `WORKLOAD_CATEGORY_MISMATCH` | Operation category doesn't match the resource's (category is immutable) |
  | 409 | `PAYMENT_PENDING` | A payment for this invoice is already pending |
  | 409 | `PAYMENT_ALREADY_RESOLVED` | Payment already confirmed/failed/reversed (duplicate callback, different outcome) |
  | 422 | `CAPABILITY_DEPENDENCY_MISSING` | Prerequisite missing (port 25, Docker, public IP) |
  | 422 | `TEMPLATE_SIGNATURE_INVALID` | Template's signed image reference invalid |
  | 422 | `CGROUP_CONFIG_INVALID` | cgroup config violates workload-category constraints (no `cpuset`; RAM ceiling ≤ physical × 1.2) |
  | 423 | `BATCH_QUEUE_FULL` | Batch queue concurrency limit reached |
  | 429 | `BATCH_YIELDED` | Operation yielded under contention |
  | 503 | `AGENT_UNAVAILABLE` | Local agent unreachable; operation cannot be dispatched |
  | 403 | `FEATURE_DISABLED` | Surface not enabled on this installation/profile (Nano commercial surface, terminal off, provider/reseller on v1) |
  | 409 | `ARTIFACT_EXPIRED` | Rollback artifact garbage-collected |

- **Idempotency:** non-idempotent POST mutations MUST send `Idempotency-Key` (UUID or high-entropy). Server stores key + principal/tenant + request digest + response/operation for a retention window; same key + different payload → `409`. **Payment idempotency is composed:** `(actor_id, invoice_id, amount_minor, provider, idempotency_key)`. Payment callbacks dedupe on provider reference (Daraja `CheckoutRequestID`, Stripe `evt_...`); a duplicate callback returns `200 OK` with the existing state. Batch operations have a separate rate limit (queue depth, not actor).
- **Versioning:** breaking changes → new major version; additive fields/endpoints stay in v1. API schema, docs and SDKs versioned together. Clients MUST ignore unknown response fields but MUST NOT ignore unrecognized operation states.
- **Capability gate ordering (every workload-creating/modifying call):** (1) authenticate → (2) resolve server capability record → (3) unavailable? return `409 CAPABILITY_UNAVAILABLE` with reason + resource delta **before** policy evaluation → (4) policy → (5) quota/entitlement → (6) approval if required → (7) enqueue operation. The agent re-checks capability/ownership/policy at execution time.
- **Personas are UI-only.** The API enforces capabilities/authorization, never personas. `GET /` is not an API router; the SPA composes the landing from `GET /me/persona-matrix` + `GET /me/default-landing` (spec also references `GET /personas/{persona}/surface` as the matrix data source).
- **Allocation ≠ reservation.** Usage endpoints return `allocated` (ceiling), `typical` (7d p50), `peak` (24h p99), `current` (last sample).
- **Workload category is immutable:** `serving` | `batch` | `infrastructure`; set at creation; reclassification → `409 WORKLOAD_CATEGORY_MISMATCH`.

---

## 2. Auth and session

How the SPA authenticates:
- **Web sessions:** HttpOnly, Secure, SameSite cookies; CSRF protection; session rotation; explicit logout/revocation. **No bearer access tokens in browser localStorage.**
- **MFA:** required for privileged actions per policy; challenge/verify flow with attempt limits and short-lived challenges; recovery codes supported (hashed at rest).
- **Step-up authentication:** for sensitive operations; short-lived token bound to action + resource (`POST /me/step-up`).
- **API/service tokens:** hashed at rest, scoped to named capabilities + organization/resource constraints, with expiration/revocation and last-used metadata; secret returned **once** at creation. Provider/reseller tokens cannot exceed their owner's delegated privileges. OAuth/OIDC are optional adapters (open decision).
- **Authorization per request:** principal → acting organization → resource ownership chain → capability → subscription/entitlement → step-up/approval policy. Resource existence is never leaked to unauthorized tenants (404, not 403, cross-tenant).
- **Role labels** (owner, provider, reseller, customer, developer, support, auditor) are UI concepts only; authorization is capability/relationship based.
- Open decision (flagged in spec): exact cookie/session implementation, OIDC strategy, MFA factors.

### Auth endpoints
| Method | Path | Purpose | Guardrails |
|---|---|---|---|
| POST | `/auth/login` | Interactive login | Rate limiting, anti-enumeration |
| POST | `/auth/logout` | End session | CSRF protection |
| POST | `/auth/mfa/challenge` | Begin MFA | Short-lived challenge |
| POST | `/auth/mfa/verify` | Complete MFA | Attempt limits |
| GET | `/me` | Current principal and effective context | No sensitive credentials |
| GET | `/me/sessions` | List sessions | Device metadata redacted |
| DELETE | `/me/sessions/{id}` | Revoke session | Audit event |
| GET | `/api-tokens` | List API tokens | Masked, last-used metadata |
| POST | `/api-tokens` | Create token | Write-only secret, shown once |
| DELETE | `/api-tokens/{id}` | Revoke token | Audit event |
| GET | `/me/capabilities` | Capabilities for this actor on this installation | No secret exposure |
| GET | `/me/persona-matrix` | Persona × capability matrix for the SPA router | Signed data; verify digest |
| GET | `/me/default-landing` | Resolved default landing | Derived from capabilities + org persona |
| POST | `/me/step-up` | Step-up auth for sensitive actions | Short-lived token; binds to action + resource |

---

## 3. Bootstrap endpoints for the SPA

The SPA's first-load sequence: `GET /me` → `GET /me/capabilities` (cache w/ `If-None-Match` digest) → `GET /me/persona-matrix` (verify signature/digest) → `GET /me/default-landing` → compose router client-side. `POST /me/step-up` on demand for sensitive actions. The API returns capability/permission/matrix data — it never returns a "persona decision" for authorization.

### GET /me — current principal and effective context ◆
Shape reconstructed from documented fields (Stage 5 `identity.*` / `tenancy.*`).
```json
{
  "data": {
    "id": "usr_01EXAMPLE",
    "email": "jane@example.com",
    "display_name": "Jane W.",
    "status": "active",
    "mfa_enabled": true,
    "effective_context": {
      "organization": {
        "id": "org_01EXAMPLE",
        "slug": "janes-vps",
        "organization_type": "standalone",
        "primary_persona": "self_hoster",
        "branding": {"logo_url": null, "colors": {}, "domain": null}
      },
      "memberships": [
        {"organization_id": "org_01EXAMPLE", "state": "active", "persona_override": null}
      ],
      "role_labels": ["owner"],
      "step_up_required_for": ["hosting-account.suspend", "database.delete"]
    }
  },
  "meta": {"request_id": "req_01EXAMPLE"}
}
```

### GET /me/capabilities — what this actor can do on this installation ◆
Derived from server capability set × actor's permission set. Two dimensions: API permission scopes (authorization) and installation capability keys (what the server can run), each with state/reason. Includes `data_version` + `digest` for caching (`If-None-Match` → `304`).
```json
{
  "data": {
    "data_version": "2026-11-06.3",
    "digest": "sha256:9f1c…",
    "permissions": ["server.read", "server.manage", "website.deploy", "domain.dns.write",
                     "backup.restore", "billing.read", "audit.read", "service.create",
                     "capability.read", "template.deploy", "workload.usage.read"],
    "server_capabilities": [
      {"capability_key": "website.static", "workload_category": "serving", "state": "available", "reason": null},
      {"capability_key": "app.node", "workload_category": "serving", "state": "borderline", "reason": "RAM floor 200 MB exceeds comfortable headroom"},
      {"capability_key": "db.mariadb", "workload_category": "serving", "state": "unavailable", "reason": "No room for MariaDB container"}
    ]
  },
  "meta": {"request_id": "req_01EXAMPLE"}
}
```

### GET /me/persona-matrix — the router's source of truth ◆ (signed)
Data comes from `inventory.persona_capability_matrix` (persona × capability_key × surface). **Signed data; clients MUST verify the digest**; tampered/unsigned matrix is rejected at load (conformance API-043). Surfaces: `default_landing` | `visible_menu` | `hidden`.
```json
{
  "data": {
    "persona": "self_hoster",
    "rows": [
      {"capability_key": "website.static", "surface": "default_landing", "notes": null},
      {"capability_key": "app.node", "surface": "visible_menu", "notes": null},
      {"capability_key": "service.storage", "surface": "visible_menu", "notes": null},
      {"capability_key": "db.mariadb", "surface": "hidden", "notes": "unavailable on this server"}
    ],
    "data_version": "2026-11-06.3",
    "digest": "sha256:4ab2…",
    "signature": "ed25519:bb31…",
    "signature_algorithm": "ed25519"
  },
  "meta": {"request_id": "req_01EXAMPLE"}
}
```

### GET /me/default-landing — resolved landing for first load ✅ (values verbatim)
Returns `router` | `portfolio` | `fleet`. Derived from `me.capabilities` and `tenancy.organizations.primary_persona`. Conformance test API-046: correct landing for each persona. The SPA calls this on first load to decide whether to render the router or the portfolio.
```json
{
  "data": {
    "default_landing": "router",
    "persona": "explorer",
    "organization_primary_persona": null,
    "basis": {"capabilities_matched": 4, "persona_matrix_version": "2026-11-06.3"}
  },
  "meta": {"request_id": "req_01EXAMPLE"}
}
```

### POST /me/step-up — step-up authentication ◆
Short-lived token; binds to action + resource. Consumed by the subsequent sensitive request.
```json
// request
{"action": "hosting-account.suspend", "resource_id": "acct_01EXAMPLE", "mfa_code": "123456"}
// response
{
  "data": {
    "step_up_token": "sud_01EXAMPLE",
    "bound_action": "hosting-account.suspend",
    "bound_resource_id": "acct_01EXAMPLE",
    "expires_at": "2026-11-06T15:10:00Z"
  },
  "meta": {"request_id": "req_01EXAMPLE"}
}
```

---

## 4. Endpoint groups per module

Every endpoint group in the spec, with a compact representative response per endpoint. Paths are relative to `/api/v1`. ⚠ Deferred/gated endpoints return the error shown even though the path exists on v1 installations.

### 4.1 Operations (async engine)
- `GET /operations/{id}` — status, steps, outcome, safe error. → ✅ `{"data":{"id":"op_01EXAMPLE","kind":"website.provision","status":"queued","resource":{"type":"website","id":"web_01EXAMPLE"},"requested_by":"usr_01EXAMPLE","workload_category":"serving","progress":{"completed_steps":0,"total_steps":5},"created_at":"2026-11-06T15:00:00Z"}}`
- `GET /operations/{id}/events` — resumable SSE status stream (see §5). → ◆ `{"data":{"operation_id":"op_01EXAMPLE","stream":"sse","resume_from":"evt_01EXAMPLE"}}`
- `POST /operations/{id}/cancel` — request cancellation if safe (best-effort; cannot promise reversal of committed changes). → ◆ `{"data":{"id":"op_01EXAMPLE","status":"cancelled","cancel_requested_at":"2026-11-06T15:03:00Z"}}`
- `POST /operations/{id}/retry` — retry eligible failed operation (creates an attempt, not a duplicate resource). → ◆ `{"data":{"id":"op_01JEXAMPLE2","kind":"website.provision","status":"queued","retry_of":"op_01EXAMPLE","attempt":2}}`
- `GET /operations?resource_id=...` — filtered operation history. → ◆ `{"data":[{"id":"op_01EXAMPLE","kind":"website.provision","status":"succeeded","resource_id":"web_01EXAMPLE","created_at":"2026-11-06T15:00:00Z"}],"page":{"next_cursor":null}}`
- `GET /operations/{id}/logs` — redacted execution diagnostics. → ◆ `{"data":{"operation_id":"op_01EXAMPLE","lines":[{"ts":"2026-11-06T15:01:10Z","step":"nginx.apply","message":"config validated"}]}}`
- `GET /operations?workload_category=batch` — batch operations with queue state. → ◆ `{"data":[{"id":"op_01BEXAMPLE","kind":"backup.create","workload_category":"batch","status":"queued","queue_position":3}],"page":{"next_cursor":null}}`
- `GET /batch-queue` — current batch queue with positions and estimated start times. → ◆ `{"data":[{"operation_id":"op_01BEXAMPLE","kind":"app.build","priority":10,"position":1,"estimated_start":"2026-11-06T15:20:00Z","yielding_reason":null}]}`
- `POST /operations/{id}/yield` — request the operation to yield (returns to queue). → ◆ `{"data":{"id":"op_01BEXAMPLE","status":"queued","yielded_at":"2026-11-06T15:05:00Z","yielding_reason":"serving_workload_contention"}}`
- `POST /operations/{id}/prioritize` — move earlier in batch queue (admin only, bounded; never promotes to serving). → ◆ `{"data":{"operation_id":"op_01BEXAMPLE","position":1}}`

Batch operation detail (GET /operations/{id} for a batch job) also returns ✅ `{"queue_position": 3, "estimated_start": "2026-11-06T15:20:00Z", "yielding_reason": "serving_workload_contention"}`.

### 4.2 Plans (preflight / plan / approve / apply / verify)
For impactful changes (firewall, DNS delegation, destructive DB actions, restore, suspension, bulk ops).
- `POST /plans` — generate a plan (capability preflight runs automatically; unavailable → `CAPABILITY_UNAVAILABLE` with no plan). → ◆ `{"data":{"id":"plan_01EXAMPLE","capability_decision":{"state":"available","reason":null},"resource_fit":{"ram_floor_mb":128,"ram_typical_mb":180,"ram_ceiling_mb":512,"cpu_weight":100,"cpu_max":null,"current_usage":{"ram_mb":420},"delta_after":{"ram_mb":600}},"estimated_downtime_class":"none","rollback_strategy":"last-known-good config","estimated_queue_time":null,"yielding_policy":null,"expires_at":"2026-11-06T15:30:00Z"}}`
- `GET /plans/{id}` — read plan/diff/impact. → ◆ `{"data":{"id":"plan_01EXAMPLE","status":"pending_approval","diff_summary":"2 records changed","plan_hash":"sha256:71aa…"}}`
- `POST /plans/{id}/approve` — approve (bound to plan hash, actor, scope, expiry; step-up; may require second approver). → ◆ `{"data":{"id":"plan_01EXAMPLE","approval":{"approver_id":"usr_01EXAMPLE","decision":"approved","plan_hash":"sha256:71aa…","expires_at":"2026-11-06T16:00:00Z"}}}`
- `POST /plans/{id}/apply` — execute only the approved plan version, with idempotency key. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","plan_id":"plan_01EXAMPLE","status":"queued"}}`

### 4.3 Identity, organizations, teams, invitations
- `GET /organizations` — list organizations. → ◆ `{"data":[{"id":"org_01EXAMPLE","slug":"janes-vps","organization_type":"standalone","status":"active","primary_persona":"self_hoster"}],"page":{"next_cursor":null}}`
- `POST /organizations` — create organization. → `201` ◆ `{"data":{"id":"org_01EXAMPLE","slug":"janes-vps","organization_type":"standalone","status":"active"}}`
- `GET /organizations/{id}` — read organization. → ◆ `{"data":{"id":"org_01EXAMPLE","slug":"janes-vps","organization_type":"standalone","primary_persona":"self_hoster","branding":{"logo_url":null,"colors":{},"domain":null},"version":3}}`
- `PATCH /organizations/{id}` — update organization. → ◆ `{"data":{"id":"org_01EXAMPLE","primary_persona":"app_developer","version":4}}`
- `GET /organizations/{id}/members` — list membership. → ◆ `{"data":[{"id":"mem_01EXAMPLE","user_id":"usr_01EXAMPLE","state":"active","persona_override":null}],"page":{"next_cursor":null}}`
- `POST /organizations/{id}/members` — add membership. → `201` ◆ `{"data":{"id":"mem_01EXAMPLE","user_id":"usr_01EXAMPLE","state":"active"}}`
- `PATCH /organizations/{id}/members/{id}` — change membership (role/scope/persona). → ◆ `{"data":{"id":"mem_01EXAMPLE","state":"active","persona_override":"app_developer"}}`
- `DELETE /organizations/{id}/members/{id}` — revoke membership (invalidates derived sessions/tokens per policy). → `204`
- `GET /organizations/{id}/invitations` — list invitations. → ◆ `{"data":[{"id":"inv_01EXAMPLE","invitee_email":"dev@example.com","expires_at":"2026-11-13T15:00:00Z","state":"pending"}]}` (invitations are single-use, expiring, never above inviter's delegable scope)
- `POST /organizations/{id}/invitations` — invite. → `201` ◆ `{"data":{"id":"inv_01EXAMPLE","invitee_email":"dev@example.com","expires_at":"2026-11-13T15:00:00Z"}}`
- `POST /invitations/{token}/accept` — accept bounded invitation. → ◆ `{"data":{"membership_id":"mem_01EXAMPLE","organization_id":"org_01EXAMPLE","state":"active"}}`
- `GET /organizations/{id}/effective-permissions` — UI permission discovery. → ◆ `{"data":{"organization_id":"org_01EXAMPLE","permissions":["website.deploy","domain.dns.write","billing.read"],"policy_version":"pv_7"}}`
- `GET /organizations/{id}/teams` — list teams. → ◆ `{"data":[{"id":"team_01EXAMPLE","name":"platform","member_count":3}]}`
- `POST /organizations/{id}/teams` — create team. → `201` ◆ `{"data":{"id":"team_01EXAMPLE","name":"platform"}}`
- `GET /organizations/{id}/service-accounts` — list automation identities. → ◆ `{"data":[{"id":"svc_01EXAMPLE","name":"ci-bot","scopes":["website.deploy"],"last_used_at":"2026-11-05T09:00:00Z"}]}`
- `POST /organizations/{id}/service-accounts` — create automation identity. → `201` ◆ `{"data":{"id":"svc_01EXAMPLE","token_secret":"nxs_…one-time…"}}`
- `GET /organizations/{id}/persona` — the org's default persona (router landing hint). → ◆ `{"data":{"organization_id":"org_01EXAMPLE","primary_persona":"app_developer"}}`
- `PATCH /organizations/{id}/persona` — set default persona (UX hint only; grants/denies nothing). → ◆ `{"data":{"organization_id":"org_01EXAMPLE","primary_persona":"app_developer"}}`
- `PATCH /organizations/{id}/members/{id}/persona` — per-membership persona override. → ◆ `{"data":{"id":"mem_01EXAMPLE","persona_override":"self_hoster"}}`
- `GET /organizations/{id}/branding` — white-label branding (v2+). → ◆ `{"data":{"logo_url":null,"colors":{},"domain":null}}`
- `POST /organizations/{id}/branding` — set branding (data-only; no authorization effect). → `201` ◆ `{"data":{"logo_url":"https://…/logo.png","colors":{"primary":"#0a7"}}}`

### 4.4 Provider, reseller, hosting accounts
⚠ On Nano / v1 installations this commercial surface returns `403 FEATURE_DISABLED` (data model complete, API gated).
- `GET /providers/{id}/resellers` — list delegated reseller relationships. → ◆ `{"data":[{"id":"res_01EXAMPLE","grantee_org_id":"org_01R","scope":{"max_accounts":50},"expiry":"2027-01-01T00:00:00Z"}]}`
- `POST /providers/{id}/resellers` — delegate reseller relationship (no cycles, no escalation). → `201` ◆ `{"data":{"id":"res_01EXAMPLE","grantee_org_id":"org_01R"}}`
- `GET /providers/{id}/hosting-packages` — list package templates (immutable published revisions). → ◆ `{"data":[{"id":"pkg_01EXAMPLE","name":"basic","revision":4,"status":"published"}]}`
- `POST /providers/{id}/hosting-packages` — manage package templates. → `201` ◆ `{"data":{"id":"pkg_01EXAMPLE","name":"basic","revision":5,"status":"draft"}}`
- `GET /resellers/{id}/customers` — manage delegated customers. → ◆ `{"data":[{"id":"org_01C","slug":"customer-a","organization_type":"customer"}]}`
- `POST /resellers/{id}/customers` — create delegated customer. → `201` ◆ `{"data":{"id":"org_01C","organization_type":"customer"}}`
- `GET /hosting-accounts` — list hosting accounts. → ◆ `{"data":[{"id":"acct_01EXAMPLE","organization_id":"org_01EXAMPLE","package_revision_id":"pkg_01EXAMPLE","state":"active"}],"page":{"next_cursor":null}}`
- `POST /hosting-accounts` — create hosting account. → `202` ◆ `{"data":{"id":"acct_01EXAMPLE","state":"provisioning","operation_id":"op_01EXAMPLE"}}`
- `GET /hosting-accounts/{id}` — read account. → ◆ `{"data":{"id":"acct_01EXAMPLE","state":"active","owner_user_id":"usr_01EXAMPLE","package_revision_id":"pkg_01EXAMPLE"}}`
- `PATCH /hosting-accounts/{id}` — update account. → ◆ `{"data":{"id":"acct_01EXAMPLE","state":"active","version":9}}`
- `POST /hosting-accounts/{id}/suspend` — suspend with plan/approval. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","plan_id":"plan_01EXAMPLE","state":"suspended"}}`
- `POST /hosting-accounts/{id}/unsuspend` — restore service. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","state":"active"}}`
- `GET /hosting-accounts/{id}/quotas` — limits, reservations, usage. → ◆ `{"data":{"quotas":[{"metric_key":"websites","limit":10,"allocated":4,"reserved":1,"consumed":3},{"metric_key":"storage_bytes","limit":53687091200,"allocated":10737418240,"consumed":5368709120}]}}`
- `POST /hosting-accounts/{id}/transfer` — governed ownership transfer. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","to_organization_id":"org_01C","status":"queued"}}`

### 4.5 Servers, clusters, agents, capabilities, usage
- `GET /servers` — list managed nodes. → ◆ `{"data":[{"id":"srv_01EXAMPLE","hostname":"panel-host","state":"active","agent_connected":true}]}`
- `POST /servers` — register node. → `201` ◆ `{"data":{"id":"srv_01EXAMPLE","hostname":"panel-host","state":"registration"}}`
- `GET /servers/{id}` — metadata and scheduling labels. → ◆ `{"data":{"id":"srv_01EXAMPLE","hostname":"panel-host","management_address":"10.0.0.5","state":"active","labels":{"profile":"nano"}}}`
- `PATCH /servers/{id}` — update metadata/labels. → ◆ `{"data":{"id":"srv_01EXAMPLE","labels":{"profile":"nano","tier":"standard"}}}`
- `GET /servers/{id}/inventory` — OS, services, runtime inventory. → ◆ `{"data":{"os":"Ubuntu 26.04","cpu_cores":4,"ram_bytes":6442450944,"disk_bytes":85899345920,"services":["nginx","php-fpm8.4"],"agent_version":"1.4.2"}}`
- `GET /servers/{id}/health` — heartbeat, connectivity, capacity. → ◆ `{"data":{"state":"active","heartbeat_at":"2026-11-06T14:59:40Z","connectivity":"ok","capacity":{"ram_free_bytes":2147483648,"disk_free_bytes":42949672960}}}`
- `GET /server-pools` — list server groups. → ◆ `{"data":[{"id":"pool_01EXAMPLE","name":"eu-fleet","server_count":3}]}`
- `POST /server-pools` — group eligible servers. → `201` ◆ `{"data":{"id":"pool_01EXAMPLE","name":"eu-fleet"}}`
- `GET /server-pools/{id}/capacity` — aggregated placement capacity. → ◆ `{"data":{"servers":3,"ram_available_bytes":12884901888,"placement_headroom":{"serving":2,"batch":8}}}`
- `POST /agents/enrollment-tokens` — short-lived one-time enrollment token (v1: local agent auto-enrolls via Unix socket; full flow is v2+ mTLS). → `201` ◆ `{"data":{"token":"aet_…one-time…","expires_at":"2026-11-06T16:00:00Z"}}`
- `POST /servers/{id}/drain` — stop new placements, migrate where supported. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","state":"draining"}}`
- `POST /servers/{id}/maintenance` — schedule maintenance state. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","state":"maintenance","window":{"from":"2026-11-07T01:00:00Z","to":"2026-11-07T03:00:00Z"}}}`
- `GET /servers/{id}/capabilities` — the server's capability set (from `inventory.capabilities`). → ◆ `{"data":{"server_id":"srv_01EXAMPLE","source_digest":"sha256:9f1c…","capabilities":[{"capability_key":"website.static","state":"available","reason":null},{"capability_key":"app.node","state":"unavailable","reason":"RAM floor exceeds available headroom"},{"capability_key":"service.docker","state":"unavailable","reason":"Not available on this profile"}]}}`
- `POST /servers/{id}/capabilities/rescan` — trigger hardware re-detection (after VPS upgrade). → `202` ✅-ish `{"data":{"operation_id":"op_01RESCAN","status":"queued","kind":"capability.rescan"}}`
- `POST /servers/{id}/capabilities/apply` — apply the accepted rescan diff (from workflow §28.8). → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","applied":{"new_available":["app.node","db.mariadb","service.docker"]}}}`
- `GET /servers/{id}/capabilities/data-version` — version/digest of the capability data file. → ◆ `{"data":{"version":"2026-11-06.3","digest":"sha256:9f1c…","detected_at":"2026-11-06T09:00:00Z"}}`
- `GET /servers/{id}/capabilities/{key}` — single capability detail (floor/typical/ceiling, category, prerequisites, state, reason). → ◆ `{"data":{"capability_key":"app.node","workload_category":"serving","ram_floor_bytes":209715200,"ram_typical_bytes":268435456,"ram_ceiling_bytes":536870912,"cpu_weight":100,"cpu_max_millicores":null,"disk_floor_bytes":1073741824,"prerequisites":{"docker":false,"port_25":false,"public_ip":true},"state":"borderline","reason":"RAM floor 200 MB vs 120 MB headroom","detected_at":"2026-11-06T09:00:00Z","source_digest":"sha256:9f1c…"}}`
- `GET /servers/{id}/usage` — server-level allocation/typical/peak/current. → ◆ `{"data":{"allocated":{"ram_max_bytes":6442450944,"cpu_weight":400,"cpu_max_millicores":null},"current":{"ram_bytes":2147483648,"cpu_percent":12.5},"typical_7d":{"ram_bytes":2684354560,"cpu_percent":18.0},"peak_24h":{"ram_bytes":4294967296,"cpu_percent":61.0}}}`
- `GET /resources/{id}/usage` — per-workload usage metrics (shape verbatim §21 v2). → ✅ `{"allocated": {"ram_max_bytes": 536870912, "cpu_weight": 100, "cpu_max_millicores": null}, "current": {"ram_bytes": 268435456, "cpu_percent": 8.1}, "typical_7d": {"ram_bytes": 322122547, "cpu_percent": 11.4}, "peak_24h": {"ram_bytes": 503316480, "cpu_percent": 44.2}, "throttled_seconds_24h": 0, "oom_kills_7d": 0}`
- `GET /servers/{id}/cgroup-metrics` — raw cgroup time-series (power users/debugging). → ◆ `{"data":[{"period_start":"2026-11-06T14:00:00Z","cpu_usage_usec":1840000,"cpu_throttled_usec":0,"memory_current_bytes":268435456,"memory_peak_bytes":301989888,"memory_oom_kill_count":0,"pids_current":42}]}`
- `POST /resources/{id}/limits` — adjust cgroup ceiling; creates an operation of kind `resource.limit.update` that verifies the value applied before succeeding. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","kind":"resource.limit.update","before":{"memory_max_bytes":536870912},"after":{"memory_max_bytes":1073741824}}}`
- `GET /capabilities/data-version` — global capability + persona-matrix data version (conventions §3 v2). → ◆ `{"data":{"version":"2026-11-06.3","digest":"sha256:9f1c…"}}`
- `GET /personas/{persona}/surface` — persona matrix surface data referenced by the router principle. → ◆ `{"data":{"persona":"explorer","rows":[{"capability_key":"website.static","surface":"default_landing"}],"data_version":"2026-11-06.3"}}`

### 4.6 Websites, domains, routing
- `GET /websites` — list sites. → ✅-style `{"data":[{"id":"web_01EXAMPLE","type":"website","organization_id":"org_01EXAMPLE","name":"example-site","status":"active","version":7,"created_at":"2026-11-06T15:00:00Z"}],"page":{"next_cursor":null}}`
- `POST /websites` — provision site; `runtime` param validated against server capability set (`CAPABILITY_UNAVAILABLE` if unsupported). → `202` ◆ `{"data":{"id":"web_01EXAMPLE","status":"provisioning","operation_id":"op_01EXAMPLE"}}`
- `GET /websites/{id}` — inspect site. → ✅ `{"data":{"id":"web_01EXAMPLE","type":"website","organization_id":"org_01EXAMPLE","name":"example-site","status":"active","version":7,"created_at":"2026-11-06T15:00:00Z"},"meta":{"request_id":"req_01EXAMPLE"}}`
- `PATCH /websites/{id}` — change site (via operation). → `202` ◆ `{"data":{"id":"web_01EXAMPLE","version":8,"operation_id":"op_01EXAMPLE"}}`
- `DELETE /websites/{id}` — delete via operation. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","status":"queued"}}`
- `POST /websites/{id}/preview` — validate web server changes (dry-run). → ◆ `{"data":{"valid":true,"errors":[],"config_diff":[{"path":"server_name","from":"old.example.com","to":"new.example.com"}]}}`
- `POST /websites/{id}/publish` — apply routing/configuration (tested before reload; last-known-good preserved; TLS readiness reported independently of DNS readiness). → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","tls_ready":true,"dns_ready":false}}`
- `GET /websites/{id}/bindings` — hostnames and routing. → ◆ `{"data":[{"id":"bnd_01EXAMPLE","hostname":"www.example.com","is_primary":true,"website_id":"web_01EXAMPLE"}]}`
- `POST /websites/{id}/bindings` — add hostname binding (ownership + uniqueness enforced across tenants; wildcard/apex verified separately). → `201` ◆ `{"data":{"id":"bnd_01EXAMPLE","hostname":"app.example.com","is_primary":false}}`
- `POST /websites/{id}/redirects` — redirect rules (loop-validated). → `201` ◆ `{"data":{"id":"rdr_01EXAMPLE","match":"http://example.com/$","destination":"https://example.com/$1","priority":10}}`
- `GET /websites/{id}/traffic` — authorized metrics. → ◆ `{"data":{"window":"24h","requests":152340,"bytes_sent":5368709120,"top_paths":[{"/":98210}]}}`
- `GET /websites/{id}/capabilities` — the site's capability subset (PHP? Node? DB? Docker?). → ◆ `{"data":{"php":true,"node":false,"database":false,"docker":false}}`
- `GET /websites/{id}/batch-jobs` — the site's batch jobs (builds, backups, transforms). → ◆ `{"data":[{"operation_id":"op_01BEXAMPLE","kind":"app.build","status":"queued","queue_position":2}]}`
- `GET /domains` — list domain resources. → ◆ `{"data":[{"id":"dom_01EXAMPLE","fqdn":"example.com","verification_state":"verified","registrar_mode":"external_manual"}]}`
- `POST /domains` — register domain resource/ownership. → `201` ◆ `{"data":{"id":"dom_01EXAMPLE","fqdn":"example.com","verification_state":"pending"}}`
- `POST /domains/{id}/verify` — domain ownership verification (distinct from registrar delegation and cert validation). → ◆ `{"data":{"id":"dom_01EXAMPLE","verification_state":"verified","method":"dns_txt"}}`

### 4.7 Applications, runtimes, deployments, environment, Git
- `GET /applications` — list applications. → ◆ `{"data":[{"id":"app_01EXAMPLE","name":"api","runtime_kind":"node","account_id":"acct_01EXAMPLE","container_id":"c_01A","build_container_id":null}]}`
- `POST /applications` — create the runtime (a **serving** workload; `runtime` capability-checked → `CAPABILITY_UNAVAILABLE` with `{required_ram_mb:200, available_ram_mb:120}`). → `202` ◆ `{"data":{"id":"app_01EXAMPLE","operation_id":"op_01EXAMPLE"}}`
- `GET /applications/{id}` — settings, runtime, start command. → ◆ `{"data":{"id":"app_01EXAMPLE","runtime_kind":"node","entrypoint":"dist/main.js","start_command":"node dist/main.js","container_id":"c_01A"}}`
- `PATCH /applications/{id}` — update settings. → ◆ `{"data":{"id":"app_01EXAMPLE","entrypoint":"dist/server.js","version":4}}`
- `GET /runtimes/catalog` — OS/server-compatible runtime versions. → ◆ `{"data":[{"runtime_kind":"node","version":"22 LTS","support_state":"supported"},{"runtime_kind":"php","version":"8.4","support_state":"supported"}]}`
- `POST /applications/{id}/deployments` — deploy from Git ref/upload/artifact; creates a **batch** build then a serving release. → `202` ◆ `{"data":{"id":"dep_01EXAMPLE","status":"queued","workload_category":"batch","operation_id":"op_01EXAMPLE"}}`
- `GET /applications/{id}/deployments` — history and statuses. → ◆ `{"data":[{"id":"dep_01EXAMPLE","release_id":"rel_01EXAMPLE","status":"succeeded","created_at":"2026-11-06T12:00:00Z"}]}`
- `POST /deployments/{id}/rollback` — revert to retained release (immutable, references artifact digest; `ARTIFACT_EXPIRED` if GC'd). → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","rollback_to_release_id":"rel_00EXAMPLE","artifact_digest":"sha256:12cd…"}}`
- `GET /applications/{id}/logs` — scoped/redacted logs (credentials masked). → ◆ `{"data":{"lines":[{"ts":"2026-11-06T15:01:00Z","level":"info","message":"listening on :3000"}]}}`
- `POST /applications/{id}/actions/restart` — restart managed process. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","status":"queued"}}`
- `GET /applications/{id}/environment` — masked metadata (secrets never returned after persistence). → ◆ `{"data":{"variables":[{"key":"DATABASE_URL","is_secret":true,"set_at":"2026-11-05T10:00:00Z"},{"key":"NODE_ENV","is_secret":false,"value":"production"}]}}`
- `PUT /applications/{id}/environment` — write-only values (write-only secret inputs). → ◆ `{"data":{"updated":["DATABASE_URL"],"version":6}}`
- `POST /applications/{id}/environment/parse` — parse pasted `.env` text for preview (preserves quotes/escaped newlines/comments; rejects duplicate/invalid keys; never echoes secret values). → ◆ `{"data":{"parsed":[{"key":"NODE_ENV","value":"production"}],"errors":[{"line":4,"error":"duplicate key"}]}}`
- `POST /applications/{id}/environment/import` — apply validated bulk variables. → ◆ `{"data":{"imported":12,"secrets_encrypted":5,"version":7}}`
- `GET /applications/{id}/git-connections` — authorized repository connections. → ◆ `{"data":[{"id":"git_01EXAMPLE","provider":"github","repository_ref":"org/repo","credential_ref":"sec_01EXAMPLE"}]}`
- `POST /applications/{id}/git-connections` — connect repository (scoped credentials). → `201` ◆ `{"data":{"id":"git_01EXAMPLE","provider":"github","repository_ref":"org/repo"}}`

### 4.8 Files, uploads, terminal, SFTP
File ops scoped to an explicit hosting account + permitted root; container-aware paths (user-visible container paths, e.g. `/app/wp-content/uploads`; agent maps host paths).
- `GET /hosting-accounts/{id}/files?path=...` — directory listing. → ◆ `{"data":{"path":"/app/wp-content/uploads","entries":[{"name":"2026","type":"directory","size_bytes":null,"modified_at":"2026-11-01T10:00:00Z"},{"name":"logo.png","type":"file","size_bytes":24680,"modified_at":"2026-11-03T09:30:00Z"}]}}`
- `GET /hosting-accounts/{id}/file-content?path=...` — read authorized file. → ◆ `{"data":{"path":"/app/index.php","content_base64":"PD9waHAg…","version":3,"size_bytes":512}}`
- `PUT /hosting-accounts/{id}/file-content?path=...` — atomic write with version precondition. → ◆ `{"data":{"path":"/app/index.php","version":4}}`
- `POST /hosting-accounts/{id}/file-operations` — move/copy/rename/delete/chmod/archive. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","action":"move","status":"queued"}}`
- `POST /hosting-accounts/{id}/uploads` — initiate bounded upload. → `201` ◆ `{"data":{"id":"up_01EXAMPLE","upload_url":"/api/v1/uploads/up_01EXAMPLE/parts","max_bytes":104857600}}`
- `POST /uploads/{id}/complete` — validate checksum and finalize. → ◆ `{"data":{"id":"up_01EXAMPLE","path":"/app/uploads/logo.png","checksum":"sha256:77aa…","status":"finalized"}}`
- `POST /hosting-accounts/{id}/terminal-sessions` — governed interactive terminal (time-limited, audited). ⚠ `403 FEATURE_DISABLED` unless owner enabled it; on Nano `409 CAPABILITY_UNAVAILABLE` ("No container to exec into"). → ◆ `{"data":{"session_id":"term_01EXAMPLE","expires_at":"2026-11-06T16:00:00Z"}}`
- `GET /hosting-accounts/{id}/sftp-credentials` — managed SFTP endpoint credentials (primary transfer path on Nano). → ◆ `{"data":{"host":"sftp.panel-host","port":22,"username":"acct_01EXAMPLE_web","password_once":"…shown once…"}}`

### 4.9 Databases (v1: read-only view over ServiceTemplate instances)
⚠ `/databases` is a read-only convenience view of `/service-instances` where `template.category = "database"`; creation uses `POST /service-instances` with `template_id` `database.mariadb` / `database.postgres`. On Nano: ✅ `{"data": [], "meta": {"capability_unavailable": true, "reason": "No room for MariaDB/Postgres container"}}`.
- `GET /database-instances` — provider-managed database services. → ◆ `{"data":[]}` (v1: DB services are service instances; this family is v1-schema-complete, API gated)
- `POST /database-instances` — create provider-managed instance. → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE"}}`
- `GET /databases` — list tenant databases (filtered service instances). → ◆ `{"data":[{"id":"svc_01DBEXAMPLE","display_name":"app-db","template_key":"database.mariadb","state":"running","hostname":"db.name.panel-host"}]}`
- `POST /databases` — ⚠ creation is redirected to `POST /service-instances` (`template_id` = `database.mariadb`/`database.postgres`). → `400`/`409` guidance or proxied `202` ◆ `{"data":{"service_instance_id":"svc_01DBEXAMPLE","operation_id":"op_01EXAMPLE"}}`
- `GET /databases/{id}` — metadata, limits. → ◆ `{"data":{"id":"db_01EXAMPLE","logical_name":"app","engine":"mariadb","state":"active","container_id":"c_01D","volume_id":"vol_01D"}}`
- `PATCH /databases/{id}` — update metadata/limits. → ◆ `{"data":{"id":"db_01EXAMPLE","version":2}}`
- `DELETE /databases/{id}` — governed deletion (impact preview + backup policy checks). → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE"}}`
- `GET /databases/{id}/users` — scoped database principals. → ◆ `{"data":[{"id":"dbu_01EXAMPLE","principal_name":"app_user","grants":["SELECT","INSERT"]}]}`
- `POST /databases/{id}/users` — create principal (least privilege; no global superuser ever). → `201` ◆ `{"data":{"id":"dbu_01EXAMPLE","principal_name":"app_user","secret_once":"…"}}`
- `POST /database-users/{id}/rotate-password` — write-only new credential. → ◆ `{"data":{"id":"dbu_01EXAMPLE","rotated_at":"2026-11-06T15:00:00Z"}}`
- `POST /databases/{id}/backups` — backup request (**batch** operation). → `202` ◆ `{"data":{"operation_id":"op_01BEXAMPLE","workload_category":"batch"}}`
- `POST /databases/{id}/restore` — governed restore (batch; verified by a real query against the restored DB). → `202` ◆ `{"data":{"operation_id":"op_01BEXAMPLE","plan_id":"plan_01EXAMPLE"}}`
- `GET /databases/{id}/connection-info` — non-secret host/port metadata. → ◆ `{"data":{"host":"db.name.panel-host","port":3306,"database":"app","tls":true}}`

### 4.10 DNS (v1 = guidance mode) and TLS
⚠ Authoritative DNS `/dns/zones` is **deferred to v2+**; on v1: `409 CAPABILITY_UNAVAILABLE` ("Authoritative DNS hosting is coming in v2. Use DNS guidance."). DNS modes: `external_manual` (v1), `external_api` (future), `local_authoritative` (v2+). Certificates use **HTTP-01 in v1** (DNS-01/wildcard deferred to v2+).
- `GET /dns/zones` — list managed zones. ⚠ v1 → `409` `{"type":"…capability-unavailable","code":"CAPABILITY_UNAVAILABLE","detail":"Authoritative DNS hosting is coming in v2. Use DNS guidance."}`
- `POST /dns/zones` — create zone. ⚠ v1 → same `409 CAPABILITY_UNAVAILABLE`.
- `GET /dns/zones/{id}/records` — list records. ⚠ v1 → same `409`.
- `POST /dns/zones/{id}/records` — add record. ⚠ v1 → same `409`.
- `PATCH /dns/records/{id}` — change record. ⚠ v1 → same `409`.
- `DELETE /dns/records/{id}` — remove record. ⚠ v1 → same `409`.
- `POST /dns/zones/{id}/preview` — validate proposed zone change. ⚠ v1 → same `409`.
- `POST /dns/zones/{id}/publish` — versioned zone publication. ⚠ v1 → same `409`.
- `GET /dns/zones/{id}/health` — SOA/NS/secondary propagation checks. ⚠ v1 → same `409`.
- `GET /domains/{id}/dns-guidance` — **the v1 DNS API**: exact records to add at the registrar + instructions (source of truth UX-DNS-014). → ✅-shape `{"data":{"domain":"example.com","records":[{"type":"A","name":"@","value":"203.0.113.10"},{"type":"CNAME","name":"www","value":"example.com"}],"instructions":"Add these records at your registrar…","registrar_hint":"…","propagation_state":"pending","last_checked_at":null}}`
- `POST /domains/{id}/dns-guidance/check` — poll for propagation; returns observed state; never claims "live" before the check succeeds. → ✅-shape `{"data":{"propagated":false,"checked":[{"resolver":"1.1.1.1","expected":"203.0.113.10","observed":null,"match":false}],"checked_at":"2026-11-06T15:05:00Z"}}`
- `GET /domains/{id}/delegation-check` — external registrar NS preflight. → ◆ `{"data":{"domain":"example.com","nameservers":["ns1.registrar.example"],"delegated":false,"checked_at":"2026-11-06T15:00:00Z"}}`
- `POST /domains/{id}/ptr-request` — PTR coordination is a provider integration (ticket-style record; panel never claims it set PTR). → `201` ◆ `{"data":{"id":"ptr_01EXAMPLE","ip":"203.0.113.10","ptr":"panel-host.example.com","status":"submitted","guidance":"Set PTR in your VPS provider's control panel."}}`
- `GET /certificates` — certificates and issuance requests. → ◆ `{"data":[{"id":"crt_01EXAMPLE","names":["example.com"],"issuer":"letsencrypt","status":"active","expiry":"2027-02-06T00:00:00Z","challenge_type":"http-01"}]}`
- `POST /certificates` — request issuance (HTTP-01 in v1; private keys never in ordinary reads). → `202` ◆ `{"data":{"id":"crt_01EXAMPLE","status":"pending_validation","operation_id":"op_01EXAMPLE"}}`
- `POST /certificates/{id}/renew` — controlled renewal. → `202` ◆ `{"data":{"id":"crt_01EXAMPLE","status":"renewing","operation_id":"op_01EXAMPLE"}}`
- `GET /certificates/{id}/status` — expiry and validation status. → ◆ `{"data":{"id":"crt_01EXAMPLE","status":"active","expiry":"2027-02-06T00:00:00Z","last_renewal_attempt_at":"2026-11-05T03:00:00Z","validation_state":"valid"}}`

### 4.11 Email (v1 = external SMTP only)
⚠ `/mail-domains`, `/mailboxes`, `/mail-domains/{id}/queue` are **deferred to v2+**: `409 CAPABILITY_UNAVAILABLE` ("Self-hosted mail is coming in v2. Use external SMTP."). On Nano, **all** `/email/*` also → `CAPABILITY_UNAVAILABLE` (no email of any kind).
- `GET /mail-domains` — list mail domains. ⚠ v1 → `409 CAPABILITY_UNAVAILABLE`.
- `POST /mail-domains` — provision mail domain. ⚠ v1 → `409`.
- `GET /mail-domains/{id}/mailboxes` — list mailboxes. ⚠ v1 → `409`.
- `POST /mail-domains/{id}/mailboxes` — create mailbox. ⚠ v1 → `409`.
- `PATCH /mailboxes/{id}` — quotas/status/deletion. ⚠ v1 → `409`.
- `DELETE /mailboxes/{id}` — delete mailbox. ⚠ v1 → `409`.
- `POST /mailboxes/{id}/reset-password` — credential rotation. ⚠ v1 → `409`.
- `GET /mail-domains/{id}/aliases` — aliases and forwarding. ⚠ v1 → `409`.
- `POST /mail-domains/{id}/aliases` — create alias. ⚠ v1 → `409`.
- `GET /mail-domains/{id}/deliverability` — SPF/DKIM/DMARC/PTR diagnostics. ⚠ v1 → `409`.
- `POST /mail-domains/{id}/dkim/rotate` — controlled key rotation. ⚠ v1 → `409`.
- `GET /mail-domains/{id}/queue` — authorized queue summary. ⚠ v1 → `409`.
- `POST /email/external-smtp` — the v1 path: configure provider (Resend/Postmark/Mailgun/SES), write-only API key, from address (used for panel notifications and WordPress outbound mail). → `201` ◆ `{"data":{"id":"smtp_01EXAMPLE","provider":"resend","from_address":"panel@example.com","verified_at":null}}`
- `POST /email/external-smtp/test` — verify the credentials. → ◆ `{"data":{"ok":true,"provider":"resend","latency_ms":210,"verified_at":"2026-11-06T15:02:00Z"}}`
- `GET /email/recommendation` — honest guidance. → ✅-shape `{"data":{"recommendation":"external_provider","message":"For mailboxes, we recommend Zoho or Google Workspace. Self-hosted mail is coming in v2.","on_nano":false}}`

### 4.12 Backups, restore, disaster recovery
Backups are **batch** operations (appear in batch queue). A backup without a recent verification is `unverified`, not `healthy`. On Nano, backups are **remote-only** (`destination: "local"` → `409 CAPABILITY_UNAVAILABLE`, "Local backups require more disk. Use remote backup.").
- `GET /backup-policies` — retention, schedule, destination. → ◆ `{"data":[{"id":"bp_01EXAMPLE","schedule":"0 3 * * *","retention_days":30,"destination":"s3://backup-bucket","consistency":"filesystem"}]}`
- `POST /backup-policies` — create policy. → `201` ◆ `{"data":{"id":"bp_01EXAMPLE","schedule":"0 3 * * *"}}`
- `GET /backups` — list backups. → ◆ `{"data":[{"id":"bkp_01EXAMPLE","status":"completed","verification_state":"unverified","last_verified_restore_at":null,"size_bytes":536870912}]}`
- `POST /backups` — request backup (`workload_category: "batch"`; Nano + `destination:"local"` → `409`). → `202` ◆ `{"data":{"operation_id":"op_01BEXAMPLE","workload_category":"batch"}}`
- `GET /backups/{id}` — integrity, scope, encryption, location; includes `last_verified_restore_at`. → ✅-field `{"data":{"id":"bkp_01EXAMPLE","status":"completed","integrity":"ok","encryption":"age/xchacha20","location":"s3://backup-bucket/…","last_verified_restore_at":"2026-11-03T04:10:00Z"}}`
- `POST /backups/{id}/verify` — integrity test = restore to disposable target; records result in `storage.backup_verifications`. → `202` ◆ `{"data":{"operation_id":"op_01BEXAMPLE","verification_state":"verifying"}}`
- `POST /restores/preview` — scope/conflict/impact plan (identifies overwritten resources; pre-restore safety measures). → ◆ `{"data":{"plan_id":"plan_01EXAMPLE","overwrite_targets":[{"type":"website","id":"web_01EXAMPLE"}],"downtime_class":"brief","safety_backup_required":true}}`
- `POST /restores` — approved restore (**batch**). → `202` ◆ `{"data":{"operation_id":"op_01BEXAMPLE","plan_id":"plan_01EXAMPLE"}}`
- `GET /restore-points` — available recovery points. → ◆ `{"data":[{"artifact_id":"bkp_01EXAMPLE","taken_at":"2026-11-06T03:00:00Z","consistency":"filesystem","verified":true}]}`

### 4.13 Security, firewall, SSH, audit
- `GET /servers/{id}/firewall` — effective firewall policy. → ◆ `{"data":{"rules":[{"id":"fw_01EXAMPLE","direction":"in","port":22,"source":"203.0.113.0/24","action":"allow"}],"management_path_safe":true}}`
- `POST /servers/{id}/firewall/preview` — lockout and conflict preflight (a plan removing the current SSH source IP is rejected unless an alternate access path is verified — policy, not UI warning). → ◆ `{"data":{"plan_id":"plan_01EXAMPLE","lockout_risk":false,"conflicts":[]}}`
- `POST /servers/{id}/firewall/apply` — approved policy change (temporary rollback/recovery if management connectivity fails). → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE"}}`
- `GET /ssh-keys` — public-key registry (private keys never uploaded). → ◆ `{"data":[{"id":"ssh_01EXAMPLE","name":"laptop","fingerprint":"SHA256:…","added_at":"2026-11-01T08:00:00Z"}]}`
- `POST /ssh-keys` — add public key. → `201` ◆ `{"data":{"id":"ssh_01EXAMPLE","name":"laptop"}}`
- `GET /security-policies` — organization/provider policies. → ◆ `{"data":[{"id":"sp_01EXAMPLE","name":"mfa-required-privileged","applies_to":["hosting-account.suspend"]}]}`
- `POST /security-policies` — create policy. → `201` ◆ `{"data":{"id":"sp_01EXAMPLE"}}`
- `GET /security/events` — authorized security timeline. → ◆ `{"data":[{"id":"sev_01EXAMPLE","type":"security.alert.created","occurred_at":"2026-11-06T10:00:00Z","summary":"5 failed logins"}]}`
- `GET /audit-logs` — immutable/redacted audit records. → ◆ `{"data":[{"id":"aud_01EXAMPLE","actor_id":"usr_01EXAMPLE","action":"website.publish","resource_id":"web_01EXAMPLE","outcome":"success","occurred_at":"2026-11-06T15:00:00Z","previous_hash":"sha256:0ab1…","record_hash":"sha256:1bc2…"}],"page":{"next_cursor":null}}`
- `GET /audit-logs/{id}` — single record incl. hash-chain linkage. → ✅-fields `{"data":{"id":"aud_01EXAMPLE","action":"website.publish","previous_hash":"sha256:0ab1…","record_hash":"sha256:1bc2…","occurred_at":"2026-11-06T15:00:00Z"}}`
- `POST /audit-logs/verify` — verify the hash chain. → ✅ `{"chain_intact": true, "last_verified_at": "2026-11-06T15:00:00Z"}`; broken chain → ✅ `{"chain_intact": false, "broken_at": "aud_0042"}` + critical alert.
- `POST /security/incident-reports` — incident tracking. → `201` ◆ `{"data":{"id":"inc_01EXAMPLE","severity":"high","status":"open"}}`

**Support:** no dedicated endpoint table exists in the spec. Provider support access = `tenancy.support_sessions` (reason, consent, expiry; no default impersonation), justified/time-bounded/audited step-up under §5 policy. ⚠ Gap: support-session endpoints are unspecified; fixtures should model support access as an audit + permission concern, not a route.

### 4.14 Monitoring, metrics, logs, alerts, usage
- `GET /metrics/servers/{id}` — CPU, RAM, disk, bandwidth time series. → ◆ `{"data":{"window":"24h","points":[{"ts":"2026-11-06T14:00:00Z","cpu_percent":12.5,"ram_bytes":2147483648,"disk_bytes":42949672960,"bandwidth_bps":1048576}],"missing_samples":0}}`
- `GET /metrics/resources/{id}` — tenant-authorized allocation/usage strip (source of truth UX-OV-009; shape verbatim). → ✅ `{"allocated": {"ram_max_bytes": 536870912, "cpu_weight": 100, "cpu_max_millicores": null}, "current": {"ram_bytes": 268435456, "cpu_percent": 8.1}, "typical_7d": {"ram_bytes": 322122547, "cpu_percent": 11.4}, "peak_24h": {"ram_bytes": 503316480, "cpu_percent": 44.2}, "throttled_seconds_24h": 0, "oom_kills_7d": 0}`
- `GET /metrics/servers/{id}/cgroup` — raw cgroup data (aggregated view is `/metrics/resources/{id}`). → ◆ `{"data":[{"period_start":"2026-11-06T14:00:00Z","cpu_usage_usec":1840000,"cpu_throttled_usec":2200,"memory_current_bytes":268435456}]}`
- `GET /logs` — filtered scoped logs (tenant scoping + redaction enforced). → ◆ `{"data":[{"ts":"2026-11-06T15:01:00Z","source":"app_01EXAMPLE","level":"info","message":"request completed"}],"page":{"next_cursor":null}}`
- `GET /alert-rules` — list alert rules. → ◆ `{"data":[{"id":"alr_01EXAMPLE","metric":"ram_bytes","comparator":">","threshold_bytes":4831838208,"window":"15m"}]}`
- `POST /alert-rules` — define threshold/service alerts. → `201` ◆ `{"data":{"id":"alr_01EXAMPLE"}}`
- `GET /alerts` — alert lifecycle. → ◆ `{"data":[{"id":"alr_01EXAMPLE","state":"firing","fired_at":"2026-11-06T14:45:00Z","acknowledged_by":null}]}`
- `POST /alerts/{id}/acknowledge` — acknowledge alert. → ◆ `{"data":{"id":"alr_01EXAMPLE","state":"acknowledged","acknowledged_at":"2026-11-06T14:50:00Z"}}`
- `GET /usage` — metered usage with time windows (billing-grade metering reproducible/immutable). → ◆ `{"data":[{"metric_key":"storage_bytes","quantity":5368709120,"window":"2026-11","source":"meter"}]}`
- `GET /usage/charges` — metered charges. → ◆ `{"data":[{"invoice_id":"inv_01EXAMPLE","metric_key":"bandwidth_gb","quantity":120,"amount_minor":120000,"currency":"KES"}]}`
- `GET /service-health` — service state and dependencies. → ◆ `{"data":{"services":[{"name":"api","state":"healthy"},{"name":"agent","state":"healthy"},{"dependencies":[{"name":"database","state":"healthy"},{"name":"license_server","state":"degraded","offline_grace_until":"2026-11-20T00:00:00Z"}]}]}}`
- `GET /recommendations/upgrade` — computed upgrade suggestions (7-day peak RAM > 80%, OOM kills, CPU contention; powers UX-OV-010). → ◆ `{"data":[{"reason":"peak_ram_7d_ratio","detail":"7-day peak RAM is 84% of allocation","recommendation":"upgrade_profile","target":"starter"}]}`

### 4.15 Commercial: plans, subscriptions, invoices, licenses, checkout
⚠ On Nano: `403 FEATURE_DISABLED` ("Commercial features are not available on this profile.").
- `GET /plans` — commercial product plans. → ◆ `{"data":[{"id":"plan_01EXAMPLE","code":"starter","revision":2,"status":"published","amount_minor":150000,"currency":"KES","period":"month"}]}`
- `POST /plans` — create plan (published revisions immutable). → `201` ◆ `{"data":{"id":"plan_01EXAMPLE","code":"starter","revision":1,"status":"draft"}}`
- `GET /subscriptions` — tenant subscription lifecycle. → ◆ `{"data":[{"id":"sub_01EXAMPLE","organization_id":"org_01EXAMPLE","plan_revision_id":"plan_01EXAMPLE","status":"active","period":{"from":"2026-11-01","to":"2026-12-01"}}]}`
- `POST /subscriptions` — create subscription. → `201` ◆ `{"data":{"id":"sub_01EXAMPLE","status":"active"}}`
- `GET /invoices` — scoped invoices. → ◆ `{"data":[{"id":"inv_01EXAMPLE","invoice_number":"INV-2026-0001","amount_minor":150000,"currency":"KES","state":"open","due_at":"2026-11-15T00:00:00Z"}]}`
- `GET /licenses/current` — license entitlements. → ✅-shape `{"status":"active","expires_at":"2027-11-06T00:00:00Z","offline_grace_until":"2026-11-20T00:00:00Z","features":["websites","service_templates","mpesa"]}`
- `POST /licenses/activate` — activate with a license key (offline grace 7–14 days if license server unreachable). → ◆ `{"data":{"status":"active","expires_at":"2027-11-06T00:00:00Z"}}`
- `POST /billing/checkout-sessions` — provider-mediated checkout (never treat a browser redirect as proof of payment). → `201` ◆ `{"data":{"id":"cks_01EXAMPLE","provider":"stripe","redirect_url":"https://checkout.stripe.com/…","invoice_id":"inv_01EXAMPLE"}}`
- `POST /integrations/billing/{provider}/callbacks` — signed provider event ingress (verify signature, event ID, merchant identity, amount/currency, order linkage, state transitions). → `200` ◆ `{"received":true}`
- Payment endpoints → see §4.16.

### 4.16 Payments (async-first), M-Pesa/Stripe integration, reconciliation
**Every payment endpoint returns `202 Accepted` with `pending`**, even when the gateway resolves synchronously (card <1s, M-Pesa 10s–2min). Identical contract for `mpesa` and `stripe`.
- `POST /payments` — initiate payment. → `202` ✅-shape `{"id":"pay_01EXAMPLE","state":"pending","provider":"mpesa","provider_reference":"ws_CO_12345678","invoice_id":"inv_01EXAMPLE","amount_minor":15000,"currency":"KES","created_at":"2026-11-06T15:00:00Z"}`
- `GET /payments/{id}` — payment state, provider reference, reconciliation state. → ◆ `{"data":{"id":"pay_01EXAMPLE","state":"confirmed","provider":"mpesa","provider_reference":"ws_CO_12345678","reconciliation_state":"matched","state_changed_at":"2026-11-06T15:02:10Z"}}`
- `GET /payments/{id}/events` — append-only state transition log (`commercial.payment_events`). → ◆ `{"data":[{"id":"pev_01EXAMPLE","from_state":"initiated","to_state":"pending","event_type":"payment.initiated","occurred_at":"2026-11-06T15:00:00Z"},{"id":"pev_02EXAMPLE","from_state":"pending","to_state":"confirmed","event_type":"callback.received","occurred_at":"2026-11-06T15:02:10Z"}]}`
- `POST /payments/{id}/retry` — retry failed/expired payment (**new idempotency key** required). → `202` ◆ `{"data":{"id":"pay_02EXAMPLE","state":"pending","retry_of":"pay_01EXAMPLE"}}`
- `POST /payments/{id}/cancel` — cancel a pending payment (best-effort). → ◆ `{"data":{"id":"pay_01EXAMPLE","state":"failed","cancel_requested":true}}`
- `GET /payments?state=pending` — list pending payments. → ◆ `{"data":[{"id":"pay_01EXAMPLE","state":"pending","provider":"mpesa"}],"page":{"next_cursor":null}}`
- `GET /payments?reconciliation_state=unmatched` — admin reconciliation filter. → ◆ `{"data":[{"id":"pay_03EXAMPLE","state":"confirmed","reconciliation_state":"unmatched"}],"page":{"next_cursor":null}}`
- `POST /integrations/payments/mpesa/callback` — M-Pesa Daraja callback (signature-verified, dedup on `CheckoutRequestID`; creates an operation of kind `payment.resolve`). → `200` ◆ `{"ResultCode":0,"message":"accepted"}` (duplicate callback → `200 OK` with existing state, not an error)
- `POST /integrations/payments/stripe/webhook` — Stripe webhook (event-ID dedup on `evt_...`). → `200` ◆ `{"received":true}`
- `POST /payments/{id}/reconcile` — admin: manually match an unmatched callback to an invoice. → ◆ `{"data":{"id":"pay_03EXAMPLE","reconciliation_state":"matched","invoice_id":"inv_01EXAMPLE"}}`
- `POST /payments/{id}/reverse` — manual reversal (with reason; explicit reversal event required). → ◆ `{"data":{"id":"pay_01EXAMPLE","state":"reversed","reason":"duplicate_charge","audited":true}}`
- `GET /payments/reconciliation` — the reconciliation queue (admin). → ◆ `{"data":[{"id":"pay_03EXAMPLE","provider":"mpesa","provider_reference":"ws_CO_999","reconciliation_state":"unmatched","received_at":"2026-11-06T13:00:00Z"}]}`
- `GET /integrations/payments/mpesa/config` — Daraja credentials (sandbox + production). → ◆ `{"data":{"environment":"sandbox","shortcode":"174379","callback_url":"https://panel.example.com/api/v1/integrations/payments/mpesa/callback","verified_at":"2026-11-01T00:00:00Z"}}`
- `POST /integrations/payments/mpesa/config` — set Daraja credentials (consumer key/secret + passkey stored as secret refs; per-tenant callback secret verified on every callback). → `201` ◆ `{"data":{"environment":"sandbox","verified_at":null}}`
- `POST /integrations/payments/mpesa/test` — test transaction against Daraja sandbox. → ◆ `{"data":{"ok":true,"checkout_request_id":"ws_CO_TEST123","state":"pending"}}`

### 4.17 Service instances (ServiceTemplate — the universal service API)
⚠ There are **no** bespoke endpoints: no `POST /storage-buckets`, no `POST /nextcloud-instances`, no `POST /databases`. Creation: `POST /service-instances` with `template_id`. `POST` with a template requesting `--privileged`/host PID → `422 CGROUP_CONFIG_INVALID`.
- `GET /service-instances` — list instances (filterable by template category). → ◆ `{"data":[{"id":"svc_01EXAMPLE","template_key":"minio","template_category":"storage","display_name":"media","state":"running","hostname":"media.name.panel-host","exposure":"public","last_health_status":"healthy"}],"page":{"next_cursor":null}}`
- `POST /service-instances` — deploy a template (validates capability fit, disk quota, hostname uniqueness, port conflict, template signature → `202` + operation). → `202` ✅-flow `{"data":{"id":"svc_01EXAMPLE","state":"provisioning","operation_id":"op_01EXAMPLE","template_key":"nextcloud","template_version":"30.0.1"}}`
- `GET /service-instances/{id}` — instance detail. → ✅-flow `{"data":{"id":"svc_01EXAMPLE","state":"running","hostname":"cloud.name.panel-host","admin_credentials_shown_once":true,"container_id":"c_01N","volume_id":"vol_01N","ssl_certificate_id":"crt_01EXAMPLE","exposure":"public","template_version":"30.0.1","last_health_check_at":"2026-11-06T15:00:00Z","last_health_status":"healthy","export_ready":true}}`
- `PATCH /service-instances/{id}` — update config/env (agent `service.configure`). → `202` ◆ `{"data":{"id":"svc_01EXAMPLE","state":"updating","operation_id":"op_01EXAMPLE"}}`
- `POST /service-instances/{id}/actions/{action}` — restart/reinstall/uninstall (workflow §28.7: "user can restart/reinstall/uninstall"; uninstall = stop, remove container/volume, cleanup → event `service.instance.uninstalled`). ⚠ Action path shape is implied, not tabulated in the spec. → `202` ◆ `{"data":{"id":"svc_01EXAMPLE","state":"removing","operation_id":"op_01EXAMPLE"}}`
- `POST /service-instances/{id}/export` — create OCI artifact + signed manifest (`service.export`). → `202` ◆ `{"data":{"export_id":"sex_01EXAMPLE","operation_id":"op_01BEXAMPLE","workload_category":"batch"}}`
- `POST /service-instances/import` — restore from OCI artifact (digest-pinned). → `202` ◆ `{"data":{"operation_id":"op_01EXAMPLE","artifact_digest":"sha256:33dd…"}}`
- Template catalog (fixture source, `services.service_templates`): keys `minio`, `imgproxy`, `nextcloud`, `postgres`, `redis`, `meilisearch`, `phpmyadmin`, `pgadmin`, `database.mariadb`, `database.postgres`; categories `storage` | `transform` | `delivery` | `self_hosted_app` | `database` | `cache` | `queue` | `search`.

### 4.18 AI assistant and diagnostics
v1 ships **read-only diagnostics + approval-gated proposed actions only**; autonomous multi-step remediation is v4+. AI has no privileged API; its inference is a **batch** workload (UI may show "AI is queued behind site traffic").
- `POST /ai/conversations` — start scoped assistance (`context_scope` required: resource_ids, log_window). → ◆ `{"data":{"id":"aic_01EXAMPLE","context_scope":{"resource_ids":["dep_01EXAMPLE"],"log_window":"1h"},"expires_at":"2026-11-06T16:00:00Z"}}`
- `POST /ai/conversations/{id}/messages` — ask or provide context (retrieved logs/sites/files are untrusted content). → ◆ `{"data":{"message_id":"aim_01EXAMPLE","reply":"Deployment failed at build step: missing dependency…","citations":[{"type":"log","ref":"op_01EXAMPLE/step:build"}]}}`
- `POST /ai/action-proposals` — propose a typed platform action (proposal, not execution). → ◆ `{"data":{"id":"aip_01EXAMPLE","operation_kind":"app.release.deploy","plan_hash":"sha256:81bb…","approval_state":"pending","risk":"low"}}`
- `GET /ai/action-proposals/{id}` — diff, risk, permission checks. → ◆ `{"data":{"id":"aip_01EXAMPLE","diff_summary":"restart app api","risk":"low","permission_check":{"allowed":true,"reason":"actor has website.deploy"}}}`
- `POST /ai/action-proposals/{id}/submit` — route through the standard plan/approval/apply workflow. → `202` ◆ `{"data":{"plan_id":"plan_01EXAMPLE","operation_id":null,"approval_state":"submitted"}}`
- `GET /ai/diagnostics/{id}` — read-only evidence-backed diagnosis. → ◆ `{"data":{"id":"aid_01EXAMPLE","diagnosis":"Build OOM: peak build RAM 480 MB exceeds batch ceiling 256 MB","evidence":[{"type":"metric","ref":"op_01EXAMPLE/step:build","summary":"memory_peak_bytes=503316480"}]}}`

### 4.19 Automations, cron, webhooks, extensions
- `GET /automations` — list scheduled/event-triggered jobs (timezone, missed-run behavior, concurrency policy, owner identity explicit). → ◆ `{"data":[{"id":"aut_01EXAMPLE","trigger":{"type":"cron","schedule":"0 * * * *","timezone":"Africa/Nairobi"},"workload_category":"batch","derived_from_command":true}]}`
- `POST /automations` — create automation (cron classification derived from command pattern; user can override `workload_category`; misclassification visible in `GET /automations/{id}`). → `201` ◆ `{"data":{"id":"aut_01EXAMPLE","workload_category":"batch"}}`
- `GET /webhooks/endpoints` — list delivery destinations. → ◆ `{"data":[{"id":"whk_01EXAMPLE","url":"https://hooks.example.com/nexus","event_filters":["payment.*"],"state":"active"}]}`
- `POST /webhooks/endpoints` — configure destination (SSRF/egress checks; signing secret issued). → `201` ◆ `{"data":{"id":"whk_01EXAMPLE","signing_secret_once":"whsec_…"}}`
- `GET /webhooks/deliveries` — delivery attempts and status. → ◆ `{"data":[{"id":"wde_01EXAMPLE","event_id":"evt_01EXAMPLE","attempt":2,"status":"delivered","last_attempt_at":"2026-11-06T15:06:00Z"}]}`
- `POST /webhooks/deliveries/{id}/redeliver` — governed replay. → `202` ◆ `{"data":{"id":"wde_01EXAMPLE","status":"pending","attempt":3}}`
- `GET /extensions` — list vetted extensions. ⚠ Plugin SDK is v2+; returns an empty list on v1 (`{"data":[],"page":{"next_cursor":null}}`); the ServiceTemplate catalog is the v1 extension mechanism.
- `POST /extensions` — install extension (signed package policy; privileged capabilities need provider approval). ⚠ v1 → `403 FEATURE_DISABLED`/empty catalog. → ◆ `{"data":{"id":"ext_01EXAMPLE","grants":["service.read"]}}`
- `GET /extensions/{id}/permissions` — granted capabilities. → ◆ `{"data":{"extension_id":"ext_01EXAMPLE","granted_capabilities":["service.read"],"network_access":"egress-allowlist"}}`

---

## 5. Async operations lifecycle

### 5.1 The 202 + operation pattern
Infrastructure mutations return `202 Accepted`, `Location: /api/v1/operations/{id}`, and an operation object referencing: requested resource, actor, desired-state revision, policy/approval decision, execution plan, steps, timestamps, final result. Work survives API restarts; workers claim tasks with leases/fencing tokens; every external effect is tracked; cancellation is best-effort; postcondition verification is required before reporting success. Payment callbacks create operations of kind `payment.resolve` (mirroring the payment state machine — every payment state change is auditable via the operations endpoint). cgroup changes create operations of kind `resource.limit.update` (response includes `{before: {...}, after: {...}}`).

### 5.2 Operation state machine
Stage 6 (API spec):

```
pending → validating → (awaiting_approval | queued) → running → (verifying | compensating)
      → (succeeded | failed | partially_succeeded | cancelled)
```

Stage 5 (data spec) adds detail:

```
requested → validating → awaiting_approval (optional) → queued → running → verifying → succeeded
  branches: rejected | cancelled | failed | compensating | partially_compensated | needs_attention
```

⚠ **Contradiction to resolve in fixtures:** Stage 6 names the first state `pending`; Stage 5 names it `requested` and adds branch states `rejected`, `partially_compensated`, `needs_attention`. The union set for the mock layer: `pending`/`requested`, `validating`, `awaiting_approval`, `queued`, `running`, `verifying`, `compensating`, `partially_compensated`, `needs_attention`, `succeeded`, `failed`, `partially_succeeded`, `cancelled`, `rejected`. Transitions must be explicitly validated; retries create attempts, not duplicate resources; `partially_succeeded` requires actionable remediation details. Every operation carries an immutable `workload_category` (`serving` | `batch` | `infrastructure`).

### 5.3 GET /operations/{id}/events — SSE stream
The spec defines this as a "Resumable SSE status stream" backed by the append-only `operations.operation_events` (`event_type`, `payload_redacted`, `occurred_at`). ⚠ The exact SSE frame format is not specified; the fixture shape below is derived from the documented fields and standard SSE resumption (`Last-Event-ID`):

```
GET /api/v1/operations/{id}/events   (text/event-stream)

event: operation.updated
id: opevt_01JEXAMPLE
data: {"operation_id":"op_01EXAMPLE","event_type":"step.started","step_key":"nginx.apply",
       "attempt":1,"status":"running","occurred_at":"2026-11-06T15:01:10Z",
       "progress":{"completed_steps":2,"total_steps":5},"payload_redacted":{}}

event: operation.completed
id: opevt_01JEXAMPLE9
data: {"operation_id":"op_01EXAMPLE","event_type":"operation.succeeded","status":"succeeded",
       "occurred_at":"2026-11-06T15:04:00Z","postcondition_verified":true}
```

Client rules: resume with `Last-Event-ID: <id>`; tolerate duplicate/out-of-order events; agent disconnects mark state **unknown until reconciliation** (never auto-failed/auto-succeeded).

### 5.4 Outbound event taxonomy (webhooks + internal outbox)
Envelope (✅ verbatim §25):
```json
{
  "id": "evt_01EXAMPLE",
  "type": "website.deployment.succeeded",
  "version": "1",
  "occurred_at": "2026-11-06T15:05:00Z",
  "organization_id": "org_01EXAMPLE",
  "resource": {"type": "deployment", "id": "dep_01EXAMPLE"},
  "operation_id": "op_01EXAMPLE",
  "data": {"status": "succeeded"}
}
```
Every event includes `workload_category` (serving/batch/infrastructure). Payment events add `provider` (mpesa|stripe), `provider_reference`, `reconciliation_state`. Service events add `template_key`, `instance_state`. Delivery: HTTPS + HMAC signature over timestamp + raw payload, unique event + delivery IDs, exponential backoff + jitter, bounded retries then dead-letter, replay via authenticated API. Ordering is not globally guaranteed.

**Initial (v1.0) taxonomy:**
`organization.member.invited`, `server.agent.connected`, `server.agent.disconnected`, `website.created`, `website.deployment.started`, `website.deployment.succeeded`, `website.deployment.failed`, `domain.verified`, `dns.zone.published`, `certificate.renewal.failed`, `database.created`, `mailbox.created`, `backup.completed`, `backup.failed`, `restore.completed`, `security.alert.created`, `hosting_account.suspended`, `subscription.updated`, `operation.failed`.

**v2 additions — capability:** `capability.changed`, `capability.unavailable_blocking`.
**v2 additions — service:** `service.template.deployed`, `service.instance.running`, `service.instance.degraded`, `service.instance.uninstalled`, `service.instance.exported`.
**v2 additions — payment:** `payment.pending`, `payment.confirmed`, `payment.failed`, `payment.expired`, `payment.reversed`, `payment.unmatched`.
**v2 additions — batch:** `batch.queued`, `batch.started`, `batch.yielded`, `batch.resumed`, `batch.completed`.
**v2 additions — workload:** `workload.limit.updated`, `workload.oom_kill`, `workload.throttled`.

---

## 6. Domain enums

### 6.1 Site / website status
⚠ **No explicit website status enum exists in either spec.** The only documented value is `"status": "active"` (§6.1 example) plus `lifecycle_state` on `inventory.resources` (default `requested`, free catalog). Related documented state sets the UI must coexist with:
- `hosting.accounts.state`: `provisioning` | `active` | `suspended` | `closing`
- `inventory.resources.lifecycle_state`: default `requested` (open catalog; desired/observed generations track convergence)
- Recommendation for fixtures: derive site status from the hosting-account set + provisioning states, and flag it as an invented interpolation.

### 6.2 Service instance statuses (`services.service_instances.state`)
`provisioning` | `running` | `degraded` | `stopped` | `updating` | `failed` | `removing`
- `last_health_status` / health-check `status`: `healthy` | `unhealthy` | `unknown`
- `exposure`: `public` | `private` (unique `(organization_id, hostname)` for public)
- `export_ready`: boolean; template `published`: boolean

### 6.3 Capability states / availability
- `inventory.capabilities.state`: `available` | `unavailable` | `borderline` (+ nullable human-readable `reason`; queries filter `state IN ('available','borderline')`)
- Legacy `inventory.server_capabilities.availability` column exists in the v1 table (value domain unspecified) — superseded by `inventory.capabilities`
- `workload_category` (every workload-bearing row, immutable): `serving` | `batch` | `infrastructure`
  - Defaults (`inventory.workload_categories`): serving → `cpu_weight 100`, `cpu_max NULL`, `memory_low 100% of typical`; batch → `cpu_weight 10`, `cpu_max 50%`, `memory_low NULL`; infrastructure → `cpu_weight 200`, `cpu_max NULL`, `memory_low 100% of floor`
- Prerequisites flags (jsonb): e.g. `{port_25: true, docker: true, public_ip: true}`

### 6.4 M-Pesa / payment states (full state machine)
`commercial.payments.state` CHECK: `initiated` | `pending` | `confirmed` | `failed` | `expired` | `reversed`

```
initiated → pending → confirmed
                   → failed
                   → expired        (no callback within timeout, e.g. 5 min; reconciliation job polls Daraja Transaction Status API)
                   → reversed       (explicit reversal event only)
initiated/pending → manual_review   (callback received but unmatched; ⚠ shown in the Stage 6 ASCII machine but NOT a DB state —
                                     in the data model it is reconciliation_state, not state)
```

- `reconciliation_state`: `matched` | `unmatched` | `manual` (default `unmatched`)
- `provider`: `mpesa` | `stripe`; `provider_reference`: Daraja `CheckoutRequestID` or Stripe `pi_...`
- `mpesa_configs.environment`: `sandbox` | `production`
- Enforced invariants: a `pending` payment cannot jump to `confirmed` without a callback; a `confirmed` payment cannot be reversed without an explicit reversal event; duplicate callback → idempotent `200`; every transition appended to `commercial.payment_events` (`from_state`, `to_state`, `event_type`, `payload_redacted`, `occurred_at`, `actor`)

### 6.5 Invoice states
⚠ **Not enumerated anywhere.** `commercial.invoices` has a `state` column ("billing integration or native") and each of `Plan → Subscription → Invoice → Payment` "has its own state machine", but only the payment machine is spelled out. Documented adjacent facts: invoices have `amount_minor`, `currency`, `invoice_number`; payments reference `invoice_id`; `POST /payments` on an already-pending invoice → `409 PAYMENT_PENDING`; confirmed payment → "invoice marked paid, entitlement updated, subscription active". Fixtures need an invented set (e.g. draft/open/paid/void) — flag as interpolation.

### 6.6 Subscription / plan states
⚠ **Not enumerated.** Documented: `commercial.plans.status` ("published immutable revisions" → statuses like draft/published are implied, not stated), `commercial.subscriptions.status` + `period`, subscription lifecycle endpoint family, `subscription.updated` event, and behavioral facts: renewal auto-generates invoices, entitlement revocation/suspension follows explicit grace and data-retention policies, license `offline_grace_until` (7–14 days). Treat as open fixture decisions.

### 6.7 Audit event types
⚠ No closed catalog. `audit.audit_events.action` is open text; the spec's canonical action vocabulary is: the **outbound event taxonomy** (§5.4 above), operation kinds (e.g. `website.provision`, `payment.resolve`, `resource.limit.update`, `capability.rescan`), and auth events (login outcomes in `identity.login_events`, session/token revocations, MFA). Every mutating endpoint MUST emit an audit event; records carry actor, impersonation/support context, org, action, target, policy decision, request correlation, operation ID, outcome, timestamp, and the hash chain (`previous_hash`, `record_hash`; `record_hash = sha256(previous_hash || actor_id || action || resource_id || occurred_at || payload_digest)`; chain verified hourly; deletion forbidden — tombstone reference only).

### 6.8 User / role / permission / capability identifiers
- **User status** (`identity.users`): `active` | `locked` | `disabled`
- **Membership state** (`tenancy.memberships`): `invite` | `active` | `revoked`
- **Organization type** (`tenancy.organizations.organization_type`): `standalone` | `provider` | `reseller` | `customer`; `status` default `active`; optional `primary_persona` + `branding`
- **UI role labels (not permissions):** owner, provider, reseller, customer, developer, support, auditor
- **Personas** (`inventory.persona_capability_matrix.persona`, 8): `website_owner` | `app_developer` | `self_hoster` | `storage_user` | `infrastructure_user` | `explorer` | `reseller` | `provider_admin`
- **Matrix surfaces:** `default_landing` | `visible_menu` | `hidden` → resolved landings: `router` | `portfolio` | `fleet`
- **API capability identifiers** (representative list; `tenancy.permissions.permission_key` is a "stable catalog" not fully enumerated):
  v1.0: `server.read`, `server.manage`, `hosting-account.create`, `website.deploy`, `domain.dns.write`, `database.provision`, `email.mailbox.manage`, `backup.restore`, `security.firewall.write`, `billing.read`, `reseller.delegate`, `audit.read`, `agent.enroll`, `approval.decide`
  v2 additions: `service.create`, `service.read`, `service.manage`, `service.export`, `service.import`, `capability.read`, `capability.rescan`, `payment.read`, `payment.reconcile` (admin only), `template.deploy`, `template.export`, `workload.category.read`, `workload.usage.read`
- **Server capability keys** (installer data; examples in spec): `website.static`, `app.node`, `db.mariadb`, `db.postgres`, `service.storage`, `service.transform`, `service.docker`
- **ServiceTemplate keys** (fixture catalog): `minio`, `imgproxy`, `nextcloud`, `postgres`, `redis`, `meilisearch`, `phpmyadmin`, `pgadmin`, `database.mariadb`, `database.postgres`; categories: `storage` | `transform` | `delivery` | `self_hosted_app` | `database` | `cache` | `queue` | `search`
- **DNS modes:** `external_manual` | `external_api` (future) | `local_authoritative` (v2+); zone `state`, certificate `status`/`verification_state` columns exist but value domains are unspecified
- **Server lifecycle** (`inventory.servers.state`): `registration` | `quarantine` | `active` | `draining`
- **Agent typed action catalog** (for fixtures of operation kinds): `system.inventory.read`, `system.service.status`, `nginx.site.validate`, `nginx.site.apply`, `runtime.install`, `app.release.deploy`, `app.process.restart`, `files.list`, `files.read`, `files.write_atomic`, `database.provision`, `database.user.rotate`, `dns.zone.publish`, `tls.certificate.install`, `mail.mailbox.provision`, `backup.create`, `backup.restore`, `firewall.preview`, `firewall.apply`, `metrics.collect`, plus v2: `workload.create/update_limits/remove/verify_cgroup/metrics.read`, `container.create/start/stop/restart/remove/health_check/logs/validate_safety`, `service.provision/configure/start/stop/health_check/backup/restore/export/import/uninstall`, `capability.detect/rescan`, `batch.yield/resume`, `payment.verify_callback`, `payment.reconcile`

---

## 7. M-Pesa flow (STK push, initiation → resolution)

API flow (✅ Stage 6 §28.6, conformance API-035…039, Stage 5 acceptance rows):

| # | Step | API behavior | What the UI shows (spec-stated; ◆ = derived from spec principles) |
|---|---|---|---|
| 1 | Invoice exists | Invoice created manually or auto-generated at subscription renewal. | Invoice with `amount_minor`/`currency` (150.00 KES) and a "Pay with M-Pesa" action. |
| 2 | Initiate | `POST /payments` `{invoice_id, provider:"mpesa", phone_number:"+254712345678", amount_minor:15000, currency:"KES"}`. Idempotency composed of actor+invoice+amount+provider. Second attempt while pending → `409 PAYMENT_PENDING`. | Payment form collecting Safaricom phone number; submit button disabled while a pending payment exists for the invoice. |
| 3 | Accepted | `202 Accepted` with ✅ `{id, state:"pending", provider_reference:"<CheckoutRequestID>"}`. API calls Daraja STK Push. | ◆ "Check your phone" — pending state with the amount and a spinner; UI polls `GET /payments/{id}` or subscribes to `payment.*` events. |
| 4 | User prompt | User receives the STK prompt on the phone and enters the M-Pesa PIN (10s–2min typical). | ◆ Pending screen with "enter your M-Pesa PIN on your phone"; a visible timeout countdown (spec's example timeout: 5 minutes). |
| 5 | Callback | Daraja calls `POST /integrations/payments/mpesa/callback`; signature verified, deduplicated by `CheckoutRequestID`; a `payment.resolve` operation is created. | ◆ No visible change yet (still pending). |
| 6a | Confirmed | State → `confirmed`; invoice marked paid; entitlement updated; subscription active; event `payment.confirmed`. | ◆ Success screen: payment receipt, invoice marked paid, entitlement/subscription active. |
| 6b | Failed | State → `failed`; event `payment.failed`; retry allowed (`POST /payments/{id}/retry` with a NEW idempotency key). | ◆ Failure notice with a "Try again" action; the old payment is terminal. |
| 6c | Duplicate callback | Idempotent `200 OK` with the existing state; no double credit. | ◆ Nothing (already resolved). |
| 6d | Unmatched callback | Callback received but no matching invoice/payment → `payment.unmatched` event; reconciliation queue (`GET /payments/reconciliation`) populated; state stays pending/unresolved per machine (`manual_review`). | ◆ (Admin UI) Reconciliation queue item: provider reference, received payload summary, "Match to invoice" action. |
| 7 | Timeout | No callback within the timeout (e.g. 5 min) → state `expired`; a reconciliation job polls the Daraja Transaction Status API. If Daraja reports success but no callback arrived, the payment is resolved and **flagged for review** (reconciliation, audit recorded). | ◆ "Payment expired — no confirmation received. We're checking with M-Pesa; you can retry." Admin sees the review flag if resolved late. |
| 8 | Reversal | Manual `POST /payments/{id}/reverse` with reason (admin); explicit reversal event; audited; event `payment.reversed`. | ◆ (Admin) Reversal with mandatory reason; payment/invoice reflect reversed state. |

Failure/security branches (spec-stated): invalid callback signature → rejected + audited; duplicate callback → idempotent 200; unmatched → reconciliation queue; timeout → expired + reconciliation job; reversal → audited. The agent has **no** access to M-Pesa credentials and no direct payment operations — resolution is control-plane only.

---

## 8. Server profiles (capability tiers)

| Profile | Control-plane DB | Customer DB | Metrics store | Reverse proxy | What it can / cannot run (spec-stated) |
|---|---|---|---|---|---|
| **Nano** | SQLite (~15 MB) | **None** | SQLite (same file) | Nginx | Installs and runs on a 512 MB VPS (acceptance: panel installs; static sites work; unavailable capabilities shown with reason). Static sites + WordPress yes; Node app → `409 CAPABILITY_UNAVAILABLE` (example error `{required_ram_mb: 200, available_ram_mb: 120}`); customer databases → ✅ `{"data": [], "meta": {"capability_unavailable": true, "reason": "No room for MariaDB/Postgres container"}}`; **no email of any kind** (`/email/*` → `CAPABILITY_UNAVAILABLE`, not even external SMTP); no container terminal (`CAPABILITY_UNAVAILABLE`, "No container to exec into"); backups **remote-only** (`destination:"local"` → `409`, "Local backups require more disk. Use remote backup."); commercial surface → `403 FEATURE_DISABLED`; SFTP is the primary file-transfer path; no Postgres RLS (single-tenant, application-layer authorization); authoritative DNS guidance-only (all profiles, v1). |
| **Starter** | SQLite or Postgres | Small MariaDB/Postgres (**borderline**) | SQLite or VictoriaMetrics | Caddy or Nginx | Static sites, Node/PHP apps; small customer DB is borderline (capability state `borderline` with reason); external SMTP email. |
| **Standard+** | PostgreSQL | MariaDB/Postgres **containers** | VictoriaMetrics | Caddy (automatic HTTPS) | Full surface: Docker as the isolation primitive (containers for apps, DBs, ServiceTemplate instances), customer DBs, DB admin tools as templates (`phpmyadmin`, `pgadmin`), external SMTP, batch queue with yielding, cgroup metrics raw series, Postgres RLS. |
| **Provider** | PostgreSQL (HA in v3+) | Managed DB containers | VictoriaMetrics per node | Caddy | Multi-node fleet, placement/scheduling, reseller delegation, provider packages — ⚠ the provider/reseller API surface is deferred to v2+ (endpoints exist, return `403 FEATURE_DISABLED` on v1). |

Ladder upgrade (no reinstall): provider bumps VPS RAM → `POST /servers/{id}/capabilities/rescan` (202; agent runs 5-step detection) → diff shown ✅ `{new_available: ["app.node", "db.mariadb", "service.docker"], new_borderline: [...]}` → user confirms `POST /servers/{id}/capabilities/apply` → new workloads enabled, no migration. Nano → Standard data path: stop panel → export SQLite → start Postgres → import → resume (DATA-030).

### Installer capability data (what the frontend renders)
Per-capability record (`inventory.capabilities`; also returned by `GET /servers/{id}/capabilities/{key}`):
```json
{
  "capability_key": "app.node",
  "workload_category": "serving",
  "ram_floor_bytes": 209715200,
  "ram_typical_bytes": 268435456,
  "ram_ceiling_bytes": 536870912,
  "cpu_weight": 100,
  "cpu_max_millicores": null,
  "disk_floor_bytes": 1073741824,
  "prerequisites": {"docker": false, "port_25": false, "public_ip": true},
  "state": "available",
  "reason": null,
  "detected_at": "2026-11-06T09:00:00Z",
  "source_digest": "sha256:9f1c…"
}
```
Rules the UI must reflect honestly: capability data is loaded from a **signed** file at install (tampered file rejected; `source_digest` recorded and echoed in every `capability_decision`); `cpu_max_millicores` only exists for batch; RAM ceiling hard constraint = Σ `memory.max` ≤ physical × 1.2; CPU overcommit soft (warn > 3×, refuse > 5×); a plan includes `resource_fit {ram_floor, ram_typical, ram_ceiling, cpu_weight, cpu_max, current_usage, delta_after}` and `capability_decision {state, reason}`; unavailable capabilities are displayed **with their reason**, never hidden; usage strip shows allocated/typical/peak/current; upgrade recommendations from 7-day peak RAM > 80%, OOM kills, CPU contention.
