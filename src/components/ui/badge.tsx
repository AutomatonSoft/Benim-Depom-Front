import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-primary",
        secondary: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border bg-card text-muted-foreground",
        success: "border-transparent bg-[var(--ui-success-bg)] text-[var(--ui-success)]",
        warning: "border-transparent bg-[var(--ui-warn-bg)] text-[var(--ui-warn)]",
        danger: "border-transparent bg-[var(--ui-danger-bg)] text-[var(--ui-danger)]",
        accent: "border-transparent bg-[var(--ui-orange-soft)] text-[#c56a12]",
        navy: "border-transparent bg-[rgba(23,57,104,0.1)] text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
