"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cx } from "@/lib/format";
import { db } from "@/lib/mock/data";
import { MODULES, SCREENS, screensByModule, type ModuleDef, type ScreenDef } from "@/lib/screens";
import { useSession } from "@/components/providers";
import { Icon, type IconName } from "@/components/ui/icons";
import type { PersonaId, RoleLabel } from "@/lib/types";

/**
 * DS-001 primary navigation — generated from the screen registry (MODULES ×
 * screensByModule), filtered by the current demo persona's audiences and
 * shaped by the presentation mode (guided / standard / expert).
 *
 * Persona ≠ permission: the audience filter only mirrors what the API would
 * return for the persona; presentation modes NEVER remove permitted items —
 * guided mode demotes the full menu behind "Advanced tools" (disclosure, not
 * removal). Pinned favorites and the collapsed icon rail persist in
 * localStorage ("nx.pinned", "nx.sidebar.collapsed").
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

const GUIDED_TOP_ROUTES = ["/overview", "/onboarding", "/activity", "/help"] as const;
const GUIDED_TOP_ICONS: Record<string, IconName> = {
  "/overview": "home",
  "/onboarding": "zap",
  "/activity": "activity",
  "/help": "help-circle",
};

const PINNED_KEY = "nx.pinned";
const COLLAPSED_KEY = "nx.sidebar.collapsed";

interface NavItem {
  screen: ScreenDef;
  href: string;
}

interface NavGroupDef {
  module: ModuleDef;
  items: NavItem[];
}

/** Demo persona → the UI role labels its audiences refer to. */
function rolesForPersona(persona: PersonaId): RoleLabel[] {
  switch (persona) {
    case "self_hoster":
    case "website_owner":
    case "explorer":
      return ["owner"];
    case "app_developer":
      return ["developer"];
    case "storage_user":
      return ["customer"];
    case "reseller":
      return ["reseller"];
    case "provider_admin":
      return ["provider"];
    case "infrastructure_user":
      return ["support", "auditor"];
  }
}

/**
 * Presentation-only audience filter: broadly-scoped audiences (all,
 * authorized*, approvers, billing authorized, explicit privileged scope) are
 * visible to every persona; role audiences match the persona's role labels;
 * "admin only" needs owner or provider. This mirrors the signed-in matrix —
 * the API remains the only authorization authority.
 */
function audiencePermitted(audience: string, roles: RoleLabel[]): boolean {
  if (audience === "all") return true;
  if (audience.startsWith("authorized")) return true; // authorized, authorized members/admins/auditors/opt-in
  if (
    audience === "approvers" ||
    audience === "billing authorized" ||
    audience === "explicit privileged scope"
  ) {
    return true;
  }
  if (audience === "admin only") return roles.includes("owner") || roles.includes("provider");
  return (roles as readonly string[]).includes(audience);
}

function screenPermitted(screen: ScreenDef, roles: RoleLabel[]): boolean {
  return screen.audiences.some((audience) => audiencePermitted(audience, roles));
}

/**
 * Resolve a registry route with ":param" segments to a concrete demo route.
 * Returns null when the item must be skipped (unresolvable param or a param
 * without a demo fixture — its list screen stays reachable instead).
 */
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
        // :box :plugin :package :account :report :plan :run :deploy :db —
        // no demo fixture; the item is skipped, its list screen is reachable.
        return null;
    }
  });
  if (parts.some((part) => part === null)) return null;
  return parts.join("/");
}

/** localStorage-backed state (SSR-safe: loads after mount). */
function usePersistedLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* prototype: ignore corrupt storage */
    }
  }, [key]);
  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    [key]
  );
  return [value, update];
}

function railItemClass(active: boolean): string {
  return cx(
    "flex h-9 w-9 items-center justify-center rounded-control",
    active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
  );
}

function NavRow({
  item,
  active,
  pinned,
  pinable,
  onTogglePin,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  pinned: boolean;
  pinable: boolean;
  onTogglePin?: (id: string) => void;
  onNavigate?: () => void;
}) {
  const icon = MODULE_ICONS[item.screen.module] ?? "file";
  return (
    <div
      className={cx(
        "group/item flex items-center gap-0.5 rounded-control pr-1",
        active ? "bg-accent-soft" : "hover:bg-surface-2"
      )}
    >
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex min-w-0 flex-1 items-center gap-2 rounded-control px-2 py-1.5 text-sm",
          active ? "font-medium text-accent" : "text-ink-2 hover:text-ink"
        )}
      >
        <Icon name={icon} size={16} className="shrink-0" />
        <span className="min-w-0 truncate">{item.screen.title}</span>
      </Link>
      {pinable && onTogglePin !== undefined && (
        <button
          type="button"
          onClick={() => onTogglePin(item.screen.id)}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${item.screen.title}` : `Pin ${item.screen.title}`}
          title={pinned ? "Unpin from sidebar" : "Pin to top of sidebar"}
          className={cx(
            "shrink-0 rounded-control p-1.5 hover:text-ink",
            pinned ? "text-accent opacity-100" : "text-ink-3 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 aria-pressed:opacity-100"
          )}
        >
          <Icon name={pinned ? "check" : "plus"} size={12} />
        </button>
      )}
    </div>
  );
}

function NavGroupView({
  group,
  open,
  onToggle,
  isItemActive,
  pinnedIds,
  onTogglePin,
  onNavigate,
}: {
  group: NavGroupDef;
  open: boolean;
  onToggle: () => void;
  isItemActive: (href: string) => boolean;
  pinnedIds: string[];
  onTogglePin: (id: string) => void;
  onNavigate?: () => void;
}) {
  const listId = `nx-nav-group-${group.module.id}`;
  const icon = MODULE_ICONS[group.module.id] ?? "list";
  return (
    <section className="pb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-3 hover:bg-surface-2 hover:text-ink-2"
      >
        <Icon name={icon} size={14} className="shrink-0" />
        <span className="min-w-0 flex-1">{group.module.title}</span>
        <Icon
          name="chevron-down"
          size={12}
          className={cx("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div id={listId} className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavRow
              key={item.screen.id}
              item={item}
              active={isItemActive(item.href)}
              pinned={pinnedIds.includes(item.screen.id)}
              pinable
              onTogglePin={onTogglePin}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { persona, presentation } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = usePersistedLocal(COLLAPSED_KEY, false);
  const [pinnedIds, setPinnedIds] = usePersistedLocal<string[]>(PINNED_KEY, []);
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const roles = useMemo(() => rolesForPersona(persona), [persona]);

  const groups = useMemo<NavGroupDef[]>(
    () =>
      MODULES.map((module) => ({
        module,
        items: screensByModule(module.id)
          .filter((screen) => screen.kind === "page" && screenPermitted(screen, roles))
          .map((screen) => ({ screen, href: resolveRoute(screen.route, screen.module) }))
          .filter((item): item is NavItem => item.href !== null),
      })).filter((group) => group.items.length > 0),
    [roles]
  );

  const guidedItems = useMemo<NavItem[]>(
    () =>
      GUIDED_TOP_ROUTES.map((route) => {
        const screen = SCREENS.find(
          (candidate) => candidate.kind === "page" && candidate.route === route && screenPermitted(candidate, roles)
        );
        if (!screen) return null;
        const href = resolveRoute(screen.route, screen.module);
        return href === null ? null : { screen, href };
      }).filter((item): item is NavItem => item !== null),
    [roles]
  );

  const pinnedItems = useMemo<NavItem[]>(
    () =>
      pinnedIds
        .map((id) => {
          for (const group of groups) {
            const found = group.items.find((item) => item.screen.id === id);
            if (found) return found;
          }
          return null;
        })
        .filter((item): item is NavItem => item !== null),
    [pinnedIds, groups]
  );

  const isItemActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(`${href}/`),
    [pathname]
  );

  const currentModuleId = useMemo(() => {
    let best: NavItem | null = null;
    for (const group of groups) {
      for (const item of group.items) {
        if (!isItemActive(item.href)) continue;
        if (best === null || item.href.length > best.href.length) best = item;
      }
    }
    return best?.screen.module;
  }, [groups, isItemActive]);

  const togglePin = useCallback(
    (id: string) => {
      setPinnedIds(
        pinnedIds.includes(id) ? pinnedIds.filter((p) => p !== id) : [...pinnedIds, id]
      );
    },
    [pinnedIds, setPinnedIds]
  );

  const setGroupOpen = useCallback((moduleId: string, open: boolean) => {
    setManualOpen((prev) => ({ ...prev, [moduleId]: open }));
  }, []);

  const groupIsOpen = useCallback(
    (group: NavGroupDef) => {
      const containsActive = group.items.some((item) => isItemActive(item.href));
      const manual = manualOpen[group.module.id];
      if (manual !== undefined) return manual;
      if (presentation === "expert") return true;
      return containsActive; // standard + guided: collapsed unless it holds the active screen
    },
    [manualOpen, presentation, isItemActive]
  );

  const brand = (
    <div className={cx("flex shrink-0 items-center", collapsed ? "justify-center px-2 py-3" : "px-3 py-3")}>
      <Link
        href="/overview"
        aria-label="NexusPanel — service portfolio"
        title="NexusPanel — service portfolio"
        className="flex items-center gap-2 rounded-control"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent text-accent-ink"
        >
          <Icon name="layers" size={16} />
        </span>
        {!collapsed && <span className="text-sm font-semibold text-ink">NexusPanel</span>}
      </Link>
    </div>
  );

  const collapseFooter = (
    <div className="shrink-0 border-t border-line p-2">
      {presentation === "expert" && !collapsed && (
        <p className="px-2 pb-2 text-xs leading-relaxed text-ink-3">
          Developer view — all modules expanded and deep controls surfaced. Presentation only:
          permissions are identical.
        </p>
      )}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-pressed={collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cx(
          "flex h-9 w-full items-center gap-2 rounded-control text-sm text-ink-2 hover:bg-surface-2 hover:text-ink",
          collapsed ? "justify-center" : "px-2"
        )}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} className="shrink-0" />
        {!collapsed && <span>Collapse</span>}
      </button>
    </div>
  );

  if (collapsed) {
    return (
      <nav aria-label="Primary" className="flex h-full w-14 flex-col overflow-hidden border-r border-line bg-surface">
        {brand}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-1.5 py-2">
          {presentation !== "guided" &&
            pinnedItems.map((item) => (
              <Link
                key={item.screen.id}
                href={item.href}
                onClick={onNavigate}
                title={`${item.screen.title} (pinned)`}
                aria-label={`${item.screen.title} (pinned)`}
                aria-current={isItemActive(item.href) ? "page" : undefined}
                className={railItemClass(isItemActive(item.href))}
              >
                <Icon name={MODULE_ICONS[item.screen.module] ?? "file"} size={16} />
              </Link>
            ))}
          {presentation === "guided"
            ? guidedItems.map((item) => (
                <Link
                  key={item.screen.id}
                  href={item.href}
                  onClick={onNavigate}
                  title={item.screen.title}
                  aria-label={item.screen.title}
                  aria-current={isItemActive(item.href) ? "page" : undefined}
                  className={railItemClass(isItemActive(item.href))}
                >
                  <Icon name={GUIDED_TOP_ICONS[item.screen.route] ?? "file"} size={16} />
                </Link>
              ))
            : groups.map((group) => {
                const containsActive = group.items.some((item) => isItemActive(item.href));
                return (
                  <button
                    key={group.module.id}
                    type="button"
                    title={group.module.title}
                    aria-label={`Open ${group.module.title}`}
                    onClick={() => {
                      setCollapsed(false);
                      setGroupOpen(group.module.id, true);
                      router.push(group.items[0].href);
                      onNavigate?.();
                    }}
                    className={railItemClass(containsActive)}
                  >
                    <Icon name={MODULE_ICONS[group.module.id] ?? "list"} size={16} />
                  </button>
                );
              })}
          {presentation === "guided" && (
            <button
              type="button"
              title="Advanced tools — full menu"
              aria-label="Advanced tools — full menu"
              onClick={() => {
                setCollapsed(false);
                setAdvancedOpen(true);
              }}
              className={railItemClass(false)}
            >
              <Icon name="list" size={16} />
            </button>
          )}
        </div>
        {collapseFooter}
      </nav>
    );
  }

  return (
    <nav aria-label="Primary" className="flex h-full w-60 flex-col overflow-hidden border-r border-line bg-surface">
      {brand}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {presentation !== "guided" && pinnedItems.length > 0 && (
          <section className="pb-1">
            <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Pinned
            </p>
            <div className="space-y-0.5">
              {pinnedItems.map((item) => (
                <NavRow
                  key={item.screen.id}
                  item={item}
                  active={isItemActive(item.href)}
                  pinned
                  pinable
                  onTogglePin={togglePin}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        )}

        {presentation === "guided" ? (
          <div>
            <div className="space-y-0.5 pt-1">
              {guidedItems.map((item) => (
                <NavRow
                  key={item.screen.id}
                  item={item}
                  active={isItemActive(item.href)}
                  pinned={false}
                  pinable={false}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
            <section className="pb-1 pt-3">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                aria-expanded={advancedOpen}
                aria-controls="nx-nav-advanced"
                className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-3 hover:bg-surface-2 hover:text-ink-2"
              >
                <Icon name="list" size={14} className="shrink-0" />
                <span className="min-w-0 flex-1">Advanced tools</span>
                <Icon
                  name="chevron-down"
                  size={12}
                  className={cx("shrink-0 transition-transform", advancedOpen && "rotate-180")}
                />
              </button>
              {advancedOpen && (
                <div id="nx-nav-advanced" className="mt-1">
                  {groups.map((group) => (
                    <NavGroupView
                      key={group.module.id}
                      group={group}
                      open={groupIsOpen(group)}
                      onToggle={() => setGroupOpen(group.module.id, !groupIsOpen(group))}
                      isItemActive={isItemActive}
                      pinnedIds={pinnedIds}
                      onTogglePin={togglePin}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="pt-1">
            {groups.map((group) => (
              <NavGroupView
                key={group.module.id}
                group={group}
                open={groupIsOpen(group)}
                onToggle={() => setGroupOpen(group.module.id, !groupIsOpen(group))}
                isItemActive={isItemActive}
                pinnedIds={pinnedIds}
                onTogglePin={togglePin}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
      {collapseFooter}
    </nav>
  );
}
