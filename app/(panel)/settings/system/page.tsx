"use client";

import React from "react";
import Link from "next/link";
import { db } from "@/lib/mock/data";
import { panelVersion } from "@/lib/mock/support";
import { formatGb, formatRelative } from "@/lib/format";
import { PROFILES } from "@/lib/profiles";
import { useNow, useSession } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { LiveStatusLine } from "@/components/common/states";
import { Card } from "@/components/ui/card";
import { Chip, StatusPill } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { Icon, type IconName } from "@/components/ui/icons";

/**
 * UX-SUP-005 /settings/system — system settings hub. Read-only server
 * identity (from db.server + the profile switcher) and panel version info,
 * with links into the lifecycle screens: installer status, upgrade center,
 * recovery, VPS upgrade ladder, data transfer and template transfer.
 * Nothing here is editable — configuration lives in the specific screens.
 */

const LINKS: { icon: IconName; title: string; body: string; href: string }[] = [
  {
    icon: "settings",
    title: "Installer status",
    body: "Preflight, stages, recovery and logs — the installation claim completed during setup.",
    href: "/system/install",
  },
  {
    icon: "refresh",
    title: "Upgrade center",
    body: "Panel versions, compatibility, the backup requirement and the maintenance window.",
    href: "/system/updates",
  },
  {
    icon: "shield",
    title: "Recovery center",
    body: "Offline-safe runbooks, rescue mode and the break-glass audit trail.",
    href: "/system/recovery",
  },
  {
    icon: "trending-up",
    title: "VPS upgrade ladder",
    body: "Plan a bigger VPS, coordinate with your provider, then rescan hardware to unlock capabilities.",
    href: "/system/upgrade",
  },
  {
    icon: "download",
    title: "Data transfer",
    body: "Export this organization's configuration as a redacted archive; import one back.",
    href: "/settings/data-transfer",
  },
  {
    icon: "box",
    title: "Template transfer",
    body: "Move a ServiceTemplate instance between VPS installs as an OCI-compatible artifact.",
    href: "/settings/templates/transfer",
  },
];

export default function SystemSettingsPage() {
  const now = useNow();
  const { profile } = useSession();
  const profileDef = PROFILES[profile];
  const server = db.server;

  return (
    <Screen
      id="UX-SUP-005"
      breadcrumbs={[{ label: "Settings" }, { label: "System" }]}
      description="Locale, URL, module policies, branding and email each live in their own settings screen. This hub is the read-only view of the server itself and the entry to its lifecycle screens."
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Server identity — read-only */}
          <Card
            title="This server"
            description="Read-only. Identity comes from the server record; specs come from the active profile in the topbar switcher."
            actions={<StatusPill status={server.agent_connected ? "active" : "stale"} />}
          >
            <KeyValue
              columns={2}
              items={[
                { label: "Server", value: <span className="font-mono text-xs">{server.name}</span>, mono: true },
                { label: "Provider", value: server.provider_label },
                { label: "IPv4", value: <span className="font-mono text-xs">{server.ip}</span>, mono: true },
                { label: "OS", value: server.os },
                { label: "Agent", value: <span className="font-mono text-xs">{server.agent_version}</span>, mono: true },
                { label: "cgroup", value: server.cgroup_version },
                {
                  label: "Profile",
                  value: (
                    <span>
                      {profileDef.label} — {profileDef.tagline}
                    </span>
                  ),
                },
                { label: "Databases / proxy", value: `${profileDef.db} · ${profileDef.proxy}` },
              ]}
            />
            <div className="mt-4 border-t border-line pt-3">
              <LiveStatusLine at={server.last_seen_at} label="Agent heartbeat" />
              <p className="mt-1.5 text-xs text-ink-3">
                Last seen {formatRelative(server.last_seen_at, now)} — observed data, not a promise.
              </p>
            </div>
          </Card>

          {/* Panel version info */}
          <Card title="Panel version" description="What is installed now, and where lifecycle work happens.">
            <KeyValue
              columns={2}
              items={[
                { label: "Panel", value: <span className="font-mono text-xs">{panelVersion.version}</span>, mono: true },
                { label: "Channel", value: <Chip tone="success">{panelVersion.channel}</Chip> },
                {
                  label: "Installed",
                  value: `${formatRelative(panelVersion.installed_at, now)} (${panelVersion.installed_at.replace("T", " ").replace("Z", "")} UTC)`,
                },
                {
                  label: "Capability data",
                  value: <span className="font-mono text-xs">{panelVersion.capability_data_version}</span>,
                  mono: true,
                },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              <Link href="/system/updates" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                Check for panel updates
                <Icon name="arrow-right" size={12} />
              </Link>
              <Link href="/audit" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                Full audit trail (UTC)
                <Icon name="arrow-right" size={12} />
              </Link>
            </div>
          </Card>
        </div>

        {/* Lifecycle links */}
        <section aria-labelledby="lifecycle-links">
          <h2 id="lifecycle-links" className="text-sm font-semibold text-ink">
            Lifecycle &amp; transfer
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-accent"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-2">
                  <Icon name={l.icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    {l.title}
                    <Icon name="arrow-right" size={12} className="shrink-0 text-ink-3" />
                  </span>
                  <span className="mt-1 block text-xs text-ink-2">{l.body}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Screen>
  );
}
