"use client";

import React, { useMemo, useState } from "react";
import type { NotificationItem } from "@/lib/types";
import { useNotifications } from "@/components/providers";
import { Screen } from "@/components/common/screen";
import { NotificationList } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/nav";

/**
 * UX-OV-007 — Notifications: severity, read state and deep links (DS-018).
 * Read state is a local copy — the prototype marks read client-side.
 */
export default function NotificationsPage() {
  const all = useNotifications();
  const [items, setItems] = useState<NotificationItem[]>(() => [...all]);
  const [filter, setFilter] = useState("all");

  const unread = items.filter((n) => !n.read).length;
  const shown = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read) : items),
    [items, filter]
  );

  const markRead = (id: string) =>
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <Screen
      id="UX-OV-007"
      breadcrumbs={[{ label: "Notifications" }]}
      actions={
        <>
          <SegmentedControl
            aria-label="Filter notifications"
            value={filter}
            onChange={setFilter}
            size="sm"
            options={[
              { value: "all", label: `All (${items.length})` },
              { value: "unread", label: `Unread (${unread})` },
            ]}
          />
          {unread > 0 && (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {shown.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Nothing unread"
            body="Critical alerts are always delivered regardless of channel preferences — this inbox collects them with deep links back to the resource. Batch completions and queued jobs show up here too."
            action={filter === "unread" ? { label: "Show all", onClick: () => setFilter("all") } : undefined}
          />
        ) : (
          <NotificationList items={shown} onRead={markRead} />
        )}
        <p className="px-1 text-xs text-ink-2">
          Critical notifications ignore mute rules (mandatory policy). Per-channel preferences (email, webhook)
          live in Personal preferences → Notifications.
        </p>
      </div>
    </Screen>
  );
}
