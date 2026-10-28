"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SectionCard, SectionCardHeader, Feedback } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FilterSelect } from "@/components/ui/filter-select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { ebayBaseTitle, ebayDraftPayload, ebayListingUrl, newEbayDraft,
  type EbayAspectSchema, type EbayCategory, type EbayChecks, type EbayDraft,
  type EbayPreparation, type EbayProduct, type EbaySnapshot, type EbayEnvironment,
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
  const [product, setProduct] = useState<EbayProduct | null>(null);
  const [environment, setEnvironment] = useState<EbayEnvironment | null>(null);
  const [snapshot, setSnapshot] = useState<EbaySnapshot | null>(null);
  const [preparation, setPreparation] = useState<EbayPreparation | null>(null);
  const [checks, setChecks] = useState<EbayChecks | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
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
        const [item, connection, saved, remote, local] = await Promise.all([
          request<EbayProduct>(`/api/v1/products/${productId}/`, fallback, options),
          request<{ environment: EbayEnvironment }>("/api/v1/ebay/connections/", fallback, options),
          request<EbayDraft>(base, fallback, options, true),
          request<EbaySnapshot>(`${base}listing/`, fallback, options, true),
          request<EbayPreparation>(`${base}prepare/`, fallback, options, true),
        ]);
        if (!connection || !["sandbox", "production"].includes(connection.environment) || (remote && remote.environment !== connection.environment)) throw new Error(fallback);
        if (controller.signal.aborted) return;
        setProduct(item); setEnvironment(connection.environment); setDraft(saved || newEbayDraft());
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
    setDirty(true); setChecks(null); setConfirmed(false); setNotice("");
  }

  async function run(action: () => Promise<void>, mutation = false) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : t("ebay.error"));
      // A lost response can follow a successful remote mutation. Never retry automatically.
      if (mutation) { setRefreshRequired(true); setChecks(null); }
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function refresh() {
    const [remote, local] = await Promise.all([
      request<EbaySnapshot>(`${base}listing/`, t("ebay.error"), {}, true),
      request<EbayPreparation>(`${base}prepare/`, t("ebay.error"), {}, true),
    ]);
    if (remote && remote.environment !== environment) throw new Error(t("ebay.error"));
    setSnapshot(remote); setPreparation(local); setChecks(null); setRefreshRequired(false);
  }

  async function save() {
    if (!draft) return;
    await run(async () => {
      const saved = await request<EbayDraft>(base, t("ebay.error"), json("PUT", ebayDraftPayload(draft)));
      if (saved) { setDraft(saved); setDirty(false); setChecks(null); setNotice(t("ebay.saved")); }
    });
  }

  async function changeListing(operation: "prepare" | "publish" | "update" | "withdraw") {
    if (!draft || !environment) return;
    if (operation !== "prepare") {
      const prompt = t(operation === "publish" ? "ebay.confirmPublish" : operation === "update" ? "ebay.confirmUpdate" : "ebay.confirmWithdraw");
      if (!window.confirm(`${environment.toUpperCase()} · Depotum\n${prompt}\n${draft.title}\n${draft.price_eur} EUR · ${draft.quantity}`)) return;
    }
    const hash = checks?.preview_hash;
    setChecks(null);
    await run(async () => {
      const url = operation === "prepare" ? `${base}prepare/` : operation === "publish" ? `${base}publish/` : `${base}listing/${operation === "withdraw" ? "?confirm_withdrawal=true" : ""}`;
      const options = operation === "withdraw" ? { method: "DELETE" } : json(operation === "update" ? "PUT" : "POST", {
        confirm_stock_location: confirmed,
        ...(operation === "publish" ? { confirm_publication: true, preview_hash: hash } : {}),
        ...(operation === "update" ? { confirm_update: true } : {}),
      });
      await request(url, t("ebay.error"), options);
      await refresh(); setNotice(t("ebay.changed"));
    }, true);
  }

  return { base, product, draft, environment, snapshot, preparation, checks, dirty, confirmed, busy,
    locked: busy || refreshRequired || preparation?.status === "processing" || preparation?.status === "uncertain",
    error, notice, edit, save, run, refresh, changeListing, setConfirmed, setChecks,
    reload: () => { setError(""); setVersion((current) => current + 1); },
  };
}

const EbayContext = createContext<ReturnType<typeof useEbayState> | null>(null);
export function EbayListingProvider({ productId, children }: { productId: number; children: ReactNode }) {
  const value = useEbayState(productId);
  return <EbayContext.Provider value={value}>{children}</EbayContext.Provider>;
}
function useEbay() {
  const value = useContext(EbayContext);
  if (!value) throw new Error("Missing EbayListingProvider");
  return value;
}

export function EbayListingPanel() {
  const { t } = useI18n();
  const state = useEbay();
  const { draft, environment, product, locked, busy, dirty, preparation, snapshot, checks, confirmed } = state;
  if (!draft || !environment) return <div>
    <p role="status">{state.error || t("common.loading")}</p>
    {state.error && <Button variant="secondary" disabled={busy} onClick={state.reload}>{t("ebay.refresh")}</Button>}
  </div>;
  const active = snapshot?.remote_status === "PUBLISHED" && snapshot?.listing_status === "ACTIVE";
  const listingUrl = ebayListingUrl(environment, snapshot?.remote_listing_id || preparation?.listing_id || "");
  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
      <span>eBay Depotum · {environment.toUpperCase()} · {snapshot?.listing_status || preparation?.status || t("ebay.noListing")}</span>
      <Button variant="secondary" disabled={busy} onClick={() => void state.run(state.refresh)}>{t("ebay.refresh")}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{t("ebay.automatic")}</p>
    <fieldset disabled={locked} className="grid min-w-0 gap-4">
      <label className="grid gap-2 text-sm font-semibold">{t("ebay.title")}
        <Input maxLength={75} value={ebayBaseTitle(draft.title)} onChange={(event) => state.edit({ title: event.target.value })} />
        <span className="text-xs text-muted-foreground">{ebayBaseTitle(draft.title).length}/75 · BD</span>
      </label>
      <label className="grid gap-2 text-sm font-semibold">{t("ebay.description")}
        <Textarea rows={product?.set_parts?.length ? 12 : 7} value={draft.description} onChange={(event) => state.edit({ description: event.target.value })} />
      </label>
      <Button className="justify-self-start" variant="accent" onClick={() => void state.save()}>{t("listing.saveChannel")}</Button>
    </fieldset>
    {dirty && <Feedback tone="warn">{t("ebay.dirty")}</Feedback>}
    {state.error && <Feedback tone="error">{state.error}</Feedback>}
    {state.notice && <Feedback tone="success">{state.notice}</Feedback>}
    {preparation?.last_error && <Feedback tone="error">{preparation.last_error}</Feedback>}
    {preparation?.status === "uncertain" && <Feedback tone="warn">{t("ebay.pending")}</Feedback>}
    <label className="text-sm"><input type="checkbox" checked={confirmed} disabled={locked || dirty} onChange={(event) => state.setConfirmed(event.target.checked)} /> {t("ebay.confirmChecks")}</label>
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={locked || dirty || !confirmed || active} onClick={() => void state.changeListing("prepare")}>{t("ebay.prepare")}</Button>
      <Button variant="secondary" disabled={locked || dirty || !preparation?.offer_id || active} onClick={() => void state.run(async () => { state.setChecks(await request<EbayChecks>(`${state.base}publish/`, t("ebay.error"))); })}>{t("ebay.check")}</Button>
      <Button disabled={locked || dirty || !confirmed || !checks?.ready || active || product?.status !== "approved"} onClick={() => void state.changeListing("publish")}>{t("ebay.publish")}</Button>
      <Button variant="secondary" disabled={locked || dirty || !confirmed || !active} onClick={() => void state.changeListing("update")}>{t("ebay.update")}</Button>
      <Button variant="destructive" disabled={locked || !active} onClick={() => void state.changeListing("withdraw")}>{t("ebay.withdraw")}</Button>
    </div>
    {checks?.blocking_reasons.map((reason) => <Feedback key={reason} tone="error">{reason}</Feedback>)}
    {checks?.warnings?.map((warning) => <Feedback key={warning} tone="warn">{warning}</Feedback>)}
    {listingUrl && <a className="text-sm underline" href={listingUrl} target="_blank" rel="noopener noreferrer">{t("ebay.open")} · {snapshot?.remote_listing_id || preparation?.listing_id}</a>}
    {snapshot?.offer?.listingDescription && <details><summary className="cursor-pointer text-sm font-semibold">{t("ebay.preview")}</summary>
      <iframe title={t("ebay.preview")} srcDoc={snapshot.offer.listingDescription} sandbox="" referrerPolicy="no-referrer" className="mt-2 h-[700px] w-full rounded-xl border bg-white" />
    </details>}
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
          request<{ categories: EbayCategory[] }>(`/api/v1/ebay/catalog/categories/?language=${language}`, fallback.current, { signal: controller.signal }),
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
        const result = await request<{ categories: EbayCategory[] }>(`/api/v1/ebay/catalog/categories/?language=${language}${category ? `&parent_id=${category.id}` : ""}`, t("ebay.error"));
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
        <Button variant="secondary" className="justify-between" onClick={() => { setQuery(""); setSheet("category"); }}>{t("ebay.category")} ›</Button>
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
          <Button variant="secondary" onClick={() => void select()}>{t("ebay.root")}</Button>
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
