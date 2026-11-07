"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { useOperationStream, useToast } from "@/components/providers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { TableCard } from "@/components/ui/table";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";
import { attachDomain, detachDomain } from "@/lib/api/web";
import { websiteBindings } from "@/lib/mock/web";
import { db } from "@/lib/mock/data";

/**
 * UX-WEB-017 — Domains attached to resource: hostnames, routing and TLS
 * status for domains attached to the app. Attach links existing domains or a
 * manual hostname to the domain-connection flow.
 */
export function AppDomainsView({ appId }: { appId: string }) {
  const app = useMemo(() => db.applications.find((a) => a.id === appId), [appId]);
  const bindings = useMemo(
    () => websiteBindings.filter((b) => b.resource_type === "application" && b.resource_id === appId),
    [appId]
  );
  const { push } = useToast();
  const { setTrayOpen, setFocusedId, list } = useOperationStream();
  const [attachOpen, setAttachOpen] = useState(false);
  const [mode, setMode] = useState("existing");
  const [existing, setExisting] = useState(db.domains[0]?.id ?? "");
  const [hostname, setHostname] = useState("");
  const [hostnameError, setHostnameError] = useState<string | undefined>(undefined);
  const [detachTarget, setDetachTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runningOp = list.find((o) => (o.kind === "website.binding.add" || o.kind === "website.binding.remove") && o.status !== "succeeded" && o.status !== "failed");

  if (app === undefined) {
    return (
      <Screen id="UX-WEB-017" breadcrumbs={[{ label: "Applications", href: "/apps" }]}>
        <NotFoundInline what="application" />
      </Screen>
    );
  }

  const crumbs = [
    { label: "Applications", href: "/apps" },
    { label: app.name, href: `/apps/${app.id}` },
    { label: "Domains" },
  ];

  const doAttach = async () => {
    if (mode === "manual" && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostname.trim())) {
      setHostnameError("Enter a valid hostname (e.g. api.wanjiku.co.ke).");
      return;
    }
    setHostnameError(undefined);
    setBusy(true);
    try {
      const name = mode === "existing" ? (db.domains.find((d) => d.id === existing)?.name ?? "") : hostname.trim();
      const res = await attachDomain(app.id, app.name, name);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("success", "Attach accepted", `${name} is queued — ownership and uniqueness are verified, then TLS is requested.`);
      setAttachOpen(false);
    } catch {
      push("error", "Attach was not accepted", "Try again — nothing changed.");
    } finally {
      setBusy(false);
    }
  };

  const doDetach = async () => {
    if (detachTarget === null) return;
    try {
      const res = await detachDomain(app.id, app.name, detachTarget);
      setFocusedId(res.operation.id);
      setTrayOpen(true);
      push("info", "Detach accepted", `${detachTarget} stops routing to this app once the job verifies.`);
    } catch {
      push("error", "Detach was not accepted", "Try again.");
    } finally {
      setDetachTarget(null);
    }
  };

  return (
    <Screen
      id="UX-WEB-017"
      breadcrumbs={crumbs}
      actions={
        <>
          <Button icon="plus" onClick={() => setAttachOpen(true)}>
            Attach
          </Button>
          <ButtonLink href="/domains/connect" variant="secondary" icon="globe">
            Connect a new domain
          </ButtonLink>
        </>
      }
    >
      {runningOp !== undefined && (
        <div className="mb-4">
          <PendingState operation={runningOp} />
        </div>
      )}

      {bindings.length === 0 ? (
        <EmptyState
          icon="globe"
          title="No domains attached to this app"
          body="Attach an existing domain, or use the domain connection wizard — it shows the exact A/CNAME records to add at your registrar and polls until they resolve."
          action={{ label: "Attach a domain", onClick: () => setAttachOpen(true) }}
          secondaryAction={{ label: "Domain connection wizard", href: "/domains/connect" }}
        />
      ) : (
        <TableCard
          title={`Hostnames — ${app.name}`}
          caption="Hostnames, routing and TLS status for domains attached to the app"
          rowKey={(b: { id: string }) => b.id}
          columns={[
            {
              key: "hostname",
              header: "Hostname",
              render: (b: { hostname: string; is_primary: boolean }) => (
                <span className="font-medium text-ink">
                  {b.hostname}
                  {b.is_primary && <Chip tone="accent" className="ml-2">primary</Chip>}
                </span>
              ),
            },
            {
              key: "routing",
              header: "Routing",
              render: () => <span className="text-xs text-ink-2">reverse proxy → app port</span>,
            },
            {
              key: "tls",
              header: "TLS",
              render: (b: { tls: string }) => (
                <Chip tone={b.tls === "active" ? "success" : b.tls === "pending" ? "warning" : "danger"}>
                  {b.tls === "active" ? "certificate active" : b.tls === "pending" ? "issuing" : "none — request a certificate"}
                </Chip>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              render: (b: { hostname: string; tls: string }) => (
                <span className="flex flex-wrap gap-2">
                  {b.tls !== "active" && (
                    <ButtonLink href="/certificates/new" size="sm" variant="secondary">
                      Request certificate
                    </ButtonLink>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDetachTarget(b.hostname)}>
                    Detach
                  </Button>
                </span>
              ),
            },
          ]}
          rows={bindings}
        />
      )}

      <Card title="Where domains live" className="mt-4">
        <p className="text-sm text-ink-2">
          Domains are managed centrally in the{" "}
          <Link href="/domains" className="text-accent hover:underline">domains inventory</Link> — DNS records
          for your registrar live in{" "}
          <Link href="/domains" className="text-accent hover:underline">DNS guidance</Link>. Ownership is
          verified once and can be attached to any site or app.
        </p>
      </Card>

      <ConfirmDialog
        open={detachTarget !== null}
        onClose={() => setDetachTarget(null)}
        onConfirm={doDetach}
        title="Detach hostname"
        confirmLabel="Detach"
        body={
          <>
            Detach <span className="font-mono">{detachTarget}</span> from {app.name}? It stops routing once
            the job verifies; the domain itself stays in your inventory.
          </>
        }
      />

      {attachOpen && (
        <Modalish
          onClose={() => setAttachOpen(false)}
          mode={mode}
          setMode={setMode}
          existing={existing}
          setExisting={setExisting}
          hostname={hostname}
          setHostname={setHostname}
          hostnameError={hostnameError}
          busy={busy}
          onAttach={doAttach}
        />
      )}
    </Screen>
  );
}

function Modalish(props: {
  onClose: () => void;
  mode: string;
  setMode: (v: string) => void;
  existing: string;
  setExisting: (v: string) => void;
  hostname: string;
  setHostname: (v: string) => void;
  hostnameError?: string;
  busy: boolean;
  onAttach: () => void;
}) {
  return (
    <FixedModal open onClose={props.onClose} title="Attach a domain" footer={
      <>
        <Button variant="secondary" onClick={props.onClose}>Cancel</Button>
        <Button onClick={props.onAttach} loading={props.busy}>Attach</Button>
      </>
    }>
      <div className="flex flex-col gap-4">
        <Field label="Domain source" htmlFor="att-mode">
          <Select id="att-mode" value={props.mode} onChange={(e) => props.setMode(e.target.value)}>
            <option value="existing">Existing domain (already verified)</option>
            <option value="manual">Manual hostname (runs the connection flow)</option>
          </Select>
        </Field>
        {props.mode === "existing" ? (
          <Field label="Domain" htmlFor="att-existing" hint="Only verified domains can be attached directly.">
            <Select id="att-existing" value={props.existing} onChange={(e) => props.setExisting(e.target.value)}>
              {db.domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.state})</option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Hostname" htmlFor="att-host" required error={props.hostnameError} hint="Ownership is verified before the binding goes live.">
            <Input id="att-host" value={props.hostname} onChange={(e) => props.setHostname(e.target.value)} className="font-mono text-xs" placeholder="api.wanjiku.co.ke" />
          </Field>
        )}
      </div>
    </FixedModal>
  );
}

import { Modal as FixedModal } from "@/components/ui/overlay";
