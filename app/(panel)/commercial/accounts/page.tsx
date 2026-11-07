"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { hostingAccounts, hostingPackages } from "@/lib/mock/commercial";
import { formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { CommercialGate, useLoaded, LoadedTable, AccountStateChip } from "@/components/commercial/shared";

export default function HostingAccountsPage() {
  const now = useNow();
  const router = useRouter();
  const { loading, data } = useLoaded(() => hostingAccounts);
  const packageLabel = (id: string) => hostingPackages.find((p) => p.id === id)?.name ?? "—";

  return (
    <Screen
      id="UX-COM-001"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Hosting accounts" }]}
      actions={<ButtonLink href="/commercial/accounts/new" icon="plus">New account</ButtonLink>}
    >
      <CommercialGate>
        <p className="mb-4 max-w-3xl text-sm text-ink-2">
          Owned customer hosting accounts with state, package and limits. Provider
          surface (v2 scope) — demoed with the Wanjiku Digital customer set.
        </p>
        <LoadedTable loading={loading}>
          <DataTable
            caption="Hosting accounts"
            rowKey={(a) => a.id}
            rows={data ?? []}
            onRowClick={(a) => {
              router.push(`/commercial/accounts/${a.id}`);
            }}
            columns={[
              {
                key: "name",
                header: "Account",
                className: "sticky left-0 bg-surface",
                render: (a) => (
                  <Link href={`/commercial/accounts/${a.id}`} className="font-medium text-accent hover:underline">
                    {a.name}
                  </Link>
                ),
                sortable: true,
              },
              { key: "customer_name", header: "Customer", sortable: true },
              { key: "package", header: "Package", render: (a) => packageLabel(a.package_id) },
              { key: "sites", header: "Sites", render: (a) => String(a.site_ids.length) },
              { key: "state", header: "State", render: (a) => <AccountStateChip state={a.state} /> },
              {
                key: "last_verified_at",
                header: "Last checked",
                render: (a) => <span className="whitespace-nowrap text-xs text-ink-3">{formatRelative(a.last_verified_at, now)}</span>,
              },
            ]}
            emptyState={
              <EmptyState
                icon="folder"
                title="No hosting accounts yet"
                body="Hosting accounts group a customer's sites, mailboxes and quotas. Create the first account to start reselling."
                action={{ label: "New account", href: "/commercial/accounts/new" }}
              />
            }
          />
        </LoadedTable>
      </CommercialGate>
    </Screen>
  );
}
