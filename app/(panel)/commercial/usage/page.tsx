"use client";

import { hostingAccounts } from "@/lib/mock/commercial";
import { formatRelative } from "@/lib/format";
import { useNow, useOperationStream, useToast } from "@/components/providers";
import { operations } from "@/lib/operations";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { ProgressBar } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/feedback";
import { CommercialGate, useLoaded, LoadedTable } from "@/components/commercial/shared";

export default function QuotaUsagePage() {
  const now = useNow();
  const { push } = useToast();
  const { setFocusedId, setTrayOpen } = useOperationStream();
  const { loading, data } = useLoaded(() => hostingAccounts);

  const exportUsage = () => {
    const op = operations.submit({
      kind: "usage.export",
      title: "Export quota and usage report",
      resource_ref: { type: "organization", id: "org_01JKV7Q4N2" },
      workload_category: "batch",
      step_titles: ["Collect metered usage", "Package CSV", "Verify checksum"],
      actor_id: "usr_01JOWN01",
      organization_id: "org_01JKV7Q4N2",
    });
    setFocusedId(op.id);
    setTrayOpen(true);
    push("info", "Export submitted", "The CSV lands in the operation tray when the export verifies.");
  };

  return (
    <Screen
      id="UX-COM-006"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Quota and usage" }]}
      actions={<Button variant="secondary" icon="download" onClick={exportUsage}>Export</Button>}
    >
      <CommercialGate>
        <LoadedTable loading={loading}>
          <div className="grid grid-cols-1 gap-4">
            {(data ?? []).map((a) => {
              const rows: { metric: string; used: number; limit: number; unit: string }[] = [
                { metric: "Websites", used: a.resources.websites, limit: a.limits.websites, unit: "sites" },
                { metric: "Mailboxes", used: a.resources.mailboxes, limit: a.limits.mailboxes, unit: "boxes" },
                { metric: "Disk", used: a.resources.disk_gb, limit: a.limits.disk_gb, unit: "GB" },
              ];
              return (
                <Card key={a.id} title={a.name} description={`${a.customer_name} · updated ${formatRelative(a.last_verified_at, now)}`}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {rows.map((r) => {
                      const pct = r.limit > 0 ? Math.min(100, Math.round((r.used / r.limit) * 100)) : 0;
                      return (
                        <ProgressBar
                          key={r.metric}
                          label={`${r.metric}: ${r.used} / ${r.limit} ${r.unit} (reserved ceiling, not a reservation)`}
                          value={pct}
                          showValue
                          tone={pct > 80 ? "warning" : "accent"}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-ink-3">
                    Metered values come from the agent meter (source: cgroup + filesystem, refreshed with the account&apos;s last check). Quota exceeded shows its own state, never a silent clamp.
                  </p>
                </Card>
              );
            })}
          </div>
          {(data ?? []).length === 0 && (
            <EmptyState icon="trending-up" title="No usage yet" body="Usage appears once hosting accounts consume resources." action={{ label: "Create an account", href: "/commercial/accounts/new" }} />
          )}
        </LoadedTable>
      </CommercialGate>
    </Screen>
  );
}
