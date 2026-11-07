"use client";

import React, { useMemo, useState } from "react";
import { cx } from "@/lib/format";
import { Icon } from "./icons";

/**
 * DS-003 Resource table — generic, client-side sortable, cursor-pagination
 * friendly. Row padding reads var(--nx-row-y) so compact density
 * (expert tables, UXD-015) applies without prop drilling. Mobile: the table
 * scrolls horizontally (overflow-x-auto); a sticky identity column is
 * supported by passing "sticky left-0 bg-surface" via column.className.
 * Clickable rows are keyboard operable (tabIndex + Enter/Space).
 */

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  caption?: string;
  className?: string;
}

/** Generic cell value for sorting — reads the raw row property by key. */
function cellValue<T>(row: T, key: string): string | number {
  const v = (row as unknown as Record<string, unknown>)[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

export function Th({
  children,
  className,
  scope = "col",
}: {
  children?: React.ReactNode;
  className?: string;
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={cx("px-3 py-2 text-left text-xs font-medium text-ink-2", className)}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cx("px-3 py-[var(--nx-row-y)] align-middle text-sm text-ink", className)}
    >
      {children}
    </td>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyState,
  caption,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = cellValue(a, sort.key);
      const bv = cellValue(b, sort.key);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sort]);

  // asc → desc → unsorted
  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev && prev.key === key) {
        return prev.dir === "asc" ? { key, dir: "desc" } : null;
      }
      return { key, dir: "asc" };
    });
  };

  const clickable = typeof onRowClick === "function";

  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-line bg-surface-2">
            {columns.map((col) => {
              const sorted = sort !== null && sort.key === col.key;
              return (
                <Th
                  key={col.key}
                  aria-sort={
                    sorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={col.className}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      aria-label={`Sort by ${col.header}`}
                      className="inline-flex items-center gap-1 rounded-control hover:text-ink"
                    >
                      {col.header}
                      <Icon
                        name="chevron-down"
                        size={12}
                        className={cx(
                          "shrink-0 transition-transform",
                          sorted ? (sort.dir === "asc" ? "rotate-180" : "") : "opacity-40"
                        )}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </Th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sortedRows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick?.(row);
                        }
                      }
                    : undefined
                }
                className={cx(clickable && "cursor-pointer hover:bg-surface-2")}
              >
                {columns.map((col) => (
                  <Td key={col.key} className={col.className}>
                    {col.render
                      ? col.render(row)
                      : cellText(cellValue(row, col.key))}
                  </Td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {sortedRows.length === 0 &&
        (emptyState ?? (
          <div className="px-3 py-10 text-center text-sm text-ink-2">No rows to show.</div>
        ))}
    </div>
  );
}

function cellText(v: string | number): string {
  return v === "" ? "—" : String(v);
}

export interface TableCardProps<T> extends DataTableProps<T> {
  title: string;
  actions?: React.ReactNode;
}

/** Puts a DataTable inside a card with a { title, actions } header row. */
export function TableCard<T>({ title, actions, ...tableProps }: TableCardProps<T>) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {actions !== undefined && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      <DataTable<T> {...tableProps} />
    </section>
  );
}
