"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { db } from "@/lib/mock/data";
import { isTerminal } from "@/lib/operations";
import { PROFILES, PROFILE_ORDER } from "@/lib/profiles";
import { ORGANIZATIONS, PERSONAS, PRESENTATION_MODES } from "@/lib/personas";
import {
  useNotifications,
  useOperationStream,
  useSession,
  useToast,
  type Theme,
} from "@/components/providers";
import { Chip } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icons";
import { Input, Select, Switch } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/nav";
import { BatchQueueIndicator } from "@/components/common/batch-queue";
import type { PersonaId, PresentationMode, ProfileId } from "@/lib/types";

/**
 * Global top bar (Stage 3 §4.1 region 1): organization switcher (DS-002),
 * server/account context chip (the demo profile switcher), search, batch
 * queue indicator (DS-023), notifications, help, theme cycle and the user
 * menu with persona / presentation / first-run / density / support-access
 * controls. Everything reads the session providers — no prop drilling.
 */

const THEME_CYCLE: Theme[] = ["light", "dark", "system"];

const ORG_OPTIONS: { id: string; name: string; type: string }[] = [
  ...ORGANIZATIONS.map((org) => ({ id: org.id, name: org.name, type: org.type })),
  ...db.organizations
    .filter((org) => !ORGANIZATIONS.some((demo) => demo.id === org.id))
    .map((org) => ({ id: org.id, name: org.name, type: org.organization_type })),
];

function usePopoverClose(
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLDivElement | null>,
  triggerRef: React.RefObject<HTMLButtonElement | null>
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        onClose();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, panelRef, triggerRef]);
}

function PopoverMenu({
  id,
  open,
  onClose,
  triggerRef,
  widthClass = "w-80",
  children,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  widthClass?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  usePopoverClose(open, onClose, panelRef, triggerRef);
  if (!open) return null;
  return (
    <div
      ref={panelRef}
      id={id}
      className={cx(
        "absolute right-0 top-full z-[150] mt-2 rounded-card border border-line bg-surface p-3",
        widthClass
      )}
    >
      {children}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  onNavigate,
  children,
}: {
  href: string;
  icon: IconName;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2 rounded-control px-2 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <Icon name={icon} size={14} className="shrink-0" />
      <span>{children}</span>
    </Link>
  );
}

const TRIGGER_CLASSES =
  "flex h-9 items-center gap-1.5 rounded-control text-sm text-ink-2 hover:bg-surface-2 hover:text-ink";

export function Topbar({
  onOpenSidebar,
  onOpenSearch,
}: {
  onOpenSidebar: () => void;
  onOpenSearch: () => void;
}) {
  const session = useSession();
  const { push } = useToast();
  const { list } = useOperationStream();
  const notifications = useNotifications();
  const [openMenu, setOpenMenu] = useState<"org" | "profile" | "user" | null>(null);
  const [orgQuery, setOrgQuery] = useState("");

  const close = useCallback(() => setOpenMenu(null), []);
  const toggle = useCallback((menu: "org" | "profile" | "user") => {
    setOpenMenu((current) => (current === menu ? null : menu));
  }, []);

  const orgTriggerRef = useRef<HTMLButtonElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const userTriggerRef = useRef<HTMLButtonElement>(null);

  const user = db.users.find((candidate) => candidate.id === db.currentUser) ?? db.users[0];
  const currentOrg =
    db.organizations.find((org) => org.id === session.organizationId) ?? db.organizations[0];
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const activeOps = list.filter((op) => !isTerminal(op.status)).length;
  const nextTheme =
    THEME_CYCLE[(THEME_CYCLE.indexOf(session.theme) + 1) % THEME_CYCLE.length] ?? "light";

  const orgQueryLower = orgQuery.trim().toLowerCase();
  const filteredOrgs = ORG_OPTIONS.filter((org) =>
    orgQueryLower === "" ? true : org.name.toLowerCase().includes(orgQueryLower)
  );
  const recentOrgs = ORG_OPTIONS.slice(0, 2);

  const selectOrg = (org: { id: string; name: string }) => {
    session.setOrganizationId(org.id);
    push("info", `Switched to ${org.name}`);
    close();
  };

  const profile = PROFILES[session.profile];

  return (
    <header className="sticky top-0 z-[100] flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-surface px-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation menu"
        title="Open navigation menu"
        className={cx(TRIGGER_CLASSES, "w-9 justify-center lg:hidden")}
      >
        <Icon name="list" size={18} />
      </button>

      {/* Organization switcher (DS-002) */}
      <div className="relative">
        <button
          ref={orgTriggerRef}
          type="button"
          onClick={() => toggle("org")}
          aria-expanded={openMenu === "org"}
          aria-controls="nx-menu-org"
          aria-haspopup="true"
          title="Switch organization — scoped filters are cleared on switch in the real product (out of scope in this prototype)"
          className={cx(TRIGGER_CLASSES, "max-w-[9rem] px-2 sm:max-w-[14rem]")}
        >
          <Icon name="users" size={14} className="shrink-0" />
          <span className="min-w-0 truncate">{currentOrg.name}</span>
          <Icon name="chevron-down" size={14} className="shrink-0 text-ink-3" />
        </button>
        <PopoverMenu
          id="nx-menu-org"
          open={openMenu === "org"}
          onClose={close}
          triggerRef={orgTriggerRef}
          widthClass="w-80"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
            Organization
          </p>
          <Input
            value={orgQuery}
            onChange={(event) => setOrgQuery(event.target.value)}
            placeholder="Filter organizations…"
            aria-label="Filter organizations"
            className="mb-2 h-9"
          />
          {activeOps > 0 && (
            <p
              role="status"
              className="mb-2 flex items-start gap-1.5 rounded-control bg-info-soft px-2 py-1.5 text-xs text-info"
            >
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              <span>
                {activeOps} {activeOps === 1 ? "operation" : "operations"} in progress — switching
                context keeps them running
              </span>
            </p>
          )}
          <p className="mb-1 text-xs text-ink-3">Recent</p>
          {recentOrgs.map((org) => (
            <button
              key={`recent-${org.id}`}
              type="button"
              onClick={() => selectOrg(org)}
              title="Switch organization — scoped filters are cleared on switch in the real product (out of scope in this prototype)"
              className="flex w-full items-center gap-1.5 rounded-control px-2 py-1.5 text-left text-xs text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <Icon name="clock" size={12} className="shrink-0" />
              <span className="min-w-0 truncate">{org.name}</span>
            </button>
          ))}
          <div className="my-2 h-px bg-line" aria-hidden="true" />
          <div className="space-y-0.5">
            {filteredOrgs.map((org) => {
              const selected = session.organizationId === org.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => selectOrg(org)}
                  aria-current={selected ? "true" : undefined}
                  title="Switch organization — scoped filters are cleared on switch in the real product (out of scope in this prototype)"
                  className={cx(
                    "flex w-full items-center justify-between gap-2 rounded-control px-2 py-2 text-left text-sm",
                    selected ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-surface-2"
                  )}
                >
                  <span className="min-w-0 truncate">{org.name}</span>
                  <Chip tone={selected ? "accent" : "neutral"}>{org.type}</Chip>
                </button>
              );
            })}
            {filteredOrgs.length === 0 && (
              <p className="px-2 py-3 text-sm text-ink-2">No organizations match “{orgQuery}”.</p>
            )}
          </div>
        </PopoverMenu>
      </div>

      {/* Server / account context chip — the demo VPS tier switcher */}
      <div className="relative">
        <button
          ref={profileTriggerRef}
          type="button"
          onClick={() => toggle("profile")}
          aria-expanded={openMenu === "profile"}
          aria-controls="nx-menu-profile"
          aria-haspopup="true"
          title={`Server profile: ${profile.label} — ${profile.tagline}`}
          className="flex h-9 items-center gap-1.5 rounded-control border border-line px-2 text-xs text-ink hover:border-line-strong"
        >
          <Icon name="hard-drive" size={14} className="shrink-0 text-ink-3" />
          <span className="font-medium">{profile.label}</span>
        </button>
        <PopoverMenu
          id="nx-menu-profile"
          open={openMenu === "profile"}
          onClose={close}
          triggerRef={profileTriggerRef}
          widthClass="w-80"
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
            Server profile
          </p>
          <p className="mb-2 text-sm text-ink">
            {profile.label} — {profile.tagline}
          </p>
          <SegmentedControl
            aria-label="Server profile"
            size="sm"
            options={PROFILE_ORDER.map((id) => ({ value: id, label: PROFILES[id].label }))}
            value={session.profile}
            onChange={(value) => {
              session.setProfile(value as ProfileId);
              push("info", "Profile switched — capability banner updates everywhere");
            }}
          />
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            Demo only — simulates which VPS you bought. Capability banners and honest states update
            everywhere.
          </p>
        </PopoverMenu>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search screens, resources and actions (Command K)"
          title="Search (⌘K)"
          className={cx(TRIGGER_CLASSES, "border border-line px-2.5 hover:border-line-strong")}
        >
          <Icon name="search" size={16} />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden rounded border border-line bg-surface-2 px-1 font-sans text-xs text-ink-3 lg:inline">
            ⌘K
          </kbd>
        </button>

        <BatchQueueIndicator />

        <Link
          href="/notifications"
          aria-label={`Notifications — ${unreadCount} unread`}
          title="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="bell" size={16} />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-ink"
            >
              {unreadCount}
            </span>
          )}
        </Link>

        <Link
          href="/help"
          aria-label="Help center"
          title="Help center"
          className="flex h-9 w-9 items-center justify-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="help-circle" size={16} />
        </Link>

        <button
          type="button"
          onClick={() => session.setTheme(nextTheme)}
          aria-label={`Theme: ${session.theme} — switch to ${nextTheme}`}
          title={`Theme: ${session.theme} (cycles light → dark → system)`}
          className="flex h-9 w-9 items-center justify-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Icon name={session.theme === "dark" ? "moon" : "sun"} size={16} />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            ref={userTriggerRef}
            type="button"
            onClick={() => toggle("user")}
            aria-expanded={openMenu === "user"}
            aria-controls="nx-menu-user"
            aria-haspopup="true"
            aria-label="User menu"
            title="Account and demo controls"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
          >
            {user.avatar_initials}
          </button>
          <PopoverMenu
            id="nx-menu-user"
            open={openMenu === "user"}
            onClose={close}
            triggerRef={userTriggerRef}
            widthClass="w-80"
          >
            <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
              >
                {user.avatar_initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">
                  {user.display_name}
                </span>
                <span className="block truncate text-xs text-ink-2">{user.email}</span>
              </span>
            </div>

            <p
              className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3"
              title="Presentation only — permissions are identical across modes"
            >
              Presentation mode
            </p>
            <SegmentedControl
              aria-label="Presentation mode (presentation only — permissions identical)"
              size="sm"
              options={PRESENTATION_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
              value={session.presentation}
              onChange={(value) => session.setPresentation(value as PresentationMode)}
            />
            <p className="mb-3 mt-1 text-xs leading-relaxed text-ink-3">
              Presentation only — permissions are identical across modes.
            </p>

            <label
              htmlFor="nx-persona-select"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3"
              title="Demo persona — jobs-to-be-done, not a permission identity"
            >
              Demo persona (jobs-to-be-done)
            </label>
            <Select
              id="nx-persona-select"
              className="mb-3 h-9"
              value={session.persona}
              onChange={(event) => session.setPersona(event.target.value as PersonaId)}
            >
              {PERSONAS.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.label}
                </option>
              ))}
            </Select>

            <div className="space-y-2">
              <Switch
                checked={session.firstRun}
                onChange={session.setFirstRun}
                label="Show first-run router at /"
              />
              <Switch
                checked={session.density === "compact"}
                onChange={(value) => session.setDensity(value ? "compact" : "comfortable")}
                label="Compact density"
              />
              <Switch
                checked={session.supportAccess}
                onChange={session.setSupportAccess}
                label="Simulate support session"
              />
            </div>

            <div className="mt-3 border-t border-line pt-2">
              <MenuLink href="/settings/profile" icon="settings" onNavigate={close}>
                Preferences
              </MenuLink>
              <MenuLink href="/settings/sessions" icon="monitor" onNavigate={close}>
                Sessions
              </MenuLink>
              <MenuLink href="/auth/sign-in" icon="log-out" onNavigate={close}>
                Sign out
              </MenuLink>
            </div>
          </PopoverMenu>
        </div>
      </div>
    </header>
  );
}
