"use client";

import React, { useState } from "react";
import type { ApprovalRequest } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { requestStepUp } from "@/lib/api/me";
import { decideApproval } from "@/lib/api/overview";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { ImpactReview, Modal } from "@/components/ui/overlay";
import { Icon } from "@/components/ui/icons";
import { formatCountdown, formatRelative } from "@/lib/format";

/**
 * UX-OV-006 — Approvals inbox: pending second-person approvals with impact,
 * policy and expiry. Approve = ImpactReview → step-up → decision record
 * (the linked operation proceeds server-side). Reject = reason modal.
 */
export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalRequest[]>(() => db.approvals);
  const [reviewFor, setReviewFor] = useState<ApprovalRequest | null>(null);
  const [rejectFor, setRejectFor] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();

  const removeItem = (id: string) => setItems((prev) => prev.filter((a) => a.id !== id));

  const approve = async (a: ApprovalRequest) => {
    setBusyId(a.id);
    try {
      await requestStepUp("approval.decide", a.id);
      await decideApproval(a, "approved");
      push("success", "Approval recorded", `“${a.title}” was approved — the linked job proceeds and stays auditable.`);
      removeItem(a.id);
      setTrayOpen(true);
    } catch {
      push("error", "Step-up verification failed", "The approval was not recorded. Try again — attempts are limited.");
    } finally {
      setBusyId(null);
      setReviewFor(null);
    }
  };

  const reject = async (a: ApprovalRequest) => {
    setBusyId(a.id);
    try {
      await decideApproval(a, "rejected", rejectReason);
      push("info", "Approval rejected", `“${a.title}” was rejected with a reason — the requester is notified and it is audited.`);
      removeItem(a.id);
    } finally {
      setBusyId(null);
      setRejectFor(null);
      setRejectReason("");
    }
  };

  return (
    <Screen id="UX-OV-006" breadcrumbs={[{ label: "Approvals" }]}>
      <div className="flex flex-col gap-4">
        {items.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title="No approvals waiting"
            body="You're all caught up. Approvals appear here when a policy requires a second person — for example firewall changes — and they expire if not decided in time."
            action={{ label: "Open activity", href: "/activity" }}
          />
        ) : (
          <p className="text-sm text-ink-2">
            {items.length} decision{items.length === 1 ? "" : "s"} waiting. Approving requires step-up verification
            bound to this exact decision — every outcome is audited.
          </p>
        )}

        {items.map((a) => {
          const secsLeft = Math.max(0, Math.floor((new Date(a.expires_at).getTime() - now.getTime()) / 1000));
          const expired = secsLeft === 0;
          return (
            <Card
              key={a.id}
              title={a.title}
              description={`Requested by ${a.requested_by} · ${formatRelative(a.expires_at, now)} deadline`}
              actions={
                <>
                  <Button
                    size="sm"
                    icon="check"
                    loading={busyId === a.id}
                    onClick={() => setReviewFor(a)}
                  >
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setRejectFor(a)} disabled={busyId === a.id}>
                    Reject
                  </Button>
                </>
              }
            >
              <p className="text-sm text-ink-2">{a.reason}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip tone="info">{a.policy}</Chip>
                <Chip tone={expired ? "danger" : secsLeft < 1800 ? "warning" : "neutral"}>
                  <Icon name="clock" size={12} />
                  {expired ? "expired — will be auto-rejected" : `expires in ${formatCountdown(a.expires_at, now)}`}
                </Chip>
                <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                  <Icon name="info" size={12} />
                  affects {a.impact.affected_resources.join(", ")}
                </span>
              </div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink-3">Downtime estimate</dt>
                  <dd className="mt-0.5 text-ink">{a.impact.downtime_estimate}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Reversibility</dt>
                  <dd className="mt-0.5 text-ink">{a.impact.reversibility}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Linked job</dt>
                  <dd className="mt-0.5 font-mono text-xs text-ink">{a.operation_id}</dd>
                </div>
              </dl>
              {busyId === a.id && (
                <p className="mt-3 flex items-center gap-2 text-xs text-ink-2">
                  <Spinner size={13} /> Waiting for step-up verification…
                </p>
              )}
            </Card>
          );
        })}

        {reviewFor !== null && (
          <ImpactReview
            open
            onClose={() => setReviewFor(null)}
            onSubmit={() => void approve(reviewFor)}
            title={`Approve: ${reviewFor.title}`}
            impact={{
              before: reviewFor.impact.before,
              after: reviewFor.impact.after,
              affectedResources: reviewFor.impact.affected_resources,
              downtimeEstimate: reviewFor.impact.downtime_estimate,
              reversibility: reviewFor.impact.reversibility,
            }}
            diff={reviewFor.diff}
            submitLabel={busyId !== null ? "Recording…" : "Approve and record"}
          />
        )}

        {rejectFor !== null && (
          <Modal
            open
            onClose={() => setRejectFor(null)}
            title={`Reject: ${rejectFor.title}`}
            description="A short reason is required — the requester sees it and the decision is audited."
            footer={
              <>
                <Button variant="secondary" onClick={() => setRejectFor(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={rejectReason.trim().length < 4 || busyId !== null}
                  loading={busyId === rejectFor.id}
                  onClick={() => void reject(rejectFor)}
                >
                  Record rejection
                </Button>
              </>
            }
          >
            <Field
              label="Reason"
              htmlFor="reject-reason"
              required
              hint="Plain language, e.g. “wrong source range — use the office IP”."
            >
              <Textarea id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </Field>
          </Modal>
        )}
      </div>
    </Screen>
  );
}
