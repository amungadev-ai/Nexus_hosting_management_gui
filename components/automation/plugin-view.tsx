"use client";

import { Screen } from "@/components/common/screen";
import { UnsupportedState } from "@/components/common/states";
import { NotFoundInline } from "@/components/common/states";
import { ButtonLink } from "@/components/ui/button";
import { KeyValue } from "@/components/ui/misc";
import { pluginCatalog } from "@/lib/mock/automation";

/**
 * UX-AUTO-008 /plugins/:plugin — plugin detail and consent. v2 phase: an
 * informative gate naming the plugin, with the roadmap and the v1 alternative.
 */
export function PluginDetailView({ pluginId }: { pluginId: string }) {
  const plugin = pluginCatalog.find((p) => p.id === pluginId);

  if (plugin === undefined) {
    return (
      <Screen id="UX-AUTO-008" breadcrumbs={[{ label: "Plugins", href: "/plugins" }, { label: "Not found" }]}>
        <NotFoundInline what="plugin" />
      </Screen>
    );
  }

  return (
    <Screen
      id="UX-AUTO-008"
      breadcrumbs={[{ label: "Plugins", href: "/plugins" }, { label: plugin.name }]}
    >
      <div className="flex flex-col gap-4">
        <UnsupportedState
          title={`${plugin.name} installs in v2`}
          body="The plugin marketplace is planned for v2 — signed packages, publisher verification, scoped capabilities and consent before install. In v1 you can achieve most of this with the template catalog or a workflow."
          action={{ label: "Browse the v1 template catalog", href: "/templates" }}
        />
        <div className="rounded-card border border-line bg-surface p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-ink">What the consent screen will check</h3>
          <div className="mt-3">
            <KeyValue
              columns={2}
              items={[
                { label: "Plugin", value: plugin.name },
                { label: "Publisher", value: plugin.publisher },
                { label: "Version", value: `v${plugin.version}` },
                { label: "Summary", value: plugin.summary },
                { label: "Granted capabilities", value: "Least privilege, enumerated at install, revocable" },
                { label: "Network access", value: "Egress allow-list only" },
                { label: "Upgrade policy", value: "Signed updates only; user approves major bumps" },
                { label: "Data access", value: "Scoped, audited, revocable" },
              ]}
            />
          </div>
          <div className="mt-4">
            <ButtonLink href="/automation/webhooks" variant="secondary" size="sm">
              v1 alternative: react to events with webhooks
            </ButtonLink>
          </div>
        </div>
      </div>
    </Screen>
  );
}
