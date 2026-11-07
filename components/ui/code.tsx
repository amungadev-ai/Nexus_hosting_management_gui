"use client";

import React, { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { Button } from "./button";
import { SearchInput } from "./form";
import { Icon, type IconName } from "./icons";

/**
 * Code & secrets: CodeBlock (mono, nx-scroll), CopyButton (clipboard +
 * 1.5s "Copied" feedback), SecretField (DS-008 one-time reveal — masked by
 * default, unrecoverable once hidden, never logged) and LogViewer (DS-014 —
 * live/pause, severity, filter, copy/export; lines arrive already redacted).
 */

export function CodeBlock({
  code,
  language,
  className,
  maxHeight,
}: {
  code: string;
  language?: string;
  className?: string;
  maxHeight?: number;
}) {
  const pre = (
    <pre
      className={cx(
        "overflow-auto nx-scroll bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink",
        language === undefined && "rounded-control",
        className
      )}
      style={maxHeight !== undefined ? { maxHeight } : undefined}
    >
      <code>{code}</code>
    </pre>
  );
  if (language === undefined) return pre;
  return (
    <div className="overflow-hidden rounded-control border border-line">
      <div className="border-b border-line bg-surface px-3 py-1.5 text-xs text-ink-3">
        {language}
      </div>
      {pre}
    </div>
  );
}

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = () => {
    const request = navigator.clipboard?.writeText(text);
    request
      ?.then(() => {
        setCopied(true);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  return (
    <Button variant="ghost" size="sm" icon="copy" onClick={handleCopy} className={className}>
      {copied ? "Copied" : label}
    </Button>
  );
}

export function SecretField({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  // held: the in-memory copy of the secret; null once the reveal is spent.
  const [held, setHeld] = useState<string | null>(value);
  const [revealed, setRevealed] = useState(false);
  const [spent, setSpent] = useState(false);

  useEffect(() => {
    if (!spent) setHeld(value);
  }, [value, spent]);

  const hide = () => {
    // One-time reveal spent: zero the internal copy — the value becomes
    // unrecoverable from the UI. Never logged anywhere.
    setRevealed(false);
    setHeld(null);
    setSpent(true);
  };

  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-auto nx-scroll rounded-control bg-surface-2 px-3 py-2 font-mono text-xs text-ink">
          {revealed && held !== null ? held : "••••••••"}
        </code>
        {!spent && (
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={revealed ? "eye-off" : "eye"}
              onClick={() => (revealed ? hide() : setRevealed(true))}
            >
              {revealed ? "Hide" : "Reveal"}
            </Button>
            {held !== null && <CopyButton text={held} />}
          </>
        )}
      </div>
      {spent && (
        <p role="status" className="text-xs text-ink-3">
          Secret copied. It will not be shown again.
        </p>
      )}
    </div>
  );
}

export interface LogLine {
  ts: string;
  severity: "info" | "warn" | "error";
  message: string;
}

const SEVERITY_META: Record<LogLine["severity"], { icon: IconName; text: string }> = {
  info: { icon: "info", text: "text-info" },
  warn: { icon: "alert-triangle", text: "text-warning" },
  error: { icon: "alert-triangle", text: "text-danger" },
};

export function LogViewer({
  lines,
  live = false,
  className,
}: {
  lines: LogLine[];
  live?: boolean;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const liveActive = live && !paused;

  useEffect(() => {
    if (liveActive && scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveActive, lines.length]);

  const q = query.trim().toLowerCase();
  const filtered = q === "" ? lines : lines.filter((l) => l.message.toLowerCase().includes(q));

  const exportLog = () => {
    const text = `${filtered
      .map((l) => `${l.ts}\t${l.severity.toUpperCase()}\t${l.message}`)
      .join("\n")}\n`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nexuspanel.log";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className={cx("overflow-hidden rounded-card border border-line bg-surface", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Filter logs"
          aria-label="Filter log lines"
          className="min-w-40 flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          icon={paused ? "play" : "pause"}
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          disabled={!live}
        >
          {paused ? "Resume" : "Pause"}
        </Button>
        <CopyButton text={filtered.map((l) => `${l.ts}\t${l.severity.toUpperCase()}\t${l.message}`).join("\n")} />
        <Button variant="secondary" size="sm" icon="download" onClick={exportLog}>
          Export
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="nx-scroll max-h-80 overflow-auto bg-surface-2 p-3 font-mono text-xs leading-relaxed"
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-ink-2">
            {lines.length === 0 ? "No log lines yet." : "No lines match the current filter."}
          </p>
        ) : (
          <ol className="flex list-none flex-col gap-1 p-0">
            {filtered.map((line, i) => {
              const meta = SEVERITY_META[line.severity];
              return (
                <li key={`${line.ts}-${i}`} className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-ink-3">
                    {line.ts}
                  </span>
                  <span className={cx("flex shrink-0 items-center gap-1 font-medium", meta.text)}>
                    <Icon name={meta.icon} size={12} />
                    {line.severity}
                  </span>
                  <span className="min-w-0 break-words text-ink">{line.message}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
