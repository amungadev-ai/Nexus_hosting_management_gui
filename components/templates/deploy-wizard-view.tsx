"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Operation, ServiceTemplate } from "@/lib/types";
import { db } from "@/lib/mock/data";
import { useCapability, useOperationStream, useSession, useToast } from "@/components/providers";
import { PROFILES } from "@/lib/profiles";
import { allocatedRamMb, allocatedDiskGb } from "@/lib/mock/overview";
import { checkDeploy, deployTemplate, discardFailedInstall } from "@/lib/api/templates";
import { markInstanceRunning } from "@/lib/mock/services";
import { newId } from "@/lib/api/core";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState, UnavailableState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, ErrorBlock } from "@/components/ui/feedback";
import { Field, Fieldset, Input, Select, Checkbox } from "@/components/ui/form";
import { Stepper } from "@/components/ui/nav";
import { KeyValue, ProgressBar } from "@/components/ui/misc";
import { SecretField } from "@/components/ui/code";
import { formatGb, formatMb } from "@/lib/format";

/**
 * UX-TPL-003 — Deploy template wizard: name + exposure → resource summary
 * vs current headroom → confirm (generated admin credential, shown once) →
 * template.install operation. UX-TPL-005 states live here: the pending
 * install card while the job runs, the failed-install card (with retry)
 * when memory pressure kills the first start, and the honest unavailable
 * gate when Docker cannot run.
 */
const STEPS = ["Basics", "Resources", "Confirm"];

export default function DeployWizardView({ templateKey }: { templateKey: string }) {
  const template: ServiceTemplate | undefined = db.templates.find((t) => t.key === templateKey);
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen, list } = useOperationStream();
  const docker = useCapability("service.docker");

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [exposure, setExposure] = useState<"private" | "public">("private");
  const [backupPolicy, setBackupPolicy] = useState<"nightly" | "none">("nightly");
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ operation: Operation; instanceId: string; warning: string | null } | null>(null);
  const [blockers, setBlockers] = useState<string[] | null>(null);

  const liveOp: Operation | undefined = submitted !== null ? list.find((o) => o.id === submitted.operation.id) : undefined;
  const opStatus = liveOp?.status ?? submitted?.operation.status ?? null;

  // Postconditions follow the operation engine's verdict — never the UI.
  useEffect(() => {
    if (submitted === null) return;
    if (opStatus === "succeeded") markInstanceRunning(submitted.instanceId);
    if (opStatus === "failed") discardFailedInstall(submitted.instanceId);
  }, [opStatus, submitted]);

  const headroom = useMemo(() => PROFILES[profile].specs.ram_mb - allocatedRamMb(), [profile]);
  const check = useMemo(
    () => (template !== undefined ? checkDeploy(template, name, profile) : null),
    [template, name, profile]
  );

  if (template === undefined) {
    return (
      <Screen id="UX-TPL-003" breadcrumbs={[{ label: "Templates", href: "/templates" }, { label: "Deploy" }]}>
        <NotFoundInline what="template" />
      </Screen>
    );
  }

  const cap = template.docker_required ? docker : useCapability("website.php");
  if (cap.state === "unavailable" && submitted === null) {
    return (
      <Screen id="UX-TPL-003" breadcrumbs={[{ label: "Templates", href: "/templates" }, { label: template.name }]}>
        <div className="flex flex-col gap-4">
          <UnavailableState
            capabilityKey={template.docker_required ? "service.docker" : "website.php"}
            title={`This VPS cannot install ${template.name}`}
          />
          <ButtonLink href="/templates" variant="secondary">
            Back to catalog
          </ButtonLink>
        </div>
      </Screen>
    );
  }

  const enterConfirm = () => {
    setStep(2);
    if (adminPassword === null) setAdminPassword(newId("pwd"));
  };

  const submit = async () => {
    if (template === undefined) return;
    try {
      const res = await deployTemplate({
        template,
        name,
        exposure,
        backup_policy: backupPolicy,
        profile,
      });
      setSubmitted({ operation: res.data.operation, instanceId: res.data.instance.id, warning: res.data.warning });
      push("success", "Install submitted", `Deploying ${template.name} — usually takes 2–3 minutes. This page tracks the job.`);
      setTrayOpen(true);
    } catch {
      setBlockers(["The install was rejected before submission — re-check the resource summary."]);
    }
  };

  if (submitted !== null) {
    const failed = opStatus === "failed";
    const succeeded = opStatus === "succeeded";
    return (
      <Screen id="UX-TPL-003" breadcrumbs={[{ label: "Templates", href: "/templates" }, { label: template.name }, { label: "Deploy" }]}>
        <div className="flex max-w-2xl flex-col gap-4">
          <Stepper steps={STEPS} current={3} />
          {!failed && !succeeded && (
            <>
              <PendingState operation={submitted.operation} />
              <Card title={`Deploying ${template.name}…`}>
                <p className="text-sm text-ink-2">
                  Usually takes 2–3 minutes. The install verifies the health endpoint before it can succeed — no
                  false green: the instance appears as “provisioning” until then.
                </p>
                <KeyValue
                  className="mt-3"
                  items={[
                    { label: "Instance", value: name, mono: true },
                    { label: "Hostname", value: exposure === "public" ? `${name}.wanjiku.digital` : `${name}.internal`, mono: true },
                    { label: "Job", value: submitted.operation.id, mono: true },
                  ]}
                />
              </Card>
            </>
          )}
          {succeeded && (
            <Card title={`${template.name} is live`} description="Verified: the health check passed and the instance is observed running.">
              <KeyValue
                items={[
                  { label: "Instance", value: name, mono: true },
                  { label: "URL", value: exposure === "public" ? `https://${name}.wanjiku.digital` : `${name}.internal`, mono: true },
                  { label: "Admin password", value: "shown once during setup — reset from the app if lost" },
                  { label: "Backup policy", value: backupPolicy === "nightly" ? "Nightly 02:00 (remote)" : "none — add one in Backups" },
                ]}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href="/services">Open Platform services</ButtonLink>
                <ButtonLink href={`/templates/${template.key}`} variant="secondary">
                  View template
                </ButtonLink>
              </div>
            </Card>
          )}
          {failed && (
            <Card title={`Install of ${template.name} failed`}>
              <ErrorBlock
                code={liveOp?.error?.code ?? "INSTALL_FAILED"}
                detail={liveOp?.error?.detail ?? "The install did not complete."}
                correlationId={submitted.operation.correlation_id}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  icon="refresh"
                  onClick={() => {
                    setSubmitted(null);
                    setStep(2);
                  }}
                >
                  Back to review and retry
                </Button>
                <ButtonLink href="/overview/usage" variant="secondary">
                  Check RAM headroom
                </ButtonLink>
              </div>
            </Card>
          )}
        </div>
      </Screen>
    );
  }

  const risky = check !== null && check.ok && check.risky;

  return (
    <Screen
      id="UX-TPL-003"
      breadcrumbs={[{ label: "Templates", href: "/templates" }, { label: template.name }, { label: "Deploy" }]}
      actions={<ButtonLink href={`/templates/${template.key}`} variant="ghost">Cancel</ButtonLink>}
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <Stepper steps={STEPS} current={step} />

        {step === 0 && (
          <Card title={`Install ${template.name} — basics`}>
            <div className="flex flex-col gap-4">
              <Field
                label="Instance name"
                htmlFor="inst-name"
                required
                hint="Lowercase letters, digits, hyphens. Becomes the hostname."
                error={name !== "" && check !== null && !check.ok && check.blockers.some((b) => b.startsWith("The name")) ? "That name is taken or invalid." : undefined}
              >
                <Input id="inst-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" spellCheck={false} placeholder="team-wiki" />
              </Field>
              <Fieldset legend="Exposure" hint="Public instances get a Let's Encrypt certificate and a public hostname.">
                <Select aria-label="Exposure" value={exposure} onChange={(e) => setExposure(e.target.value === "public" ? "public" : "private")}>
                  <option value="private">Private — internal network only</option>
                  <option value="public">Public — reachable on {name === "" ? "<name>" : name}.wanjiku.digital</option>
                </Select>
              </Fieldset>
              <Field label="Backup policy" htmlFor="backup-policy" hint="A template install without backups is one disk fault away from data loss.">
                <Select id="backup-policy" value={backupPolicy} onChange={(e) => setBackupPolicy(e.target.value === "none" ? "none" : "nightly")}>
                  <option value="nightly">Nightly 02:00, remote destination (recommended)</option>
                  <option value="none">No backups for now</option>
                </Select>
              </Field>
              <div className="flex gap-2">
                <Button onClick={() => setStep(1)} disabled={name === ""}>
                  Continue
                </Button>
              </div>
            </div>
          </Card>
        )}

        {step === 1 && check !== null && (
          <Card title="Resource summary" description={`Against the ${PROFILES[profile].label} profile (${PROFILES[profile].tagline}) — unallocated headroom ${Math.max(0, check.headroom_mb)} MB.`}>
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1 flex justify-between text-xs text-ink-2">
                  <span>Typical RAM need vs unallocated headroom</span>
                  <span className="tabular-nums">{formatMb(template.ram_typical_mb)} / {formatMb(Math.max(0, check.headroom_mb))}</span>
                </div>
                <ProgressBar
                  value={Math.min(template.ram_typical_mb, Math.max(0, check.headroom_mb))}
                  max={Math.max(template.ram_typical_mb, Math.max(0, check.headroom_mb))}
                  tone={check.risky ? "warning" : "accent"}
                  label="RAM fit"
                />
              </div>
              <KeyValue
                items={[
                  { label: "RAM floor / typical / ceiling", value: `${formatMb(template.ram_floor_mb)} / ${formatMb(template.ram_typical_mb)} / ${formatMb(template.ram_ceiling_mb)}` },
                  { label: "Disk floor", value: `${formatGb(template.disk_floor_gb)} (${formatGb(Math.max(0, PROFILES[profile].specs.disk_gb - allocatedDiskGb()))} free)` },
                  { label: "Preflight", value: "capability record, port conflict, disk quota, name uniqueness" },
                ]}
              />
              {!check.ok && (
                <Callout tone="danger" title="This install cannot fit yet">
                  <ul className="ml-4 list-disc">
                    {check.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </Callout>
              )}
              {check.ok && check.riskNote !== null && (
                <Callout tone="warning" title="Tight fit — the install can fail under pressure">
                  {check.riskNote}
                </Callout>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button onClick={() => enterConfirm()} disabled={!check.ok}>
                  Continue
                </Button>
              </div>
            </div>
          </Card>
        )}

        {step === 2 && check !== null && (
          <Card title="Confirm and install">
            <div className="flex flex-col gap-4">
              <KeyValue
                columns={2}
                items={[
                  { label: "Template", value: `${template.name} v${template.version}` },
                  { label: "Instance name", value: name, mono: true },
                  { label: "Exposure", value: exposure },
                  { label: "Backups", value: backupPolicy === "nightly" ? "Nightly 02:00" : "none" },
                ]}
              />
              {adminPassword !== null && (
                <SecretField value={adminPassword} label={`Generated admin password for ${name || "the instance"} — shown once`} />
              )}
              {risky && (
                <Checkbox
                  checked={acceptedRisk}
                  onChange={setAcceptedRisk}
                  label="I understand the RAM headroom is below this template's typical usage and the install may fail at first start"
                />
              )}
              {blockers !== null && (
                <Callout tone="danger" title="Rejected">
                  {blockers.join(" ")}
                </Callout>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button icon="download" loading={false} disabled={(risky && !acceptedRisk) || !check.ok} onClick={() => void submit()}>
                  Install {template.name}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Screen>
  );
}
