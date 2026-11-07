"use client";

import React, { useState } from "react";
import Link from "next/link";
import { hostingAccounts, hostingPackages } from "@/lib/mock/commercial";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/components/providers";
import { publishPackage, savePackage } from "@/lib/api/commercial";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/form";
import { KeyValue } from "@/components/ui/misc";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { NotFoundInline } from "@/components/common/states";
import { CommercialGate } from "@/components/commercial/shared";

export function PackageEditorView({ packageId }: { packageId: string }) {
  const { push } = useToast();
  const pkg = hostingPackages.find((p) => p.id === packageId);
  const [name, setName] = useState(pkg?.name ?? "");
  const [price, setPrice] = useState(pkg ? (pkg.price.amount_minor / 100).toFixed(2) : "");
  const [features, setFeatures] = useState(pkg?.features.join("\n") ?? "");
  const [dirty, setDirty] = useState(false);
  if (!pkg) {
    return (
      <Screen id="UX-COM-005" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Packages", href: "/commercial/packages" }]}>
        <NotFoundInline what="package" />
      </Screen>
    );
  }
  const users = hostingAccounts.filter((a) => a.package_id === pkg.id);

  const save = () => {
    try {
      savePackage({ id: pkg.id, name, price_minor: Math.round(parseFloat(price || "0") * 100), websites: pkg.resources.websites, mailboxes: pkg.resources.mailboxes, disk_gb: pkg.resources.disk_gb, features });
      setDirty(false);
      push("success", "Draft saved", "Publish to make the revision immutable.");
    } catch {
      push("error", "Cannot save", "Published revisions are immutable.");
    }
  };

  return (
    <Screen
      id="UX-COM-005"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Packages", href: "/commercial/packages" }, { label: pkg.name }]}
      actions={
        pkg.status === "draft" ? (
          <>
            <Button variant="secondary" disabled={!dirty} onClick={save}>Save draft</Button>
            <Button onClick={() => { publishPackage(pkg.id); push("success", "Package published", `${name} is now published and immutable.`); }}>Publish</Button>
          </>
        ) : (
          <Chip tone="success">Published · rev {pkg.revision}</Chip>
        )
      }
    >
      <CommercialGate>
        {pkg.status === "published" && (
          <Callout tone="info" className="mb-4">
            Published revisions are immutable (Stage 6 §4.14). Create a new draft revision from the packages list to change pricing or quotas.
          </Callout>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Limits and pricing">
            <KeyValue
              items={[
                { label: "Price", value: `${formatMoney(pkg.price)}/month + 16% VAT` },
                { label: "Websites / mailboxes", value: `${pkg.resources.websites} / ${pkg.resources.mailboxes}` },
                { label: "Disk", value: `${pkg.resources.disk_gb} GB` },
                { label: "Revision", value: `rev ${pkg.revision} (${pkg.status})` },
              ]}
              columns={2}
            />
            {pkg.status === "draft" && (
              <CardSection>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Name" htmlFor="pe-name"><Input id="pe-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} /></Field>
                  <Field label="Price (KES)" htmlFor="pe-price"><Input id="pe-price" inputMode="decimal" value={price} onChange={(e) => { setPrice(e.target.value); setDirty(true); }} /></Field>
                  <Field label="Features (one per line)" htmlFor="pe-feat" className="sm:col-span-2"><Textarea id="pe-feat" rows={4} value={features} onChange={(e) => { setFeatures(e.target.value); setDirty(true); }} /></Field>
                </div>
              </CardSection>
            )}
          </Card>
          <Card title="Entitlements in use" description="Accounts on this package">
            {users.length === 0 ? (
              <EmptyState icon="folder" title="No accounts yet" body="No hosting accounts use this package yet. Create an account to sell it." action={{ label: "New account", href: "/commercial/accounts/new" }} />
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {users.map((a) => (
                  <li key={a.id}>
                    <Link href={`/commercial/accounts/${a.id}`} className="font-medium text-accent hover:underline">{a.name}</Link>
                    <span className="ml-2 text-ink-2">{a.customer_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </CommercialGate>
    </Screen>
  );
}
