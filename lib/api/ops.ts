import { db } from "@/lib/mock/data";
import { operations } from "@/lib/operations";
import type { Operation } from "@/lib/types";

/**
 * Ops-module API client (§4.12 backups, §4.13 security, §4.14 monitoring).
 * Every mutation goes through operations.submit() — the 202+operation pattern —
 * so the operation tray, the batch queue indicator (DS-023) and audit trails
 * react automatically. Batch workloads carry workload_category "batch".
 */

interface ResourceRefLike {
  type: string;
  id: string;
  name?: string;
}

const ACTOR = { actor_id: db.currentUser, organization_id: db.currentOrganization } as const;

/** Back up now — a batch job; it queues behind serving traffic (DS-023). */
export function submitBackupNow(resource: ResourceRefLike, destination: "remote" | "local" = "remote"): Operation {
  return operations.submit({
    kind: "backup.create",
    title: `Backup — ${resource.name ?? resource.id}`,
    resource_ref: resource,
    workload_category: "batch",
    yields_once: true,
    step_titles:
      destination === "remote"
        ? ["Snapshot files (restic)", "Snapshot database", "Upload to B2 bucket", "Verify snapshot integrity"]
        : ["Snapshot files to local disk", "Verify snapshot integrity"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Policy edit (schedule/retention/destination) — infrastructure config change. */
export function submitPolicyUpdate(policyName: string): Operation {
  return operations.submit({
    kind: "backup.policy.update",
    title: `Update backup policy — ${policyName}`,
    resource_ref: { type: "backup_policy", id: policyName, name: policyName },
    workload_category: "infrastructure",
    step_titles: ["Validate schedule and retention", "Apply policy", "Recompute next runs"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Destination connectivity test — uploads and deletes a 1 KB probe (batch). */
export function submitDestinationTest(destinationName: string, destinationId: string): Operation {
  return operations.submit({
    kind: "backup.destination.test",
    title: `Test connection — ${destinationName}`,
    resource_ref: { type: "backup_destination", id: destinationId, name: destinationName },
    workload_category: "batch",
    step_titles: ["Resolve endpoint", "Authenticate with stored key", "Upload 1 KB probe", "Delete probe"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Connect a new remote destination — the secret is stored server-side only. */
export function submitDestinationConnect(name: string): Operation {
  return operations.submit({
    kind: "backup.destination.connect",
    title: `Connect backup destination — ${name}`,
    resource_ref: { type: "backup_destination", id: name, name },
    workload_category: "infrastructure",
    step_titles: ["Validate endpoint + bucket", "Store credentials encrypted", "Upload first probe"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Governed restore — batch, per FLOW-008. */
export function submitRestore(resource: ResourceRefLike, snapshotLabel: string): Operation {
  return operations.submit({
    kind: "backup.restore",
    title: `Restore ${resource.name ?? resource.id} from ${snapshotLabel}`,
    resource_ref: resource,
    workload_category: "batch",
    yields_once: true,
    step_titles: [
      "Enumerate overwritten resources",
      "Download snapshot from B2",
      "Restore files (atomic)",
      "Health-check restored site",
    ],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Restore-test verification — restore to a disposable target (batch). */
export function submitBackupVerify(backupId: string, backupLabel: string): Operation {
  return operations.submit({
    kind: "backup.verify",
    title: `Verify restore — ${backupLabel}`,
    resource_ref: { type: "backup", id: backupId, name: backupLabel },
    workload_category: "batch",
    step_titles: ["Download snapshot", "Restore to disposable target", "Compare checksums", "Record verification"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/**
 * Firewall change (§4.13). High-risk: the screen's toast states that the
 * second-person approval request went to /approvals; the operation enters
 * the same durable pipeline as every other mutation.
 */
export function submitFirewallApply(summary: string): Operation {
  return operations.submit({
    kind: "firewall.apply",
    title: summary,
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: ["Preview rule diff", "Second-person approval", "firewall.apply", "Verify SSH session survives"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Add an SSH public key — the private key never leaves the client. */
export function submitSshKeyAdd(keyName: string): Operation {
  return operations.submit({
    kind: "ssh.key.add",
    title: `Add SSH key — ${keyName}`,
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: ["Parse public key", "Record fingerprint", "Install authorized_keys entry"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

export function submitSshKeyRevoke(keyName: string, keyId: string): Operation {
  return operations.submit({
    kind: "ssh.key.revoke",
    title: `Revoke SSH key — ${keyName}`,
    resource_ref: { type: "ssh_key", id: keyId, name: keyName },
    workload_category: "infrastructure",
    step_titles: ["Remove authorized_keys entry", "Audit the revocation"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Alert rule create / silence (§4.14). */
export function submitAlertRuleCreate(name: string): Operation {
  return operations.submit({
    kind: "monitoring.alert.create",
    title: `Create alert rule — ${name}`,
    resource_ref: { type: "alert_rule", id: name, name },
    workload_category: "infrastructure",
    step_titles: ["Validate threshold", "Register rule", "Confirm delivery channel"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

export function submitAlertSilence(name: string): Operation {
  return operations.submit({
    kind: "monitoring.alert.silence",
    title: `Silence alert — ${name}`,
    resource_ref: { type: "alert_rule", id: name, name },
    workload_category: "infrastructure",
    step_titles: ["Apply silence window", "Notify subscribers"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Panel self-update check + apply (UX-OPS-017). */
export function submitUpdateCheck(): Operation {
  return operations.submit({
    kind: "panel.update.check",
    title: "Check for panel updates",
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: ["Query release channel", "Verify release signature", "Compare compatibility"],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

export function submitUpdateApply(version: string): Operation {
  return operations.submit({
    kind: "panel.update.apply",
    title: `Update panel to ${version}`,
    resource_ref: { type: "server", id: db.server.id, name: db.server.name },
    workload_category: "infrastructure",
    step_titles: [
      "Pre-update backup (panel database)",
      "Download + signature-verify release",
      "Apply update in maintenance window",
      "Post-update health check",
    ],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** Adjust a workload cgroup ceiling — kind resource.limit.update (§4.5). */
export function submitLimitUpdate(workloadName: string, beforeMb: number, afterMb: number): Operation {
  return operations.submit({
    kind: "resource.limit.update",
    title: `Adjust memory.max — ${workloadName}`,
    resource_ref: { type: "workload", id: workloadName, name: workloadName },
    workload_category: "infrastructure",
    step_titles: [
      "Validate ceiling (≤ physical × 1.2)",
      "Apply cgroup memory.max",
      "Verify value applied",
    ],
    actor_id: ACTOR.actor_id,
    organization_id: ACTOR.organization_id,
  });
}

/** CSV export shared by audit/logs/metrics/verification screens. */
export function downloadCsv(filename: string, header: string[], rows: string[][]): void {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const text = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
