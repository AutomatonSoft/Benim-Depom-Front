"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { Check, Loader2, PencilLine, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import {
  COUNTRIES,
  CURRENCIES,
  TURKISH_CITIES,
  buildPayload,
  draftFromProduct,
  shortDescriptionLines,
  validateDraft,
  type ShortDescriptionDraft,
  type ShortDescriptionProduct,
} from "@/lib/product-short-description";
import { cn } from "@/lib/utils";
import { useI18n, type MessageKey } from "@/i18n";

const CITY_NAMES: Record<string, string> = {
  IST: "Istanbul",
  ANK: "Ankara",
  IZM: "Izmir",
  BUR: "Bursa",
  INE: "Inegöl",
  KSY: "Kars",
};

/**
 * Rows in the manager product tables open the product card on click. Clicks
 * coming from editable cells (including their portalled popovers) must not.
 */
export function stopRowNavigation(event: MouseEvent) {
  event.stopPropagation();
}

type Props<T extends ShortDescriptionProduct & { id: number }> = {
  product: T;
  onSaved: (updated: Partial<T> & { id: number }) => void;
};

function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
  renderLabel,
  columns,
}: {
  value: V;
  options: readonly V[];
  onChange: (value: V) => void;
  label: string;
  renderLabel?: (value: V) => string;
  columns?: number;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-[10px] bg-[var(--ui-bg)] p-1"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            title={renderLabel?.(option)}
            onClick={() => onChange(option)}
            className={cn(
              "h-8 rounded-[8px] text-xs font-extrabold tracking-wide transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/40",
              active
                ? "bg-white text-primary shadow-[0_1px_3px_rgba(20,47,85,0.15)] ring-1 ring-[var(--brand-accent)]/60"
                : "text-muted-foreground hover:bg-white/60 hover:text-primary",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </label>
  );
}

export function ProductShortDescriptionCell<T extends ShortDescriptionProduct & { id: number }>({ product, onSaved }: Props<T>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ShortDescriptionDraft>(() => draftFromProduct(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const lines = shortDescriptionLines(product);
  const payload = buildPayload(product, draft);
  const dirty = Object.keys(payload).length > 0;
  const idPrefix = `short-desc-${product.id}`;

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  function handleOpenChange(next: boolean) {
    if (saving) return;
    if (next) {
      setDraft(draftFromProduct(product));
      setError("");
    }
    setOpen(next);
  }

  function update<K extends keyof ShortDescriptionDraft>(field: K, value: ShortDescriptionDraft[K]) {
    setError("");
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validateDraft(draft);
    if (invalid) {
      setError(t(`shortDesc.error.${invalid}` as MessageKey));
      return;
    }
    if (!dirty) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await authorizedFetch(`/api/v2/products/${product.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(data, t("shortDesc.saveError")));
      onSaved({ ...(data as Partial<T>), id: product.id });
      setJustSaved(true);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("shortDesc.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const showCalculatedHint = product.cbm_calculated && draft.cbm.trim() !== "" && Number(draft.cbm) !== Number(product.cbm_calculated);

  return (
    <div onClick={stopRowNavigation} className="min-w-0">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("shortDesc.edit")}
            className={cn(
              "group relative block w-full cursor-text rounded-xl border bg-white px-3 py-2.5 text-left font-mono text-[13px] leading-[1.65] text-primary transition-all outline-none",
              "hover:border-[var(--brand-accent)]/70 hover:bg-white hover:shadow-[0_2px_10px_rgba(20,47,85,0.08)]",
              "focus-visible:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/25",
              open ? "border-[var(--brand-accent)] bg-white ring-2 ring-[var(--brand-accent)]/25" : "border-[var(--ui-border-2)] shadow-[0_1px_2px_rgba(20,47,85,0.06)]",
              justSaved && "border-[var(--ui-success)] bg-[var(--ui-success-bg)]",
            )}
          >
            <span className="block truncate text-[15px] font-extrabold text-primary tabular-nums">{lines.price}</span>
            <span className="flex items-center gap-1.5 truncate text-[15px] font-extrabold text-primary tabular-nums">
              {lines.cbm}
              {lines.manualCbm ? (
                <span
                  title={product.cbm_calculated ? t("shortDesc.calculated", { cbm: product.cbm_calculated }) : undefined}
                  className="rounded-[4px] bg-[var(--ui-orange-soft)] px-1 font-sans text-[9px] font-extrabold uppercase tracking-wide text-[var(--ui-orange-2)]"
                >
                  {t("shortDesc.manual")}
                </span>
              ) : null}
            </span>
            <span className="block truncate">
              <span className="text-[var(--ui-text-2)]">country </span>
              <span className="font-extrabold text-primary">{lines.country}</span>
            </span>
            <span className="block min-h-[1.6em] truncate">
              {lines.city ? (
                <>
                  <span className="text-[var(--ui-text-2)]">city </span>
                  <span className="font-extrabold text-primary">{lines.city}</span>
                </>
              ) : null}
            </span>
            <span
              aria-hidden
              className={cn(
                "absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md transition-opacity",
                justSaved
                  ? "bg-[var(--ui-success)] text-white opacity-100"
                  : "bg-white text-[var(--brand-accent)] opacity-0 shadow-sm group-hover:opacity-100 group-focus-visible:opacity-100",
              )}
            >
              {justSaved ? <Check className="size-3.5" /> : <PencilLine className="size-3.5" />}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          onClick={stopRowNavigation}
          className="w-[320px] gap-0 rounded-2xl p-0 shadow-[0_18px_48px_rgba(20,47,85,0.18)]"
        >
          <form onSubmit={save} noValidate>
            <div className="border-b border-border px-4 pt-3.5 pb-3">
              <p className="text-sm font-extrabold text-primary">{t("products.col.shortDescription")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("shortDesc.hint")}</p>
            </div>

            <div className="grid gap-3.5 px-4 py-3.5">
              <div>
                <FieldLabel htmlFor={`${idPrefix}-price`}>{t("shortDesc.price")}</FieldLabel>
                <div className="grid grid-cols-[1fr_150px] gap-2">
                  <Input
                    id={`${idPrefix}-price`}
                    autoFocus
                    inputMode="decimal"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="h-9 font-mono tabular-nums"
                    value={draft.price}
                    aria-invalid={error === t("shortDesc.error.price") || undefined}
                    onChange={(event) => update("price", event.target.value)}
                  />
                  <Segmented label={t("product.currency")} value={draft.currency} options={CURRENCIES} onChange={(value) => update("currency", value)} />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor={`${idPrefix}-cbm`}>{t("shortDesc.volume")}</FieldLabel>
                <div className="relative">
                  <Input
                    id={`${idPrefix}-cbm`}
                    inputMode="decimal"
                    type="number"
                    min="0.001"
                    step="0.001"
                    className="h-9 pr-12 font-mono tabular-nums"
                    placeholder={product.cbm_calculated ?? undefined}
                    value={draft.cbm}
                    onChange={(event) => update("cbm", event.target.value)}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs text-muted-foreground">cbm</span>
                </div>
                {product.cbm_calculated ? (
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{t("shortDesc.calculated", { cbm: product.cbm_calculated })}</span>
                    {showCalculatedHint ? (
                      <button
                        type="button"
                        onClick={() => update("cbm", product.cbm_calculated ?? "")}
                        className="inline-flex items-center gap-1 font-bold text-[var(--brand-accent)] hover:underline"
                      >
                        <RotateCcw className="size-3" aria-hidden />
                        {t("shortDesc.useCalculated")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <FieldLabel>{t("shortDesc.country")}</FieldLabel>
                <Segmented
                  label={t("shortDesc.country")}
                  value={draft.country}
                  options={COUNTRIES}
                  renderLabel={(value) => t(`shortDesc.country.${value}` as MessageKey)}
                  onChange={(value) => {
                    setError("");
                    setDraft((current) => ({
                      ...current,
                      country: value,
                      city: value === "TR" ? current.city || "IST" : "",
                    }));
                  }}
                />
              </div>

              <div>
                <FieldLabel>{t("shortDesc.city")}</FieldLabel>
                {draft.country === "TR" ? (
                  <Segmented
                    label={t("shortDesc.city")}
                    value={draft.city as (typeof TURKISH_CITIES)[number]}
                    options={TURKISH_CITIES}
                    columns={3}
                    renderLabel={(value) => CITY_NAMES[value] ?? value}
                    onChange={(value) => update("city", value)}
                  />
                ) : (
                  <p className="rounded-[10px] border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">{t("shortDesc.noCity")}</p>
                )}
              </div>

              {error ? (
                <p role="alert" className="rounded-[10px] bg-[var(--ui-danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--ui-danger)]">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-[var(--ui-bg-2)] px-4 py-3">
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={saving || !dirty}>
                {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {t("common.save")}
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
