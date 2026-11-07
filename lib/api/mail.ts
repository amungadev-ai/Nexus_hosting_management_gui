import type { Mailbox } from "@/lib/mock/mail";
import { catchAll, mailAliases, mailboxes, smtpConfig } from "@/lib/mock/mail";
import { operations } from "@/lib/operations";
import { currentOrganization, currentUser } from "@/lib/api/me";
import { newId, problem, ApiError } from "@/lib/api/core";

/**
 * Mail mock API (Stage 6 §4.11 — v1 email is external SMTP only; self-hosted
 * mailboxes are the v2 capability and their screens gate honestly). Async
 * work (test send, provisioning) submits operations; configuration changes
 * are direct 201-style data mutations.
 */

function actor(): { actor_id: string; organization_id: string } {
  return { actor_id: currentUser().id, organization_id: currentOrganization().id };
}

export function saveSmtpConfig(patch: { provider?: typeof smtpConfig.provider; host?: string; port?: number; username?: string; from_address?: string; enabled?: boolean }): void {
  Object.assign(smtpConfig, patch);
}

/** POST /email/external-smtp/test — verify credentials (durable operation). */
export function sendTestEmail(recipient: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Invalid recipient", "Enter a valid email address for the test message."));
  }
  return operations.submit({
    kind: "mail.test",
    title: `Send SMTP test message to ${recipient}`,
    resource_ref: { type: "smtp_config", id: smtpConfig.id, name: smtpConfig.from_address },
    workload_category: "serving",
    step_titles: ["Resolve provider endpoint", "Authenticate with stored credentials", "Send test message", "Verify acceptance by relay"],
    ...actor(),
  });
}

export function createMailbox(address: string, quotaMb: number) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Invalid mailbox address", "Use a full address like hello@wanjiku.co.ke."));
  }
  if (mailboxes.some((m) => m.address === address)) {
    throw new ApiError(problem(409, "CONFLICT", "Mailbox already exists", `A mailbox for ${address} already exists.`));
  }
  const box: Mailbox = {
    id: newId("mbox"),
    address,
    quota_mb: quotaMb,
    used_mb: 0,
    state: "active",
    forwarders: [],
    created_at: new Date().toISOString(),
  };
  mailboxes.push(box);
  const op = operations.submit({
    kind: "mail.mailbox.provision",
    title: `Provision mailbox ${address}`,
    resource_ref: { type: "mailbox", id: box.id, name: address },
    workload_category: "serving",
    step_titles: ["Create mailbox storage", "Set quota and policy", "Generate credentials", "Verify IMAP/SMTP login"],
    ...actor(),
  });
  return { mailbox: box, operation_id: op.id };
}

/** Returns a one-time generated password — the UI shows it once (DS-008). */
export function resetMailboxPassword(id: string): string {
  const box = mailboxes.find((m) => m.id === id);
  if (!box) throw new ApiError(problem(404, "NOT_FOUND", "Mailbox not found", "That mailbox does not exist."));
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 16; i++) pw += alphabet[Math.floor(Math.random() * alphabet.length)];
  return pw;
}

export function deleteMailbox(id: string): void {
  const idx = mailboxes.findIndex((m) => m.id === id);
  if (idx < 0) throw new ApiError(problem(404, "NOT_FOUND", "Mailbox not found", "That mailbox does not exist."));
  mailboxes.splice(idx, 1);
}

export function createAlias(source: string, target: string): void {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(source) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Invalid alias", "Source and target must be full email addresses."));
  }
  if (source === target) {
    throw new ApiError(problem(422, "LOOP_DETECTED", "Alias loop", "An alias cannot forward to itself."));
  }
  if (mailAliases.some((a) => a.source === source)) {
    throw new ApiError(problem(409, "CONFLICT", "Alias already exists", `An alias for ${source} already exists.`));
  }
  mailAliases.push({ id: newId("mal"), source, target, state: "active" });
}

export function deleteAlias(id: string): void {
  const idx = mailAliases.findIndex((a) => a.id === id);
  if (idx < 0) throw new ApiError(problem(404, "NOT_FOUND", "Alias not found", "That alias does not exist."));
  mailAliases.splice(idx, 1);
}

export function setCatchAll(target: string | null): void {
  if (target !== null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
    throw new ApiError(problem(422, "SEMANTICALLY_INVALID", "Invalid target", "The catch-all target must be a full email address."));
  }
  catchAll.target = target;
}

/** POST /email/queue retry — durable redelivery operation. */
export function retryQueuedMessage(id: string, recipient: string) {
  return operations.submit({
    kind: "mail.queue.redeliver",
    title: `Retry delivery to ${recipient}`,
    resource_ref: { type: "mail_queue", id, name: recipient },
    workload_category: "serving",
    step_titles: ["Requeue message", "Attempt delivery", "Record final delivery state"],
    ...actor(),
  });
}
