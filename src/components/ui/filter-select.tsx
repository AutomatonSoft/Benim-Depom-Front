"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/** Styled native select for dense filters/forms. Use Radix Select for richer menus. */
function FilterSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        data-slot="filter-select"
        className={cn(
          "flex h-10 w-full cursor-pointer appearance-none rounded-[10px] border border-input bg-card px-3 py-2 pr-9 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
          "[background-image:none]",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

type FilterSelectMenuProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  /** Long labels wrap onto several lines instead of being cut off. */
  wrap?: boolean;
};

function FilterSelectMenu({ value, onValueChange, options, className, id, disabled, "aria-label": ariaLabel, wrap = false }: FilterSelectMenuProps) {
  const emptyValue = React.useId();

  return (
    <div className={cn("relative min-w-0", className)}>
      <SelectPrimitive.Root value={value || emptyValue} onValueChange={(next) => onValueChange(next === emptyValue ? "" : next)} disabled={disabled}>
        <SelectPrimitive.Trigger
          id={id}
          aria-label={ariaLabel}
          data-slot="filter-select"
          className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-input bg-card px-3 py-2 text-left font-[inherit] text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/20 data-[state=open]:border-[var(--brand-accent)] data-[state=open]:ring-2 data-[state=open]:ring-[var(--brand-accent)]/20 disabled:cursor-not-allowed disabled:opacity-50",
            wrap ? "min-h-10 text-sm leading-snug [&>span:first-child]:whitespace-normal" : "h-10 [&>span:first-child]:truncate",
          )}
        >
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            data-slot="filter-select-menu"
            position="popper"
            side="bottom"
            avoidCollisions={false}
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              "z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 font-[family-name:var(--font-ui)] text-popover-foreground shadow-[0_12px_36px_rgba(23,57,104,0.16)]",
              wrap && "w-[var(--radix-select-trigger-width)]",
            )}
          >
            <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-muted-foreground">
              <ChevronUp className="size-4" aria-hidden />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value || emptyValue}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-lg py-2 pr-9 pl-3 text-sm font-medium text-primary outline-none data-[highlighted]:bg-secondary data-[state=checked]:bg-[var(--brand-accent)]/10 data-[state=checked]:font-semibold",
                    wrap && "rounded-none border-b border-black/30 leading-snug last:border-b-0",
                  )}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3 flex items-center text-[var(--brand-accent)]">
                    <Check className="size-4" aria-hidden />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-muted-foreground">
              <ChevronDown className="size-4" aria-hidden />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

export { FilterSelect, FilterSelectMenu };
