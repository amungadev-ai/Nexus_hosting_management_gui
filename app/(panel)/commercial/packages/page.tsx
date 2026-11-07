"use client";

import React, { useState } from "react";
import Link from "next/link";
import { hostingPackages } from "@/lib/mock/commercial";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/components/providers";
import { publishPackage, savePackage } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Callout } from "@/components/ui/feedback";
import { CommercialGate, useLoaded, LoadedTable, useRefresh } from "@/components/commercial/shared";

export default function PackagesPage() {
  const { push } = useToast();
  const [refresh, bump] = useRefresh();
  const { loading, data } = useLoaded(() => hostingPackages);
  const [editing, setEditing] = useState<string | null | undefined>(undefined); // undefined = closed, null = new
  const [form, setForm] = useState({ name: "", price: "150.00", websites: "2", mailboxes: "5", disk: "10", features: "" });

  const openNew = () => {
    setForm({ name: "", price: "150.00", websites: "2", mailboxes: "5", disk: "10", features: "Static + PHP sites\nFree Let's Encrypt SSL" });
    setEditing(null);
  };
  const openEdit = (id: string) => {
    const p = hostingPackages.find((x) => x.id === id);
    if (!p) return;
    setForm({ name: p.name, price: (p.price.amount_minor / 100).toFixed(2), websites: String(p.resources.websites), mailboxes: String(p.resources.mailboxes), disk: String(p.resources.disk_gb), features: p.features.join("\n") });
    setEditing(id);
  };

  const submit = () => {
    try {
      savePackage({
        id: editing ?? undefined,
        name: form.name.trim() || "Untitled package",
        price_minor: Math.round(parseFloat(form.price || "0") * 100),
        websites: parseInt(form.websites, 10) || 0,
        mailboxes: parseInt(form.mailboxes, 10) || 0,
        disk_gb: parseFloat(form.disk || "0"),
        features: form.features,
      });
      push("success", "Package saved", "Draft revisions are editable until published.");
      setEditing(undefined);
      bump();
    } catch {
      push("error", "Cannot save package", "Published revisions are immutable — create a new draft instead.");
    }
  };

  return (
    <Screen
      id="UX-COM-004"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Packages" }]}
      actions={<Button icon="plus" onClick={openNew}>Create package</Button>}
    >
      <CommercialGate>
        <Callout tone="info" className="mb-4">
          Overselling is prevented by policy: account limits are checked against the provider&apos;s own capacity at provisioning time.
        </Callout>
        <LoadedTable loading={loading}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(data ?? []).map((p) => (
              <Card
                key={p.id}
                title={p.name}
                actions={
                  <>
                    <Chip tone={p.status === "published" ? "success" : "neutral"}>{p.status === "published" ? `Published · rev ${p.revision}` : "Draft"}</Chip>
                  </>
                }
              >
                <p className="text-lg font-semibold text-ink">{formatMoney(p.price)}<span className="text-sm font-normal text-ink-2">/month + 16% VAT</span></p>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-2">
                  <li>{p.resources.websites} websites · {p.resources.mailboxes} mailboxes</li>
                  <li>{p.resources.disk_gb} GB disk · {Math.round(p.resources.ram_mb / 1024 * 10) / 10} GB RAM ceiling</li>
                  {p.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.status === "published" ? (
                    <Link href={`/commercial/packages/${p.id}`} className="text-sm font-medium text-accent hover:underline">View editor</Link>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => openEdit(p.id)}>Edit</Button>
                      <Button size="sm" onClick={() => { publishPackage(p.id); push("success", "Package published", `${p.name} rev ${p.revision} is now published and immutable.`); bump(); }}>Publish</Button>
                    </>
                  )}
                  <ButtonLink href={`/commercial/packages/${p.id}`} variant="ghost" size="sm">Details</ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        </LoadedTable>

        <Modal
          open={editing !== undefined}
          onClose={() => setEditing(undefined)}
          title={editing === null ? "Create package" : "Edit draft package"}
          description="Draft revisions are editable; published revisions are immutable."
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(undefined)}>Cancel</Button>
              <Button onClick={submit}>Save package</Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="pkg-name" required><Input id="pkg-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Price (KES/month, before VAT)" htmlFor="pkg-price" required><Input id="pkg-price" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Websites" htmlFor="pkg-web"><Input id="pkg-web" inputMode="numeric" value={form.websites} onChange={(e) => setForm({ ...form, websites: e.target.value })} /></Field>
            <Field label="Mailboxes" htmlFor="pkg-mail"><Input id="pkg-mail" inputMode="numeric" value={form.mailboxes} onChange={(e) => setForm({ ...form, mailboxes: e.target.value })} /></Field>
            <Field label="Disk (GB)" htmlFor="pkg-disk"><Input id="pkg-disk" inputMode="decimal" value={form.disk} onChange={(e) => setForm({ ...form, disk: e.target.value })} /></Field>
            <Field label="Features (one per line)" htmlFor="pkg-feat" className="sm:col-span-2"><Textarea id="pkg-feat" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} /></Field>
          </div>
        </Modal>
      </CommercialGate>
    </Screen>
  );
}
