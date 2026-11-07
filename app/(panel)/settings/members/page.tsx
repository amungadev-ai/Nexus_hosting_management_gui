"use client";

import { useEffect, useState } from "react";
import type { RoleLabel } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { iamInviteRoles, type IamInvite } from "@/lib/mock/iam";
import { inviteMember, isApiError, listInvites, revokeInvite } from "@/lib/api/iam";
import { PERSONA_BY_ID } from "@/lib/personas";
import { formatRelative } from "@/lib/format";
import { useNow, useSession, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Callout, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { DataTable, TableCard } from "@/components/ui/table";

/**
 * UX-IAM-007 — Users and invitations. Member list (db.users) with role
 * labels, MFA state and status; the invite flow pairs each role with the
 * persona's job-to-be-done blurb (UI guidance only — the API decides what
 * the account may do). Invitations expire in 7 days and revocation is
 * audited.
 */
export default function MembersPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <Screen
      id="UX-IAM-007"
      breadcrumbs={[{ label: "Settings" }, { label: "Members" }]}
      actions={
        <Button icon="plus" onClick={() => setInviteOpen(true)}>
          Invite member
        </Button>
      }
    >
      <MembersBody inviteOpen={inviteOpen} closeInvite={() => setInviteOpen(false)} />
    </Screen>
  );
}

function MembersBody({ inviteOpen, closeInvite }: { inviteOpen: boolean; closeInvite: () => void }) {
  const now = useNow();
  const { organizationId } = useSession();
  const { push } = useToast();
  const [invites, setInvites] = useState<IamInvite[] | null>(null);
  const [revoking, setRevoking] = useState<IamInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listInvites(organizationId)
      .then((rows) => {
        if (alive) setInvites(rows);
      })
      .catch(() => {
        if (alive) setInvites([]);
      });
    return () => {
      alive = false;
    };
  }, [organizationId]);

  const confirmRevoke = async () => {
    if (revoking === null) return;
    setError(null);
    try {
      await revokeInvite(revoking.id);
      setInvites((prev) => (prev === null ? prev : prev.filter((i) => i.id !== revoking.id)));
      push("success", "Invitation revoked", `${revoking.email} can no longer accept — the revocation is in the audit chain.`);
    } catch (e) {
      setError(isApiError(e) ? e.problem.detail : "Revoking the invitation failed.");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <TableCard
        title="Members"
        rowKey={(u) => u.id}
        rows={db.users}
        caption="Users with access to this installation"
        columns={[
          {
            key: "display_name",
            header: "Member",
            sortable: true,
            className: "sticky left-0 bg-surface",
            render: (u) => (
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent">
                  {u.avatar_initials}
                </span>
                {u.display_name}
              </span>
            ),
          },
          { key: "email", header: "Email", sortable: true },
          {
            key: "role_labels",
            header: "Role labels",
            render: (u) => (
              <span className="flex flex-wrap gap-1">
                {u.role_labels.map((r) => (
                  <Chip key={r} tone="accent">
                    {r}
                  </Chip>
                ))}
              </span>
            ),
          },
          {
            key: "mfa_enabled",
            header: "MFA",
            render: (u) =>
              u.mfa_enabled ? <Chip tone="success">Enabled</Chip> : <Chip tone="warning">Not set up</Chip>,
          },
          {
            key: "status",
            header: "Status",
            render: (u) => (
              <Chip tone={u.status === "active" ? "success" : u.status === "locked" ? "danger" : "neutral"}>
                {u.status}
              </Chip>
            ),
          },
        ]}
      />

      {error !== null && <Callout tone="danger">{error}</Callout>}

      {invites === null ? (
        <SkeletonTable rows={2} cols={4} />
      ) : (
        <TableCard
          title="Pending invitations"
          rowKey={(i) => i.id}
          rows={invites}
          caption="Invitations awaiting acceptance"
          emptyState={
            <EmptyState
              icon="mail"
              title="No pending invitations"
              body="Invite a collaborator above — invitations expire after 7 days, and revoking one is recorded in the audit chain."
              className="py-8"
            />
          }
          columns={[
            { key: "email", header: "Email", sortable: true, className: "sticky left-0 bg-surface" },
            {
              key: "role_labels",
              header: "Roles",
              render: (i) => (
                <span className="flex flex-wrap gap-1">
                  {i.role_labels.map((r) => (
                    <Chip key={r} tone="neutral">
                      {r}
                    </Chip>
                  ))}
                </span>
              ),
            },
            {
              key: "persona_hint",
              header: "Persona hint",
              render: (i) => PERSONA_BY_ID[i.persona_hint].label,
            },
            {
              key: "expires_at",
              header: "Expires",
              sortable: true,
              render: (i) => (
                <span className={i.state === "expired" ? "text-warning" : undefined}>
                  {formatRelative(i.expires_at, now)}
                </span>
              ),
            },
            {
              key: "state",
              header: "State",
              render: (i) => <Chip tone={i.state === "pending" ? "info" : "warning"}>{i.state}</Chip>,
            },
            {
              key: "actions",
              header: "",
              render: (i) => (
                <Button variant="secondary" size="sm" onClick={() => setRevoking(i)}>
                  Revoke
                </Button>
              ),
            },
          ]}
        />
      )}

      <p className="text-xs text-ink-2">
        Role labels are UI concepts only — authorization is capability/relationship based and
        checked by the API on every request (Stage 6 §2).
      </p>

      <InviteModal
        open={inviteOpen}
        onClose={closeInvite}
        onInvited={(invite) => setInvites((prev) => (prev === null ? prev : [invite, ...prev]))}
      />

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => void confirmRevoke()}
        title={revoking !== null ? `Revoke invitation for ${revoking.email}` : "Revoke invitation"}
        body="The invitation link stops working immediately and the revocation is recorded in the audit chain. You can invite the person again later."
        confirmLabel="Revoke invitation"
        destructive
      />
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: (invite: IamInvite) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleLabel>("developer");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const { organizationId } = useSession();

  const selected = iamInviteRoles.find((r) => r.role === role);
  const personaHint = selected === undefined ? null : PERSONA_BY_ID[selected.persona_hint];

  const submit = async () => {
    setError(null);
    if (!email.includes("@") || email.length < 5) {
      setError("Enter a valid email address to invite.");
      return;
    }
    setInviting(true);
    try {
      const invite = await inviteMember({
        organization_id: organizationId,
        email: email.trim(),
        role_labels: [role],
        persona_hint: selected?.persona_hint ?? "explorer",
      });
      push(
        "success",
        `Invitation sent to ${invite.email}`,
        "The invite expires in 7 days. The account gets permissions from its capabilities, not from the label."
      );
      onInvited(invite);
      setEmail("");
      setRole("developer");
      onClose();
    } catch (e) {
      setError(isApiError(e) ? `${e.problem.title} — ${e.problem.detail}` : "Sending the invitation failed.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite member"
      description="Invitations are organization-scoped, expire in 7 days, and every revocation is audited."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={inviting} disabled={!email.includes("@")} onClick={() => void submit()}>
            Send invitation
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error !== null && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Field label="Email" htmlFor="invite-email" required>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="name@example.co.ke"
          />
        </Field>
        <Field
          label="Role label"
          htmlFor="invite-role"
          hint={
            personaHint === null
              ? undefined
              : `What this person is here to do: ${personaHint.blurb}`
          }
        >
          <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as RoleLabel)}>
            {iamInviteRoles.map((r) => (
              <option key={r.role} value={r.role}>
                {r.role}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-ink-3">
          The label only shapes the interface. What the account may actually do is decided by its
          capability/permission set on the API — persona ≠ permission.
        </p>
      </div>
    </Modal>
  );
}
