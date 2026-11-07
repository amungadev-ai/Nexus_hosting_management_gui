"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/icons";
import { Drawer } from "@/components/ui/overlay";
import { ToastViewport } from "@/components/ui/toast";
import { CapabilityBanner } from "@/components/common/capability-banner";
import { AccessGrantBanner } from "@/components/ui/misc";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { OperationTray } from "@/components/shell/operation-tray";
import { CommandPalette } from "@/components/shell/command-palette";

/**
 * App shell (Stage 3 §4.1): desktop sidebar + sticky topbar + capability
 * banner (DS-021) + access-grant banner (DS-019) + main region + footer;
 * operation tray (DS-011), command palette (DS-015) and toast viewport
 * mounted globally. Mobile (<1024px): drawer navigation + the fixed bottom
 * shortcut set (Overview, Resources, Activity, Search, More — §2.2).
 * Everything reads the providers — no prop drilling.
 */

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BottomItem({
  href,
  icon,
  label,
  active,
  onClick,
}: {
  href?: string;
  icon: IconName;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const classes = cx(
    "flex h-16 flex-col items-center justify-center gap-0.5 text-xs",
    active ? "font-medium text-accent" : "text-ink-2 hover:text-ink"
  );
  if (href !== undefined) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={classes}>
        <Icon name={icon} size={18} />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  // Global ⌘K / Ctrl+K toggles the command palette.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {/* Desktop sidebar — hidden below 1024px; the drawer carries it on mobile */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSidebar={() => setNavOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <CapabilityBanner />
        <AccessGrantBanner />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="border-t border-line px-4 pb-24 pt-4 text-center text-xs text-ink-3 sm:px-6 lg:pb-4">
          NexusPanel prototype — mocked API, static export
        </footer>
      </div>

      {/* Mobile bottom shortcuts (Stage 3 §2.2 fixed set) */}
      <nav
        aria-label="Mobile shortcuts"
        className="fixed inset-x-0 bottom-0 z-[100] grid grid-cols-5 border-t border-line bg-surface lg:hidden"
      >
        <BottomItem href="/overview" icon="home" label="Overview" active={isActivePath(pathname, "/overview")} />
        <BottomItem href="/websites" icon="globe" label="Resources" active={isActivePath(pathname, "/websites")} />
        <BottomItem href="/activity" icon="activity" label="Activity" active={isActivePath(pathname, "/activity")} />
        <BottomItem icon="search" label="Search" onClick={() => setSearchOpen(true)} />
        <BottomItem
          icon="more-horizontal"
          label="More"
          onClick={() => setNavOpen(true)}
        />
      </nav>

      {/* Mobile navigation drawer — full sidebar content */}
      <Drawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title="Navigation"
        className="max-w-xs"
      >
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </Drawer>

      <OperationTray />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ToastViewport />
    </div>
  );
}
