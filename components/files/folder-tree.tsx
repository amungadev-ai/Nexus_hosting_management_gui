"use client";

import React, { useState } from "react";
import { Icon } from "@/components/ui/icons";
import type { FileNode } from "@/lib/mock/files";

/** Accessible site-scoped folder tree. Paths are arrays of fixture node names,
 * never raw filesystem paths. The agent remains authoritative in production. */
export function FolderTree({ rootName, nodes, currentPath, onNavigate }: {
  rootName: string;
  nodes: FileNode[];
  currentPath: string[];
  onNavigate: (path: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([""]);
  const toggle = (key: string) => setExpanded((old) => old.includes(key) ? old.filter((v) => v !== key) : [...old, key]);
  const render = (children: FileNode[], parent: string[], depth: number): React.ReactNode => children
    .filter((node) => node.type === "directory")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((node) => {
      const path = [...parent, node.name];
      const key = path.join("/");
      const isOpen = expanded.includes(key) || currentPath.slice(0, path.length).join("/") === key;
      const isActive = currentPath.join("/") === key;
      return (
        <div key={key}>
          <div className={`flex items-center rounded-md ${isActive ? "bg-surface-2 text-accent" : "text-ink-2 hover:bg-surface-2"}`} style={{ paddingLeft: `${Math.min(depth, 7) * 12}px` }}>
            <button type="button" onClick={() => toggle(key)} aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.name}`} aria-expanded={isOpen} className="shrink-0 rounded p-1">
              <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={13} />
            </button>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded py-1.5 pr-1 text-left text-xs" onClick={() => { onNavigate(path); if (!isOpen) setExpanded((old) => [...old, key]); }} aria-current={isActive ? "page" : undefined}>
              <Icon name="folder" size={15} className="shrink-0 text-accent" /><span className="truncate">{node.name}</span>
            </button>
          </div>
          {isOpen && node.children && render(node.children, path, depth + 1)}
        </div>
      );
    });
  return <nav aria-label="Folders" className="text-sm">
    <button type="button" onClick={() => onNavigate([])} className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold ${currentPath.length === 0 ? "bg-surface-2 text-accent" : "text-ink hover:bg-surface-2"}`} aria-current={currentPath.length === 0 ? "page" : undefined}>
      <Icon name="folder" size={16} /> {rootName}
    </button>
    {render(nodes, [], 1)}
  </nav>;
}
