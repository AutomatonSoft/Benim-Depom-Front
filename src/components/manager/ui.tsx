"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Fragment } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/* -------------------------------------------------------------------------- */
/* Page layout                                                                */
/* -------------------------------------------------------------------------- */

export function PageContainer({
  children,
  className,
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <section
      className={cn(
        "mx-auto w-full flex-1 px-4 py-4 sm:px-5 sm:py-5 md:px-7 md:py-6 lg:px-9",
        narrow ? "max-w-[1100px]" : "max-w-[1560px]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** @deprecated Use PageContainer */
export const PageFrame = PageContainer;

export type Crumb = { label: string; href?: string };

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  /** @deprecated prefer primaryAction/secondaryActions */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 space-y-2">
        {breadcrumbs?.length ? (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${index}`}>
                    <BreadcrumbItem>
                      {last || !crumb.href ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!last ? (
                      <BreadcrumbSeparator>
                        <ChevronRight />
                      </BreadcrumbSeparator>
                    ) : null}
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--brand-accent)]">{eyebrow}</p>
        ) : null}
        <h1 className="text-[clamp(1.5rem,2.2vw,1.875rem)] font-extrabold tracking-tight text-primary leading-tight">{title}</h1>
        {description ? <div className="max-w-2xl text-sm font-medium text-muted-foreground">{description}</div> : null}
      </div>
      {(primaryAction || secondaryActions || actions) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {secondaryActions}
          {primaryAction}
          {actions}
        </div>
      )}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                      */
/* -------------------------------------------------------------------------- */

const sectionCardVariants = cva("overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_rgba(20,47,85,0.04)]", {
  variants: {
    variant: {
      default: "border-border",
      metric: "border-border",
      interactive: "border-border transition-colors hover:border-[var(--ui-border-2)] hover:bg-[#fbfcfe]",
      warning: "border-[rgba(247,148,29,0.35)] bg-gradient-to-b from-[#fffaf3] to-[#fff6ea]",
      danger: "border-[rgba(194,59,59,0.28)] bg-[var(--ui-danger-bg)]",
      success: "border-[rgba(31,138,91,0.28)] bg-[var(--ui-success-bg)]",
      accent: "border-[rgba(247,148,29,0.4)] bg-[var(--ui-orange-soft)]",
    },
  },
  defaultVariants: { variant: "default" },
});

export function SectionCard({
  children,
  className,
  variant,
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
} & VariantProps<typeof sectionCardVariants>) {
  return <section className={cn(sectionCardVariants({ variant }), padded && "p-5", className)}>{children}</section>;
}

/** @deprecated Use SectionCard */
export const Panel = SectionCard;

export function SectionCardHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">{eyebrow}</p> : null}
        {title ? <div className="text-base font-extrabold tracking-tight text-primary">{title}</div> : null}
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions}
    </div>
  );
}

/** @deprecated */
export const PanelHeader = SectionCardHeader;

export function OverviewSectionBanner({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#1b3f70] via-[#1a3a66] to-[#14325a] px-6 py-6 text-white shadow-[0_12px_28px_rgba(20,47,85,0.16)]",
        className,
      )}
    >
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
      {description ? <p className="mt-1.5 max-w-3xl text-sm font-semibold text-white/75">{description}</p> : null}
    </div>
  );
}

export function SectionToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-3 border-b border-border bg-[#f8fafc] px-4 py-3", className)}>{children}</div>;
}

/** @deprecated */
export const PanelToolbar = SectionToolbar;

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "navy" | "accent" | "success" | "danger" | "warning";
}) {
  const emphasized = tone !== "default";
  return (
    <article
      className={cn(
        "relative overflow-hidden grid gap-1 rounded-2xl border p-5 shadow-[0_8px_24px_rgba(20,47,85,0.06)]",
        tone === "default" && "border-[#d9e3ef] bg-gradient-to-br from-white to-[#f4f7fb]",
        tone === "navy" && "border-transparent bg-gradient-to-br from-[#1b3f70] to-[#14325a] text-white",
        tone === "accent" && "border-transparent bg-gradient-to-br from-[#f9a338] to-[#ef8a12] text-white",
        tone === "success" && "border-[rgba(31,138,91,0.25)] bg-[var(--ui-success-bg)]",
        tone === "danger" && "border-[rgba(194,59,59,0.25)] bg-[var(--ui-danger-bg)]",
        tone === "warning" && "border-[rgba(247,148,29,0.35)] bg-[var(--ui-orange-soft)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.06em]",
            emphasized && (tone === "navy" || tone === "accent") ? "text-white/75" : "text-muted-foreground",
            tone === "warning" && "text-[var(--brand-accent)]",
          )}
        >
          {label}
        </span>
        {Icon ? (
          <Icon
            className={cn("size-4 shrink-0", tone === "navy" || tone === "accent" ? "text-white/70" : "text-muted-foreground")}
            aria-hidden
          />
        ) : null}
      </div>
      <strong
        className={cn(
          "text-[1.75rem] font-extrabold tracking-tight tabular-nums leading-none",
          tone === "navy" || tone === "accent" ? "text-white" : "text-primary",
        )}
      >
        {value}
      </strong>
      {hint ? (
        <small
          className={cn(
            "text-xs font-semibold",
            tone === "navy" || tone === "accent" ? "text-white/75" : "text-muted-foreground",
          )}
        >
          {hint}
        </small>
      ) : null}
    </article>
  );
}

/** @deprecated Use MetricCard */
export const StatCard = MetricCard;

/* -------------------------------------------------------------------------- */
/* Status / empty / feedback                                                  */
/* -------------------------------------------------------------------------- */

const STATUS_VARIANT: Record<string, VariantProps<typeof badgeVariants>["variant"]> = {
  submitted: "warning",
  withdrawn: "warning",
  pending: "warning",
  pending_confirmation: "warning",
  queued: "warning",
  processing: "warning",
  publishing: "warning",
  running: "warning",
  "in-flight": "warning",
  accepted: "success",
  superseded: "secondary",
  approved: "success",
  succeeded: "success",
  completed: "success",
  active: "success",
  available: "success",
  assigned: "navy",
  published: "success",
  rejected: "danger",
  deactivated: "danger",
  failed: "danger",
  unavailable: "danger",
  deleted: "danger",
  error: "danger",
  draft: "secondary",
  returned_to_review: "secondary",
  inactive: "secondary",
};

export function StatusBadge({ status, children }: { status: string; children: ReactNode }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "navy"}>{children}</Badge>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center px-6 py-14 text-center", className)}>
      <div className="max-w-sm space-y-3">
        {Icon ? (
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
            <Icon className="size-5" aria-hidden />
          </div>
        ) : null}
        <div>
          <p className="font-bold text-primary">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

export function Feedback({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "warn";
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "text-sm font-semibold",
        tone === "error" && "text-[var(--ui-danger)]",
        tone === "success" && "text-[var(--ui-success)]",
        tone === "warn" && "text-[var(--ui-warn)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function PaginationBar({
  page,
  hasPrevious,
  hasNext,
  loading,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  pageLabel,
  className,
}: {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  pageLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Pagination"
      data-page={page}
      className={cn(
        "flex items-center justify-end gap-2.5 border-b border-border bg-[#f8fafc] px-4 py-2.5 text-xs font-bold text-muted-foreground sm:px-5",
        className,
      )}
    >
      <Button type="button" size="sm" variant="secondary" disabled={!hasPrevious || loading} onClick={onPrevious}>
        {previousLabel}
      </Button>
      <span className="min-w-[5.5rem] text-center tabular-nums">{pageLabel}</span>
      <Button type="button" size="sm" variant="secondary" disabled={!hasNext || loading} onClick={onNext}>
        {nextLabel}
      </Button>
    </nav>
  );
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle, Button };
