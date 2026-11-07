"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { LiveMoment } from "@/components/router/live-moment";
import { PendingState } from "@/components/common/states";
import { useCapability, useOperationStream, useToast } from "@/components/providers";
import { CAPABILITY_META } from "@/lib/profiles";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { Stepper } from "@/components/ui/nav";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Callout, ErrorBlock } from "@/components/ui/feedback";
import { KeyValue } from "@/components/ui/misc";
import { Icon, type IconName } from "@/components/ui/icons";
import { provisionWebsite } from "@/lib/api/web";
import { isTerminal } from "@/lib/operations";
import { cx } from "@/lib/format";

/**
 * UX-WEB-002 — Create website wizard. The kind step is capability-aware: it
 * reads the installer capability set for the current profile and shows the
 * honest reason + resource delta when a runtime cannot run (never a bare
 * greyed card). Provisioning ends at the LiveMoment only after the operation
 * reports verified success.
 */

const STEPS = ["Kind", "Source", "Name & domain", "Review"];

type SiteKind = "static" | "php" | "node";
type SourceKind = "upload" | "git";

const KIND_META: Record<SiteKind, { capabilityKey: string; icon: IconName; label: string; blurb: string }> = {
  static: { capabilityKey: "website.static", icon: "file-text", label: "Static site", blurb: "HTML, CSS and JS — the lightest option. Live in under a minute." },
  php: { capabilityKey: "website.php", icon: "box", label: "PHP site (WordPress)", blurb: "PHP + a managed web root — the classic CMS path." },
  node: { capabilityKey: "app.node", icon: "cpu", label: "Node.js app", blurb: "A Node runtime with build + start commands and health checks." },
};

export default function CreateWebsiteWizardPage() {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<SiteKind>("static");
  const [source, setSource] = useState<SourceKind>("upload");
  const [gitUrl, setGitUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [usePreview, setUsePreview] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [opId, setOpId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const operation = useMemo(() => (opId === null ? undefined : list.find((o) => o.id === opId)), [opId, list]);

  const caps = {
    static: useCapability("website.static"),
    php: useCapability("website.php"),
    node: useCapability("app.node"),
  };

  const previewHost = name !== "" ? `${name}.preview.nexuspanel.app` : "";

  const nameValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);

  const validateStep = (s: number): boolean => {
    const next: Record<string, string> = {};
    if (s === 1 && source === "git" && gitUrl.trim() === "") {
      next.gitUrl = "Enter the repository URL, or switch to uploading a zip archive.";
    }
    if (s === 1 && source === "upload" && fileName === null) {
      next.file = "Choose a .zip archive to upload, or switch to a Git repository.";
    }
    if (s === 2) {
      if (name.trim() === "") next.name = "A name is required — it becomes part of the preview hostname.";
      else if (!nameValid) next.name = "Use lowercase letters, numbers and hyphens (e.g. acme-consulting).";
      if (title.trim() === "") next.title = "Give the site a human label for lists and breadcrumbs.";
      if (!usePreview && domain.trim() === "") next.domain = "Enter your domain, or tick the preview-hostname option.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    if (!validateStep(2)) {
      setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      const result = await provisionWebsite({
        name,
        title: title.trim() === "" ? name : title,
        kind,
        primary_domain: usePreview ? previewHost : domain,
        use_preview_hostname: usePreview,
        source,
        git_url: source === "git" ? gitUrl : undefined,
      });
      setOpId(result.operation.id);
      setFocusedId(result.operation.id);
      setTrayOpen(true);
      push(
        "success",
        "Provisioning started",
        "We accepted the request (202). The site is live only after the job verifies health — watch the tray or this page."
      );
    } catch {
      push("error", "Could not start provisioning", "The request was rejected before a job was created. Check the values and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- provisioning in flight / terminal ---------------------------------
  if (opId !== null) {
    const live = operation?.status === "succeeded";
    const url = usePreview ? previewHost : domain;
    return (
      <Screen id="UX-WEB-002" breadcrumbs={[{ label: "Websites", href: "/websites" }, { label: "Create" }]}>
        {live && operation !== undefined ? (
          <LiveMoment
            url={`https://${url}`}
            title={title.trim() === "" ? name : title}
            nextSteps={[
              { label: "Connect your own domain", href: "/domains/connect", hint: "show the exact registrar records" },
              { label: "Open the site overview", href: "/websites", hint: "health, usage and jobs" },
              { label: "Enable backups", href: "/backups", hint: "remote destinations work on every profile" },
            ]}
          />
        ) : (
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-3 text-sm font-semibold text-ink">Provisioning {name}</h2>
            {operation !== undefined ? (
              isTerminal(operation.status) ? (
                <ErrorBlock
                  code={operation.error?.code ?? "WEBSITE_PROVISION_FAILED"}
                  detail={operation.error?.detail ?? "Provisioning did not complete. Nothing is being served yet — you can retry safely."}
                  correlationId={operation.correlation_id}
                />
              ) : (
                <PendingState operation={operation}>
                  <p className="text-xs text-ink-2">
                    Provisioning usually takes 1–2 minutes. We verify the site is actually serving before
                    we say it is live — a finished file copy is not a live site.
                  </p>
                </PendingState>
              )
            ) : (
              <Callout tone="info">Accepting the request…</Callout>
            )}
          </div>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      id="UX-WEB-002"
      breadcrumbs={[{ label: "Websites", href: "/websites" }, { label: "Create" }]}
      description="Domain, root, runtime, placement, TLS and preview before provisioning. The wizard only offers what your VPS can actually run — and explains what it can't."
    >
      <div className="mx-auto max-w-3xl">
        <Stepper steps={STEPS} current={step} className="mb-6" />

        {step === 0 && (
          <fieldset>
            <legend className="text-sm font-medium text-ink">What kind of website is it?</legend>
            <p className="mb-3 mt-1 text-xs text-ink-3">
              Availability comes from the installer&apos;s capability set for your VPS profile — not a plan tier.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(KIND_META) as SiteKind[]).map((k) => {
                const meta = KIND_META[k];
                const cap = caps[k];
                const available = cap.state !== "unavailable";
                const selected = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={selected}
                    disabled={!available}
                    onClick={() => setKind(k)}
                    className={cx(
                      "flex flex-col items-start gap-2 rounded-card border p-4 text-left transition-colors",
                      selected && available ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
                      !available && "cursor-not-allowed"
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <Icon name={meta.icon} size={18} className={selected && available ? "text-accent" : "text-ink-2"} />
                      {available ? <StatusPill status={cap.state === "borderline" ? "borderline" : "available"} /> : <StatusPill status="unavailable" />}
                    </span>
                    <span className="text-sm font-semibold text-ink">{meta.label}</span>
                    <span className="text-xs text-ink-2">{available ? meta.blurb : cap.reason}</span>
                    {!available && CAPABILITY_META[meta.capabilityKey] !== undefined && (
                      <span className="text-xs font-medium text-accent">
                        {CAPABILITY_META[meta.capabilityKey]?.upgrade}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {kind === "node" && caps.node.state !== "unavailable" && (<Callout tone="info" title="Building a Node.js application?"><Link href="/apps/new" className="font-medium text-accent underline">Use the dedicated Node.js deployment wizard</Link> for Git source, build and start commands, environment settings and domain guidance. This website wizard remains available for website-oriented setups.</Callout>)}
            {caps.node.state === "unavailable" && (
              <Callout tone="warning" title="Node.js is not available on this VPS" className="mt-4">
                {caps.node.reason} You can still create static or PHP sites today, and{" "}
                <ButtonLink href="/system/upgrade" variant="link" size="sm">
                  the upgrade path is here
                </ButtonLink>
                .
              </Callout>
            )}
          </fieldset>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="text-sm font-medium text-ink">Where does the source come from?</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { id: "upload", icon: "upload", label: "Upload a zip", blurb: "Drop an archive — we validate and release it." },
                    { id: "git", icon: "git-branch", label: "Connect a Git repo", blurb: "Deploy from a branch with a build step." },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={source === opt.id}
                    onClick={() => setSource(opt.id)}
                    className={cx(
                      "flex items-start gap-2 rounded-card border p-4 text-left transition-colors",
                      source === opt.id ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"
                    )}
                  >
                    <Icon name={opt.icon} size={16} className="mt-0.5 shrink-0 text-ink-2" />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{opt.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-2">{opt.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {source === "upload" ? (
              <Field
                label="Site archive (.zip)"
                htmlFor="wizard-file"
                error={errors.file}
                hint="We validate the archive before releasing it. The previous release stays live until the new one passes health checks."
              >
                <label
                  htmlFor="wizard-file"
                  className={cx(
                    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed p-8 text-center transition-colors hover:border-accent",
                    fileName !== null && "border-accent bg-accent-soft"
                  )}
                >
                  <Icon name="upload" size={20} className="text-ink-2" />
                  <span className="text-sm font-medium text-ink">
                    {fileName === null ? "Choose a .zip archive or drop it here" : fileName}
                  </span>
                  <span className="text-xs text-ink-3">
                    {fileName === null ? "Up to 100 MB — static sites and PHP typically zip to a few MB" : "Selected — go to the next step to continue"}
                  </span>
                  <input
                    id="wizard-file"
                    type="file"
                    accept=".zip"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f !== undefined) {
                        setFileName(f.name);
                        setErrors((prev) => ({ ...prev, file: "" }));
                      }
                    }}
                  />
                </label>
              </Field>
            ) : (
              <Field
                label="Repository URL"
                htmlFor="wizard-git"
                error={errors.gitUrl}
                hint="We request a read-only deploy key — the panel can clone, never push."
              >
                <Input
                  id="wizard-git"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://github.com/wanjiku-digital/site.git"
                  autoComplete="url"
                />
              </Field>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site name" htmlFor="wizard-name" required error={errors.name} hint="Lowercase letters, numbers, hyphens. Used for lists and the preview hostname.">
                <Input id="wizard-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" spellCheck={false} placeholder="acme-consulting" />
              </Field>
              <Field label="Human label" htmlFor="wizard-title" required error={errors.title} hint="Shown in lists and breadcrumbs.">
                <Input id="wizard-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Acme Consulting" />
              </Field>
            </div>
            <Field
              label="Primary domain"
              htmlFor="wizard-domain"
              error={errors.domain}
              hint="You can point a .co.ke domain at the site now or later."
            >
              <Input
                id="wizard-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={usePreview}
                placeholder="acmeconsulting.co.ke"
                autoComplete="url"
              />
            </Field>
            <Checkbox
              checked={usePreview}
              onChange={(v) => {
                setUsePreview(v);
                if (v) setErrors((prev) => ({ ...prev, domain: "" }));
              }}
              label="Use a preview hostname for now"
              description={
                previewHost === ""
                  ? "You'll get a temporary https://…preview.nexuspanel.app address — connect your real domain whenever you're ready."
                  : `The site will be reachable at https://${previewHost} until you connect a domain.`
              }
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <Card title="Review — what we will do">
              <KeyValue
                columns={2}
                items={[
                  { label: "Kind", value: KIND_META[kind].label },
                  { label: "Source", value: source === "git" ? `Git — ${gitUrl}` : `Upload — ${fileName ?? "—"}` },
                  { label: "Site name", value: <span className="font-mono text-xs">{name}</span> },
                  { label: "Human label", value: title === "" ? name : title },
                  {
                    label: "Address",
                    value: <span className="font-mono text-xs">{usePreview ? previewHost : domain}</span>,
                    mono: true,
                  },
                  { label: "TLS", value: "Automatic (Let's Encrypt, HTTP-01) — issued during provisioning" },
                ]}
              />
              <Callout tone="info" className="mt-4">
                Provisioning is a tracked job: we provision the runtime, then verify the site is actually
                serving before the panel calls it live. If your VPS can&apos;t fit the runtime, the job fails
                safely with the resource delta.
              </Callout>
            </Card>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="accent">Preview-hostname option per UXD-007</Chip>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext}>Next: {STEPS[step + 1]}</Button>
          ) : (
            <Button onClick={submit} loading={submitting} icon="zap">
              Provision website
            </Button>
          )}
        </div>
      </div>
    </Screen>
  );
}
