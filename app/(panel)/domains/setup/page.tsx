"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/form";
import { Callout } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/code";
import { useOperationStream, useToast } from "@/components/providers";
import { checkDnsPropagation } from "@/lib/api/dns";
import { db } from "@/lib/mock/data";
import { guidanceForDomain } from "@/lib/mock/dns";
import { isTerminal } from "@/lib/operations";

const STAGES = ["Choose domain", "Connect to service", "Update DNS", "Verify & HTTPS"];

/** Batch 03: a connected UX journey over the existing specialized domain/DNS/SSL screens.
 * All data and checks use the existing mock adapter; never represents actual DNS or ACME state.
 */
export default function DomainSetupPage() {
  const { push } = useToast();
  const { list, setFocusedId, setTrayOpen } = useOperationStream();
  const [step, setStep] = useState(0);
  const [domainId, setDomainId] = useState(db.domains[0]?.id ?? "");
  const [target, setTarget] = useState("none");
  const [recordAcknowledged, setRecordAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const domain = useMemo(() => db.domains.find((d) => d.id === domainId), [domainId]);
  const guidance = useMemo(() => guidanceForDomain(domainId), [domainId]);
  const domainOps = list.filter((o) => o.kind === "domain.dns.check" && o.resource_ref.id === domainId);
  const latest = domainOps[0];
  const running = domainOps.find((o) => !isTerminal(o.status));
  const isVerified = domain?.state === "verified";
  const dnsReady = guidance?.propagation_state === "propagated";
  const hasConfirmedCheck = latest?.status === "succeeded" && guidance?.check_outcome === "propagated";

  const check = async () => {
    if (!domain) return;
    setBusy(true);
    try {
      const response = await checkDnsPropagation(domain.id, domain.name);
      setFocusedId(response.operation.id);
      setTrayOpen(true);
      push("info", "DNS check queued (demo)", "Open the operation tray for the simulated resolver result. This does not query live DNS.");
    } catch {
      push("error", "Could not start check", "No changes were made. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen id="UX-DNS-016" breadcrumbs={[{ label: "Domains", href: "/domains" }, { label: "Guided setup" }]}
      description="One connected journey from domain ownership to service attachment, DNS guidance and HTTPS. Demo data only.">
      <div className="mx-auto max-w-5xl space-y-5">
        <Callout tone="info" title="Prototype mode — no live domain changes">
          DNS records, verification, propagation and certificate states shown here are fixtures. The existing dedicated tools remain available for detailed management.
        </Callout>
        <nav aria-label="Domain setup steps" className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {STAGES.map((label, i) => <button key={label} type="button" onClick={() => { if (i <= step) setStep(i); }}
            aria-current={step === i ? "step" : undefined} disabled={i > step}
            className={`rounded-xl border p-3 text-left text-sm transition-colors ${step === i ? "border-accent bg-surface-2 font-semibold text-ink" : "border-line bg-surface text-ink-2"} disabled:opacity-60`}>
            <span className="mb-1 block text-xs">Step {i + 1} / 4</span>{label}
          </button>)}
        </nav>
        {step === 0 && <Card title="Which domain do you want to connect?" description="Select a domain already in your workspace or add a new one through the ownership-verification flow.">
          <div className="mt-4 max-w-lg">
            <Field label="Your domain" htmlFor="setup-domain">
              <Select id="setup-domain" value={domainId} onChange={(e) => { setDomainId(e.target.value); setRecordAcknowledged(false); }}>
                {db.domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => setStep(1)} disabled={!domain}>Continue to service</Button>
            <ButtonLink href="/domains/new" variant="secondary" icon="plus">Add a new domain</ButtonLink>
            {domain && <Link href={`/domains/${domain.id}/verify`} className="text-sm text-accent hover:underline">Ownership verification</Link>}
          </div>
        </Card>}
        {step === 1 && <Card title="What should this domain open?" description="Select a website or application. In this prototype, the choice is a preview; attachment is managed by the existing resource-specific screen.">
          <div className="mt-4 max-w-xl">
            <Field label="Destination" htmlFor="setup-target">
              <Select id="setup-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="none">Decide later — configure DNS only</option>
                <optgroup label="Websites">{db.websites.map((w) => <option key={w.id} value={`website:${w.id}`}>{w.name}</option>)}</optgroup>
                <optgroup label="Applications">{db.applications.map((a) => <option key={a.id} value={`app:${a.id}`}>{a.name}</option>)}</optgroup>
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => setStep(2)}>Continue to DNS instructions</Button>
            <Button onClick={() => setStep(0)} variant="secondary">Back</Button>
          </div>
        </Card>}
        {step === 2 && <Card title={`DNS records for ${domain?.name ?? "your domain"}`} description="Copy these fixture records to understand the intended registrar workflow. DNS remains at your registrar in the v1 guidance mode.">
          {guidance ? <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm"><thead className="bg-surface-2"><tr><th className="p-3">Type</th><th className="p-3">Host</th><th className="p-3">Value</th><th className="p-3">Copy</th></tr></thead>
                <tbody>{guidance.records.map((r, i) => <tr key={`${r.type}-${r.name}-${i}`} className="border-t border-line"><td className="p-3 font-mono">{r.type}</td><td className="p-3 font-mono">{r.name}</td><td className="p-3 font-mono text-xs break-all">{r.value}</td><td className="p-3"><CopyButton text={r.value} /></td></tr>)}</tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-ink-2">{guidance.registrar_hint}</p>
          </> : <Callout tone="warning" title="No DNS guidance available">This domain has no record fixture. Use its dedicated guidance screen or add the domain through onboarding.</Callout>}
          <label className="mt-4 flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={recordAcknowledged} onChange={(e) => setRecordAcknowledged(e.target.checked)}/>I understand where to edit these records. This checkbox does not verify that DNS was changed.</label>
          <div className="mt-4 flex flex-wrap gap-3"><Button disabled={!guidance || !recordAcknowledged} onClick={() => setStep(3)}>Continue to checks</Button><Button variant="secondary" onClick={() => setStep(1)}>Back</Button>{domain && <ButtonLink variant="ghost" href={`/domains/${domain.id}/dns-guidance`}>Advanced DNS guidance</ButtonLink>}</div>
        </Card>}
        {step === 3 && <Card title="Check DNS and prepare HTTPS" description="Separate ownership, resolver propagation and certificate issuance. A queued check is not proof of a live domain.">
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-line p-4"><p className="text-sm font-semibold">1. Ownership</p><div className="mt-2"><Chip tone={isVerified ? "success" : "warning"}>{isVerified ? "Fixture verified" : "Needs verification"}</Chip></div><p className="mt-2 text-xs text-ink-2">Prove control with a TXT challenge.</p></div>
            <div className="rounded-lg border border-line p-4"><p className="text-sm font-semibold">2. DNS resolution</p><div className="mt-2"><Chip tone={dnsReady ? "success" : "warning"}>{dnsReady ? "Fixture propagated" : "Not confirmed"}</Chip></div><p className="mt-2 text-xs text-ink-2">Resolver results are simulated, not live measurements.</p></div>
            <div className="rounded-lg border border-line p-4"><p className="text-sm font-semibold">3. HTTPS</p><div className="mt-2"><Chip tone="neutral">Separate operation</Chip></div><p className="mt-2 text-xs text-ink-2">Certificate issuance must complete before HTTPS is claimed active.</p></div>
          </div>
          {latest && <p className="mt-4 text-sm text-ink-2" role="status">Latest simulated DNS check: <strong>{latest.status}</strong>{hasConfirmedCheck ? " — fixture result matched" : ""}.</p>}
          <div className="mt-4 flex flex-wrap gap-2"><Button onClick={check} loading={busy || !!running} icon="activity">Run demo DNS check</Button>{domain && <ButtonLink href={`/domains/${domain.id}/verify`} variant="secondary">Verify ownership</ButtonLink>}<ButtonLink href="/certificates/new" variant="secondary">Request HTTPS certificate</ButtonLink><Button onClick={() => setStep(2)} variant="ghost">Back</Button></div>
          {target !== "none" && <p className="mt-4 text-xs text-ink-2">Selected destination: {target.startsWith("app:") ? "application" : "website"}. To attach the domain, open its dedicated resource settings; this guided prototype does not persist attachments.</p>}
        </Card>}
        <div className="flex flex-wrap gap-4 text-sm"><Link className="text-accent hover:underline" href="/domains">Domain inventory</Link><Link className="text-accent hover:underline" href="/dns/zones">DNS zones</Link><Link className="text-accent hover:underline" href="/certificates">Certificates</Link><Link className="text-accent hover:underline" href="/domains/connect">Original domain connector</Link></div>
      </div>
    </Screen>
  );
}
