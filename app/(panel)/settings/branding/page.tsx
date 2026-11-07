"use client";

import React from "react";
import { Screen } from "@/components/common/screen";
import { UnsupportedState } from "@/components/common/states";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";

/**
 * UX-AUTO-009 /settings/branding — White-label settings, v2 phase. The gate is
 * informative (never hidden) and shows exactly what branding will control.
 */
export default function BrandingPage() {
  return (
    <Screen
      id="UX-AUTO-009"
      breadcrumbs={[{ label: "Settings" }, { label: "White-label" }]}
    >
      <div className="flex flex-col gap-4">
        <UnsupportedState
          title="White-label branding is planned for v2"
          body="Brand tokens, assets, a branded portal domain and email-template previews arrive with the v2 reseller/commercial surface (paired with reseller portal branding). Overrides will stay within accessibility constraints."
          action={{ label: "See the commercial roadmap screens", href: "/commercial/branding" }}
        />
        <Card title="What branding will control" description="Preview of the v2 scope — nothing is editable yet, and no fake controls are shown.">
          <ul className="flex list-none flex-col gap-1.5 p-0 text-sm text-ink-2">
            <li>• Brand tokens — accent color, logo, favicon (contrast-validated against the palette).</li>
            <li>• Portal domain — branded sign-in on your own hostname with managed TLS.</li>
            <li>• Email templates — notification mail carrying your identity.</li>
            <li>• Preview — every change renders before it publishes.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="neutral">v2 scope</Chip>
            <ButtonLink href="/overview/capabilities" variant="secondary" size="sm">
              What this VPS can run today
            </ButtonLink>
          </div>
        </Card>
      </div>
    </Screen>
  );
}
