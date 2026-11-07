"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { databaseHref } from "@/lib/database-routes";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Stepper } from "@/components/ui/nav";
import { UnavailableState } from "@/components/common/states";
import { Field, Input, Select } from "@/components/ui/form";
import { useCapability, useSession, useToast, useOperationStream } from "@/components/providers";
import { createDatabase } from "@/lib/api/databases";
import { ApiError } from "@/lib/api/core";
import type { DbEngine } from "@/lib/mock/databases";
import { PROFILES } from "@/lib/profiles";

/** UX-DB-002 — Create database wizard (FLOW-006 condensed): engine, name,
 * size → review → database.provision operation. Capability-gated per engine. */
export default function CreateDatabasePage() {
  const { profile } = useSession();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const router = useRouter();
  const [engine, setEngine] = useState<DbEngine>("mariadb");
  const [name, setName] = useState("");
  const [size, setSize] = useState("900");
  const [backupPolicy, setBackupPolicy] = useState("Nightly 02:00 → B2 bucket wanjiku-backups · retention 30 days");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const rec = useCapability(engine === "mariadb" ? "db.mariadb" : "db.postgres");
  const otherRec = useCapability(engine === "mariadb" ? "db.postgres" : "db.mariadb");

  if (rec.state === "unavailable") {
    return (
      <Screen id="UX-DB-002" breadcrumbs={[{ label: "Databases", href: "/databases" }, { label: "Create" }]}>
        {/* Honest gate with the record's resource delta (never a greyed button). */}
        <UnavailableState capabilityKey={engine === "mariadb" ? "db.mariadb" : "db.postgres"} title="This VPS cannot run this database engine">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEngine(engine === "mariadb" ? "postgres" : "mariadb")}>
              Check the other engine instead
            </Button>
            <Link href="/databases" className="self-center text-sm text-accent hover:underline">Back to databases</Link>
          </div>
        </UnavailableState>
      </Screen>
    );
  }

  const steps = ["Engine", "Name & size", "Review"];

  const submit = () => {
    setBusy(true);
    setError(null);
    createDatabase({ engine, name: name.trim(), size_mb: Number(size), backup_policy: backupPolicy })
      .then(({ instance, operation }) => {
        push("success", "Database provisioning submitted", `Operation ${operation.id} — the instance appears when the connection verifies.`);
        setFocusedId(operation.id);
        setTrayOpen(true);
        router.push(databaseHref(instance.id));
      })
      .catch((e: unknown) => {
        setBusy(false);
        setError(e instanceof ApiError ? e.problem.detail : "Unexpected error.");
      });
  };

  return (
    <Screen id="UX-DB-002" breadcrumbs={[{ label: "Databases", href: "/databases" }, { label: "Create" }]}>
      <div className="flex flex-col gap-4">
        <Stepper steps={steps} current={step} />
        {rec.state === "borderline" && (
          <Callout tone="warning" title="Runs, but tight">
            {rec.reason} Consider the smallest size and keep batch jobs light.
          </Callout>
        )}

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["mariadb", "postgres"] as DbEngine[]).map((e) => {
              const r = e === engine ? rec : otherRec;
              const active = engine === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEngine(e)}
                  aria-pressed={active}
                  className={`rounded-card border p-4 text-left ${active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"}`}
                >
                  <p className="text-sm font-semibold text-ink">{e === "mariadb" ? "MariaDB 11.4 LTS" : "PostgreSQL 16"}</p>
                  <p className="mt-1 text-xs text-ink-2">
                    {e === "mariadb" ? "The classic WordPress/woocommerce engine. mysql:// with TLS." : "JSONB, row-level security, strict types. postgresql:// with TLS."}
                  </p>
                  <p className="mt-2 text-xs font-medium">{r.state === "available" ? "Available" : "Borderline — runs, but tight"}</p>
                </button>
              );
            })}
            <div className="sm:col-span-2">
              <Button onClick={() => setStep(1)}>Continue</Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid max-w-xl gap-4">
            <Field label="Database name" htmlFor="db-name" required hint="3–31 lowercase letters, digits or hyphens. It doubles as the hostname prefix.">
              <Input id="db-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="kilishop-db" autoComplete="off" />
            </Field>
            <Field label="Memory ceiling" htmlFor="db-size" required hint={`A ceiling, not a reservation. The hard limit on this VPS is ${PROFILES[profile].specs.ram_mb * 1.2} MB across all workloads.`}>
              <Select id="db-size" value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="450">Small — 450 MB ceiling</option>
                <option value="900">Medium — 900 MB ceiling</option>
                <option value="1000">Large — 1 GB ceiling (Postgres only)</option>
              </Select>
            </Field>
            <Field label="Backup policy" htmlFor="db-backup" required hint="Logical dumps to the remote destination — local backups are not available on this profile.">
              <Select id="db-backup" value={backupPolicy} onChange={(e) => setBackupPolicy(e.target.value)}>
                <option value="Nightly 02:00 → B2 bucket wanjiku-backups · retention 30 days">Nightly 02:00 · 30 days</option>
                <option value="Nightly 02:30 → B2 bucket wanjiku-backups · retention 14 days">Nightly 02:30 · 14 days</option>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
              <Button disabled={name.trim().length < 3} onClick={() => setStep(2)}>Review</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-xl">
            <Callout tone="info" title="Review before submitting">
              <ul className="list-disc space-y-1 pl-4">
                <li>Engine: {engine === "mariadb" ? "MariaDB 11.4" : "PostgreSQL 16"}</li>
                <li>Name: <span className="font-mono">{name}</span> → host <span className="font-mono">db.{name || "…"}.nairobi-01.wanjiku.digital</span></li>
                <li>Memory ceiling: {size} MB</li>
                <li>Backup policy: {backupPolicy}</li>
                <li>A least-privilege app user is created with the instance; the password is shown once.</li>
              </ul>
            </Callout>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button loading={busy} onClick={submit}>Create database</Button>
            </div>
          </div>
        )}

        {error !== null && (
          <Callout tone="danger" title="Could not create the database">{error}</Callout>
        )}
      </div>
    </Screen>
  );
}
