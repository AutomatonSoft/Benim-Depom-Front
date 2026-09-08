"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

const guideItems = [1, 2, 3, 4, 5, 6, 7] as const;

export function OttoShippingGuide() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn("h-auto px-0 text-[var(--brand-accent)] hover:bg-transparent hover:underline", open && "font-extrabold")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t("listing.ottoShippingHelp")}
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </Button>
      {open ? (
        <div
          className="mt-2 grid gap-2 rounded-xl border border-border bg-[#f8fafc] p-3"
          role="region"
          aria-label={t("listing.ottoShippingHelp")}
        >
          {guideItems.map((index) => (
            <article key={index} className="rounded-lg border border-border/70 bg-card px-3 py-2">
              <header className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-sm font-extrabold text-primary">{t(`listing.shipGuide${index}Name` as MessageKey)}</strong>
                <em className="text-[11px] font-bold not-italic text-[var(--brand-accent)]">
                  {t(`listing.shipGuide${index}Tag` as MessageKey)}
                </em>
              </header>
              <p className="text-xs font-semibold text-muted-foreground">{t(`listing.shipGuide${index}Times` as MessageKey)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t(`listing.shipGuide${index}Use` as MessageKey)}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
