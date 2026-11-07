"use client";

import React, { useMemo, useState } from "react";
import { Screen } from "@/components/common/screen";
import { useFixture } from "@/components/ops/use-fixture";
import { Button } from "@/components/ui/button";
import { TableCard } from "@/components/ui/table";
import { Callout, SkeletonTable } from "@/components/ui/feedback";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { ImpactReview, Modal } from "@/components/ui/overlay";
import { useOperationStream, useToast } from "@/components/providers";
import { firewallRules, type FirewallRule } from "@/lib/mock/ops";
import { submitFirewallApply } from "@/lib/api/ops";
import { formatRelative } from "@/lib/format";
import { useNow } from "@/components/providers";

/**
 * UX-OPS-013 /security/firewall — rules, order, lockout preview, IPv4/IPv6
 * (FLOW-009). Add-rule runs the plan pipeline: form → lockout check →
 * impact review → op (second-person approval noted in the toast).
 */
const CIDR_V4 = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^anywhere$/;
const CIDR_V6 = /^[0-9a-fA-F:]+(\/\d{1,3})?$|^::\/0$|^anywhere$/;

export default function FirewallPage() {
  const now = useNow();
  const { push } = useToast();
  const { setTrayOpen, setFocusedId } = useOperationStream();
  const base = useFixture(() => firewallRules);
  const [added, setAdded] = useState<FirewallRule[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);

  const [direction, setDirection] = useState<"in" | "out">("in");
  const [family, setFamily] = useState<"ipv4" | "ipv6">("ipv4");
  const [protocol, setProtocol] = useState<"tcp" | "udp" | "any">("tcp");
  const [port, setPort] = useState("");
  const [source, setSource] = useState("");
  const [action, setAction] = useState<"allow" | "deny">("allow");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rules = useMemo(() => [...(base ?? []), ...added].sort((a, b) => a.position - b.position), [base, added]);

  const lockoutRisk = useMemo(() => {
    // A deny that covers tcp/22 from the current management IP would lock SSH out.
    return rules.some(
      (r) => r.action === "deny" && (r.port === "any" || r.port.includes("22")) && r.direction === "in" && r.position < 3
    );
  }, [rules]);

  const validate = (): string | null => {
    if (port.trim() === "" && protocol !== "any") return "A port (or range list) is required unless the protocol is “any”.";
    if (source.trim() === "") return "A source CIDR (or “anywhere”) is required.";
    const okCidr = family === "ipv4" ? CIDR_V4.test(source.trim()) : CIDR_V6.test(source.trim());
    if (!okCidr) return `“${source}” is not a valid ${family === "ipv4" ? "IPv4" : "IPv6"} CIDR, address or “anywhere”.`;
    if (action === "deny" && (port.includes("22") || port === "any") && direction === "in")
      return "A deny covering tcp/22 would lock out SSH — an alternate verified access path is required before it can apply.";
    return null;
  };

  const openImpact = () => {
    const v = validate();
    setError(v);
    if (v === null) setImpactOpen(true);
  };

  const submit = () => {
    const summary = `Firewall: ${action} ${protocol === "any" ? "any protocol" : `${port}/${protocol}`} ${direction === "in" ? "from" : "to"} ${source}`;
    const op = submitFirewallApply(summary);
    setFocusedId(op.id);
    setTrayOpen(true);
    setAdded((prev) => [
      ...prev,
      {
        id: op.id,
        position: rules.length + 1,
        direction,
        family,
        protocol,
        port: port.trim() || "any",
        source: source.trim(),
        action,
        note: note.trim() || "Added via firewall screen",
        added_at: new Date().toISOString(),
        added_by: "You (pending approval)",
      },
    ]);
    push(
      "success",
      "Firewall change submitted",
      "Second-person approval required — request sent to /approvals. A timed rollback protects your SSH session."
    );
    setImpactOpen(false);
    setModalOpen(false);
    setPort("");
    setSource("");
    setNote("");
  };

  return (
    <Screen
      id="UX-OPS-013"
      breadcrumbs={[{ label: "Security", href: "/security" }, { label: "Firewall" }]}
      actions={
        <Button icon="plus" onClick={() => setModalOpen(true)}>
          Add rule
        </Button>
      }
    >
      {lockoutRisk && (
        <Callout tone="danger" className="mb-4" title="Lockout risk detected in the current rule set">
          A deny rule sits above the SSH allow. Confirm an alternate verified access path
          exists (provider console) before relying on SSH.
        </Callout>
      )}

      {base === null ? (
        <SkeletonTable rows={5} cols={6} />
      ) : rules.length === 0 ? (
        <Callout tone="warning" title="No firewall rules">
          An empty rule set means every port is closed — including your SSH session. Add an
          allow rule for tcp/22 from your office IP first.
        </Callout>
      ) : (
        <>
          <TableCard<FirewallRule>
            title="Effective rules (in order)"
            caption="Firewall rules in evaluation order — first match wins"
            rowKey={(r) => r.id}
            rows={rules}
            columns={[
              { key: "position", header: "#" },
              { key: "direction", header: "Dir", render: (r) => (r.direction === "in" ? "in" : "out") },
              {
                key: "family",
                header: "Family",
                render: (r) => <Chip tone="neutral">{r.family}</Chip>,
              },
              { key: "port", header: "Port", render: (r) => `${r.port}${r.protocol !== "any" ? `/${r.protocol}` : ""}` },
              { key: "source", header: "Source", render: (r) => <span className="font-mono text-xs">{r.source}</span> },
              {
                key: "action",
                header: "Action",
                render: (r) => (
                  <Chip tone={r.action === "allow" ? "success" : "danger"}>
                    {r.action === "allow" ? "Allow" : "Deny"}
                  </Chip>
                ),
              },
              { key: "note", header: "Note" },
              { key: "added_at", header: "Added", render: (r) => `${r.added_by}, ${formatRelative(r.added_at, now)}` },
            ]}
          />
          <Callout tone="info" className="mt-4" title="Safe-change workflow (FLOW-009)">
            Apply is atomic with a timed rollback: if management connectivity fails after the
            change, the previous rule set is restored and the operation reports the rollback
            honestly. Management path safety is re-verified from an independent session.
          </Callout>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add firewall rule"
        description="CIDR/IP-family validated; shadowed and conflicting rules are flagged in the preview."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={openImpact}>Preview impact</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Direction" htmlFor="fw-direction">
            <Select id="fw-direction" value={direction} onChange={(e) => setDirection(e.target.value === "out" ? "out" : "in")}>
              <option value="in">Inbound</option>
              <option value="out">Outbound</option>
            </Select>
          </Field>
          <Field label="IP family" htmlFor="fw-family">
            <Select id="fw-family" value={family} onChange={(e) => setFamily(e.target.value === "ipv6" ? "ipv6" : "ipv4")}>
              <option value="ipv4">IPv4</option>
              <option value="ipv6">IPv6</option>
            </Select>
          </Field>
          <Field label="Protocol" htmlFor="fw-protocol">
            <Select id="fw-protocol" value={protocol} onChange={(e) => setProtocol(e.target.value === "udp" ? "udp" : e.target.value === "any" ? "any" : "tcp")}>
              <option value="tcp">tcp</option>
              <option value="udp">udp</option>
              <option value="any">any</option>
            </Select>
          </Field>
          <Field label="Port(s)" htmlFor="fw-port" hint={protocol === "any" ? "Not needed when the protocol is any." : "e.g. 22 or 80,443"} required={protocol !== "any"}>
            <Input id="fw-port" value={port} onChange={(e) => setPort(e.target.value)} placeholder="8443" />
          </Field>
          <Field label="Source" htmlFor="fw-source" hint="CIDR, single address, or “anywhere”." required>
            <Input id="fw-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder={family === "ipv4" ? "197.232.81.14/32" : "2001:db8::/32"} className="font-mono" />
          </Field>
          <Field label="Action" htmlFor="fw-action">
            <Select id="fw-action" value={action} onChange={(e) => setAction(e.target.value === "deny" ? "deny" : "allow")}>
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </Select>
          </Field>
          <Field label="Note" htmlFor="fw-note" className="sm:col-span-2">
            <Input id="fw-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this rule exists" />
          </Field>
        </div>
        {error !== null && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </Modal>

      <ImpactReview
        open={impactOpen}
        onClose={() => setImpactOpen(false)}
        onSubmit={submit}
        title="Review firewall change"
        submitLabel="Submit for approval"
        impact={{
          before: `rules 1–${rules.length} (current effective set)`,
          after: `+ ${action} ${protocol === "any" ? "any" : `${port}/${protocol}`} ${direction === "in" ? "from" : "to"} ${source}`,
          affectedResources: ["nairobi-01", "all sites behind nginx"],
          downtimeEstimate: "None — rules apply atomically",
          reversibility: "Timed automatic rollback restores the previous set if SSH fails",
        }}
        diff={[
          {
            path: `ufw/${port || "any"}-${protocol}`,
            before: "no matching rule (falls through to default deny)",
            after: `${action.toUpperCase()} ${direction === "in" ? "from" : "to"} ${source}`,
          },
        ]}
      >
        <p className="font-medium text-ink">Second-person approval required — the request is sent to /approvals.</p>
        <p>Keep an out-of-band access path (provider console) available until the change is verified.</p>
      </ImpactReview>
    </Screen>
  );
}
