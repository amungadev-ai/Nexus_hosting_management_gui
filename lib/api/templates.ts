import type { ProfileId, ServiceInstance, ServiceTemplate } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { newId, ok, withLatency, ApiError, problem } from "@/lib/api/core";
import { operations } from "@/lib/operations";
import { capabilityFor, PROFILES } from "@/lib/profiles";
import {
  allocatedDiskGb,
  allocatedRamMb,
} from "@/lib/mock/overview";
import { registerProvisioned, removeProvisioned, allServiceInstances } from "@/lib/mock/services";

/**
 * Self-hosted Templates API client (mock layer). Mirrors
 * POST /service-instances with a template_id: capability preflight →
 * resource fit → port/disk checks → 202 + template.install operation.
 * The capability gate runs before anything else, and a plan is refused when
 * the allocation cannot fit — the delta is shown, never hidden.
 */

export const INSTANCE_NAME = /^[a-z0-9][a-z0-9-]{2,40}$/;

export interface DeployCheck {
  ok: boolean;
  /** Exactly what to fix — rendered verbatim in the wizard. */
  blockers: string[];
  /** Deploying with less than typical RAM is allowed but honestly risky. */
  risky: boolean;
  riskNote: string | null;
  headroom_mb: number;
}

/** The wizard's preflight: capability, name, port/disk quota, RAM fit. */
export function checkDeploy(template: ServiceTemplate, name: string, profile: ProfileId): DeployCheck {
  const blockers: string[] = [];
  const profileRam = PROFILES[profile].specs.ram_mb;
  const profileDisk = PROFILES[profile].specs.disk_gb;
  const headroom = profileRam - allocatedRamMb();

  const cap = template.docker_required
    ? capabilityFor(profile, "service.docker")
    : capabilityFor(profile, "website.php");
  if (cap && cap.state === "unavailable") {
    blockers.push(
      `${template.name} needs ${template.docker_required ? "Docker" : "a PHP runtime"}, which this VPS cannot run. ${cap.reason ?? ""}`.trim()
    );
  }
  if (!INSTANCE_NAME.test(name)) {
    blockers.push("The name must be 3–41 characters: lowercase letters, digits and hyphens, starting with a letter or digit.");
  }
  if (allServiceInstances().some((i) => i.name === name)) {
    blockers.push(`An instance named “${name}” already exists — instance names and public hostnames must be unique.`);
  }
  const diskFree = profileDisk - allocatedDiskGb();
  if (template.disk_floor_gb > diskFree) {
    blockers.push(
      `Disk quota: ${template.name} needs at least ${template.disk_floor_gb} GB but only ${Math.max(0, Math.round(diskFree * 10) / 10)} GB is free on the ${PROFILES[profile].label} disk.`
    );
  }
  if (template.ram_floor_mb > headroom) {
    blockers.push(
      `RAM fit: ${template.name} needs ${template.ram_floor_mb} MB to start but only ${Math.max(0, headroom)} MB of the ${profileRam} MB ceiling is unallocated — ${template.ram_floor_mb - Math.max(0, headroom)} MB more is required.`
    );
  }

  const risky = blockers.length === 0 && headroom < template.ram_typical_mb;
  const riskNote = risky
    ? `${template.name} typically uses ${template.ram_typical_mb} MB but only ${headroom} MB is unallocated. Under memory pressure the install can fail at first start — free RAM or upgrade first if you can.`
    : null;

  return { ok: blockers.length === 0, blockers, risky, riskNote, headroom_mb: headroom };
}

export interface DeployResult {
  operation: ReturnType<typeof operations.submit>;
  instance: ServiceInstance;
  warning: string | null;
}

/**
 * Deploy a template: submit the template.install operation and register the
 * instance draft (state provisioning). If the operation fails, the draft is
 * removed again — the caller watches the live operation stream and drops it
 * via `discardFailedInstall`.
 */
export async function deployTemplate(input: {
  template: ServiceTemplate;
  name: string;
  exposure: "public" | "private";
  backup_policy: "nightly" | "none";
  profile: ProfileId;
}) {
  return withLatency(() => {
    const check = checkDeploy(input.template, input.name, input.profile);
    if (!check.ok) {
      throw new ApiError(
        problem(409, "CAPABILITY_UNAVAILABLE", "This VPS cannot run this template", check.blockers.join(" "), {
          resource_delta:
            input.template.ram_floor_mb > check.headroom_mb
              ? {
                  required_ram_mb: input.template.ram_floor_mb - Math.max(0, check.headroom_mb),
                  available_ram_mb: Math.max(0, check.headroom_mb),
                }
              : undefined,
        })
      );
    }

    // Honest risk: deploying below the typical RAM budget can fail at first
    // start (memory pressure) — the prototype replays that outcome faithfully.
    const failUnderPressure = check.risky;
    const operation = operations.submit({
      kind: "template.install",
      title: `Install ${input.template.name} as ${input.name}`,
      resource_ref: { type: "service_instance", id: input.name, name: input.name },
      workload_category: "serving",
      step_titles: [
        "Preflight: capability, port conflict, disk quota",
        "Pull signed image",
        "Create volume",
        "Start container",
        "Health check",
      ],
      outcome: failUnderPressure ? "failed" : "succeeded",
      error: failUnderPressure
        ? {
            code: "INSTALL_OOM_FIRST_START",
            detail:
              "The container exited during its first start — the VPS ran out of memory while other workloads were busy. Nothing was changed permanently; free RAM (or raise the ceiling) and retry.",
            retryable: true,
          }
        : undefined,
      actor_id: db.currentUser,
      organization_id: db.currentOrganization,
    });

    const instance: ServiceInstance = {
      id: newId("svc"),
      template_key: input.template.key,
      name: input.name,
      state: "provisioning",
      health: "unknown",
      exposure: input.exposure,
      hostname: input.exposure === "public" ? `${input.name}.wanjiku.digital` : `${input.name}.internal`,
      version: input.template.version,
      usage: {
        ram_mb: { allocated: input.template.ram_ceiling_mb, typical: 0, peak: 0, current: 0 },
        cpu_millicores: { allocated: 1000, typical: 0, peak: 0, current: 0 },
        disk_gb: { allocated: input.template.disk_floor_gb, current: 0 },
        throttled_seconds_24h: 0,
        oom_events_7d: 0,
        updated_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    };
    registerProvisioned(instance);

    return ok<DeployResult>({ operation, instance, warning: check.riskNote });
  }, 260);
}

/** Called when the watched install operation reports failed. */
export function discardFailedInstall(instanceId: string): void {
  removeProvisioned(instanceId);
}

/** Postcondition for a fresh install (used by the success card). */
export function installVerified(instanceId: string): boolean {
  const inst = allServiceInstances().find((i) => i.id === instanceId);
  return inst !== undefined && inst.state !== "provisioning";
}
