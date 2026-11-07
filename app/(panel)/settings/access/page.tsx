"use client";

import { useEffect, useState } from "react";
import type { PersonaId, PersonaMatrixRow } from "@/lib/types";
import { getMe, getMyCapabilities, getPersonaMatrix } from "@/lib/api/me";
import { iamPolicies } from "@/lib/mock/iam";
import { PERSONAS } from "@/lib/personas";
import { useSession } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { Chip } from "@/components/ui/badge";
import { Callout, Skeleton, SkeletonTable } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/form";
import { DataTable, TableCard } from "@/components/ui/table";
import { Card } from "@/components/ui/card";

/**
 * UX-IAM-008 — Roles and access policies (read-only preview). The persona ×
 * capability matrix is GET /me/persona-matrix — signed data the SPA must
 * verify (digest + signature shown as evidence, tampered matrices are
 * rejected at load in the real product). Policy cards summarize the
 * second-person approval rule, step-up actions and session lifetime. The
 * standing rule: personas shape the interface; the API decides permissions.
 */
export default function AccessPage() {
  const { persona } = useSession();
  const [selected, setSelected] = useState<PersonaId>(persona);
  const [rows, setRows] = useState<PersonaMatrixRow[] | null>(null);
  const [digest, setDigest] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    getPersonaMatrix(selected)
      .then((res) => {
        if (alive) {
          setRows(res.data.rows);
          setDigest(`${res.data.signature_algorithm}:${res.data.digest}`);
        }
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [selected]);

  const surfaceChip = (surface: PersonaMatrixRow["surface"]) =>
    surface === "default_landing" ? (
      <Chip tone="accent">default_landing</Chip>
    ) : surface === "visible_menu" ? (
      <Chip tone="neutral">visible_menu</Chip>
    ) : (
      <Chip tone="warning">hidden</Chip>
    );

  return (
    <Screen
      id="UX-IAM-008"
      breadcrumbs={[{ label: "Settings" }, { label: "Access" }]}
      description="Read-only preview of the persona × capability matrix and the standing access policies. Roles cannot be edited here — the policy engine and the API own authorization."
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="Personas shape the interface; the API decides permissions.">
          Guided / Standard / Expert are presentation modes with identical permissions. This
          matrix drives navigation emphasis and the router — it is never the authorization
          source, and prohibited resources stay undiscoverable rather than greyed out.
        </Callout>

        <Card title="Persona × capability matrix" description="GET /me/persona-matrix — the router's source of truth (signed).">
          <div className="flex flex-col gap-4">
            <Field
              label="Preview persona"
              htmlFor="matrix-persona"
              hint="Switch the top-bar persona to change the whole interface, not just this preview."
              className="max-w-md"
            >
              <Select id="matrix-persona" value={selected} onChange={(e) => setSelected(e.target.value as PersonaId)}>
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>

            {rows === null ? (
              <SkeletonTable rows={6} cols={3} />
            ) : (
              <TableCard
                title={`Surfaces for ${PERSONAS.find((p) => p.id === selected)?.label ?? selected}`}
                rowKey={(r) => r.capability_key}
                rows={rows}
                caption="Persona matrix rows"
                emptyState={
                  <div className="px-4 py-10 text-center text-sm text-ink-2">
                    The matrix returned no rows for this persona — the router would fall back to
                    the capability display + guided tour.
                  </div>
                }
                columns={[
                  {
                    key: "capability_key",
                    header: "Capability",
                    sortable: true,
                    className: "sticky left-0 bg-surface font-mono text-xs",
                  },
                  { key: "surface", header: "Surface", render: (r) => surfaceChip(r.surface) },
                  {
                    key: "notes",
                    header: "Notes",
                    render: (r) => r.notes ?? <span className="text-ink-3">—</span>,
                  },
                ]}
              />
            )}

            {digest !== null ? (
              <p className="text-xs text-ink-3">
                Signature <span className="font-mono">{digest}</span> — clients verify this
                digest before trusting the matrix (conformance API-043).
              </p>
            ) : (
              <Skeleton className="h-4 w-72" />
            )}
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          {iamPolicies.map((policy) => (
            <PolicyCard key={policy.id} policyId={policy.id} title={policy.title} body={policy.body} source={policy.source} />
          ))}
        </div>
      </div>
    </Screen>
  );
}

/** Step-up actions and permission scopes load from the bootstrap endpoints. */
function PolicyCard({ policyId, title, body, source }: { policyId: string; title: string; body: string; source: string }) {
  const { profile } = useSession();
  const [stepUpActions, setStepUpActions] = useState<string[] | null>(null);
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    if (policyId !== "pol_step_up") return;
    let alive = true;
    void (async () => {
      try {
        const [me, caps] = await Promise.all([getMe(), getMyCapabilities(profile)]);
        if (alive) {
          setStepUpActions(me.data.effective_context.step_up_required_for);
          setPermissions(caps.data.permissions);
        }
      } catch {
        if (alive) {
          setStepUpActions([]);
          setPermissions([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [policyId, profile]);

  return (
    <Card title={title}>
      <p className="text-sm text-ink-2">{body}</p>
      {policyId === "pol_step_up" && (
        <div className="mt-3 flex flex-col gap-2">
          {stepUpActions === null ? (
            <Skeleton className="h-5 w-56" />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {stepUpActions.map((a) => (
                <Chip key={a} tone="info" className="font-mono">
                  {a}
                </Chip>
              ))}
            </div>
          )}
          <p className="text-xs text-ink-3">
            Effective permission scopes (
            {permissions === null ? "loading" : `${permissions.length}`}):{" "}
            {permissions === null ? (
              <Skeleton className="inline-block h-3 w-40 align-middle" />
            ) : (
              <span className="font-mono">{permissions.join(" · ")}</span>
            )}
          </p>
        </div>
      )}
      <p className="mt-3 border-t border-line pt-2 font-mono text-[11px] text-ink-3">{source}</p>
    </Card>
  );
}
