import { db } from "@/lib/mock/data";
import { operations } from "@/lib/operations";
import type { Operation } from "@/lib/types";

/**
 * Automation-module API client (§4.19). Every mutation returns a 202-style
 * operation; webhook secrets are write-only and shown once (DS-008).
 */

const ACTOR = { actor_id: db.currentUser, organization_id: db.currentOrganization } as const;

/** Create a scheduled job (cron presets + custom expression). */
export function submitScheduleCreate(name: string): Operation {
  return operations.submit({
    kind: "automation.schedule.create",
    title: `Create scheduled job — ${name}`,
    resource_ref: { type: "automation", id: name, name },
    workload_category: "infrastructure",
    step_titles: ["Validate cron expression", "Register schedule", "Compute first run"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

export function submitScheduleState(name: string, pause: boolean): Operation {
  return operations.submit({
    kind: pause ? "automation.schedule.pause" : "automation.schedule.resume",
    title: `${pause ? "Pause" : "Resume"} scheduled job — ${name}`,
    resource_ref: { type: "automation", id: name, name },
    workload_category: "infrastructure",
    step_titles: [pause ? "Pause schedule" : "Resume schedule", "Notify owner"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Create a webhook endpoint — the signing secret is issued once by the server. */
export function submitWebhookCreate(url: string, events: string[]): Operation {
  return operations.submit({
    kind: "webhook.create",
    title: `Create webhook — ${url}`,
    resource_ref: { type: "webhook", id: url, name: url },
    workload_category: "infrastructure",
    step_titles: ["Validate URL (SSRF/egress checks)", "Issue signing secret", "Register event filters"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

export function submitWebhookRedeliver(deliveryId: string): Operation {
  return operations.submit({
    kind: "webhook.redeliver",
    title: `Redeliver webhook — ${deliveryId}`,
    resource_ref: { type: "webhook_delivery", id: deliveryId, name: deliveryId },
    workload_category: "infrastructure",
    step_titles: ["Replay with same signature scheme", "Record new attempt"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

export function submitWebhookTest(webhookUrl: string): Operation {
  return operations.submit({
    kind: "webhook.test",
    title: `Send test delivery — ${webhookUrl}`,
    resource_ref: { type: "webhook", id: webhookUrl, name: webhookUrl },
    workload_category: "infrastructure",
    step_titles: ["Compose ping event", "Sign and deliver", "Record result"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

export function submitWorkflowPublish(name: string, dryRun: boolean): Operation {
  return operations.submit({
    kind: dryRun ? "automation.workflow.dryrun" : "automation.workflow.publish",
    title: `${dryRun ? "Dry-run" : "Publish"} workflow — ${name}`,
    resource_ref: { type: "workflow", id: name, name },
    workload_category: "infrastructure",
    step_titles: dryRun
      ? ["Execute steps in shadow mode", "Collect step results"]
      : ["Validate trigger + steps", "Publish workflow", "Enable trigger"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

export function submitIntegrationConnect(name: string): Operation {
  return operations.submit({
    kind: "integration.connect",
    title: `Connect integration — ${name}`,
    resource_ref: { type: "integration", id: name, name },
    workload_category: "infrastructure",
    step_titles: ["OAuth/credential exchange", "Store credentials encrypted", "Verify permissions"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

export function submitIntegrationRevoke(name: string, id: string): Operation {
  return operations.submit({
    kind: "integration.revoke",
    title: `Revoke integration — ${name}`,
    resource_ref: { type: "integration", id, name },
    workload_category: "infrastructure",
    step_titles: ["Revoke credentials", "Remove scopes", "Audit the revocation"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}
