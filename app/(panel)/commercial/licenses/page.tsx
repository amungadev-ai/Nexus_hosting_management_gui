"use client";

import React, { useState } from "react";
import { license } from "@/lib/mock/commercial";
import { formatDate, formatRelative } from "@/lib/format";
import { useNow, useToast } from "@/components/providers";
import { activateLicense, renewLicense } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { CopyButton, SecretField } from "@/components/ui/code";
import { KeyValue, ProgressBar } from "@/components/ui/misc";
import { Callout } from "@/components/ui/feedback";

export default function LicensingPage() {
  const now = useNow();
  const { push } = useToast();
  const [activateOpen, setActivateOpen] = useState(false);
  const [key, setKey] = useState("");

  const demoKey = "NXP-DEMO-2026-8F2K";

  return (
    <Screen
      id="UX-COM-012"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Licensing" }]}
      description="License state, seats and activation — the sole v1 commercial surface: a single-owner installation activates the panel here."
      actions={
        <>
          <Button variant="secondary" onClick={() => { renewLicense(); push("success", "License renewed", `Active until ${formatDate(license.expires_at)}.`); }}>Renew</Button>
          <Button onClick={() => setActivateOpen(true)}>Activate a key</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="License" description="Entitlements reported by GET /licenses/current">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={license.status === "active" ? "success" : license.status === "grace" ? "warning" : "danger"}>
              {license.status === "active" ? "Active" : license.status === "grace" ? "Offline grace" : "Inactive"}
            </Chip>
            <span className="text-xs text-ink-3">last checked {formatRelative(license.expires_at, now)}</span>
          </div>
          <CardSection>
            <KeyValue
              items={[
                { label: "Expires", value: formatDate(license.expires_at) },
                { label: "Offline grace until", value: formatDate(license.offline_grace_until) },
                { label: "Nodes", value: String(license.nodes) },
                { label: "Features", value: license.features.join(", ") },
              ]}
              columns={2}
            />
          </CardSection>
          <CardSection>
            <SecretField label="License key" value={demoKey} />
          </CardSection>
        </Card>
        <Card title="Seats" description="Operator seats included with this license">
          <ProgressBar label={`${license.seats_used} of ${license.seats_total} seats in use`} value={license.seats_used} max={license.seats_total} showValue tone={license.seats_used / license.seats_total > 0.8 ? "warning" : "accent"} />
          <CardSection>
            <p className="text-sm text-ink-2">
              Seats cover operator sign-ins; nodes cover enrolled servers. Renewal keeps both — expiry drops the panel into a read-only grace window (7–14 days) before features lock.
            </p>
            <div className="mt-3"><CopyButton text={demoKey} label="Copy demo key" /></div>
          </CardSection>
        </Card>
      </div>

      <Modal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        title="Activate the panel"
        description="Enter the license key from your provider invoice."
        footer={<><Button variant="secondary" onClick={() => setActivateOpen(false)}>Cancel</Button><Button onClick={() => { try { activateLicense(key); push("success", "License activated", "The panel is entitled until the expiry date."); setActivateOpen(false); } catch { push("error", "Invalid license key", "License keys look like NXP-XXXX-XXXX-XXXX — check the key and try again."); } }}>Activate</Button></>}
      >
        <Field label="License key" htmlFor="lic-key" required hint="Format NXP-XXXX-XXXX-XXXX. The key is stored as a secret reference, never displayed in full again.">
          <Input id="lic-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="NXP-XXXX-XXXX-XXXX" />
        </Field>
        <Callout tone="info" className="mt-4">Demo key: <span className="font-mono">NXP-DEMO-2026-8F2K</span></Callout>
      </Modal>
    </Screen>
  );
}
