"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chip } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icons";
import { useCapabilities, useSession } from "@/components/providers";
import { SCREENS, type ScreenDef } from "@/lib/screens";
import { db } from "@/lib/mock/data";
import { cx } from "@/lib/format";

/**
 * Command palette (DS-015): scoped search over the page screens of the
 * registry, grouped by module, capability-aware — screens whose module is
 * gated carry an honest "needs more resources" chip when the current profile
 * cannot run that module's core capability (rows stay navigable). Full
 * keyboard support: ↑↓ navigate, ↵ open, esc close; focus returns to the
 * opener on close.
 */

const MODULE_ICONS: Record<string, IconName> = {
  iam: "settings",
  overview: "home",
  infrastructure: "server",
  commercial: "credit-card",
  web: "globe",
  files: "folder",
  databases: "database",
  dns: "globe",
  mail: "mail",
  ops: "activity",
  automation: "zap",
  ai: "bot",
  support: "help-circle",
  services: "cloud",
  templates: "box",
};

/** Module → the capability that gates its core work (honest palette hints). */
const MODULE_CAPABILITY: Record<string, string> = {
  databases: "db.mariadb",
  mail: "mail.external_smtp",
  commercial: "commercial.surface",
  templates: "service.docker",
  services: "service.docker",
};

/** Same resolver as the sidebar (duplicated locally, per shell contract). */
function resolveRoute(route: string, moduleId: string): string | null {
  if (!route.includes(":")) return route;
  const parts = route.split("/").map((part) => {
    if (!part.startsWith(":")) return part;
    switch (part.slice(1)) {
      case "site":
        return db.websites[0].id;
      case "app":
        return db.applications[0].id;
      case "domain":
      case "zone":
        return db.domains[0].id;
      case "cert":
        return db.certificates[0].id;
      case "server":
        return db.server.id;
      case "org":
        return db.organizations[0].id;
      case "job":
        return db.operations[0].id;
      case "incident":
        return db.incidents[0].id;
      case "id":
        if (moduleId === "commercial") return db.payments[0].id;
        if (moduleId === "services") return db.serviceInstances[0].id;
        if (moduleId === "templates") return db.templates[0].key;
        if (route.startsWith("/migrations")) return "mig_01JDEMO1";
        return null;
      default:
        return null;
    }
  });
  if (parts.some((part) => part === null)) return null;
  return parts.join("/");
}

interface PaletteItem {
  screen: ScreenDef;
  href: string;
}

const LIMIT = 12;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { profile } = useSession();
  const capabilities = useCapabilities();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const capState = useMemo(
    () => new Map(capabilities.map((record) => [record.capability_key, record.state])),
    [capabilities]
  );

  const results = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const out: PaletteItem[] = [];
    for (const screen of SCREENS) {
      if (screen.kind !== "page") continue;
      if (
        q !== "" &&
        !screen.title.toLowerCase().includes(q) &&
        !screen.route.toLowerCase().includes(q) &&
        !screen.module_title.toLowerCase().includes(q)
      ) {
        continue;
      }
      const href = resolveRoute(screen.route, screen.module);
      if (href === null) continue;
      out.push({ screen, href });
      if (out.length >= LIMIT) break;
    }
    return out;
  }, [query]);

  const grouped = useMemo(() => {
    const out: { moduleTitle: string; module: string; items: PaletteItem[] }[] = [];
    for (const item of results) {
      const last = out[out.length - 1];
      if (last && last.module === item.screen.module) {
        last.items.push(item);
      } else {
        out.push({ moduleTitle: item.screen.module_title, module: item.screen.module, items: [item] });
      }
    }
    return out;
  }, [results]);

  const flatIndex = useMemo(
    () => new Map(results.map((item, index) => [item.screen.id, index])),
    [results]
  );

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Focus the input on open; restore focus to the opener on close.
  useEffect(() => {
    if (open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery("");
      setActive(0);
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
    openerRef.current?.focus();
  }, [open]);

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, Math.max(0, results.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500]">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="absolute inset-x-0 top-20 mx-auto w-full max-w-xl px-4"
      >
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search screens, resources, actions…"
            aria-label="Search screens, resources, actions"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="nx-cmdk-list"
            aria-activedescendant={
              results[active] !== undefined ? `nx-cmdk-opt-${active}` : undefined
            }
            className="h-12 w-full border-b border-line bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-3"
          />
          <div id="nx-cmdk-list" role="listbox" aria-label="Search results" className="max-h-[60vh] overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-2">
                No screens match “{query}”. Try a resource name, a screen title or a module.
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.module}>
                  <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                    {group.moduleTitle}
                  </p>
                  {group.items.map((item) => {
                    const index = flatIndex.get(item.screen.id) ?? 0;
                    const isActive = index === active;
                    const gateKey = MODULE_CAPABILITY[item.screen.module];
                    const gated = gateKey !== undefined && capState.get(gateKey) === "unavailable";
                    return (
                      <button
                        key={item.screen.id}
                        id={`nx-cmdk-opt-${index}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(item)}
                        className={cx(
                          "flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-sm",
                          isActive ? "bg-accent-soft font-medium text-accent" : "text-ink-2"
                        )}
                      >
                        <Icon
                          name={MODULE_ICONS[item.screen.module] ?? "file"}
                          size={14}
                          className="shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate">{item.screen.title}</span>
                        {gated && <Chip tone="warning">needs more resources</Chip>}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <p className="border-t border-line bg-surface-2 px-4 py-2 text-xs text-ink-3">
            ↑↓ navigate · ↵ open · esc close
          </p>
        </div>
      </div>
    </div>
  );
}
