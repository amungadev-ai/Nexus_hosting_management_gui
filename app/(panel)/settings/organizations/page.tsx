"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Organization } from "@/lib/types";
import { createOrganization, isApiError, listOrganizations } from "@/lib/api/iam";
import { PERSONA_BY_ID } from "@/lib/personas";
import { useOperationStream, useSession, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { DataTable, TableCard } from "@/components/ui/table";

/**
 * UX-IAM-005 — Organizations. Lists owned organizations and memberships
 * (GET /organizations); creating one runs the "organization.create"
 * operation (202 pattern). The new row appears optimistically and is marked
 * "provisional" — this static prototype only pre-renders detail routes for
 * the fixture organizations (dynamicParams = false), so the provisional row
 * is not linked until a real backend serves the new id.
 */
export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [provisionalIds, setProvisionalIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { organizationId } = useSession();
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    listOrganizations()
      .then((rows) => {
        if (alive) setOrgs(rows);
      })
      .catch(() => {
        if (alive) setLoadError("GET /organizations failed in the mock layer.");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Screen
      id="UX-IAM-005"
      breadcrumbs={[{ label: "Settings" }, { label: "Organizations" }]}
      actions={
        <Button icon="plus" onClick={() => setCreateOpen(true)}>
          Create organization
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {loadError !== null && <Callout tone="warning">{loadError}</Callout>}
        {orgs === null ? (
          <SkeletonTable rows={3} cols={4} />
        ) : (
          <TableCard
            title="Owned organizations and memberships"
            rowKey={(o) => o.id}
            rows={orgs}
            caption="Organizations you own or belong to"
            onRowClick={(o) => {
              if (!provisionalIds.includes(o.id)) router.push(`/settings/organizations/${o.id}`);
            }}
            emptyState={
              <div className="px-4 py-10 text-center text-sm text-ink-2">
                No organizations yet. Create one to scope resources, members and policy — the
                switcher in the top bar picks the context.
              </div>
            }
            columns={[
              {
                key: "name",
                header: "Name",
                sortable: true,
                className: "sticky left-0 bg-surface",
                render: (o) =>
                  provisionalIds.includes(o.id) ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{o.name}</span>
                      <Chip tone="info">Provisional</Chip>
                    </span>
                  ) : (
                    <Link
                      href={`/settings/organizations/${o.id}`}
                      className="font-medium text-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {o.name}
                    </Link>
                  ),
              },
              {
                key: "organization_type",
                header: "Type",
                render: (o) => (
                  <Chip tone={o.organization_type === "standalone" ? "accent" : "neutral"}>
                    {o.organization_type}
                  </Chip>
                ),
              },
              {
                key: "primary_persona",
                header: "Primary persona",
                render: (o) =>
                  o.primary_persona === null ? (
                    <span className="text-ink-3">Not set</span>
                  ) : (
                    PERSONA_BY_ID[o.primary_persona].label
                  ),
              },
              {
                key: "context",
                header: "Context",
                render: (o) =>
                  o.id === organizationId ? (
                    <Chip tone="success">Current</Chip>
                  ) : (
                    <span className="text-xs text-ink-3">Member</span>
                  ),
              },
            ]}
          />
        )}
        <p className="text-xs text-ink-2">
          Switching organization clears scoped search, filters and selections (DS-002) — roles
          are per organization and are never assumed across orgs.
        </p>
      </div>

      <CreateOrganizationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(organization) => setOrgs((prev) => (prev === null ? prev : [organization, ...prev]))}
      />
    </Screen>
  );
}

function CreateOrganizationModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (organization: Organization) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Organization["organization_type"]>("standalone");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const { setTrayOpen } = useOperationStream();
  const router = useRouter();

  const submit = async () => {
    setError(null);
    setCreating(true);
    try {
      const { organization, operation } = await createOrganization({
        name: name.trim(),
        organization_type: type,
      });
      push(
        "success",
        `Organization "${organization.name}" submitted`,
        `Operation ${operation.id} accepted (202). The row is provisional until the job verifies in Activity → Jobs.`
      );
      setTrayOpen(true);
      onCreated(organization);
      setName("");
      setType("standalone");
      onClose();
      router.push(`/settings/organizations/${organization.id}`);
    } catch (e) {
      setError(isApiError(e) ? `${e.problem.title} — ${e.problem.detail}` : "Creating the organization failed.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create organization"
      description="Organizations scope resources, members and policy. The type is fixed after creation."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={creating} disabled={name.trim().length < 2} onClick={() => void submit()}>
            Create organization
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
        <Field label="Organization name" htmlFor="org-name" required>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wanjiku Digital (my VPS)"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Type"
          htmlFor="org-type"
          hint="Standalone = your own VPS. Provider/reseller commercial surfaces are v2+ and render the honest gate."
        >
          <Select
            id="org-type"
            value={type}
            onChange={(e) => setType(e.target.value as Organization["organization_type"])}
          >
            <option value="standalone">Standalone — personal or single-team use</option>
            <option value="provider">Provider — operates a fleet (v2+ surface)</option>
            <option value="reseller">Reseller — hosts customers under own brand (v2+)</option>
            <option value="customer">Customer — consumes provisioned resources</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
