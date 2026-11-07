"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { migrations } from "@/lib/mock/support";
import { ensureMigrationOperations } from "@/lib/api/support";
import { formatRelative, formatUtc } from "@/lib/format";
import { useNow } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { Callout, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { MigrationStatePill, useFixture } from "@/components/support/shared";

/**
 * UX-SUP-002 /migrations — migration hub. The three fixture migrations cover
 * completed / running / conflicts states. Rows route honestly: a migration
 * paused for conflicts goes to its conflict-resolution screen; everything
 * else opens its live operation in the activity center. cPanel/DirectAdmin/
 * Plesk imports are v2 scope per the registry note — the v1 path is
 * ServiceTemplate export/import.
 */

const KIND_LABEL: Record<string, string> = {
  cpanel_import: "cPanel import",
  service_template: "Template transfer",
};

export default function MigrationHubPage() {
  const now = useNow();
  const router = useRouter();

  const rows = useFixture(() => {
    // Attach the live/finished operations for running + completed fixtures.
    ensureMigrationOperations();
    return [...migrations];
  });

  return (
    <Screen
      id="UX-SUP-002"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Migrations" }]}
      actions={
        <ButtonLink href="/migrations/new" icon="plus">
          New migration
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="max-w-3xl text-sm text-ink-2">
          Source platforms, compatibility and import status. Migrations run as batch jobs — they
          queue when your websites are busy and never block serving traffic.
        </p>

        <Callout tone="info" title="Which migration path applies to you?">
          Importing from cPanel, DirectAdmin or Plesk is planned for v2 — the wizard prototypes that
          flow honestly. Today&apos;s supported path is VPS-to-VPS via ServiceTemplate export/import:{" "}
          <a href="/settings/templates/transfer" className="font-medium text-accent hover:underline">
            Settings → Template transfer
          </a>
          .
        </Callout>

        {rows === null ? (
          <SkeletonTable rows={3} cols={5} />
        ) : (
          <DataTable
            caption="Migrations"
            rowKey={(m) => m.id}
            rows={rows}
            onRowClick={(m) => {
              if (m.conflicts > 0) {
                router.push(`/migrations/${m.id}/conflicts`);
              } else if (m.operation_id !== undefined) {
                router.push(`/activity/jobs/${m.operation_id}`);
              }
            }}
            columns={[
              {
                key: "source_label",
                header: "Migration",
                className: "sticky left-0 bg-surface",
                render: (m) => (
                  <span className="font-medium text-ink">
                    {m.source_label}
                    {m.state === "conflicts" && (
                      <a
                        href={`/migrations/${m.id}/conflicts`}
                        className="ml-2 whitespace-nowrap font-medium text-accent hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Resolve conflicts
                      </a>
                    )}
                  </span>
                ),
                sortable: true,
              },
              { key: "kind", header: "Kind", render: (m) => <Chip tone={m.kind === "cpanel_import" ? "info" : "accent"}>{KIND_LABEL[m.kind] ?? m.kind}</Chip> },
              { key: "state", header: "Status", render: (m) => <MigrationStatePill state={m.state} /> },
              { key: "items", header: "Items", render: (m) => String(m.items) },
              {
                key: "conflicts",
                header: "Conflicts",
                render: (m) =>
                  m.conflicts > 0 ? (
                    <Chip tone="warning">{String(m.conflicts)}</Chip>
                  ) : (
                    <span className="text-xs text-ink-3">0</span>
                  ),
              },
              {
                key: "started_at",
                header: "Started",
                render: (m) => (
                  <span className="whitespace-nowrap text-xs text-ink-3" title={formatUtc(m.started_at)}>
                    {formatRelative(m.started_at, now)}
                  </span>
                ),
                sortable: true,
              },
            ]}
            emptyState={
              <EmptyState
                icon="box"
                title="No migrations yet"
                body="Start a migration from a cPanel-style source (v2 flow) or move an instance between VPS installs with a ServiceTemplate export."
                action={{ label: "New migration", href: "/migrations/new" }}
                secondaryAction={{ label: "Template transfer", href: "/settings/templates/transfer" }}
              />
            }
          />
        )}

        <Card title="How conflicts are handled" description="A paused import is never a failure.">
          <p className="text-sm text-ink-2">
            When the dry-run finds a name clash, a runtime mismatch or a database-prefix collision,
            the import pauses at the conflict-review stage — nothing has been written yet. You pick
            keep / skip / rename per conflict, apply, and the import resumes and verifies checksums
            before any cutover. Rolling back at that stage discards only the staged copy.
          </p>
        </Card>
      </div>
    </Screen>
  );
}
