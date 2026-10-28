"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SectionCard, SectionCardHeader, Feedback } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FilterSelect } from "@/components/ui/filter-select";
import { useI18n } from "@/i18n";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import {
  ebayAspectDefaults, ebayDraftPayload, ebayListingUrl, ebayProductImages, newEbayDraft,
  type EbayAspectSchema, type EbayCategory, type EbayChecks, type EbayContact,
  type EbayDraft, type EbayGeneration, type EbayPreparation, type EbayProduct,
  type EbayReadiness, type EbaySnapshot,
} from "@/lib/ebay";

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

function Field({ title, children }: { title: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm font-semibold">{title}{children}</label>;
}

export function EbayListingPanel({ productId }: { productId: number }) {
  const { t } = useI18n();
  const base = `/api/v1/ebay/drafts/depotum/${productId}/`;
  const [product, setProduct] = useState<EbayProduct | null>(null);
  const [readiness, setReadiness] = useState<EbayReadiness | null>(null);
  const [draft, setDraft] = useState<EbayDraft | null>(null);
  const [snapshot, setSnapshot] = useState<EbaySnapshot | null>(null);
  const [preparation, setPreparation] = useState<EbayPreparation | null>(null);
  const [schema, setSchema] = useState<EbayAspectSchema | null>(null);
  const [categories, setCategories] = useState<EbayCategory[]>([]);
  const [categoryPath, setCategoryPath] = useState<EbayCategory[]>([]);
  const [optionalAspects, setOptionalAspects] = useState(false);
  const [checks, setChecks] = useState<EbayChecks | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generation, setGeneration] = useState<EbayGeneration | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const loadError = useRef(t("ebay.error"));
  const generationPending = generation?.status === "queued" || generation?.status === "running";

  function edit(changes: Partial<EbayDraft>) {
    setDraft((current) => current ? { ...current, ...changes } : current);
    setDirty(true);
    setChecks(null);
    setConfirmed(false);
    setNotice("");
  }

  async function run(action: () => Promise<void>, mutation = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : t("ebay.error"));
      // A lost response can follow a successful remote mutation. Never retry it automatically.
      if (mutation) { setRefreshRequired(true); setChecks(null); }
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function refresh() {
    const [remote, local] = await Promise.all([
      request<EbaySnapshot>(`${base}listing/`, t("ebay.error"), {}, true),
      request<EbayPreparation>(`${base}prepare/`, t("ebay.error"), {}, true),
    ]);
    if (remote && remote.environment !== readiness?.environment) throw new Error(t("ebay.error"));
    setSnapshot(remote);
    setPreparation(local);
    setChecks(null);
    setRefreshRequired(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const fallback = loadError.current;
    async function load() {
      setBusy(true);
      try {
        const [item, account, saved, remote, local, tree] = await Promise.all([
          request<EbayProduct>(`/api/v1/products/${productId}/`, fallback, options),
          request<EbayReadiness>("/api/v1/ebay/readiness/?account=depotum", fallback, options),
          request<EbayDraft>(base, fallback, options, true),
          request<EbaySnapshot>(`${base}listing/`, fallback, options, true),
          request<EbayPreparation>(`${base}prepare/`, fallback, options, true),
          request<{ categories: EbayCategory[] }>("/api/v1/ebay/catalog/categories/", fallback, options),
        ]);
        if (!item || !account || account.account !== "depotum" || !["sandbox", "production"].includes(account.environment) || (remote && remote.environment !== account.environment)) throw new Error(fallback);
        const aspectSchema = saved?.category_id ? await request<EbayAspectSchema>(`/api/v1/ebay/catalog/categories/${encodeURIComponent(saved.category_id)}/aspects/`, fallback, options) : null;
        if (controller.signal.aborted) return;
        setProduct(item); setReadiness(account); setDraft(saved || newEbayDraft(item, account));
        setDirty(!saved); setSnapshot(remote); setPreparation(local); setSchema(aspectSchema); setCategories(tree?.categories || []);
        const jobId = window.localStorage.getItem(`ebay-ai:${account.environment}:${productId}`);
        if (jobId && /^[\da-f-]{36}$/i.test(jobId)) {
          const job = await request<EbayGeneration>(`/api/v1/orchestrator/ai-content/generations/${jobId}/`, fallback, options, true);
          if (!controller.signal.aborted && job?.product_id === productId) setGeneration(job);
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : fallback);
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void load();
    return () => controller.abort();
  }, [base, productId, loadVersion]);

  useEffect(() => {
    if (!generationPending || !generation) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const job = await request<EbayGeneration>(`/api/v1/orchestrator/ai-content/generations/${generation.id}/`, t("ebay.error"), { signal: controller.signal });
        if (!controller.signal.aborted && job?.product_id === productId) setGeneration(job);
      } catch (failure) {
        if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : t("ebay.error")); setGeneration(null); }
      }
    }, 4000);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [generation, generationPending, productId, t]);

  if (!draft || !product || !readiness) return <SectionCard padded>
    {error ? <Feedback tone="error">{error}</Feedback> : <p role="status">{t("common.loading")}</p>}
    {error && <Button variant="secondary" disabled={busy} onClick={() => { setError(""); setLoadVersion((current) => current + 1); }}>{t("ebay.refresh")}</Button>}
  </SectionCard>;

  const locked = busy || refreshRequired || preparation?.status === "processing" || preparation?.status === "uncertain";
  const active = snapshot?.remote_status === "PUBLISHED" && snapshot?.listing_status === "ACTIVE";
  const listingUrl = ebayListingUrl(readiness.environment, snapshot?.remote_listing_id || preparation?.listing_id || "");
  const aiContent = generation?.status === "succeeded" ? generation.result?.universal?.content : undefined;
  const imageChoices = ebayProductImages(product);
  for (const url of draft.image_urls) if (!imageChoices.some((item) => item.url === url)) imageChoices.push({ url, thumbnail: url, label: "" });

  async function selectCategory(category?: EbayCategory, path: EbayCategory[] = []) {
    await run(async () => {
      if (category?.is_leaf) {
        if (draft!.category_id !== category.id && Object.keys(draft!.aspects).length && !window.confirm(t("ebay.changeCategory"))) return;
        const next = await request<EbayAspectSchema>(`/api/v1/ebay/catalog/categories/${category.id}/aspects/`, t("ebay.error"));
        if (!next) return;
        setSchema(next);
        edit({ category_id: category.id, aspects: draft!.category_id === category.id ? draft!.aspects : ebayAspectDefaults(next, product!, aiContent) });
      } else {
        const tree = await request<{ categories: EbayCategory[] }>(`/api/v1/ebay/catalog/categories/${category ? `?parent_id=${category.id}` : ""}`, t("ebay.error"));
        setCategories(tree?.categories || []);
        setCategoryPath(path);
      }
    });
  }

  function contact(kind: "manufacturer" | "responsiblePersons", key: keyof EbayContact, value: string) {
    const regulatory = { ...draft!.regulatory };
    const updated = { ...(kind === "manufacturer" ? regulatory.manufacturer : regulatory.responsiblePersons?.[0]), [key]: value };
    if (kind === "manufacturer") regulatory.manufacturer = updated;
    else regulatory.responsiblePersons = [{ ...updated, types: ["EU_RESPONSIBLE_PERSON"] }, ...(regulatory.responsiblePersons?.slice(1) || [])];
    edit({ regulatory });
  }

  async function changeListing(operation: "prepare" | "publish" | "update" | "withdraw") {
    if (operation !== "prepare") {
      const prompt = t(operation === "publish" ? "ebay.confirmPublish" : operation === "update" ? "ebay.confirmUpdate" : "ebay.confirmWithdraw");
      if (!window.confirm(`${readiness!.environment.toUpperCase()} · Depotum\n${prompt}\n${draft!.title}\n${draft!.price_eur} EUR · ${draft!.quantity}`)) return;
    }
    setChecks(null);
    await run(async () => {
      const url = operation === "prepare" ? `${base}prepare/` : operation === "publish" ? `${base}publish/` : `${base}listing/${operation === "withdraw" ? "?confirm_withdrawal=true" : ""}`;
      const options = operation === "withdraw" ? { method: "DELETE" } : json(operation === "update" ? "PUT" : "POST", {
        confirm_stock_location: confirmed,
        ...(operation === "publish" ? { confirm_publication: true, preview_hash: checks?.preview_hash } : {}),
        ...(operation === "update" ? { confirm_update: true } : {}),
      });
      await request(url, t("ebay.error"), options);
      await refresh();
      setNotice(t("ebay.changed"));
    }, true);
  }

  return <div className="grid gap-4">
    <SectionCard>
      <SectionCardHeader title={`eBay · Depotum · ${readiness.environment.toUpperCase()}`} description={t("ebay.hint")}
        actions={<Button variant="secondary" disabled={busy} onClick={() => void run(refresh)}>{t("ebay.refresh")}</Button>} />
      <div className="grid gap-3 p-5" aria-live="polite">
        {error && <Feedback tone="error">{error}</Feedback>}
        {notice && <Feedback tone="success">{notice}</Feedback>}
        {dirty && <Feedback tone="warn">{t("ebay.dirty")}</Feedback>}
        {(refreshRequired || preparation?.status === "processing" || preparation?.status === "uncertain") && <Feedback tone="warn">{t("ebay.pending")}</Feedback>}
        {!readiness.ready_for_listing_setup && <Feedback tone="warn">{t("ebay.setupMissing")}: {readiness.missing_requirements.join(", ")}</Feedback>}
        {[...(readiness.warnings || []), ...Object.values(readiness.errors || {})].map((warning, i) => <Feedback key={i} tone="warn">{warning}</Feedback>)}
        <p className="text-sm">SKU / EAN: {product.ean_jv || "—"} · {snapshot?.listing_status || preparation?.status || t("ebay.noListing")} · Offer ID: {preparation?.offer_id || "—"} · Listing ID: {snapshot?.remote_listing_id || preparation?.listing_id || "—"}</p>
        {preparation?.last_error && <Feedback tone="error">{preparation.last_error}</Feedback>}
        {listingUrl && <a className="text-sm underline" href={listingUrl} target="_blank" rel="noopener noreferrer">{t("ebay.open")}</a>}
      </div>
    </SectionCard>

    <SectionCard padded>
      <fieldset disabled={locked} className="grid min-w-0 gap-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={generationPending} onClick={() => void run(async () => {
            const job = await request<EbayGeneration>(`/api/v1/orchestrator/products/${productId}/ai-content/generate/`, t("ebay.error"), {
              ...json("POST", { targets: [{ marketplace: "ebay", account: "depotum" }] }),
              headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
            });
            if (job) { setGeneration(job); window.localStorage.setItem(`ebay-ai:${readiness.environment}:${productId}`, job.id); }
          })}>{t("ebay.generate")}</Button>
          {aiContent && <Button variant="secondary" onClick={() => {
            if (!window.confirm(t("ebay.replace"))) return;
            edit({ title: aiContent.title, description: aiContent.description, aspects: { ...draft.aspects, ...(schema ? ebayAspectDefaults(schema, product, aiContent) : {}) } });
          }}>{t("ebay.applyAi")}</Button>}
          {generationPending && <p role="status">{t("ebay.generating")}</p>}
          {generation?.status === "failed" && <Feedback tone="error">{t("ebay.aiFailed")}</Feedback>}
        </div>
        <Field title={t("ebay.title")}><Input value={draft.title} maxLength={80} onChange={(e) => edit({ title: e.target.value })} /></Field>
        <Field title={t("ebay.description")}><Textarea rows={6} value={draft.description} onChange={(e) => edit({ description: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field title={t("ebay.price")}><Input type="number" min="0.01" step="0.01" value={draft.price_eur || ""} onChange={(e) => edit({ price_eur: e.target.value || null })} /></Field>
          <Field title={t("ebay.quantity")}><Input type="number" min="1" step="1" value={draft.quantity ?? ""} onChange={(e) => edit({ quantity: e.target.value ? Number(e.target.value) : null })} /></Field>
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-semibold">{t("ebay.images")}</p>
          <div className="flex flex-wrap gap-3">{imageChoices.map((image) => {
            const index = draft.image_urls.indexOf(image.url);
            return <label key={image.url} className="grid w-28 gap-1 rounded-lg border p-2 text-xs">
              {/* Product images are remote URLs provided by the backend. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumbnail} alt={image.label} className="h-20 w-full rounded object-contain" loading="lazy" />
              <span><input type="checkbox" checked={index >= 0} disabled={index < 0 && draft.image_urls.length >= 24} onChange={() => edit({ image_urls: index < 0 ? [...draft.image_urls, image.url] : draft.image_urls.filter((url) => url !== image.url) })} /> {index >= 0 ? `#${index + 1}` : image.label}</span>
            </label>;
          })}</div>
        </div>
        <div className="grid gap-3">
          <h3 className="font-bold">{t("ebay.category")}: {schema?.category.name || draft.category_id || "—"}</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void selectCategory()}>{t("ebay.root")}</Button>
            {categoryPath.map((node, index) => <Button key={node.id} variant="secondary" onClick={() => void selectCategory(node, categoryPath.slice(0, index + 1))}>{node.name}</Button>)}
          </div>
          <FilterSelect aria-label={t("ebay.category")} value="" onChange={(e) => {
            const category = categories.find((item) => item.id === e.target.value);
            if (category) void selectCategory(category, [...categoryPath, category]);
          }}><option value="">{t("ebay.choose")}</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_leaf ? "" : " ›"}</option>)}</FilterSelect>
          {schema && <>
            <label className="text-sm"><input type="checkbox" checked={optionalAspects} onChange={(e) => setOptionalAspects(e.target.checked)} /> {t("ebay.optional")}</label>
            <div className="grid gap-4 sm:grid-cols-2">{schema.aspects.filter((aspect) => optionalAspects || aspect.aspectConstraint.aspectRequired || draft.aspects[aspect.localizedAspectName]?.length).map((aspect, index) => {
              const name = aspect.localizedAspectName;
              const constraint = aspect.aspectConstraint;
              const values = draft.aspects[name] || [];
              const multiple = constraint.itemToAspectCardinality === "MULTI";
              const change = (next: string[]) => edit({ aspects: { ...draft.aspects, [name]: next } });
              return <Field key={name} title={`${name}${constraint.aspectRequired ? " *" : ""}`}>
                {constraint.aspectMode === "SELECTION_ONLY" ? <FilterSelect multiple={multiple} style={multiple ? { height: "8rem" } : undefined} value={multiple ? values : values[0] || ""} onChange={(e) => change(multiple ? Array.from(e.target.selectedOptions, (option) => option.value) : [e.target.value])}>
                  {!multiple && <option value="">{t("ebay.choose")}</option>}{aspect.aspectValues?.map((item) => <option key={item.localizedValue} value={item.localizedValue}>{item.localizedValue}</option>)}
                </FilterSelect> : multiple ? <Textarea rows={3} placeholder={t("ebay.multiple")} value={values.join("\n")} onChange={(e) => change(e.target.value.split("\n"))} /> : <>
                  <Input value={values[0] || ""} maxLength={constraint.aspectMaxLength || 65} list={`ebay-aspect-${productId}-${index}`} onChange={(e) => change([e.target.value])} />
                  <datalist id={`ebay-aspect-${productId}-${index}`}>{aspect.aspectValues?.slice(0, 100).map((item) => <option key={item.localizedValue} value={item.localizedValue} />)}</datalist>
                </>}
              </Field>;
            })}
            {Object.entries(draft.aspects).filter(([name]) => !schema.aspects.some((aspect) => aspect.localizedAspectName === name)).map(([name, values]) => <Field key={name} title={name}><Input value={values.join("; ")} onChange={(e) => edit({ aspects: { ...draft.aspects, [name]: [e.target.value] } })} /></Field>)}
            </div>
          </>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([ ["fulfillment_policy_id", "fulfillment", "ebay.shipping"], ["payment_policy_id", "payment", "ebay.payment"], ["return_policy_id", "return", "ebay.returns"] ] as const).map(([field, kind, label]) => <Field key={field} title={t(label)}>
            <FilterSelect value={draft[field]} onChange={(e) => edit({ [field]: e.target.value })}><option value="">{t("ebay.choose")}</option>{readiness.policies[kind]?.filter((policy) => policy.applicable_to_furniture).map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</FilterSelect>
          </Field>)}
          <Field title={t("ebay.warehouse")}><FilterSelect value={draft.merchant_location_key} onChange={(e) => edit({ merchant_location_key: e.target.value })}><option value="">{t("ebay.choose")}</option>{readiness.inventory_locations?.filter((location) => location.usable).map((location) => <option key={location.merchant_location_key} value={location.merchant_location_key}>{location.name || location.merchant_location_key}</option>)}</FilterSelect></Field>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">{(["manufacturer", "responsiblePersons"] as const).map((kind) => {
          const value = kind === "manufacturer" ? draft.regulatory.manufacturer : draft.regulatory.responsiblePersons?.[0];
          return <div className="grid gap-3 rounded-lg border p-4" key={kind}><h3 className="font-bold">{t(kind === "manufacturer" ? "ebay.manufacturer" : "ebay.responsible")}</h3>
            {(["companyName", "addressLine1", "city", "postalCode", "country", "email"] as const).map((key) => <Field key={key} title={t(`ebay.${key}`)}><Input value={value?.[key] || ""} maxLength={key === "country" ? 2 : undefined} onChange={(e) => contact(kind, key, key === "country" ? e.target.value.toUpperCase() : e.target.value)} /></Field>)}
          </div>;
        })}</div>
        <Button className="justify-self-start" onClick={() => void run(async () => {
          const saved = await request<EbayDraft>(base, t("ebay.error"), json("PUT", ebayDraftPayload(draft)));
          if (saved) { setDraft(saved); setDirty(false); setChecks(null); setNotice(t("ebay.saved")); }
        })}>{t("ebay.save")}</Button>
      </fieldset>
    </SectionCard>

    <SectionCard padded>
      <div className="grid gap-4">
        <label className="text-sm"><input type="checkbox" checked={confirmed} disabled={locked || dirty} onChange={(e) => setConfirmed(e.target.checked)} /> {t("ebay.confirmChecks")}</label>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={locked || dirty || !confirmed || active || !readiness.ready_for_listing_setup} onClick={() => void changeListing("prepare")}>{t("ebay.prepare")}</Button>
          <Button variant="secondary" disabled={locked || dirty || !preparation?.offer_id || active} onClick={() => void run(async () => { setChecks(await request<EbayChecks>(`${base}publish/`, t("ebay.error"))); })}>{t("ebay.check")}</Button>
          <Button disabled={locked || dirty || !confirmed || !checks?.ready || active || product.status !== "approved"} onClick={() => void changeListing("publish")}>{t("ebay.publish")}</Button>
          <Button variant="secondary" disabled={locked || dirty || !confirmed || !active} onClick={() => void changeListing("update")}>{t("ebay.update")}</Button>
          <Button variant="destructive" disabled={locked || !active} onClick={() => void changeListing("withdraw")}>{t("ebay.withdraw")}</Button>
        </div>
        {checks?.blocking_reasons.map((reason) => <Feedback key={reason} tone="error">{reason}</Feedback>)}
        {checks?.warnings?.map((warning) => <Feedback key={warning} tone="warn">{warning}</Feedback>)}
      </div>
    </SectionCard>
    {snapshot?.offer?.listingDescription && <SectionCard>
      <SectionCardHeader title={t("ebay.preview")} />
      <iframe title={t("ebay.preview")} srcDoc={snapshot.offer.listingDescription} sandbox="" referrerPolicy="no-referrer" className="h-[700px] w-full rounded-b-2xl border-0 bg-white" />
    </SectionCard>}
  </div>;
}
