"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import type { MigrationConflict } from "@/lib/mock/support";
import {
  applyConflictResolutions,
  conflictsFor,
  migrationById,
  rollbackMigration,
} from "@/lib/api/support";
import { isTerminal } from "@/lib/operations";
import { useOperationStream, useToast } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { NotFoundInline, PendingState } from "@/components/common/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/overlay";
import { MigrationStatePill, useFixture } from "@/components/support/shared";

/**
 * UX-SUP-011 /migrations/[id]/conflicts — conflict resolution for a paused
 * import. Each conflict (name collision, PHP version mismatch, database
 * prefix) resolves with keep / skip / rename; rename reveals an input.
 * "Apply resolutions" submits the lib/api/support.ts resolve operation — the
 * import only resumes when that job runs. The preview line under each
 * conflict states exactly what the choice will do.
 */

const RESOLUTION_OPTIONS: { value: MigrationConflict["resolution"]; label: string }[] = [
  { value: "keep", label: "Keep" },
  { value: "skip", label: "Skip" },
  { value: "rename", label: "Rename" },
];

function keepPreview(kind: MigrationConflict["kind"]): string {
  switch (kind) {
    case "name_collision":
      return "The item already on this panel stays as-is; the source copy is not imported over it.";
    case "php_version_mismatch":
      return "The destination runtime is kept. The installer validates the source app against it during import and reports incompatibilities instead of silently upgrading.";
    case "database_prefix":
      return "The existing database keeps its prefix; the source tables are re-written to match it during import.";
  }
}

function previewFor(c: MigrationConflict, resolution: MigrationConflict["resolution"], rename: string): string {
  if (resolution === "skip") {
    return "Nothing is imported for this item — the destination stays exactly as it is, and the import continues with the rest.";
  }
  if (resolution === "rename") {
    const name = rename.trim();
    return name === ""
      ? "Imported under a new name — enter one below so the preview is exact."
      : `Imported as “${name}”. The destination item is untouched, and the audit records the rename.`;
  }
  return keepPreview(c.kind);
}

interface DraftState {
  [conflictId: string]: { resolution: MigrationConflict["resolution"]; rename: string };
}

function draftFrom(conflicts: MigrationConflict[]): DraftState {
  const draft: DraftState = {};
  for (const c of conflicts) {
    draft[c.id] = { resolution: c.resolution, rename: c.rename_value };
  }
  return draft;
}

export function MigrationConflictsView({ migrationId }: { migrationId: string }) {
  const { push } = useToast();
  const { list, setTrayOpen, setFocusedId } = useOperationStream();
  const migration = useFixture(() => migrationById(migrationId));
  const conflicts = useMemo(() => conflictsFor(migrationId), [migrationId]);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [opId, setOpId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackOpId, setRollbackOpId] = useState<string | null>(null);

  const operation = useMemo(() => (opId === null ? undefined : list.find((o) => o.id === opId)), [opId, list]);
  const rollbackOperation = useMemo(
    () => (rollbackOpId === null ? undefined : list.find((o) => o.id === rollbackOpId)),
    [rollbackOpId, list]
  );

  if (migration === null) {
    return (
      <Screen id="UX-SUP-011" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Migrations", href: "/migrations" }, { label: "Conflicts" }]}>
        <SkeletonTable rows={3} cols={3} />
      </Screen>
    );
  }

  if (migration === undefined) {
    return (
      <Screen id="UX-SUP-011" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Migrations", href: "/migrations" }, { label: "Conflicts" }]}>
        <NotFoundInline what="migration" />
      </Screen>
    );
  }

  // Terminal rollback in progress / done.
  if (rollbackOperation !== undefined && !isTerminal(rollbackOperation.status)) {
    return (
      <Screen
        id="UX-SUP-011"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Migrations", href: "/migrations" }, { label: migration.source_label, href: "/migrations" }, { label: "Conflicts" }]}
      >
        <div className="mx-auto max-w-2xl">
          <PendingState operation={rollbackOperation}>
            <p className="text-xs text-ink-2">
              Nothing was cut over, so rollback only removes the staged copy and records the decision
              in the audit chain.
            </p>
          </PendingState>
        </div>
      </Screen>
    );
  }

  const paused = migration.state === "conflicts";
  const effectiveDraft = draft ?? draftFrom(conflicts);
  const applied = !paused && conflicts.length > 0;

  const renameMissing = conflicts.some((c) => {
    const d = effectiveDraft[c.id];
    return d !== undefined && d.resolution === "rename" && d.rename.trim() === "";
  });

  const apply = () => {
    setApplyError(null);
    setApplying(true);
    try {
      const resolutions = new Map<string, { resolution: MigrationConflict["resolution"]; rename: string }>();
      for (const c of conflicts) {
        const d = effectiveDraft[c.id];
        if (d !== undefined) resolutions.set(c.id, { resolution: d.resolution, rename: d.rename.trim() });
      }
      const op = applyConflictResolutions(migrationId, resolutions);
      setOpId(op.id);
      setFocusedId(op.id);
      setTrayOpen(true);
      push(
        "success",
        "Resolutions submitted (202)",
        "The import resumes only after the resolve job verifies the plan — the hub shows the live status."
      );
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "The resolutions could not be applied. Try again.");
    } finally {
      setApplying(false);
    }
  };

  const rollback = () => {
    try {
      const op = rollbackMigration(migrationId);
      setRollbackOpId(op.id);
      setRollbackOpen(false);
      push("info", "Rollback submitted", "The staged import copy is removed; the migration hub will show it as rolled back.");
    } catch (e) {
      push("error", "Rollback failed", e instanceof Error ? e.message : "The rollback could not be submitted.");
    }
  };

  // ---- honest non-conflict states ----------------------------------------
  if (conflicts.length === 0) {
    return (
      <Screen
        id="UX-SUP-011"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Migrations", href: "/migrations" }, { label: migration.source_label, href: "/migrations" }, { label: "Conflicts" }]}
        actions={
          <ButtonLink href="/migrations" variant="secondary">
            Back to migration hub
          </ButtonLink>
        }
      >
        <div className="flex flex-col gap-4">
          <MigrationStatePill state={migration.state} />
          {migration.state === "running" ? (
            <Callout tone="info" title="The dry-run is still checking this import">
              Conflicts appear here as soon as the preflight finds a name clash, runtime mismatch or
              database-prefix collision. Until then there is nothing to resolve — the import either
              proceeds or pauses for review.
            </Callout>
          ) : (
            <EmptyState
              icon="check-circle"
              title="No conflicts recorded for this migration"
              body="This screen only lists conflicts found by the import dry-run. Check the migration hub for the current status and its operation timeline."
              action={{ label: "Back to migration hub", href: "/migrations" }}
            />
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      id="UX-SUP-011"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Migrations", href: "/migrations" }, { label: migration.source_label, href: "/migrations" }, { label: "Conflicts" }]}
      actions={
        <>
          <Button
            onClick={apply}
            loading={applying}
            disabled={!paused || renameMissing}
            icon="check"
          >
            Apply resolutions
          </Button>
          <Button variant="destructive" onClick={() => setRollbackOpen(true)} disabled={!paused}>
            Roll back import
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <MigrationStatePill state={migration.state} />
          <span className="text-xs text-ink-3">
            {migration.items} items · started from {migration.source_label}
          </span>
        </div>

        {!paused && (
          <Callout
            tone="info"
            title={applied ? "Resolutions applied — the import resumed" : "This migration is no longer paused"}
          >
            {applied
              ? "The choices below are recorded; the resume job verifies the plan before copying anything. You can no longer change them here — roll back or let the import finish."
              : "Conflicts were recorded for this import, but its state has moved on. The table below is read-only."}
            {" "}
            <Link href="/migrations" className="font-medium text-accent hover:underline">
              Track it in the migration hub
            </Link>
            .
          </Callout>
        )}

        {operation !== undefined && !isTerminal(operation.status) && (
          <PendingState operation={operation}>
            <p className="text-xs text-ink-2">
              Applying the keep / skip / rename decisions, re-running the conflict check, then
              resuming the import. Nothing is written until verification passes.
            </p>
          </PendingState>
        )}
        {operation !== undefined && operation.status === "succeeded" && (
          <Callout tone="success" title="Resolutions applied and import resumed">
            The verified plan is now running in the migration hub.
          </Callout>
        )}

        {applyError !== null && (
          <Callout tone="danger" title="Could not apply resolutions">
            {applyError}
          </Callout>
        )}

        <Callout tone="warning" title="You are choosing what the importer will do">
          The import is paused — nothing has been written to this panel yet. Each choice below states
          exactly what will happen. &ldquo;Keep&rdquo; protects what is already here; &ldquo;skip&rdquo; leaves the
          source item behind; &ldquo;rename&rdquo; imports it under a new name.
        </Callout>

        {/* Conflict table — one resolution row per conflict */}
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Migration conflicts and chosen resolutions</caption>
            <thead>
              <tr className="border-b border-line bg-surface-2">
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-2">Conflict</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-2">Resolution</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-2">What will happen</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c) => {
                const d = effectiveDraft[c.id] ?? { resolution: c.resolution, rename: c.rename_value };
                const disabled = !paused;
                return (
                  <tr key={c.id} className="border-b border-line align-top last:border-b-0">
                    <td className="min-w-0 px-3 py-3">
                      <p className="font-medium text-ink">{c.title}</p>
                      <p className="mt-1 max-w-md text-xs text-ink-2">{c.detail}</p>
                    </td>
                    <td className="px-3 py-3">
                      <fieldset className="flex flex-col gap-2" disabled={disabled}>
                        <legend className="sr-only">Resolution for {c.title}</legend>
                        {RESOLUTION_OPTIONS.map((opt) => (
                          <label key={opt.value} className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                            <input
                              type="radio"
                              name={`res-${c.id}`}
                              value={opt.value}
                              checked={d.resolution === opt.value}
                              disabled={disabled}
                              onChange={() =>
                                setDraft({
                                  ...effectiveDraft,
                                  [c.id]: { resolution: opt.value, rename: d.rename },
                                })
                              }
                              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                        {d.resolution === "rename" && (
                          <div className="ml-6">
                            <label htmlFor={`rename-${c.id}`} className="text-xs font-medium text-ink">
                              New name
                            </label>
                            <Input
                              id={`rename-${c.id}`}
                              value={d.rename}
                              disabled={disabled}
                              onChange={(e) =>
                                setDraft({
                                  ...effectiveDraft,
                                  [c.id]: { resolution: "rename", rename: e.target.value },
                                })
                              }
                              autoComplete="off"
                              spellCheck={false}
                              className="mt-1 max-w-56 font-mono text-xs"
                            />
                          </div>
                        )}
                      </fieldset>
                    </td>
                    <td className="min-w-0 px-3 py-3 text-xs text-ink-2">{previewFor(c, d.resolution, d.rename)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!paused ? null : renameMissing ? (
          <p className="text-sm text-warning">Every rename needs a value before resolutions can be applied.</p>
        ) : (
          <p className="text-sm text-ink-2">
            Applying submits the resolutions as a durable operation — the import resumes only when the
            job verifies the plan, and the result is audited.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        onConfirm={rollback}
        title={`Roll back import — ${migration.source_label}`}
        confirmLabel="Roll back import"
        destructive
        typedConfirmation="ROLLBACK"
        body={
          <>
            <p>
              The import is paused at conflict review — nothing has been cut over. Rolling back
              discards the staged copy of the source data and marks the migration rolled back; the
              source server is never touched.
            </p>
            <p className="mt-2">
              The rollback runs as a tracked operation and is recorded in the audit chain. To import
              later, start a fresh migration from the hub.
            </p>
          </>
        }
      />
    </Screen>
  );
}
