"use client";

import React, { useState } from "react";
import { Screen } from "@/components/common/screen";
import { UnavailableState } from "@/components/common/states";
import { useFixture } from "@/components/ops/use-fixture";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { SecretField } from "@/components/ui/code";
import { useCapability, useNow, useOperationStream, useToast } from "@/components/providers";
import { backupDestinations } from "@/lib/mock/ops";
import { submitDestinationConnect, submitDestinationTest } from "@/lib/api/ops";
import { formatRelative } from "@/lib/format";

/**
 * UX-OPS-005 /backups/destinations — offsite providers, credentials, health.
 * The primary backup flow on Nano (remote-only). The B2 card holds the
 * application key in a SecretField (DS-008 one-time reveal); the local card
 * renders the honest capability gate on profiles without backup.local.
 */
export default function BackupDestinationsPage() {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const localCap = useCapability("backup.local");
  const destinations = useFixture(() => backupDestinations);
  const [connectOpen, setConnectOpen] = useState(false);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("s3.eu-central-003.backblazeb2.com");
  const [bucket, setBucket] = useState("");
  const [kind, setKind] = useState("remote");

  const test = (d: { id: string; name: string; status: string }) => {
    const op = submitDestinationTest(d.name, d.id);
    setFocusedId(op.id);
    setTrayOpen(true);
    push("info", "Connection test queued", `${d.name} — the probe runs as a batch job.`);
  };

  const connect = () => {
    const label = name.trim() || "New destination";
    const op = submitDestinationConnect(label);
    setFocusedId(op.id);
    setTrayOpen(true);
    push("success", "Destination connect queued", `${label} — credentials are encrypted at rest.`);
    setConnectOpen(false);
    setName("");
    setBucket("");
  };

  return (
    <Screen
      id="UX-OPS-005"
      breadcrumbs={[{ label: "Backups", href: "/backups" }, { label: "Destinations" }]}
      actions={
        <Button icon="plus" onClick={() => setConnectOpen(true)}>
          Connect destination
        </Button>
      }
    >
      <Callout tone="info" className="mb-4">
        A destination on the same VPS disk does not protect you against disk or VPS
        loss — offsite (remote) destinations are the trustworthy default.
      </Callout>

      {destinations === null ? (
        <SkeletonTable rows={2} cols={4} />
      ) : destinations.length === 0 ? (
        <Callout tone="warning" title="No destinations configured">
          Backups need somewhere to go. Connect an S3-compatible destination —
          Backblaze B2 is the reference setup.
        </Callout>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {destinations.map((d) => {
            if (d.kind === "local" && localCap.state === "unavailable") {
              return (
                <UnavailableState key={d.id} capabilityKey={d.capability_key ?? "backup.local"} title="Local backups" />
              );
            }
            return (
              <Card
                key={d.id}
                title={
                  <span className="flex items-center gap-2">
                    {d.name}
                    <StatusPill status={d.status === "healthy" ? "healthy" : d.status === "unavailable" ? "unavailable" : d.status === "degraded" ? "degraded" : "unknown"} />
                  </span>
                }
                description={d.detail}
                actions={
                  d.status !== "unavailable" ? (
                    <Button variant="secondary" size="sm" icon="zap" onClick={() => test(d)}>
                      Test connection
                    </Button>
                  ) : undefined
                }
              >
                {d.credential_hint !== "—" ? (
                  <SecretField
                    label="Application key"
                    value="kWanjiku0000000000000000000B2AppKey7f2b"
                    className="max-w-md"
                  />
                ) : (
                  <p className="text-sm text-ink-2">Credentials: none — direct disk path.</p>
                )}
                <p className="mt-3 text-xs text-ink-3">
                  {d.status_detail ??
                    `Not tested yet${d.last_tested_at !== null ? ` · last tested ${formatRelative(d.last_tested_at, now)}` : ""}`}
                  {d.last_tested_at !== null && d.status_detail !== null &&
                    ` · last tested ${formatRelative(d.last_tested_at, now)}`}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title="Connect destination"
        description="S3-compatible endpoints work out of the box (B2, Wasabi, MinIO). Credentials are encrypted before storage."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={connect} disabled={name.trim() === "" || bucket.trim() === "" || kind === "local"}>
              Connect
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Destination kind" htmlFor="dst-kind" hint={kind === "local" ? "Local destinations need the backup.local capability — see the local card on this page." : undefined}>
            <Select id="dst-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="remote">Remote (S3-compatible)</option>
              <option value="local">Local disk</option>
            </Select>
          </Field>
          <Field label="Name" htmlFor="dst-name" required>
            <Input id="dst-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wasabi Nairobi" />
          </Field>
          <Field label="Endpoint" htmlFor="dst-endpoint">
            <Input id="dst-endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Bucket" htmlFor="dst-bucket" required>
            <Input id="dst-bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="wanjiku-backups-2" />
          </Field>
          <p className="text-xs text-ink-3">
            The access key and secret are requested on the next step and stored
            encrypted — they are never displayed again after save.
          </p>
        </div>
      </Modal>
    </Screen>
  );
}
