"use client";

import React, { useRef } from "react";
import { cx } from "@/lib/format";

/**
 * Horizontal tabs (DS-020 flavor): role="tablist" + role="tab" with
 * aria-selected, roving tabindex and Arrow/Home/End keyboard navigation.
 * Panels are rendered conditionally by the page (no TabPanels helper).
 */

export interface TabDef {
  id: string;
  label: string;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].id);
      tabRefs.current[next]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      className={cx("flex gap-1 overflow-x-auto border-b border-line", className)}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cx(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-accent text-ink"
                : "border-transparent text-ink-2 hover:text-ink"
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="rounded-control bg-surface-2 px-1.5 py-0.5 text-xs font-normal text-ink-2">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
