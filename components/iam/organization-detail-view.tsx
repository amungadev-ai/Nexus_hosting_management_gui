"use client";

import { useEffect, useMemo, useState } from "react";
import type { Organization, UserAccount } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { iamMemberships, type IamInvite } from "@/lib/mock/iam";
import { isApiError, listInvites, revokeInvite } from "@/lib/api/iam";
import { formatRelative } from "@/lib/format";
import { useNow, useSession, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Callout, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { DataTable, TableCard } from "@/components/ui/table";
import { KeyValue } from "@/components/ui/misc";
import { PERSONA_BY_ID } from "@/lib/personas";

/**
 * UX-IAM-006 — Organization detail (client view for /settings/organizations/[org]).
 * Members (filtered db.users × memberships), pending invitations with expiry
 * and revocation, the DS-002 "switch context" action, and the honest v2+
 * branding note. Unknown ids render an honest not-found (the static export
 * only pre-renders fixture organizations).
 */
export function OrganizationDetailView({ orgId }: { orgId: string }) {
  const organization = useMemo<Organization | undefined>(
    () => db.organizations.find((o) => o.id === orgId),
    [orgId]
  );

  if (organization === undefined) {
    return (
      <Screen id="UX-IAM-006" breadcrumbs={[{ label: "Settings" }, { label: "Organizations", href: "/settings/organizations" }, { label: "Not found" }]}>
        <EmptyState
          icon="help-circle"
          title="Organization not found"
          body={`No organization "${orgId}" exists in this prototype build — detail pages are pre-rendered for the fixture organizations only.`}
          action={{ label: "Back to organizations", href: "/settings/organizations" }}
        />
      </Screen>
    );
  }

  return <OrganizationDetail organization={organization} />;
}

function OrganizationDetail({ organization }: { organization: Organization }) {
  const now = useNow();
  const { organizationId, setOrganizationId } = useSession();
  const { push } = useToast();
  const [inviteList, setInviteList] = useState<IamInvite[] | null>(null);
  const [revoking, setRevoking] = useState<IamInvite | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const members = useMemo<UserAccount[]>(
    () =>
      iamMemberships
        .filter((m) => m.organization_id === organization.id)
        .map((m) => db.users.find((u) => u.id === m.user_id))
        .filter((u): u is UserAccount => u !== undefined),
    [organization.id]
  );

  // GET /organizations/{id}/invitations — with an honest loading state.
  useEffect(() => {
    let alive = true;
    listInvites(organization.id)
      .then((rows) => {
        if (alive) setInviteList(rows);
      })
      .catch(() => {
        if (alive) setInviteList([]);
      });
    return () => {
      alive = false;
    };
  }, [organization.id]);

  const isCurrent = organizationId === organization.id;

  const switchTo = () => {
    setOrganizationId(organization.id);
    push(
      "info",
      `Switched to ${organization.name}`,
      "Scoped search, filters and selections were cleared — roles are evaluated per organization."
    );
  };

  const confirmRevoke = async () => {
    if (revoking === null) return;
    setRevokeError(null);
    try {
      await revokeInvite(revoking.id);
      setInviteList((prev) => (prev === null ? prev : prev.filter((i) => i.id !== revoking.id)));
      push("success", "Invitation revoked", `${revoking.email} can no longer accept the invitation. The revocation was audited.`);
    } catch (e) {
      setRevokeError(isApiError(e) ? e.problem.detail : "Revoking the invitation failed.");
    } finally {
      setRevoking(null);
    }
  };

  const displayedInvites = inviteList;

  return (
    <Screen
      id="UX-IAM-006"
      breadcrumbs={[
        { label: "Settings" },
        { label: "Organizations", href: "/settings/organizations" },
        { label: organization.name },
      ]}
      actions={
        isCurrent ? (
          <Chip tone="success">Current context</Chip>
        ) : (
          <Button icon="refresh" onClick={switchTo}>
            Switch to this organization
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <section className="rounded-card border border-line bg-surface p-4 sm:p-6">
          <KeyValue
            columns={2}
            items={[
              { label: "Organization", value: organization.name },
              { label: "ID", value: organization.id, mono: true },
              { label: "Type", value: <Chip tone={organization.organization_type === "standalone" ? "accent" : "neutral"}>{organization.organization_type}</Chip> },
              {
                label: "Primary persona",
                value:
                  organization.primary_persona === null ? (
                    <span className="text-ink-3">Not set</span>
                  ) : (
                    PERSONA_BY_ID[organization.primary_persona].label
                  ),
              },
            ]}
          />
          <p className="mt-4 border-t border-line pt-3 text-sm text-ink-2">
            Branding note: organization logo, colors and portal domain are white-label territory
            — deferred to v2+ (UX-AUTO-009 / UX-COM-009). Roles and limits beyond membership are
            evaluated by the API, not the UI.
          </p>
        </section>

        <MembersTable members={members} />

        {revokeError !== null && <Callout tone="danger">{revokeError}</Callout>}
        {displayedInvites === null ? (
          <SkeletonTable rows={2} cols={4} />
        ) : (
          <TableCard
            title="Pending invitations"
            rowKey={(i) => i.id}
            rows={displayedInvites}
            caption="Invitations for this organization"
            emptyState={
              <EmptyState
                icon="mail"
                title="No pending invitations"
                body="Invite collaborators from Members & invitations — invitations expire after 7 days and are audited when revoked."
                action={{ label: "Open Members & invitations", href: "/settings/members" }}
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
                render: (i) => (
                  <Chip tone={i.state === "pending" ? "info" : "warning"}>{i.state}</Chip>
                ),
              },
              {
                key: "actions",
                header: "",
                render: (i) => (
                  <Button variant="secondary" size="sm" onClick={() => setRevoking(i)}>
                    Revoke invite
                  </Button>
                ),
              },
            ]}
          />
        )}
      </div>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => void confirmRevoke()}
        title={revoking !== null ? `Revoke invitation for ${revoking.email}` : "Revoke invitation"}
        body="The invitation link stops working immediately and the revocation is recorded in the audit chain. The person can be invited again later."
        confirmLabel="Revoke invitation"
        destructive
      />
    </Screen>
  );
}

function MembersTable({ members }: { members: UserAccount[] }) {
  return (
    <TableCard
      title="Members"
      rowKey={(u) => u.id}
      rows={members}
      caption="Members of this organization"
      emptyState={
        <EmptyState
          icon="users"
          title="No members yet"
          body="Invite the first member from Members & invitations — every membership is scoped to one organization."
          action={{ label: "Invite a member", href: "/settings/members" }}
          className="py-8"
        />
      }
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
            u.mfa_enabled ? (
              <Chip tone="success">Enabled</Chip>
            ) : (
              <Chip tone="warning">Not set up</Chip>
            ),
        },
      ]}
    />
  );
}
