"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { Button } from "./button";
import { Checkbox, Input } from "./form";
import { Chip } from "./badge";
import { DiffViewer } from "./misc";
import { Icon } from "./icons";

/**
 * Overlays: Modal (DS-010 dialogs / general), Drawer (DS-020 context panel),
 * ConfirmDialog (DS-010 exact-target confirmation) and ImpactReview (DS-009).
 * Shared a11y: on open the panel receives focus, Escape closes, and focus is
 * restored to the previously focused element on close. Dialogs become
 * full-height sheets below the sm breakpoint (Stage 3 §7).
 */

const BACKDROP_CLASSES = "bg-black/40";

function useDialogA11y(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, panelRef]);
}

function DialogHeader({
  title,
  description,
  titleId,
  descriptionId,
  onClose,
}: {
  title: string;
  description?: string;
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-surface p-4 sm:p-6">
      <div className="min-w-0">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {description !== undefined && (
          <p id={descriptionId} className="mt-1 text-sm text-ink-2">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="-m-1 shrink-0 rounded-control p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(open, onClose, panelRef);
  const titleId = useId();
  const descriptionId = useId();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-start justify-center sm:items-center sm:p-6">
      <div aria-hidden="true" className={cx("absolute inset-0", BACKDROP_CLASSES)} onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        className={cx(
          "relative flex max-h-[85vh] w-full flex-col overflow-auto rounded-modal bg-surface outline-none",
          "max-sm:h-full max-sm:max-h-full max-sm:rounded-b-none",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
          className
        )}
      >
        <DialogHeader
          title={title}
          description={description}
          titleId={titleId}
          descriptionId={descriptionId}
          onClose={onClose}
        />
        <div className="min-w-0 p-4 sm:p-6">{children}</div>
        {footer !== undefined && (
          <div className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface p-4 sm:p-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Right-side sliding context panel (DS-020) — same a11y contract as Modal. */
export function Drawer({ open, onClose, title, children, footer, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(open, onClose, panelRef);
  const titleId = useId();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      <div aria-hidden="true" className={cx("absolute inset-0", BACKDROP_CLASSES)} onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-surface outline-none",
          className
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-4">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-m-1 rounded-control p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer !== undefined && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** When set, the confirm button stays disabled until this exact string is typed. */
  typedConfirmation?: string;
}

/**
 * DS-010 confirmation dialog. The consumer names the exact target in
 * title/confirmLabel ("Delete website acme-consulting"); destructive actions
 * use the destructive variant; high-risk adds typed confirmation.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  destructive = false,
  typedConfirmation,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const typedSatisfied = typedConfirmation === undefined || typed === typedConfirmation;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            disabled={!typedSatisfied}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-sm text-ink-2">{body}</div>
        {typedConfirmation !== undefined && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-typed" className="text-sm font-medium text-ink">
              Type <span className="font-mono">{typedConfirmation}</span> to confirm
            </label>
            <Input
              id="confirm-typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

export interface ImpactReviewImpact {
  before: string;
  after: string;
  affectedResources: string[];
  downtimeEstimate: string;
  reversibility: string;
}

export interface ImpactReviewProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  impact: ImpactReviewImpact;
  diff?: { path: string; before: string; after: string }[];
  submitLabel: string;
  children?: React.ReactNode;
}

/**
 * DS-009 Impact review — the mandatory pre-flight for high-risk changes:
 * before/after, affected resources, downtime estimate, reversibility,
 * optional diff, and an explicit "I have reviewed the impact" gate before
 * the action can be submitted.
 */
export function ImpactReview({
  open,
  onClose,
  onSubmit,
  title,
  impact,
  diff,
  submitLabel,
  children,
}: ImpactReviewProps) {
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => {
    if (open) setReviewed(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Review what this change will do before submitting."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!reviewed} onClick={onSubmit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-control bg-danger-soft p-3">
            <p className="flex items-center gap-1 text-xs font-medium text-danger">
              <Icon name="minus" size={12} /> Before
            </p>
            <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-xs text-ink">
              {impact.before === "" ? "(empty)" : impact.before}
            </p>
          </div>
          <div className="rounded-control bg-success-soft p-3">
            <p className="flex items-center gap-1 text-xs font-medium text-success">
              <Icon name="plus" size={12} /> After
            </p>
            <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-xs text-ink">
              {impact.after === "" ? "(empty)" : impact.after}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-ink-2">Affected resources</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {impact.affectedResources.map((r) => (
              <Chip key={r} tone="neutral">
                {r}
              </Chip>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-ink-3">Downtime estimate</dt>
            <dd className="mt-0.5 text-sm text-ink">{impact.downtimeEstimate}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-ink-3">Reversibility</dt>
            <dd className="mt-0.5 text-sm text-ink">{impact.reversibility}</dd>
          </div>
        </dl>

        {diff !== undefined && diff.length > 0 && <DiffViewer hunks={diff} />}

        {children !== undefined && <div className="text-sm text-ink-2">{children}</div>}

        <Checkbox
          checked={reviewed}
          onChange={setReviewed}
          label="I have reviewed the impact"
        />
      </div>
    </Modal>
  );
}
