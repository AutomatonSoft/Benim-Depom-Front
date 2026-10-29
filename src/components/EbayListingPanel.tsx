"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SectionCard, SectionCardHeader, Feedback } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FilterSelect } from "@/components/ui/filter-select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { ebayDisplayTitle, ebayDraftPayload, ebayListingUrl, newEbayDraft, submitEbayListing,
  type EbayAspectSchema, type EbayCategory, type EbayDraft,
  type EbayPreparation, type EbaySnapshot, type EbayEnvironment,
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

  async function submit(operation: "publish" | "update") {
    if (busyRef.current || busy || !draft || !environment) throw new Error(t("common.loading"));
    if (dirty) throw new Error(t("ebay.dirty"));
    if (preparation?.status === "processing" || preparation?.status === "uncertain") throw new Error(t("ebay.pending"));
    busyRef.current = true; setBusy(true); setError("");
    try {
      // Always read remote state first; a lost response must never trigger an automatic retry.
      await submitEbayListing(operation, environment,
        <T,>(path: string, init?: RequestInit, optional?: boolean) => request<T>(base + path, t("ebay.error"), init, optional));
      await refresh();
    } finally { busyRef.current = false; setBusy(false); }
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
    error, notice, edit, save, submit, preview,
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
  const { draft, environment, locked, busy, preparation, snapshot } = state;
  if (!draft || !environment) return <div>
    <p role="status">{state.error || t("common.loading")}</p>
    {state.error && <Button variant="secondary" disabled={busy} onClick={state.reload}>{t("ebay.refresh")}</Button>}
  </div>;
  const listingUrl = ebayListingUrl(environment, snapshot?.remote_listing_id || preparation?.listing_id || "");
  return <div className="grid gap-4">
    <fieldset disabled={locked} className="grid min-w-0 gap-4">
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
      <Button className="justify-self-start" variant="accent" onClick={() => void state.save()}>{t("listing.saveChannel")}</Button>
    </fieldset>
    {state.error && <Feedback tone="error">{state.error}</Feedback>}
    {state.notice && <Feedback tone="success">{state.notice}</Feedback>}
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
  const [sheet, setSheet] = useState<"category" | "aspects" | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const categoryId = state.draft?.category_id;
  const fallback = useRef(t("ebay.error"));

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
    <SectionCardHeader title={t("ebay.category")} description={t("ebay.categoryHint")} />
    <div className="grid gap-4 p-4 md:p-5">
      <FilterSelect aria-label={t("listing.catalogLanguage")} value={language} onChange={(event) => { setLanguage(event.target.value); window.localStorage.setItem("benim_ebay_catalog_lang", event.target.value); }}>
        {ottoCatalogLanguages.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
      </FilterSelect>
      <fieldset disabled={state.locked || loading || !state.draft} className="grid min-w-0 gap-4">
        <p className="text-sm font-semibold">{schema?.category.label || schema?.category.name || categoryId || "—"}</p>
        <Button variant="secondary" className="justify-between" onClick={() => { setSheet("category"); void select(); }}>{t("ebay.category")} ›</Button>
        <article className="grid gap-3 rounded-xl border p-3">
          <strong className="text-sm">{t("ebay.aspects")}</strong>
          {schema?.aspects.filter((aspect) => aspect.aspectConstraint.aspectRequired || state.draft?.aspects[aspect.localizedAspectName]?.length).map((aspect) => {
            const values = state.draft?.aspects[aspect.localizedAspectName] || [];
            return <button type="button" key={aspect.localizedAspectName} className="grid gap-1 rounded-xl border bg-secondary/30 px-3 py-2 text-left" onClick={() => { setQuery(aspect.label || aspect.localizedAspectName); setSheet("aspects"); }}>
              <strong className="text-sm">{aspect.label || aspect.localizedAspectName}{aspect.aspectConstraint.aspectRequired ? " *" : ""}</strong>
              <span className="text-xs text-muted-foreground">{values.map((value) => aspect.aspectValues?.find((item) => item.localizedValue === value)?.label || value).join(", ") || (["Breite", "Länge", "Höhe"].includes(aspect.localizedAspectName) ? t("ebay.fromCard") : t("ebay.choose"))}</span>
            </button>;
          })}
          <Button variant="secondary" disabled={!schema} onClick={() => { setQuery(""); setSheet("aspects"); }}>{t("listing.addAttribute")}</Button>
        </article>
        <Button variant="accent" className="justify-self-start" onClick={() => void state.save()}>{t("listing.saveChannel")}</Button>
      </fieldset>
      {loading && <p role="status">{t("common.loading")}</p>}
      {(error || state.error) && <Feedback tone="error">{error || state.error}</Feedback>}
      {state.notice && <Feedback tone="success">{state.notice}</Feedback>}
    </div>
    <Dialog open={sheet !== null} onOpenChange={(open) => { if (!open) setSheet(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{t(sheet === "category" ? "ebay.category" : "ebay.aspects")}</DialogTitle>
        <DialogDescription>{t("ebay.categoryHint")}</DialogDescription>
        <Input aria-label={t("common.search")} placeholder={t("common.search")} value={query} onChange={(event) => setQuery(event.target.value)} />
        <fieldset disabled={loading || state.locked} className="grid gap-3">
        {sheet === "category" && <>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void select()}>{t("ebay.furniture")}</Button>
          {path.map((node, index) => <Button key={node.id} variant="secondary" onClick={() => void select(node, path.slice(0, index + 1))}>{node.label || node.name}</Button>)}
        </div>
        {categories.filter((item) => `${item.name} ${item.label || ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((item) => <Button className="h-auto justify-between whitespace-normal py-2 text-left" variant="ghost" key={item.id} onClick={() => void select(item, [...path, item])}>{item.label || item.name}{item.is_leaf ? "" : " ›"}</Button>)}
        </>}
        {sheet === "aspects" && schema && state.draft && <>
          {schema.aspects.filter((aspect) => `${aspect.localizedAspectName} ${aspect.label || ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((aspect, index) => {
            const name = aspect.localizedAspectName;
            const constraint = aspect.aspectConstraint;
            const values = state.draft!.aspects[name] || [];
            const multiple = constraint.itemToAspectCardinality === "MULTI";
            const automatic = ["Breite", "Länge", "Höhe"].includes(name);
            const change = (next: string[]) => state.edit({ aspects: { ...state.draft!.aspects, [name]: next } });
            return <label key={name} className="grid min-w-0 gap-2 text-sm font-semibold">
              {aspect.label || name}{constraint.aspectRequired ? " *" : ""}
              {automatic ? <Input readOnly value={values[0] || t("ebay.fromCard")} /> : constraint.aspectMode === "SELECTION_ONLY" ?
                <FilterSelect multiple={multiple} style={multiple ? { height: "8rem" } : undefined} value={multiple ? values : values[0] || ""} onChange={(event) => change(multiple ? Array.from(event.target.selectedOptions, (option) => option.value) : [event.target.value])}>
                  {!multiple && <option value="">{t("ebay.choose")}</option>}{aspect.aspectValues?.map((item) => <option key={item.localizedValue} value={item.localizedValue}>{item.label || item.localizedValue}</option>)}
                </FilterSelect> : multiple ? <Textarea rows={3} placeholder={t("ebay.multiple")} value={values.join("\n")} onChange={(event) => change(event.target.value.split("\n"))} /> : <>
                  <Input value={values[0] || ""} maxLength={constraint.aspectMaxLength || 65} list={`ebay-aspect-${index}`} onChange={(event) => change([event.target.value])} />
                  <datalist id={`ebay-aspect-${index}`}>{aspect.aspectValues?.slice(0, 100).map((item) => <option key={item.localizedValue} value={item.localizedValue}>{item.label || item.localizedValue}</option>)}</datalist>
                </>}
            </label>;
          })}
        </>}
        </fieldset>
        {loading && <p role="status">{t("common.loading")}</p>}
        {error && <Feedback tone="error">{error}</Feedback>}
        <Button variant="secondary" onClick={() => setSheet(null)}>{t("common.close")}</Button>
      </DialogContent>
    </Dialog>
  </SectionCard>;
}
