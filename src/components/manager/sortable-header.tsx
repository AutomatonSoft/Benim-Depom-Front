"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export const DEFAULT_PRODUCT_ORDERING = "-created_at";

/**
 * Next ordering after a click: descending → ascending → back to the default.
 * The default column (created) just flips between its two directions.
 */
export function nextOrdering(current: string, key: string): string {
  if (current === `-${key}`) return key;
  if (current === key) return key === DEFAULT_PRODUCT_ORDERING.slice(1) ? `-${key}` : DEFAULT_PRODUCT_ORDERING;
  return `-${key}`;
}

export function SortableHeader({
  label,
  sortKey,
  ordering,
  onOrderingChange,
  align = "start",
}: {
  label: string;
  sortKey: string;
  ordering: string;
  onOrderingChange: (ordering: string) => void;
  align?: "start" | "center" | "end";
}) {
  const { t } = useI18n();
  const direction = ordering === `-${sortKey}` ? "desc" : ordering === sortKey ? "asc" : null;
  const Icon = direction === "desc" ? ArrowDown : direction === "asc" ? ArrowUp : ArrowUpDown;
  const ariaSort = direction === "desc" ? "descending" : direction === "asc" ? "ascending" : "none";

  return (
    <span
      role="columnheader"
      aria-sort={ariaSort}
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        align === "end" && "justify-end text-right",
        align === "center" && "justify-center text-center",
      )}
    >
      <span className={cn("min-w-0 transition-colors", direction && "text-primary")}>{label}</span>
      <button
        type="button"
        onClick={() => onOrderingChange(nextOrdering(ordering, sortKey))}
        title={direction === "desc" ? t("sort.desc") : direction === "asc" ? t("sort.asc") : t("sort.none")}
        aria-label={`${label}: ${direction === "desc" ? t("sort.desc") : direction === "asc" ? t("sort.asc") : t("sort.none")}`}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md border transition-all outline-none",
          "focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/30",
          direction
            ? "border-[var(--brand-accent)]/50 bg-[var(--ui-orange-soft)] text-[var(--ui-orange-2)] shadow-[0_1px_2px_rgba(247,148,29,0.25)]"
            : "border-transparent text-[var(--ui-muted-2)] hover:border-[var(--ui-border-2)] hover:bg-white hover:text-primary",
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.5} aria-hidden />
      </button>
    </span>
  );
}
