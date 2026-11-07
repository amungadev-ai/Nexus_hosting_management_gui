"use client";

import React from "react";
import { Screen } from "@/components/common/screen";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { pluginCatalog } from "@/lib/mock/automation";

/**
 * UX-AUTO-007 /plugins — Plugin marketplace is a v2 phase surface: the gate is
 * informative, never hidden. The v1 extension mechanism is the template catalog.
 */
export default function PluginsPage() {
  return (
    <Screen
      id="UX-AUTO-007"
      breadcrumbs={[{ label: "Plugins" }]}
    >
      <div className="flex flex-col gap-4">
        <Card
          title="Plugin marketplace is coming in v2"
          description="The plugin SDK, signed packages and publisher verification ship with v2. Nothing is hidden — this page tells you exactly what is planned and what to use today."
        >
          <p className="text-sm text-ink-2">
            The plugin marketplace is planned for v2: verified publishers, scoped
            capabilities, upgrade policy and consent screens. In v1 the extension mechanism
            is the ServiceTemplate catalog — self-hosted apps deploy from signed templates
            with the same approval discipline.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href="/templates" icon="box">
              Browse the v1 template catalog
            </ButtonLink>
            <ButtonLink href="/automation" variant="secondary" icon="zap">
              Use workflows + webhooks instead
            </ButtonLink>
          </div>
        </Card>

        <Card title="Planned catalog (preview)" description="Listed for transparency — not installable in v1">
          <ul className="divide-y divide-line">
            {pluginCatalog.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {p.name} <span className="font-normal text-ink-3">· {p.publisher}</span>
                  </p>
                  <p className="text-xs text-ink-3">{p.summary}</p>
                </div>
                <Chip tone="neutral">v{p.version} · v2</Chip>
              </li>
            ))}
          </ul>
        </Card>

        <Callout tone="info" title="Why a gate, not a hidden menu">
          Unsupported, unavailable, disabled and unauthorized are different states with
          different explanations. The marketplace is unsupported in v1 — so the page exists
          and explains, rather than disappearing from navigation.
        </Callout>
      </div>
    </Screen>
  );
}
