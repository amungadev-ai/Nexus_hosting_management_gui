import type { ProfileId, ServiceInstance } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { newId, ok, withLatency, ApiError, problem } from "@/lib/api/core";
import { operations } from "@/lib/operations";
import { capabilityFor, PROFILES } from "@/lib/profiles";

/**
 * Platform Services API client (mock layer). Every mutation returns the
 * 202 + operation pattern; capability checks run BEFORE policy — a request
 * this VPS cannot honour is rejected with CAPABILITY_UNAVAILABLE + the
 * resource delta from the signed capability record, exactly like the real
 * POST /service-instances gate.
 */

function requireCapability(profile: ProfileId, key: string): void {
  const rec = capabilityFor(profile, key);
  if (rec && rec.state === "unavailable") {
    throw new ApiError(
      problem(409, "CAPABILITY_UNAVAILABLE", "This VPS cannot run that", rec.reason ?? "The capability record marks this as unavailable.", {
        resource_delta:
          rec.delta?.ram_mb !== undefined
            ? { required_ram_mb: rec.delta.ram_mb, available_ram_mb: 0 }
            : undefined,
      })
    );
  }
}

const S3_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export interface CreateBucketInput {
  profile: ProfileId;
  name: string;
  exposure: "public" | "private";
  quota_gb: number;
}

/**
 * POST /service-instances (template: minio) — FLOW-015 storage flow.
 * S3 naming rules are enforced server-side: lowercase, digits, hyphens,
 * 3–63 chars.
 */
export async function createBucket(input: CreateBucketInput) {
  return withLatency(() => {
    requireCapability(input.profile, "service.storage");
    if (!S3_NAME.test(input.name)) {
      throw new ApiError(
        problem(422, "VALIDATION_FAILED", "Invalid bucket name", "Bucket names use lowercase letters, digits and hyphens, 3–63 characters, starting and ending with a letter or digit.")
      );
    }
    const operation = operations.submit({
      kind: "service.provision",
      title: `Create storage bucket ${input.name}`,
      resource_ref: { type: "service_instance", id: input.name, name: input.name },
      workload_category: "serving",
      step_titles: [
        "Validate bucket name",
        "Allocate volume",
        "Start MinIO container",
        "Create access keys",
        "Health check",
      ],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok({ operation });
  }, 200);
}

export interface KeySecretResult {
  operation: ReturnType<typeof operations.submit>;
  /** Shown once (DS-008) — the mock layer cannot retrieve it again either. */
  secret: string;
}

function generateSecret(): string {
  return `nxs_${newId("k").slice(4)}${Math.random().toString(36).slice(2, 10)}`;
}

/** POST /service-instances/{id}/keys — least-privilege scope by default. */
export async function createAccessKey(bucketId: string, scope: "read-only" | "write-only" | "read-write", profile: ProfileId) {
  return withLatency(() => {
    requireCapability(profile, "service.storage");
    const bucket = db.serviceInstances.find((i) => i.id === bucketId);
    const operation = operations.submit({
      kind: "service.configure",
      title: `Create ${scope} access key${bucket !== undefined ? ` for ${bucket.name}` : ""}`,
      resource_ref: { type: "service_instance", id: bucketId, name: bucket?.name },
      workload_category: "serving",
      step_titles: ["Generate key pair", "Store hash only", "Verify S3 authentication"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok<KeySecretResult>({ operation, secret: generateSecret() });
  }, 200);
}

/** POST /service-instances/{id}/keys/rotate — old keys revoked after handover. */
export async function rotateBucketKeys(bucketId: string, profile: ProfileId) {
  return withLatency(() => {
    requireCapability(profile, "service.storage");
    const bucket = db.serviceInstances.find((i) => i.id === bucketId);
    const operation = operations.submit({
      kind: "service.configure",
      title: `Rotate access keys${bucket !== undefined ? ` — ${bucket.name}` : ""}`,
      resource_ref: { type: "service_instance", id: bucketId, name: bucket?.name },
      workload_category: "serving",
      step_titles: ["Generate new key pair", "Revoke previous keys", "Verify S3 authentication"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok<KeySecretResult>({ operation, secret: generateSecret() });
  }, 200);
}

/** DELETE /service-instances/{id}/keys/{keyId} — audited revocation. */
export async function revokeAccessKey(bucketId: string, keyId: string, keyLabel: string) {
  return withLatency(() => {
    const bucket = db.serviceInstances.find((i) => i.id === bucketId);
    const operation = operations.submit({
      kind: "service.configure",
      title: `Revoke access key ${keyLabel}`,
      resource_ref: { type: "service_instance", id: bucketId, name: bucket?.name },
      workload_category: "serving",
      step_titles: ["Revoke key", "Verify dependent clients fail safely"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok({ operation });
  }, 180);
}

/** POST /service-instances/{id}/actions/restart (agent: service.start). */
export async function restartService(instance: ServiceInstance) {
  return withLatency(() => {
    const operation = operations.submit({
      kind: "service.start",
      title: `Restart ${instance.name}`,
      resource_ref: { type: "service_instance", id: instance.id, name: instance.name },
      workload_category: "serving",
      step_titles: ["Drain connections", "Start container", "Health check"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok({ operation });
  }, 160);
}

/** POST /service-instances/{id}/actions/stop (agent: service.stop). */
export async function stopService(instance: ServiceInstance) {
  return withLatency(() => {
    const operation = operations.submit({
      kind: "service.stop",
      title: `Stop ${instance.name}`,
      resource_ref: { type: "service_instance", id: instance.id, name: instance.name },
      workload_category: "serving",
      step_titles: ["Drain connections", "Stop container"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok({ operation });
  }, 160);
}

/** POST /service-instances/{id}/actions/flush — cache reset (DS-011 verified). */
export async function flushCache(instance: ServiceInstance) {
  return withLatency(() => {
    const operation = operations.submit({
      kind: "service.configure",
      title: `Flush ${instance.name}`,
      resource_ref: { type: "service_instance", id: instance.id, name: instance.name },
      workload_category: "serving",
      step_titles: ["Flush cached keys", "Verify hit ratio reset"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok({ operation });
  }, 160);
}

/** POST /service-instances/{id}/actions/uninstall — destructive, volume kept 24h. */
export async function uninstallService(instance: ServiceInstance) {
  return withLatency(() => {
    const operation = operations.submit({
      kind: "service.uninstall",
      title: `Uninstall ${instance.name}`,
      resource_ref: { type: "service_instance", id: instance.id, name: instance.name },
      workload_category: "serving",
      step_titles: [
        "Stop container",
        "Remove container",
        "Remove volume (kept 24h for recovery)",
        "Verify removal",
      ],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok({ operation });
  }, 200);
}

/** POST /service-instances/{id}/consume — one-click integration (UX-SVC-010). */
export async function consumeService(
  bucket: ServiceInstance,
  target: { type: "website" | "application"; id: string; name: string }
) {
  return withLatency(() => {
    const operation = operations.submit({
      kind: "service.configure",
      title: `Attach ${bucket.name} to ${target.name}`,
      resource_ref: { type: "service_instance", id: bucket.id, name: bucket.name },
      workload_category: "serving",
      step_titles: [
        `Validate ${target.type} target`,
        "Inject credentials (write-only)",
        target.type === "application" ? "Restart app process" : "Apply site config",
        "Verify connection",
      ],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok({ operation });
  }, 200);
}

/** PUT /service-instances/{id}/config — transform pipeline rules (UX-SVC-005). */
export async function applyTransformConfig(instance: ServiceInstance) {
  return withLatency(() => {
    const operation = operations.submit({
      kind: "service.configure",
      title: `Apply transform rules — ${instance.name}`,
      resource_ref: { type: "service_instance", id: instance.id, name: instance.name },
      workload_category: "serving",
      step_titles: ["Validate size rules", "Apply imgproxy config", "Purge transform cache"],
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });
    return ok({ operation });
  }, 200);
}

/** Profile RAM (MB) — used by views to show headroom honestly. */
export function profileRamMb(profile: ProfileId): number {
  return PROFILES[profile].specs.ram_mb;
}
