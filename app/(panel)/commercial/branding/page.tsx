"use client";

import React, { useState } from "react";
import { branding } from "@/lib/mock/commercial";
import { useToast } from "@/components/providers";
import { saveBranding } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Switch } from "@/components/ui/form";
import { Callout } from "@/components/ui/feedback";
import { CommercialGate } from "@/components/commercial/shared";

function relLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  const channels = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a: string, b: string): number | null {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export default function ResellerBrandingPage() {
  const { push } = useToast();
  const [name, setName] = useState(branding.portal_name);
  const [logo, setLogo] = useState(branding.logo_url ?? "");
  const [primary, setPrimary] = useState(branding.primary_color);
  const [buttonText, setButtonText] = useState(branding.button_text);
  const [domain, setDomain] = useState(branding.domain ?? "");
  const [published, setPublished] = useState(branding.published);

  const ratio = contrast(primary, buttonText);
  const ok = ratio !== null && ratio >= 4.5;

  const publish = (next: boolean) => {
    saveBranding({ portal_name: name, logo_url: logo.trim() === "" ? null : logo.trim(), primary_color: primary, button_text: buttonText, domain: domain.trim() === "" ? null : domain.trim(), published: next });
    setPublished(next);
    push(next ? "success" : "info", next ? "Branding published" : "Branding unpublished", next ? "The customer portal now uses your brand (data-only — no authorization effect)." : "The portal fell back to the operator brand.");
  };

  return (
    <Screen
      id="UX-COM-009"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reseller portal branding" }]}
      actions={<Button onClick={() => publish(!published)}>{published ? "Unpublish" : "Publish"}</Button>}
    >
      <CommercialGate>
        <p className="mb-4 max-w-3xl text-sm text-ink-2">
          Reseller &amp; provider surface: logo, domain and colors for the white-labeled customer portal, with a live preview.
          White-label branding is v2 scope — data-only, never a permission change.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Brand settings">
            <div className="flex flex-col gap-4">
              <Field label="Portal name" htmlFor="b-name" required><Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Logo URL" htmlFor="b-logo" hint="Optional. Prefer inline SVG logos served from your own domain."><Input id="b-logo" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.svg" /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Primary color (hex)" htmlFor="b-primary" required><Input id="b-primary" value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="#177A53" /></Field>
                <Field label="Button text color (hex)" htmlFor="b-text" required><Input id="b-text" value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="#FFFFFF" /></Field>
              </div>
              <Field label="Custom domain" htmlFor="b-domain" hint="TLS is issued automatically once the domain points at the panel."><Input id="b-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="portal.jamiihosting.co.ke" /></Field>
              {ratio !== null && (
                <Callout tone={ok ? "success" : "warning"} title={ok ? "Contrast passes WCAG 2.2 AA (4.5:1)" : `Contrast ${ratio.toFixed(2)}:1 is below 4.5:1`}>
                  Brand overrides must stay within accessibility constraints — adjust the colors until the check passes, or publishing will be honest about the failure.
                </Callout>
              )}
            </div>
          </Card>
          <Card title="Preview" description="How customers will see the branded portal">
            <div className="overflow-hidden rounded-card border border-line">
              <div className="p-4" style={{ backgroundColor: primary }}>
                <p className="text-base font-semibold" style={{ color: buttonText }}>{name}</p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-sm text-ink-2">Welcome back — your services are below.</p>
                <div className="mt-3 inline-flex items-center rounded-control px-4 py-2 text-sm font-medium" style={{ backgroundColor: primary, color: buttonText }}>
                  Open billing
                </div>
              </div>
            </div>
            <CardSection>
              <div className="flex items-center gap-3">
                <Switch checked={published} onChange={(v) => publish(v)} label={published ? "Published" : "Draft — preview only"} />
                {published ? <Chip tone="success">Live</Chip> : <Chip tone="neutral">Preview</Chip>}
              </div>
              <p className="mt-3 text-xs text-ink-3">
                Setting branding is a 201 data-only request (POST /organizations/&#123;id&#125;/branding) — it never changes what customers may do.
              </p>
            </CardSection>
          </Card>
        </div>
      </CommercialGate>
    </Screen>
  );
}
