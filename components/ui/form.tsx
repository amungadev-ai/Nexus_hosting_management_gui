"use client";

import React, { useId } from "react";
import { cx } from "@/lib/format";
import { Icon } from "./icons";

/**
 * DS-007 Form field family — labels are always visible (never
 * placeholder-as-label), hints explain, errors announce (role="alert").
 * Field auto-wires aria-describedby / aria-invalid onto its control.
 * Deliberately uncontrolled-friendly — no form library in the prototype.
 */

const CONTROL_CLASSES =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-2";

export interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  required?: boolean;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, required, error, children, className }: FieldProps) {
  const hintId = useId();
  const errorId = useId();
  const describedBy =
    [hint !== undefined && !error ? hintId : null, error !== undefined ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  // Forward the describedby/invalid state into the single child control.
  let control: React.ReactNode = children;
  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<{
      "aria-describedby"?: string;
      "aria-invalid"?: boolean;
      id?: string;
    }>;
    control = React.cloneElement(element, {
      "aria-describedby": describedBy,
      "aria-invalid": error !== undefined ? true : undefined,
      id: element.props.id ?? htmlFor,
    });
  }

  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-danger">
              {" "}
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {control}
      {hint !== undefined && error === undefined && (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type = "text", ...rest }, ref) {
  return <input ref={ref} type={type} className={cx(CONTROL_CLASSES, className)} {...rest} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea ref={ref} rows={rows} className={cx(CONTROL_CLASSES, className)} {...rest} />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(CONTROL_CLASSES, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Accessible switch — button role="switch", 40×24 track, sliding thumb. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label === undefined ? (ariaLabel ?? "Toggle") : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "group inline-flex items-center gap-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-accent bg-accent" : "border-line bg-surface-2"
        )}
      >
        <span
          className={cx(
            "pointer-events-none inline-block h-5 w-5 rounded-full border border-line bg-surface transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          )}
        />
      </span>
      {label !== undefined && <span className="text-sm text-ink">{label}</span>}
    </button>
  );
}

export interface CheckboxProps {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: React.ReactNode;
  className?: string;
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  description,
  className,
}: CheckboxProps) {
  return (
    <label
      className={cx(
        "inline-flex max-w-full items-start gap-2 text-sm",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
      />
      <span className="min-w-0 text-ink">
        {label}
        {description !== undefined && (
          <span className="mt-0.5 block text-xs text-ink-2">{description}</span>
        )}
      </span>
    </label>
  );
}

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  className?: string;
  "aria-label"?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  onClear,
  className,
  "aria-label": ariaLabel,
}: SearchInputProps) {
  const showClear = value !== "";
  return (
    <div className={cx("relative", className)}>
      <Icon
        name="search"
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder ?? "Search"}
        className={cx(CONTROL_CLASSES, "pl-8 pr-8")}
      />
      {showClear && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-control p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  );
}

export interface FieldsetProps {
  legend: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Groups related controls (wizard steps, radio-like clusters). */
export function Fieldset({ legend, hint, children, className }: FieldsetProps) {
  return (
    <fieldset className={cx("min-w-0", className)}>
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      {hint !== undefined && <p className="mb-2 text-xs text-ink-3">{hint}</p>}
      <div className="flex flex-col gap-3">{children}</div>
    </fieldset>
  );
}
