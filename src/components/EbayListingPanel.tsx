"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, List, ListChecks, X } from "lucide-react";
import { CatalogLanguageSelect } from "@/components/CatalogLanguageSelect";
import { SectionCard, SectionCardHeader, Feedback } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { ebayDisplayTitle, ebayDraftPayload, ebayListingUrl, newEbayDraft,
  type EbayAspectSchema, type EbayCategory, type EbayDraft,
  type EbayPreparation, type EbaySnapshot, type EbayEnvironment, type EbayAspect,
} from "@/lib/ebay";
import { ottoCatalogLanguages } from "@/lib/listings";

async function request<T>(url: string, fallback: string, init: RequestInit = {}, optional = false): Promise<T | null> {
  const response = await authorizedFetch(url, { ...init, cache: "no-store" });
  if (optional && response.status === 404) return null;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(data, data ? JSON.stringify(data) : fallback));
  return data as T;
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function useEbayState(productId: number) {
  const { t } = useI18n();
  const base = `/api/v1/ebay/drafts/depotum/${productId}/`;
  const [draft, setDraft] = useState<EbayDraft | null>(null);
  const [environment, setEnvironment] = useState<EbayEnvironment | null>(null);
  const [snapshot, setSnapshot] = useState<EbaySnapshot | null>(null);
  const [preparation, setPreparation] = useState<EbayPreparation | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const initialError = useRef(t("ebay.error"));
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const fallback = initialError.current;
    async function load() {
      setBusy(true);
      try {
        const [connection, saved, remote, local] = await Promise.all([
          request<{ environment: EbayEnvironment }>("/api/v1/ebay/connections/", fallback, options),
          request<EbayDraft>(base, fallback, options, true),
          request<EbaySnapshot>(`${base}listing/`, fallback, options, true),
          request<EbayPreparation>(`${base}prepare/`, fallback, options, true),
        ]);
        if (!connection || !["sandbox", "production"].includes(connection.environment) || (remote && remote.environment !== connection.environment)) throw new Error(fallback);
        if (controller.signal.aborted) return;
        setEnvironment(connection.environment); setDraft(saved ? { ...saved, title: ebayDisplayTitle(saved.title) } : newEbayDraft());
        setDirty(!saved); setSnapshot(remote); setPreparation(local);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : fallback);
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void load();
    return () => controller.abort();
  }, [base, productId, version]);

  function edit(changes: Partial<EbayDraft>) {
    setDraft((current) => current ? { ...current, ...changes } : current);
    setDirty(true); setNotice("");
  }

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : t("ebay.error"));
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function refresh() {
    const [remote, local] = await Promise.all([
      request<EbaySnapshot>(`${base}listing/`, t("ebay.error"), {}, true),
      request<EbayPreparation>(`${base}prepare/`, t("ebay.error"), {}, true),
    ]);
    if (remote && remote.environment !== environment) throw new Error(t("ebay.error"));
    setSnapshot(remote); setPreparation(local);
  }

  async function save() {
    if (!draft) return;
    await run(async () => {
      const saved = await request<EbayDraft>(base, t("ebay.error"), json("PUT", ebayDraftPayload(draft)));
      if (saved) { setDraft({ ...saved, title: ebayDisplayTitle(saved.title) }); setDirty(false); setNotice(t("ebay.saved")); }
    });
  }

  async function preview() {
    if (dirty) throw new Error(t("ebay.dirty"));
    await refresh();
    const saved = await request<EbayDraft & { missing_requirements: { fields: string[]; aspects: string[] } }>(base, t("ebay.error"));
    const missing = [...(saved?.missing_requirements.fields || []), ...(saved?.missing_requirements.aspects || [])];
    if (!saved || missing.length) throw new Error(missing.join(", ") || t("ebay.error"));
  }

  return { base, draft, environment, snapshot, preparation, dirty, busy,
    locked: busy || preparation?.status === "processing" || preparation?.status === "uncertain",
    error, notice, edit, save, preview,
    reload: () => { setError(""); setVersion((current) => current + 1); },
  };
}

const EbayContext = createContext<ReturnType<typeof useEbayState> | null>(null);
export function EbayListingProvider({ productId, children }: { productId: number; children: ReactNode }) {
  const value = useEbayState(productId);
  return <EbayContext.Provider value={value}>{children}</EbayContext.Provider>;
}
export function useEbay() {
  const value = useContext(EbayContext);
  if (!value) throw new Error("Missing EbayListingProvider");
  return value;
}

export function EbayListingPanel() {
  const { t } = useI18n();
  const fieldId = useId();
  const state = useEbay();
  const [previewing, setPreviewing] = useState(false);
  const [payloadPreview, setPayloadPreview] = useState<{ draft: EbayDraft; ok: boolean; text: string } | null>(null);
  const { draft, environment, locked, busy, preparation, snapshot } = state;

  async function previewPayload() {
    if (!draft || state.dirty || locked || previewing) return;
    const sourceDraft = draft;
    setPreviewing(true);
    setPayloadPreview(null);
    try {
      const data = await request<{ draft_complete: boolean; missing_regulatory_fields: string[] }>(`${state.base}?preview=1`, t("listing.previewNotReady"));
      if (data) setPayloadPreview({ draft: sourceDraft, ok: data.draft_complete && !data.missing_regulatory_fields.length, text: JSON.stringify(data, null, 2) });
    } catch (error) {
      setPayloadPreview({ draft: sourceDraft, ok: false, text: error instanceof Error ? error.message : t("common.apiUnreachable") });
    } finally { setPreviewing(false); }
  }

  if (!draft || !environment) return <div>
    <p role="status">{state.error || t("common.loading")}</p>
    {state.error && <Button variant="secondary" disabled={busy} onClick={state.reload}>{t("ebay.refresh")}</Button>}
  </div>;
  const listingUrl = ebayListingUrl(environment, snapshot?.remote_listing_id || preparation?.listing_id || "");
  return <div className="grid gap-4">
    <fieldset disabled={locked || previewing} className="grid min-w-0 gap-4">
      <div>
        <Label htmlFor={`${fieldId}-title`}>{t("ebay.title")}</Label>
        <Input id={`${fieldId}-title`} maxLength={78} value={draft.title} onChange={(event) => state.edit({ title: event.target.value })} onBlur={() => {
          const title = ebayDisplayTitle(draft.title);
          if (title !== draft.title) state.edit({ title });
        }} />
        <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{draft.title.length}/78</p>
      </div>
      <div>
        <Label htmlFor={`${fieldId}-description`}>{t("ebay.description")}</Label>
        <Textarea id={`${fieldId}-description`} rows={7} value={draft.description} onChange={(event) => state.edit({ description: event.target.value })} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="accent" onClick={() => { setPayloadPreview(null); void state.save(); }}>{t("listing.saveChannel")}</Button>
        <Button type="button" variant="secondary" disabled={state.dirty || previewing} onClick={() => void previewPayload()}>
          {previewing ? t("listing.previewing") : t("listing.preview")}
        </Button>
      </div>
      {state.dirty && <p className="text-xs font-semibold text-muted-foreground">{t("listing.saveBeforePreview")}</p>}
    </fieldset>
    {state.error && <Feedback tone="error">{state.error}</Feedback>}
    {state.notice && <Feedback tone="success">{state.notice}</Feedback>}
    {payloadPreview && payloadPreview.draft === draft && !state.dirty && <div className={`rounded-xl border px-4 py-3 ${payloadPreview.ok ? "border-[rgba(34,140,90,0.28)] bg-[var(--ui-success-bg)]" : "border-[rgba(196,64,56,0.28)] bg-[var(--ui-danger-bg)]"}`}>
      <strong className={`text-sm font-extrabold ${payloadPreview.ok ? "text-[var(--ui-success)]" : "text-[var(--ui-danger)]"}`}>{t(payloadPreview.ok ? "listing.previewOk" : "listing.previewBad")}</strong>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs font-semibold text-primary">{payloadPreview.text}</pre>
    </div>}
    {listingUrl && <a className="text-xs font-semibold text-muted-foreground underline underline-offset-4" href={listingUrl} target="_blank" rel="noopener noreferrer">{t("ebay.open")}</a>}
  </div>;
}

export function EbayCategoryPicker() {
  const { t, locale } = useI18n();
  const state = useEbay();
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === "undefined") return locale;
    const stored = window.localStorage.getItem("benim_ebay_catalog_lang");
    return stored && ottoCatalogLanguages.some((item) => item === stored) ? stored : locale;
  });
  const [categories, setCategories] = useState<EbayCategory[]>([]);
  const [path, setPath] = useState<EbayCategory[]>([]);
  const [schema, setSchema] = useState<EbayAspectSchema | null>(null);
  const [sheet, setSheet] = useState<"category" | "aspects" | "value" | null>(null);
  const [editingName, setEditingName] = useState("");
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const categoryId = state.draft?.category_id;
  const fallback = useRef(t("ebay.error"));
  const displayedAspects = state.draft?.aspects || {};
  const editingAspect = schema?.aspects.find((aspect) => aspect.localizedAspectName === editingName);
  const multiple = editingAspect?.aspectConstraint.itemToAspectCardinality === "MULTI";
  const freeText = editingAspect?.aspectConstraint.aspectMode !== "SELECTION_ONLY";
  const matchesQuery = (name: string, label = "") => `${name} ${label}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());

  function openAspect(aspect: EbayAspect) {
    setEditingName(aspect.localizedAspectName);
    setDraftValues(displayedAspects[aspect.localizedAspectName] || []);
    setQuery("");
    setSheet("value");
  }

  function commitAspect() {
    if (!state.draft || !editingAspect) return;
    const values = draftValues.map((value) => value.trim()).filter(Boolean);
    state.edit({ aspects: { ...state.draft.aspects, [editingName]: values } });
    setSheet(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const [tree, aspects] = await Promise.all([
          request<{ categories: EbayCategory[] }>(`/api/v1/ebay/catalog/categories/?parent_id=3197&language=${language}`, fallback.current, { signal: controller.signal }),
          categoryId ? request<EbayAspectSchema>(`/api/v1/ebay/catalog/categories/${categoryId}/aspects/?language=${language}`, fallback.current, { signal: controller.signal }) : null,
        ]);
        if (!controller.signal.aborted) { setCategories(tree?.categories || []); setSchema(aspects); setPath([]); setError(""); }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : fallback.current);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [categoryId, language]);

  async function select(category?: EbayCategory, nextPath: EbayCategory[] = []) {
    setLoading(true); setError("");
    try {
      if (category?.is_leaf) {
        if (category.id !== categoryId && state.draft && Object.keys(state.draft.aspects).some((name) => name !== "Farbe") && !window.confirm(t("ebay.changeCategory"))) return;
        state.edit({ category_id: category.id, aspects: category.id === categoryId ? state.draft!.aspects : (state.draft?.aspects.Farbe ? { Farbe: state.draft.aspects.Farbe } : {}) });
        if (category.id !== categoryId) setSchema(null);
        setSheet(null);
      } else {
        const result = await request<{ categories: EbayCategory[] }>(`/api/v1/ebay/catalog/categories/?language=${language}&parent_id=${category?.id || "3197"}`, t("ebay.error"));
        setCategories(result?.categories || []); setPath(nextPath);
        setQuery("");
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("ebay.error")); }
    finally { setLoading(false); }
  }

  return <SectionCard>
    <SectionCardHeader title={t("ebay.category")} description={t("ebay.categoryHint")} actions={
      <div className="min-w-[140px]">
        <Label htmlFor="ebay-catalog-lang" className="mb-1">{t("listing.catalogLanguage")}</Label>
        <CatalogLanguageSelect id="ebay-catalog-lang" value={language} onValueChange={(next) => { setLanguage(next); window.localStorage.setItem("benim_ebay_catalog_lang", next); }} />
      </div>
    } />
    <div className="grid gap-4 p-4 md:p-5">
      <fieldset disabled={state.locked || loading || !state.draft} className="grid min-w-0 gap-4">
        <article className="rounded-xl border border-border bg-card p-3">
          <header className="mb-2 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary"><List className="size-4" aria-hidden /></span>
            <strong className="text-sm font-extrabold text-primary">{t("ebay.category")}</strong>
          </header>
          <button type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-[#f8fafc] px-3 py-2.5 text-left transition-colors hover:border-primary/30" onClick={() => { setQuery(""); setSheet("category"); void select(); }}>
            <strong className={`text-sm font-extrabold ${categoryId ? "text-primary" : "text-muted-foreground"}`}>{schema?.category.label || schema?.category.name || categoryId || t("ebay.choose")}</strong>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </article>
        <article className="rounded-xl border border-border bg-card p-3">
          <header className="mb-2 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary"><ListChecks className="size-4" aria-hidden /></span>
            <strong className="text-sm font-extrabold text-primary">{t("ebay.aspects")}</strong>
          </header>
          <ul className="mb-3 grid gap-2">
          {schema?.aspects.filter((aspect) => aspect.aspectConstraint.aspectRequired || displayedAspects[aspect.localizedAspectName]?.some(Boolean)).map((aspect) => {
            const name = aspect.localizedAspectName;
            const values = displayedAspects[name] || [];
            const freeText = aspect.aspectConstraint.aspectMode === "FREE_TEXT";
            return <li key={name} className="flex items-stretch gap-2">
              <button type="button" className={`flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-xl border bg-[#f8fafc] px-3 py-2 text-left hover:border-primary/30 ${freeText ? "border-[rgba(247,148,29,0.45)]" : "border-border"}`} onClick={() => openAspect(aspect)}>
                <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
                  <strong className="truncate text-sm font-extrabold text-primary">{aspect.label || name}{aspect.aspectConstraint.aspectRequired ? " *" : ""}</strong>
                  {freeText && name !== "Farbe" && <span className="rounded-md bg-[rgba(247,148,29,0.16)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--brand-accent,#f7941d)]">{t("ebay.freeTextBadge")}</span>}
                </div>
                <span className="truncate text-xs font-semibold text-muted-foreground">{values.map((value) => aspect.aspectValues?.find((item) => item.localizedValue === value)?.label || value).join(", ") || t("ebay.choose")}</span>
              </button>
              {values.some(Boolean) && <Button type="button" size="icon" variant="ghost" className="shrink-0 text-[var(--ui-danger)] hover:bg-[var(--ui-danger-bg)]" aria-label={t("listing.removeAttribute")} onClick={() => {
                const aspects = { ...state.draft!.aspects };
                delete aspects[name];
                state.edit({ aspects });
              }}><X className="size-4" aria-hidden /></Button>}
            </li>;
          })}
          </ul>
          <Button variant="secondary" disabled={!schema} onClick={() => { setQuery(""); setSheet("aspects"); }}>{t("listing.addAttribute")}</Button>
        </article>
        <Button variant="accent" className="justify-self-start" onClick={() => void state.save()}>{state.busy ? t("product.saving") : t("ebay.saveCategory")}</Button>
      </fieldset>
      {loading && <p role="status">{t("common.loading")}</p>}
      {(error || state.error) && <Feedback tone="error">{error || state.error}</Feedback>}
      {state.notice && <Feedback tone="success">{state.notice}</Feedback>}
    </div>
    <Dialog open={sheet !== null} onOpenChange={(open) => { if (!open) setSheet(null); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="grid shrink-0 gap-3 border-b border-border p-4">
          <DialogTitle className="pr-8 text-base font-extrabold text-primary">{sheet === "value" ? editingAspect?.label || editingName : t(sheet === "category" ? "ebay.category" : "ebay.aspects")}</DialogTitle>
          <DialogDescription className="sr-only">{t("ebay.categoryHint")}</DialogDescription>
          {(sheet !== "value" || Boolean(editingAspect?.aspectValues?.length)) && <Input autoFocus={sheet !== "value" || !freeText} aria-label={t("common.search")} placeholder={t("common.search")} value={query} onChange={(event) => setQuery(event.target.value)} />}
        </div>
        <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain">
        <fieldset disabled={loading || state.locked} className="grid min-w-0 gap-1 p-3">
        {sheet === "category" && <>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void select()}>{t("ebay.furniture")}</Button>
          {path.map((node, index) => <Button key={node.id} variant="secondary" onClick={() => void select(node, path.slice(0, index + 1))}>{node.label || node.name}</Button>)}
        </div>
        {categories.filter((item) => matchesQuery(item.name, item.label)).map((item) => <button type="button" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-extrabold text-primary hover:bg-secondary" key={item.id} onClick={() => void select(item, [...path, item])}>{item.label || item.name}{!item.is_leaf && <ChevronRight className="size-4" aria-hidden />}</button>)}
        </>}
        {sheet === "aspects" && schema && state.draft && <>
          {schema.aspects.filter((aspect) => matchesQuery(aspect.localizedAspectName, aspect.label)).map((aspect) => {
            const name = aspect.localizedAspectName;
            return <button type="button" key={name} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-secondary" onClick={() => openAspect(aspect)}>
              <span className="flex min-w-0 flex-col gap-0.5"><strong className="text-sm font-extrabold text-primary">{aspect.label || name}{aspect.aspectConstraint.aspectRequired ? " *" : ""}</strong><small className="text-xs font-semibold text-muted-foreground">{schema.category.label || schema.category.name}</small></span>
              {displayedAspects[name]?.some(Boolean) && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
            </button>;
          })}
          {!schema.aspects.some((aspect) => matchesQuery(aspect.localizedAspectName, aspect.label)) && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("listing.sheetEmpty")}</p>}
        </>}
        {sheet === "value" && editingAspect && <div className="grid gap-3 p-1">
          {freeText ? multiple ?
            <Textarea autoFocus aria-label={editingAspect.label || editingName} rows={3} placeholder={t("ebay.multiple")} value={draftValues.join("\n")} onChange={(event) => setDraftValues(event.target.value.split("\n"))} /> :
            <Input autoFocus aria-label={editingAspect.label || editingName} maxLength={editingAspect.aspectConstraint.aspectMaxLength || 65} value={draftValues[0] || ""} onChange={(event) => setDraftValues([event.target.value])} /> : null}
          <div className="grid gap-1">
            {editingAspect.aspectValues?.filter((item) => matchesQuery(item.localizedValue, item.label)).slice(0, 100).map((item) => {
              const checked = draftValues.includes(item.localizedValue);
              const toggle = () => setDraftValues(multiple ? checked ? draftValues.filter((value) => value !== item.localizedValue) : [...draftValues, item.localizedValue] : [item.localizedValue]);
              return multiple ? <label key={item.localizedValue} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-primary hover:bg-secondary">
                <Checkbox checked={checked} onCheckedChange={toggle} />{item.label || item.localizedValue}
              </label> : <button type="button" key={item.localizedValue} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary hover:bg-secondary ${checked ? "bg-secondary" : ""}`} onClick={toggle}>{item.label || item.localizedValue}{checked && <Check className="size-4 shrink-0" aria-hidden />}</button>;
            })}
            {Boolean(editingAspect.aspectValues?.length) && !editingAspect.aspectValues?.some((item) => matchesQuery(item.localizedValue, item.label)) && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("listing.sheetEmpty")}</p>}
          </div>
        </div>}
        </fieldset>
        </div>
        {loading && <p role="status" className="px-4">{t("common.loading")}</p>}
        {error && <div className="px-4"><Feedback tone="error">{error}</Feedback></div>}
        <div className="flex shrink-0 justify-end gap-2 border-t border-border p-4">
          <Button variant="secondary" onClick={() => setSheet(null)}>{t(sheet === "value" ? "common.cancel" : "common.close")}</Button>
          {sheet === "value" && <Button variant="accent" disabled={loading || state.locked} onClick={commitAspect}>{t("common.save")}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  </SectionCard>;
}
