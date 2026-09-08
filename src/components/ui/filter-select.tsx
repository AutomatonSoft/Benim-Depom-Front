import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** Styled native select for dense filters/forms. Use Radix Select for richer menus. */
function FilterSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        data-slot="filter-select"
        className={cn(
          "flex h-10 w-full appearance-none rounded-[10px] border border-input bg-card px-3 py-2 pr-9 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
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

export { FilterSelect };
