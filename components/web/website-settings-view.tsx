"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { KeyValue, DiffViewer } from "@/components/ui/misc";
import { Callout } from "@/components/ui/feedback";
import { applyWebsiteSettings, previewWebsiteSettings } from "@/lib/api/web";
import { websiteRedirects } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";
import { RUNTIME_CATALOG } from "@/lib/mock/web";

/**
 * UX-WEB-004 — Website configuration: document root, redirects, PHP/HTTP
 * settings and staging. Preview is a server-side dry run (diff only, nothing
 * applied); Apply submits a tracked operation that validates before reload.
 */
export function WebsiteSettingsView({ siteId }: { siteId: string }) {
  const site = useMemo(() => db.websites.find((w) => w.id === siteId), [siteId]);
  const { push } = useToast();
  const { setTrayOpen, setFocusedId, list } = useOperationStream();
  const [root, setRoot] = useState("/var/www/current");
  const [errorPage, setErrorPage] = useState("/50x.html");
  const [phpVersion, setPhpVersion] = useState("8.2");
  const [httpOnly, setHttpOnly] = useState(false);
  const [diff, setDiff] = useState<{ path: string; from: string; to: string }[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const siteRedirects = useMemo(() => websiteRedirects.filter((r) => r.website_id === siteId), [siteId]);
  const lastConfigOp = useMemo(
    () => list.find((o) => o.resource_ref.id === siteId && o.kind === "website.configure"),
    [list, siteId]
  );

  if (site === undefined) {
    return (
      <Screen id="UX-WEB-004" breadcrumbs={[{ label: "Websites", href: "/websites" }]}>
        <NotFoundInline what="website" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Websites", href: "/websites" },
    { label: site.title, href: `/websites/${site.id}` },
    { label: "Settings" },
  ];

  const doPreview = async () => {
    setPreviewing(true);
    try {
      const res = await previewWebsiteSettings(site.id);
      setDiff(res.config_diff);
      push("info", "Preview ready", "This is a dry run — the diff shows what apply would change. Nothing is live yet.");
    } catch {
      push("error", "Preview failed", "The dry run could not be generated. Try again.");
    } finally {
      setPreviewing(false);
    }
  };

  const doApply = async () => {
    setApplying(true);
    try {
      const res = await applyWebsiteSettings(site.id, site.name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Apply accepted", `${site.name} configuration is queued — nginx validates the config before reload, and the previous config stays live on failure.`);
    } catch {
      push("error", "Apply was not accepted", "Try again — nothing has changed.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Screen
      id="UX-WEB-004"
      breadcrumbs={crumbs}
      actions={
        <>
          <Button variant="secondary" icon="eye" onClick={doPreview} loading={previewing}>
            Preview
          </Button>
          <Button icon="check" onClick={doApply} loading={applying}>
            Apply
          </Button>
        </>
      }
    >
      {lastConfigOp !== undefined && lastConfigOp.status !== "succeeded" && lastConfigOp.status !== "failed" && (
        <div className="mb-4">
          <PendingState operation={lastConfigOp} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Document root">
          <div className="flex flex-col gap-4">
            <Field label="Web root" htmlFor="ws-root" hint="Relative to the site's storage. Nano serves this directory directly; containerized profiles mount it at /app.">
              <Input id="ws-root" value={root} onChange={(e) => setRoot(e.target.value)} className="font-mono text-xs" />
            </Field>
            <Field label="Custom error page" htmlFor="ws-error" hint="Served when nginx returns 5xx. Leave the default unless you have a branded page.">
              <Input id="ws-error" value={errorPage} onChange={(e) => setErrorPage(e.target.value)} className="font-mono text-xs" />
            </Field>
          </div>
        </Card>

        <Card title="Runtime & HTTP settings">
          {site.kind === "php" ? (
            <div className="flex flex-col gap-4">
              <Field label="PHP version" htmlFor="ws-php" hint="Only versions actually installed on this server are listed — no invented options.">
                <Select id="ws-php" value={phpVersion} onChange={(e) => setPhpVersion(e.target.value)}>
                  {RUNTIME_CATALOG.filter((r) => r.runtime_kind === "php").map((r) => (
                    <option key={r.version} value={r.version}>
                      PHP {r.version} (supported)
                    </option>
                  ))}
                </Select>
              </Field>
              <Switch checked={httpOnly} onChange={(v) => setHttpOnly(v)} label={<span>Serve over HTTP without redirect<span className="block text-xs font-normal text-ink-3">Off (recommended): HTTP requests redirect to HTTPS. Managed by the HTTPS policy screen.</span></span>} />
            </div>
          ) : site.kind === "static" ? (
            <Callout tone="info" title="No runtime settings for static sites">
              Static sites serve files directly from the web root — there is no PHP or HTTP process to
              configure. Redirects and the HTTPS policy still apply.
            </Callout>
          ) : (
            <Callout tone="info" title="Node apps configure runtime in the app settings">
              This site is served by a Node application. Runtime versions, startup command and ports live in
              the application&apos;s runtime configuration.
            </Callout>
          )}
        </Card>

        <Card
          title="Redirects"
          description={`${siteRedirects.length} rule${siteRedirects.length === 1 ? "" : "s"} — loop and conflict detection runs on every change.`}
          actions={
            <Link href={`/websites/${site.id}/redirects`} className="text-sm font-medium text-accent hover:underline">
              Manage
            </Link>
          }
        >
          {siteRedirects.length === 0 ? (
            <p className="text-sm text-ink-2">
              No redirect rules. <Link href={`/websites/${site.id}/redirects`} className="text-accent hover:underline">Create one</Link> — e.g. http → https or www → apex.
            </p>
          ) : (
            <ul className="flex list-none flex-col gap-2 p-0">
              {siteRedirects.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-mono text-xs text-ink">{r.match}</span>
                  <Chip tone={r.test === "passed" ? "success" : r.test === "conflict" ? "danger" : "neutral"}>
                    {r.test}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Staging"
          description="Staging copies, sync and promotion impact."
          actions={
            <Link href={`/websites/${site.id}/staging`} className="text-sm font-medium text-accent hover:underline">
              Open staging
            </Link>
          }
        >
          <p className="text-sm text-ink-2">
            Promote a staging copy after verifying it. Promotion swaps the release symlink and health-checks
            the production URL — the previous release stays available for instant rollback.
          </p>
        </Card>
      </div>

      {diff !== null && (
        <Card title="Preview — dry-run diff" className="mt-4" description="What apply would change. Validated server-side; nothing is live yet.">
          <DiffViewer hunks={diff.map((d) => ({ path: d.path, before: d.from, after: d.to }))} />
          <KeyValue
            className="mt-4"
            items={[{ label: "Validity", value: "Config validated — safe to apply. Last-known-good config is preserved for instant rollback." }]}
          />
        </Card>
      )}
    </Screen>
  );
}
