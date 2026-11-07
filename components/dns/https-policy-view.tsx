"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, Switch } from "@/components/ui/form";
import { Callout } from "@/components/ui/feedback";
import { DiffViewer, KeyValue } from "@/components/ui/misc";
import { applyHttpsPolicy, previewHttpsPolicy } from "@/lib/api/dns";
import { db } from "@/lib/mock/data";

/**
 * UX-DNS-013 — HTTPS policy: redirect, HSTS, TLS modes and warnings.
 * Preview is a dry run (diff); apply submits a tracked operation that verifies
 * the redirect + TLS from the outside before claiming success.
 */
export function HttpsPolicyView({ siteId }: { siteId: string }) {
  const site = useMemo(() => db.websites.find((w) => w.id === siteId), [siteId]);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId, list } = useOperationStream();
  const [forceHttps, setForceHttps] = useState(true);
  const [hsts, setHsts] = useState(false);
  const [tlsMode, setTlsMode] = useState("compatible");
  const [diff, setDiff] = useState<{ path: string; from: string; to: string }[] | null>(null);
  const [applying, setApplying] = useState(false);

  const runningOp = list.find((o) => o.resource_ref.id === siteId && o.kind === "website.https.apply" && o.status !== "succeeded" && o.status !== "failed");

  if (site === undefined) {
    return (
      <Screen id="UX-DNS-013" breadcrumbs={[{ label: "Websites", href: "/websites" }]}>
        <NotFoundInline what="website" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Websites", href: "/websites" },
    { label: site.title, href: `/websites/${site.id}` },
    { label: "HTTPS policy" },
  ];

  const doPreview = async () => {
    const res = await previewHttpsPolicy(site.id, hsts);
    setDiff(res.config_diff);
    push("info", "Preview ready", "Dry run only — the diff shows what apply would change.");
  };

  const doApply = async () => {
    setApplying(true);
    try {
      const res = await applyHttpsPolicy(site.id, site.name, hsts);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "HTTPS policy queued", "nginx validates and reloads; the redirect and TLS are verified from the outside before we call it done.");
    } catch {
      push("error", "Apply was not accepted", "Try again — the current policy is still active.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Screen
      id="UX-DNS-013"
      breadcrumbs={crumbs}
      actions={
        <>
          <Button variant="secondary" icon="eye" onClick={doPreview}>
            Preview
          </Button>
          <Button icon="check" onClick={doApply} loading={applying}>
            Apply
          </Button>
        </>
      }
    >
      {runningOp !== undefined && (
        <div className="mb-4">
          <PendingState operation={runningOp} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Redirect & HSTS">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Switch
                checked={forceHttps}
                onChange={(v) => setForceHttps(v)}
                label="Force HTTPS"
              />
              <p className="text-xs text-ink-2">
                All HTTP requests permanently redirect to HTTPS. Recommended — search engines rank HTTPS higher.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Switch
                checked={hsts}
                onChange={(v) => setHsts(v)}
                label="Enable HSTS (max-age 30 days)"
              />
              <p className="text-xs text-ink-2">
                Browsers will refuse plain HTTP for this domain, even before asking the server.
              </p>
            </div>
            {hsts && (
              <Callout tone="warning" title="HSTS is a commitment">
                HSTS is cached by browsers for the full max-age. If TLS later breaks (e.g. DNS points away and
                certificates stop renewing), visitors see a hard error until the cache expires. Only enable it
                once HTTPS works reliably.
              </Callout>
            )}
          </div>
        </Card>

        <Card title="TLS mode">
          <div className="flex flex-col gap-4">
            <Field label="Compatibility" htmlFor="tls-mode" hint="Modern accepts TLS 1.3 only; Compatible keeps TLS 1.2 for older Android browsers still common on mobile money devices.">
              <Select id="tls-mode" value={tlsMode} onChange={(e) => setTlsMode(e.target.value)}>
                <option value="compatible">Compatible — TLS 1.2+ (recommended)</option>
                <option value="modern">Modern — TLS 1.3 only</option>
              </Select>
            </Field>
            <KeyValue
              items={[
                { label: "Certificate", value: "Automatic (Let's Encrypt, HTTP-01)", },
                { label: "Managed on", value: "Certificates screen — renew is automatic" },
              ]}
            />
          </div>
        </Card>
      </div>

      {diff !== null && (
        <Card title="Preview — dry-run diff" className="mt-4" description="What apply would change. Nothing is live yet.">
          <DiffViewer hunks={diff.map((d) => ({ path: d.path, before: d.from, after: d.to }))} />
        </Card>
      )}
    </Screen>
  );
}
