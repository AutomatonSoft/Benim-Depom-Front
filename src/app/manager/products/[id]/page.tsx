"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { listingTargetKey, listingTargets } from "@/lib/listings";
import { useI18n, type MessageKey } from "@/i18n";

type Variant = {
  id: number;
  color_hex: string;
  materials: string[];
  width_cm: string;
  height_cm: string;
  length_cm: string;
  quantity: number;
};

type ProductImage = {
  id: number;
  image: string;
  processed_image: string | null;
  position?: number;
  is_primary: boolean;
  processing_status: string;
  processing_error: string;
  generated_images: Array<{ id: number; image: string; mode: string }>;
};

type PricingFormula = {
  margin: string | number;
  adv_fee: string | number;
  vat: string | number;
  percent_factor?: string;
  city_tariffs_eur_per_cbm: Record<string, string | number>;
  de_size_tiers: Array<{ code: string; min_cbm: string | number; max_cbm: string | number; price_eur: string | number }>;
  eur_to_try: string | null;
  eur_to_usd: string | null;
  uses_product_formula?: boolean;
  uses_manual_listing?: boolean;
};

type Product = {
  id: number;
  owner: number;
  title: string;
  product_type: string;
  unit_price: string;
  currency: "TRY" | "EUR" | "USD";
  warehouse_city?: "IST" | "ANK" | "IZM" | "BUR" | "KSY" | "INE";
  listing_price_eur?: string | null;
  listing_price_eur_override?: string | null;
  pricing_overrides?: Record<string, unknown>;
  pricing_formula?: PricingFormula | null;
  last_moderation_decision?: "approved" | "rejected" | "returned_to_review" | "withdrawn" | null;
  status: string;
  ean_jv: string | null;
  ean_xl: string | null;
  total_quantity: number;
  total_amount: string;
  otto_category_name: string | null;
  otto_category_group_name: string | null;
  variants: Variant[];
  images: ProductImage[];
  created_at: string;
  updated_at: string;
  availability_reminder_sent_at?: string | null;
  availability_confirmed_at?: string | null;
  is_available?: boolean;
  seller?: { id: number; username: string; first_name: string; email: string };
  catalog_revision?: number;
  pending_changes?: Record<string, unknown> | null;
  pending_changes_submitted_at?: string | null;
};

type ModerationDecision = {
  id: number;
  decision: string;
  comment: string;
  manager_username: string;
  created_at: string;
};

type FormState = {
  title: string;
  product_type: string;
  unit_price: string;
  currency: Product["currency"];
  listing_price_eur: string;
  variants: Variant[];
};

type GenerationContent = { title?: string; description?: string; bullet_points?: string[] };

type Generation = {
  id: string;
  status: string;
  targets?: Array<{ marketplace: string; account: string }>;
  result: { universal?: { model?: string; content?: GenerationContent } } | null;
  error: { code?: string; detail?: string } | null;
};

type GalleryItem = {
  key: string;
  url: string;
  label: string;
  generated: boolean;
  sourceImageId?: number;
  isPrimary?: boolean;
};

function sortProductImages(images: ProductImage[]) {
  return [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
}

function moveImageInList(images: ProductImage[], fromId: number, toId: number) {
  if (fromId === toId) return images;
  const next = sortProductImages(images);
  const from = next.findIndex((image) => image.id === fromId);
  const to = next.findIndex((image) => image.id === toId);
  if (from < 0 || to < 0) return images;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((image, position) => ({ ...image, position }));
}

type DraftForm = { title: string; description: string; bullets: string };

const HISTORY_PAGE_SIZE = 5;

const generationStorageKey = (productId: number) => `benim_ai_generation_${productId}`;

function isGenerationInProgress(status?: string) {
  return status === "queued" || status === "running";
}

function isImageGenerationInProgress(image?: Pick<ProductImage, "processing_status" | "processing_error">) {
  if (!image || image.processing_error) return false;
  return image.processing_status === "pending" || image.processing_status === "processing" || image.processing_status === "result_received";
}

function BackgroundProgress({ label, status }: { label: string; status: string }) {
  const normalizedStatus = status.replaceAll("_", " ");
  const isComplete = status === "succeeded" || status === "completed";
  const isFailed = status === "failed";
  const isActive = !isComplete && !isFailed;
  const width = isComplete ? "100%" : isFailed ? "100%" : status === "queued" || status === "pending" ? "28%" : "68%";

  return <>
    <style>{`
      .background-tasks-card { display: grid; gap: 15px; margin-bottom: 22px; }
      .task-progress { display: grid; gap: 7px; color: #29466f; font-size: 12px; }
      .task-progress > div { display: flex; justify-content: space-between; gap: 12px; }
      .task-progress > div span { color: #71849d; }
      .task-progress > div strong { text-transform: capitalize; }
      .task-progress-track { display: block; height: 6px; overflow: hidden; border-radius: 999px; background: #e8eef6; }
      .task-progress-track > span { display: block; height: 100%; border-radius: inherit; background: #f7941d; transition: width .35s ease; }
      .task-progress.is-active .task-progress-track > span { animation: task-progress-pulse 1.4s ease-in-out infinite; }
      .task-progress.is-failed .task-progress-track > span { background: #c33c33; }
      @keyframes task-progress-pulse { 50% { opacity: .52; } }
    `}</style>
    <div className={`task-progress ${isActive ? "is-active" : ""} ${isFailed ? "is-failed" : ""}`} aria-live="polite">
      <div><span>{label}</span><strong>{isComplete ? "Ready" : isFailed ? "Failed" : normalizedStatus}</strong></div>
      <span className="task-progress-track"><span style={{ width }} /></span>
    </div>
  </>;
}

const warehouseLabels: Record<string, string> = {
  IST: "Istanbul",
  ANK: "Ankara",
  IZM: "Izmir",
  BUR: "Bursa",
  KSY: "Kars",
  INE: "Inegol",
};

function formatMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(Number(amount));
}

function sellerPriceEur(product: Product) {
  if (product.currency === "EUR") return null;
  const amount = Number(product.unit_price);
  const rate = Number(
    product.currency === "TRY"
      ? product.pricing_formula?.eur_to_try
      : product.currency === "USD"
        ? product.pricing_formula?.eur_to_usd
        : null,
  );
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) return null;
  return formatMoney(String(amount / rate), "EUR");
}

const cityOrder = ["IST", "ANK", "IZM", "BUR", "KSY", "INE"] as const;

function FormulaEditorDialog({
  formula,
  saving,
  onClose,
  onSave,
  onReset,
}: {
  formula: PricingFormula;
  saving: boolean;
  onClose: () => void;
  onSave: (overrides: Record<string, unknown>) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(formula);

  function setField(field: "margin" | "adv_fee" | "vat" | "eur_to_try" | "eur_to_usd", value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function setCity(city: string, value: string) {
    setDraft((current) => ({
      ...current,
      city_tariffs_eur_per_cbm: { ...current.city_tariffs_eur_per_cbm, [city]: value },
    }));
  }

  function setTier(index: number, field: "min_cbm" | "max_cbm" | "price_eur", value: string) {
    setDraft((current) => ({
      ...current,
      de_size_tiers: current.de_size_tiers.map((tier, itemIndex) => itemIndex === index ? { ...tier, [field]: value } : tier),
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const overrides: Record<string, unknown> = {
      margin: draft.margin,
      adv_fee: draft.adv_fee,
      vat: draft.vat,
      city_tariffs_eur_per_cbm: draft.city_tariffs_eur_per_cbm,
      de_size_tiers: draft.de_size_tiers,
    };
    if (draft.eur_to_try) overrides.eur_to_try = draft.eur_to_try;
    if (draft.eur_to_usd) overrides.eur_to_usd = draft.eur_to_usd;
    onSave(overrides);
  }

  return (
    <div className="price-help-overlay" role="dialog" aria-modal="true" aria-labelledby="price-help-title" onClick={onClose}>
      <form className="price-help-dialog price-formula-dialog" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="price-help-heading">
          <h2 id="price-help-title">{t("formula.title")}</h2>
          <button type="button" className="price-calc-hint" onClick={onClose}>{t("common.close")}</button>
        </div>
        <p className="formula-intro">{t("formula.intro")}</p>
        <p className="price-help-formula">
          {t("formula.listing")}<br />
          {t("formula.listingRest")}
        </p>
        <div className="formula-sections">
          <section className="formula-block">
            <h3>{t("formula.percentages")}</h3>
            <div className="formula-percent-grid">
              <label>{t("formula.margin")}<input required step="0.01" min="0" type="number" value={String(draft.margin)} onChange={(event) => setField("margin", event.target.value)} /></label>
              <label>{t("formula.advertising")}<input required step="0.01" min="0" type="number" value={String(draft.adv_fee)} onChange={(event) => setField("adv_fee", event.target.value)} /></label>
              <label>{t("formula.vat")}<input required step="0.01" min="0" type="number" value={String(draft.vat)} onChange={(event) => setField("vat", event.target.value)} /></label>
            </div>
          </section>
          <section className="formula-block">
            <h3>{t("formula.rates")}</h3>
            <div className="formula-rates-grid">
              <label>{t("formula.try")}<input step="0.0001" min="0.0001" type="number" value={String(draft.eur_to_try ?? "")} onChange={(event) => setField("eur_to_try", event.target.value)} /></label>
              <label>{t("formula.usd")}<input step="0.0001" min="0.0001" type="number" value={String(draft.eur_to_usd ?? "")} onChange={(event) => setField("eur_to_usd", event.target.value)} /></label>
            </div>
          </section>
          <section className="formula-block">
            <h3>{t("formula.cityTariffs")}</h3>
            <div className="formula-city-grid">
              {cityOrder.map((city) => (
                <label key={city}>{warehouseLabels[city]}<input required step="0.01" min="0" type="number" value={String(draft.city_tariffs_eur_per_cbm[city] ?? "")} onChange={(event) => setCity(city, event.target.value)} /></label>
              ))}
            </div>
          </section>
          <section className="formula-block">
            <h3>{t("formula.deDelivery")}</h3>
            <div className="formula-tier-list">
              {draft.de_size_tiers.map((tier, index) => (
                <div className="formula-tier-row" key={tier.code}>
                  <strong>{tier.code}</strong>
                  <label>{t("formula.from")}<input required step="0.001" min="0" type="number" value={String(tier.min_cbm)} onChange={(event) => setTier(index, "min_cbm", event.target.value)} /></label>
                  <label>{t("formula.to")}<input required step="0.001" min="0" type="number" value={String(tier.max_cbm)} onChange={(event) => setTier(index, "max_cbm", event.target.value)} /></label>
                  <label>{t("formula.price")}<input required step="0.01" min="0" type="number" value={String(tier.price_eur)} onChange={(event) => setTier(index, "price_eur", event.target.value)} /></label>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="price-help-actions">
          <button type="button" className="price-calc-hint" disabled={saving} onClick={onReset}>{t("formula.useDefault")}</button>
          <button className="save-button" disabled={saving} type="submit">{saving ? t("product.saving") : t("formula.save")}</button>
        </div>
      </form>
    </div>
  );
}

function formatChangeValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function currentFieldValue(product: Product, field: string) {
  if (field === "variants") return formatChangeValue(product.variants);
  const record = product as unknown as Record<string, unknown>;
  return formatChangeValue(record[field]);
}

function toForm(product: Product): FormState {
  return {
    title: product.title,
    product_type: product.product_type,
    unit_price: product.unit_price,
    currency: product.currency,
    listing_price_eur: product.listing_price_eur ?? "",
    variants: (product.variants ?? []).map((variant) => ({
      ...variant,
      materials: [...(variant.materials ?? [])],
    })),
  };
}

export default function ProductWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const productId = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [selectedImageKey, setSelectedImageKey] = useState<string | null>(null);
  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [priceHelpOpen, setPriceHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ModerationDecision[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dragImageId, setDragImageId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const dragImageIdRef = useRef<number | null>(null);

  const canModerate = product?.status === "submitted";
  const canChangeApprovedStatus = product?.status === "approved";
  const pendingEntries = Object.entries(product?.pending_changes ?? {}).filter(([, value]) => value !== undefined);
  const latestRejection = history.find((item) => item.decision === "rejected");
  const sellerWithdrew = product?.status === "withdrawn";
  const totalQuantity = useMemo(
    () => form?.variants.reduce((total, variant) => total + Number(variant.quantity || 0), 0) ?? 0,
    [form],
  );
  const imageGenerationInProgress = useMemo(
    () => product?.images.some((image) => isImageGenerationInProgress(image)) ?? false,
    [product],
  );
  const activeImageGenerationStatus = product?.images.find((image) => isImageGenerationInProgress(image))?.processing_status;
  const descriptionGenerationInProgress = isGenerationInProgress(generation?.status);
  const generationContent = generation?.status === "succeeded" ? generation.result?.universal?.content : undefined;

  const galleryItems = useMemo<GalleryItem[]>(() => {
    if (!product) return [];
    const items: GalleryItem[] = [];
    for (const image of sortProductImages(product.images)) {
      items.push({
        key: `source-${image.id}`,
        url: image.image,
        label: image.is_primary ? t("product.primaryImage") : t("product.sourceImage"),
        generated: false,
        sourceImageId: image.id,
        isPrimary: image.is_primary,
      });
      if (image.processed_image) items.push({ key: `processed-${image.id}`, url: image.processed_image, label: t("product.processedImage"), generated: true });
      for (const generated of image.generated_images) {
        items.push({ key: `generated-${generated.id}`, url: generated.image, label: `${t("product.aiGenerated")} · ${t(`mode.${generated.mode}` as MessageKey)}`, generated: true });
      }
    }
    return items;
  }, [product, t]);
  const selectedImageIndex = Math.max(0, galleryItems.findIndex((item) => item.key === selectedImageKey));
  const selectedGalleryItem: GalleryItem | undefined = galleryItems[selectedImageIndex];

  function stepGallery(offset: number) {
    if (galleryItems.length < 2) return;
    const nextIndex = (selectedImageIndex + offset + galleryItems.length) % galleryItems.length;
    setSelectedImageKey(galleryItems[nextIndex].key);
  }

  // Sync the editable draft with the latest generation result during render,
  // per https://react.dev/learn/you-might-not-need-an-effect
  const [syncedContent, setSyncedContent] = useState<GenerationContent | undefined>(undefined);
  if (generationContent !== syncedContent) {
    setSyncedContent(generationContent);
    if (!generationContent) {
      setDraftForm(null);
    } else if (!draftDirty) {
      setDraftForm({
        title: generationContent.title ?? "",
        description: generationContent.description ?? "",
        bullets: (generationContent.bullet_points ?? []).join("\n"),
      });
    }
  }

  function updateDraft(field: keyof DraftForm, value: string) {
    setDraftDirty(true);
    setDraftForm((current) => current && { ...current, [field]: value });
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!generation || !draftForm) return;
    setDraftSaving(true); setError(""); setFeedback("");
    try {
      const payload = {
        title: draftForm.title.trim(),
        description: draftForm.description.trim(),
        bullet_points: draftForm.bullets.split("\n").map((item) => item.trim()).filter(Boolean),
      };
      const response = await authorizedFetch(`/api/v1/orchestrator/ai-content/generations/${generation.id}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fieldErrors = [data.title, data.description, data.bullet_points].flat().filter(Boolean).join(" ");
        throw new Error(data.detail || fieldErrors || "Draft could not be saved.");
      }
      setGeneration(data as Generation);
      setDraftDirty(false);
      setFeedback(t("product.draftSavedFeedback"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Draft could not be saved."); }
    finally { setDraftSaving(false); }
  }

  async function applyDraft() {
    if (!generation || generation.status !== "succeeded") return;
    if (draftDirty) {
      setError(t("listing.saveDraftFirst"));
      return;
    }
    setApplying(true); setError(""); setFeedback("");
    try {
      const allowed = generation.targets ?? [];
      const allowedKeys = new Set(allowed.map((item) => `${item.marketplace}:${item.account}`));
      const targets = allowed.length
        ? listingTargets.filter((item) => allowedKeys.has(listingTargetKey(item)))
        : listingTargets;
      const applyTargets = targets.length ? targets : allowed;
      const response = await authorizedFetch(
        `/api/v1/orchestrator/products/${productId}/ai-content/generations/${generation.id}/apply/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targets: applyTargets, overwrite: true }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(data, t("listing.applyFailed")));
      const updated = Array.isArray(data.updated_targets) ? data.updated_targets.length : 0;
      setFeedback(t("listing.applied", { count: updated || applyTargets.length }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("listing.applyFailed"));
    } finally {
      setApplying(false);
    }
  }

  async function loadProduct(options?: { silent?: boolean }): Promise<Product | null> {
    if (!Number.isInteger(productId) || productId < 1) return null;
    if (!options?.silent) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/`);
      if (response.status === 401) {
        router.replace("/manager/login");
        return null;
      }
      if (response.status === 404) throw new Error(t("product.notFound"));
      if (!response.ok) throw new Error(t("product.loadError"));
      const data = await response.json() as Product;
      setProduct(data);
      setForm(toForm(data));
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("product.loadError"));
      return null;
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }

  async function loadHistory(page = 1) {
    if (!Number.isInteger(productId) || productId < 1) return;
    setHistoryError("");
    setHistoryLoading(true);
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/moderation-history/?page=${page}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      const results = Array.isArray(data) ? data : data.results ?? [];
      setHistory(results);
      setHistoryCount(Array.isArray(data) ? results.length : Number(data.count ?? results.length));
      setHistoryPage(page);
    } catch {
      setHistoryError(t("product.historyError"));
      setHistory([]);
      setHistoryCount(0);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem("benim_access_token")) return void router.replace("/manager/login");

    async function loadInitialProduct() {
      try {
        const response = await authorizedFetch(`/api/v1/products/${productId}/`);
        if (response.status === 401) return void router.replace("/manager/login");
        if (response.status === 404) throw new Error(t("product.notFound"));
        if (!response.ok) throw new Error(t("product.loadError"));
        const data = await response.json() as Product;
        setProduct(data);
        setForm(toForm(data));
        try {
          await loadHistory(1);
        } catch {
          setHistoryError(t("product.historyError"));
          setHistory([]);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t("product.loadError"));
      } finally {
        setLoading(false);
      }
    }

    void loadInitialProduct();
  // loadHistory is recreated each render; initial load should run once per product.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, router, t]);

  useEffect(() => {
    const savedGenerationId = window.localStorage.getItem(generationStorageKey(productId));
    if (!savedGenerationId) return;

    async function restoreGeneration() {
      try {
        const response = await authorizedFetch(`/api/v1/orchestrator/ai-content/generations/${savedGenerationId}/`);
        if (!response.ok) {
          window.localStorage.removeItem(generationStorageKey(productId));
          return;
        }
        const data = await response.json() as Generation;
        setGeneration(data);
        // Keep succeeded generations saved so the draft stays visible after reloads.
        if (data.status === "failed") window.localStorage.removeItem(generationStorageKey(productId));
      } catch {
        // The task itself continues on the server; the next poll or page visit retries this request.
      }
    }

    void restoreGeneration();
  }, [productId]);

  function updateVariant(index: number, field: keyof Variant, value: string | number | string[]) {
    setForm((current) => current && {
      ...current,
      variants: current.variants.map((variant, itemIndex) => itemIndex === index ? { ...variant, [field]: value } : variant),
    });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        product_type: form.product_type,
        unit_price: form.unit_price,
        currency: form.currency,
        variants: form.variants.map(({ color_hex, materials, width_cm, height_cm, length_cm, quantity }) => ({ color_hex, materials, width_cm, height_cm, length_cm, quantity: Number(quantity) })),
      };
      if (form.listing_price_eur && form.listing_price_eur !== (product?.listing_price_eur ?? "")) {
        payload.listing_price_eur_override = form.listing_price_eur;
      }
      const response = await authorizedFetch(`/api/v1/products/${productId}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(data, "Changes could not be saved."));
      setProduct(data as Product); setForm(toForm(data as Product)); setFeedback("Product changes saved. Update marketplace listings when you are ready to sync them.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Changes could not be saved."); }
    finally { setSaving(false); }
  }

  async function saveProductFormula(overrides: Record<string, unknown>) {
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pricing_overrides: overrides }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(data, "Formula could not be saved."));
      setProduct(data as Product); setForm(toForm(data as Product)); setPriceHelpOpen(false);
      setFeedback("Listing formula saved for this product only.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Formula could not be saved."); }
    finally { setSaving(false); }
  }

  async function resetProductFormula() {
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pricing_overrides: {} }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(data, "Default formula could not be restored."));
      setProduct(data as Product); setForm(toForm(data as Product)); setPriceHelpOpen(false);
      setFeedback("This product now uses the default listing formula.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Default formula could not be restored."); }
    finally { setSaving(false); }
  }

  async function moderate(action: "approve" | "reject") {
    if (action === "reject" && !rejectComment.trim()) { setError("Enter a reason before rejecting the product."); return; }
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/manager/products/${productId}/${action}/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(action === "reject" ? { comment: rejectComment.trim() } : {}),
          expected_catalog_revision: product?.catalog_revision,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        await loadProduct({ silent: true });
        throw new Error(apiErrorMessage(data, t("product.sellerChanged")));
      }
      if (!response.ok) throw new Error(apiErrorMessage(data, `Product could not be ${action}d.`));
      setProduct(data as Product); setForm(toForm(data as Product)); setFeedback(action === "approve" ? "Product approved and EANs assigned." : "Product rejected. The seller will receive the reason.");
      await loadHistory(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Moderation action failed."); }
    finally { setSaving(false); }
  }

  async function changeApprovedStatus(nextStatus: "submitted" | "rejected") {
    if (nextStatus === "rejected" && !rejectComment.trim()) {
      setError("Enter a reason before rejecting the product.");
      return;
    }
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/manager/products/${productId}/status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextStatus === "rejected"
            ? { status: nextStatus, comment: rejectComment.trim(), expected_catalog_revision: product?.catalog_revision }
            : { status: nextStatus, expected_catalog_revision: product?.catalog_revision },
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        await loadProduct({ silent: true });
        throw new Error(apiErrorMessage(data, t("product.sellerChanged")));
      }
      if (!response.ok) throw new Error(apiErrorMessage(data, "Product status could not be changed."));
      setProduct(data as Product);
      setForm(toForm(data as Product));
      setRejectComment("");
      setFeedback(
        nextStatus === "submitted"
          ? "Product returned to review. EANs were kept."
          : "Product rejected. The seller will receive the reason.",
      );
      await loadHistory(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product status could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  async function approveSellerChanges() {
    if (!product) return;
    const hadPending = Object.keys(product.pending_changes ?? {}).length > 0;
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/manager/products/${productId}/seller-changes/approve/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_catalog_revision: product.catalog_revision }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        await loadProduct({ silent: true });
        throw new Error(apiErrorMessage(data, t("product.sellerChanged")));
      }
      if (!response.ok) throw new Error(apiErrorMessage(data, t("product.pendingApproveFailed")));
      await loadProduct({ silent: true });
      const job = (data as { marketplace_job?: unknown }).marketplace_job;
      setFeedback(job ? t("product.pendingApprovedQueued") : t("product.pendingApproved"));
    } catch (cause) {
      const reloaded = await loadProduct({ silent: true });
      const pendingGone = Object.keys(reloaded?.pending_changes ?? {}).length === 0;
      if (hadPending && reloaded?.status === "approved" && pendingGone) {
        setError("");
        setFeedback(t("product.pendingApproved"));
        return;
      }
      setError(cause instanceof Error ? cause.message : t("product.pendingApproveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function requestAvailability() {
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/manager/products/${productId}/availability-request/`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(data, t("product.availabilityFailed")));
      setProduct(data as Product);
      setFeedback(t("product.availabilitySent"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("product.availabilityFailed"));
    } finally { setSaving(false); }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    if (!image) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      const body = new FormData(); body.set("image", image); body.set("is_primary", String(!product?.images.length));
      const response = await authorizedFetch(`/api/v1/products/${productId}/images/`, { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Image upload failed.");
      setFeedback("Image uploaded."); await loadProduct();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Image upload failed."); }
    finally { setSaving(false); event.target.value = ""; }
  }

  async function deleteImage(imageId: number) {
    if (!window.confirm(t("product.deleteImageConfirm"))) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/images/${imageId}/`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Image could not be deleted.");
      }
      setFeedback(t("product.imageDeleted")); await loadProduct({ silent: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("product.imageDeleteFailed")); }
    finally { setSaving(false); }
  }

  async function persistImageOrder(nextImages: ProductImage[]) {
    if (!product) return;
    const previous = product.images;
    const ordered = nextImages.map((image, position) => ({ ...image, position }));
    if (ordered.map((image) => image.id).join() === sortProductImages(previous).map((image) => image.id).join()) return;
    setProduct((current) => current ? { ...current, images: ordered } : current);
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/images/reorder/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_ids: ordered.map((image) => image.id) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(apiErrorMessage(data, t("product.reorderFailed")));
      }
      setFeedback(t("product.reordered"));
    } catch (cause) {
      setProduct((current) => current ? { ...current, images: previous } : current);
      setError(cause instanceof Error ? cause.message : t("product.reorderFailed"));
    } finally {
      setSaving(false);
    }
  }

  function moveImageBy(imageId: number, delta: number) {
    if (!product) return;
    const images = sortProductImages(product.images);
    const from = images.findIndex((image) => image.id === imageId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= images.length) return;
    void persistImageOrder(moveImageInList(images, imageId, images[to].id));
  }

  function onImageDragStart(event: DragEvent<HTMLElement>, imageId: number) {
    if (saving) {
      event.preventDefault();
      return;
    }
    dragImageIdRef.current = imageId;
    setDragImageId(imageId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(imageId));
  }

  function onImageDragOver(event: DragEvent<HTMLElement>, imageId: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetId !== imageId) setDropTargetId(imageId);
  }

  function onImageDrop(event: DragEvent<HTMLElement>, imageId: number) {
    event.preventDefault();
    const fromId = dragImageIdRef.current ?? Number(event.dataTransfer.getData("text/plain"));
    setDragImageId(null);
    setDropTargetId(null);
    dragImageIdRef.current = null;
    if (!product || !fromId) return;
    void persistImageOrder(moveImageInList(product.images, fromId, imageId));
  }

  function onImageDragEnd() {
    dragImageIdRef.current = null;
    setDragImageId(null);
    setDropTargetId(null);
  }

  async function generateImage(imageId: number) {
    if (product?.status !== "approved") {
      setError("Image generation is available after the product is approved.");
      return;
    }
    const image = product?.images.find((item) => item.id === imageId);
    if (isImageGenerationInProgress(image)) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/images/${imageId}/process/`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Image generation could not be started.");
      setFeedback("Image generation started and continues in the background."); await loadProduct();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Image generation could not be started."); }
    finally { setSaving(false); }
  }

  async function generateDescription() {
    if (descriptionGenerationInProgress) return;
    setGenerating(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/orchestrator/products/${productId}/ai-content/generate/`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ targets: listingTargets }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "AI generation could not be started.");
      const newGeneration = data as Generation;
      setGeneration(newGeneration);
      window.localStorage.setItem(generationStorageKey(productId), newGeneration.id);
      setFeedback("Description generation started and continues in the background.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI generation could not be started."); }
    finally { setGenerating(false); }
  }

  async function refreshGeneration() {
    if (!generation) return;
    setGenerating(true); setError("");
    try {
      const response = await authorizedFetch(`/api/v1/orchestrator/ai-content/generations/${generation.id}/`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to check generation status.");
      const updatedGeneration = data as Generation;
      setGeneration(updatedGeneration);
      if (updatedGeneration.status === "failed") {
        window.localStorage.removeItem(generationStorageKey(productId));
      }
      if (data.status === "succeeded") setFeedback(t("product.aiReady"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to check generation status."); }
    finally { setGenerating(false); }
  }

  useEffect(() => {
    if (!descriptionGenerationInProgress && !imageGenerationInProgress) return;

    const poll = () => {
      if (descriptionGenerationInProgress) void refreshGeneration();
      if (imageGenerationInProgress) void loadProduct({ silent: true });
    };
    const intervalId = window.setInterval(poll, 4000);
    return () => window.clearInterval(intervalId);
  // The polling lifecycle intentionally follows task status, not recreated local request functions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptionGenerationInProgress, imageGenerationInProgress, generation?.id]);

  if (loading) return <section className="content products-page"><p className="products-message">{t("product.loading")}</p></section>;
  if (error && !product) return <section className="content products-page"><p className="products-message error">{error}</p><Link className="back-link" href="/manager/products">{t("product.backToList")}</Link></section>;
  if (!product || !form) return null;
  const sellerEur = sellerPriceEur(product);
  const previouslyRejected = product.status === "submitted" && product.last_moderation_decision === "rejected";

  return <><section className="content product-workspace">
    <header className="topbar"><div><p className="eyebrow">{t("product.workspace")}</p><h1>{product.title}</h1><p className="products-subtitle">{t("product.updated", { id: product.id, date: formatDate(product.updated_at, true) })}</p>{product.seller ? <p className="products-subtitle">{t("product.createdBy", { name: product.seller.username })}{product.seller.first_name ? ` · ${product.seller.first_name}` : ""}{product.seller.email ? ` · ${product.seller.email}` : ""}</p> : null}</div><div className="topbar-actions"><Link className="back-link" href="/manager/products">{t("product.back")}</Link></div></header>
    {error && <p className="form-feedback error" role="alert">{error}</p>}{feedback && <p className="form-feedback success">{feedback}</p>}
    {(descriptionGenerationInProgress || activeImageGenerationStatus) && <section className="workspace-card background-tasks-card"><div><p className="eyebrow">{t("product.background")}</p><h2>{t("product.backgroundTitle")}</h2><p>{t("product.backgroundHint")}</p></div>{descriptionGenerationInProgress && generation && <BackgroundProgress label={t("product.descGeneration")} status={generation.status} />}{activeImageGenerationStatus && <BackgroundProgress label={t("product.imageGeneration")} status={activeImageGenerationStatus} />}</section>}
    <section className="workspace-summary"><article><span>{t("product.statusEyebrow")}</span><strong className={`manager-status ${product.status}`}>{t(`status.${product.status}` as MessageKey)}</strong>{previouslyRejected ? <small className="previous-decision">{t("products.previouslyRejected")}</small> : null}</article><article><span>{t("product.stock")}</span><strong>{t("products.pcs", { count: product.total_quantity })}</strong></article><article><span>{t("product.sellerPrice")}</span><strong>{formatMoney(product.unit_price, product.currency)}{sellerEur ? ` (${sellerEur})` : ""}</strong></article><article><span>{t("product.listingEur")}</span><strong>{product.listing_price_eur ? formatMoney(product.listing_price_eur, "EUR") : "—"}</strong></article></section>
    <section className="workspace-summary workspace-ean"><article><span>EAN JV</span><strong>{product.ean_jv?.trim() || "—"}</strong></article><article><span>EAN XL</span><strong>{product.ean_xl?.trim() || "—"}</strong></article></section>
    <div className="product-toolbar"><div className="availability-action"><button type="button" className="ask-availability-button" disabled={saving || product.status !== "approved"} title={product.status !== "approved" ? t("product.askAvailabilityHint") : undefined} onClick={() => void requestAvailability()}>{t("product.askAvailability")}</button>{product.availability_reminder_sent_at ? <small>{t("product.lastRequest", { date: formatDate(product.availability_reminder_sent_at, true) })}</small> : null}{product.availability_confirmed_at ? <small>{t("product.lastResponse")} <span className={product.is_available ? "availability-yes" : "availability-no"}>{product.is_available ? t("common.yes") : t("common.no")}</span>, {formatDate(product.availability_confirmed_at, true)}</small> : null}</div><button type="button" className="history-button" onClick={() => { setHistoryOpen(true); void loadHistory(1); }}>{t("product.history")}</button></div>
    {sellerWithdrew && <section className="workspace-card withdrawal-card"><div><p className="eyebrow">{t("product.withdrawal")}</p><h2>{t("product.withdrawnTitle")}</h2><p>{t("product.withdrawnHint")}</p></div></section>}
    {product.status === "rejected" && !sellerWithdrew && <section className="workspace-card rejection-card"><div><p className="eyebrow">{t("product.rejection")}</p><h2>{t("product.rejectedTitle")}</h2><p>{latestRejection?.comment?.trim() || t("product.noRejectReason")}</p></div></section>}
    {pendingEntries.length > 0 && <section className="workspace-card pending-changes-card"><div><p className="eyebrow">{t("product.pendingChanges")}</p><h2>{t("product.pendingTitle")}</h2><p>{t("product.pendingHint")}</p></div><dl className="pending-changes-list">{pendingEntries.map(([field, value]) => <div key={field}><dt>{field}</dt><dd><small title={t("product.pendingOld")}>{currentFieldValue(product, field)}</small><strong title={t("product.pendingNew")}>{formatChangeValue(value)}</strong></dd></div>)}</dl><button className="approve-button" disabled={saving} onClick={() => void approveSellerChanges()}>{saving ? t("product.saving") : t("product.approveChanges")}</button></section>}
    {canModerate && <section className="workspace-card moderation-card"><div><p className="eyebrow">{t("product.moderation")}</p><h2>{t("product.reviewTitle")}</h2><p>{t("product.reviewHint")}</p></div><div className="moderation-actions"><button className="approve-button" disabled={saving} onClick={() => void moderate("approve")}>{t("product.approve")}</button><input value={rejectComment} onChange={(event) => setRejectComment(event.target.value)} placeholder={t("product.rejectReason")} /><button className="reject-button" disabled={saving} onClick={() => void moderate("reject")}>{t("product.reject")}</button></div></section>}
    {canChangeApprovedStatus && <section className="workspace-card moderation-card"><div><p className="eyebrow">{t("product.statusEyebrow")}</p><h2>{t("product.changeStatus")}</h2><p>{t("product.changeStatusHintBefore")}<Link href="/manager/marketplaces">{t("nav.marketplaces")}</Link>{t("product.changeStatusHintAfter")}</p></div><div className="moderation-actions"><button className="approve-button" disabled={saving} onClick={() => void changeApprovedStatus("submitted")}>{t("product.returnToReview")}</button><input value={rejectComment} onChange={(event) => setRejectComment(event.target.value)} placeholder={t("product.rejectReason")} /><button className="reject-button" disabled={saving} onClick={() => void changeApprovedStatus("rejected")}>{t("product.reject")}</button></div></section>}
    <section className="workspace-card image-gallery-card">
      <div className="image-gallery-heading">
        <div>
          <p className="eyebrow">{t("product.images")}</p>
          <h2>{t("product.imagesTitle")}</h2>
          <p>{t("product.imagesHint")}</p>
        </div>
        <label className="upload-image-button">{t("product.addImage")}<input accept="image/jpeg,image/png,image/webp" disabled={saving} type="file" onChange={(event) => void uploadImage(event)} /></label>
      </div>
      <div className="image-gallery-layout">
        <div className="image-gallery-viewer">
          <div className="image-gallery-stage">
            {selectedGalleryItem ? <>
              <img src={selectedGalleryItem.url} alt={selectedGalleryItem.label} />
              {selectedGalleryItem.generated && <span className="ai-badge">{t("product.aiGenerated")}</span>}
              {galleryItems.length > 1 && <>
                <button type="button" className="image-gallery-nav prev" aria-label={t("product.prevImage")} onClick={() => stepGallery(-1)}>‹</button>
                <button type="button" className="image-gallery-nav next" aria-label={t("product.nextImage")} onClick={() => stepGallery(1)}>›</button>
              </>}
            </> : <p className="image-gallery-empty">{t("product.noImages")}</p>}
          </div>
          {selectedGalleryItem && <div className="image-gallery-meta">
            <strong>{selectedGalleryItem.label}</strong>
            <span>{selectedImageIndex + 1} / {galleryItems.length}</span>
<<<<<<< Updated upstream
            {selectedGalleryItem.sourceImageId && !selectedGalleryItem.isPrimary ? (
              <button type="button" className="image-make-primary" disabled={saving} onClick={() => void makeImagePrimary(selectedGalleryItem.sourceImageId!)}>{t("product.makePrimary")}</button>
            ) : null}
=======
>>>>>>> Stashed changes
            <a href={selectedGalleryItem.url} target="_blank" rel="noreferrer">{t("product.openTab")}</a>
          </div>}
          {galleryItems.length > 1 && <div className="image-gallery-thumbs">
            {galleryItems.map((item, index) => <button key={item.key} type="button" className={`${index === selectedImageIndex ? "is-active" : ""}${item.isPrimary ? " is-primary" : ""}`} title={item.label} onClick={() => setSelectedImageKey(item.key)}><img src={item.url} alt={item.label} />{item.isPrimary && <span className="image-cover-dot" aria-hidden="true" />}{item.generated && <span className="ai-badge">AI</span>}</button>)}
          </div>}
        </div>
        <div className="image-workspace-list">
          {product.images.length === 0 && <p>{t("product.noSourceImages")}</p>}
          {product.images.length > 1 && <p className="image-order-hint">{t("product.reorderHint")}</p>}
          {sortProductImages(product.images).map((image, index) => {
            const canReorder = product.images.length > 1;
            return (
              <article
                key={image.id}
                className={`${image.is_primary ? "is-primary" : ""}${dragImageId === image.id ? " is-dragging" : ""}${dropTargetId === image.id && dragImageId !== image.id ? " is-drop-target" : ""}`}
                onDragOver={(event) => onImageDragOver(event, image.id)}
                onDrop={(event) => onImageDrop(event, image.id)}
                onDragEnd={onImageDragEnd}
              >
                {canReorder && (
                  <div className="image-order-rail">
                    <span
                      className="image-drag-handle"
                      title={t("product.dragToReorder")}
                      aria-hidden="true"
                      draggable
                      onDragStart={(event) => onImageDragStart(event, image.id)}
                    ><span /><span /><span /></span>
                    <div className="image-order-buttons">
                      <button type="button" disabled={saving || index === 0} aria-label={t("product.moveUp")} onClick={() => moveImageBy(image.id, -1)}>↑</button>
                      <button type="button" disabled={saving || index === product.images.length - 1} aria-label={t("product.moveDown")} onClick={() => moveImageBy(image.id, 1)}>↓</button>
                    </div>
                  </div>
                )}
                <button type="button" className="image-preview-thumb" onClick={() => setSelectedImageKey(`source-${image.id}`)}>
                  <img src={image.image} alt="" />
                  <span className="image-order-index">{index + 1}</span>
                </button>
                <div>
                  <strong>{image.is_primary ? t("product.primaryImage") : t("product.sourceImage")}</strong>
                  <small>{image.processing_status === "idle" ? t("product.notGenerated") : image.processing_status.replaceAll("_", " ")}</small>
                  {image.processing_error && <small className="image-error">{image.processing_error}</small>}
                  {image.generated_images.length > 0 && <div className="generated-thumbs">
<<<<<<< Updated upstream
                    {image.generated_images.map((generated) => <button key={generated.id} type="button" title={`${t("product.aiGenerated")} · ${t(`mode.${generated.mode}` as MessageKey)}`} onClick={() => setSelectedImageKey(`generated-${generated.id}`)}><img src={generated.image} alt={generated.mode} /><span className="ai-badge">AI</span></button>)}
                  </div>}
                  <div className="image-row-actions">
                    {image.is_primary
                      ? <span className="image-primary-pill">{t("product.coverBadge")}</span>
                      : <button type="button" className="image-make-primary" disabled={saving} onClick={() => void makeImagePrimary(image.id)}>{t("product.makePrimary")}</button>}
                    <button disabled={saving || product.status !== "approved" || isImageGenerationInProgress(image)} onClick={() => void generateImage(image.id)}>{isImageGenerationInProgress(image) ? t("product.generating") : product.status !== "approved" ? t("product.generateAfterApprove") : image.generated_images.length ? t("product.generateAgain") : t("product.generateImage")}</button>
=======
                    {image.generated_images.map((generated) => (
                      <div key={generated.id} className="generated-thumb">
                        <button type="button" className="generated-open" title={`${t("product.aiGenerated")} · ${t(`mode.${generated.mode}` as MessageKey)}`} onClick={() => setSelectedImageKey(`generated-${generated.id}`)}>
                          <img src={generated.image} alt={generated.mode} />
                        </button>
                      </div>
                    ))}
                  </div>}
                  <div className="image-row-actions">
                    {image.is_primary ? <span className="image-primary-pill">{t("product.coverBadge")}</span> : null}
                    {image.is_primary ? (
                      <button disabled={saving || product.status !== "approved" || isImageGenerationInProgress(image)} onClick={() => void generateImage(image.id)}>{isImageGenerationInProgress(image) ? t("product.generating") : product.status !== "approved" ? t("product.generateAfterApprove") : image.generated_images.length ? t("product.generateAgain") : t("product.generateImage")}</button>
                    ) : (
                      <small>{t("product.generateCoverOnly")}</small>
                    )}
>>>>>>> Stashed changes
                    <button className="image-delete-button" disabled={saving || isImageGenerationInProgress(image)} onClick={() => void deleteImage(image.id)}>{t("product.delete")}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
    <div className="workspace-grid"><form className="workspace-card product-edit-form" onSubmit={saveProduct}><div><p className="eyebrow">{t("product.data")}</p><h2>{t("product.edit")}</h2><p>{t("product.editHint")}</p></div><label>{t("product.fieldTitle")}<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>{t("product.fieldType")}<input required value={form.product_type} onChange={(event) => setForm({ ...form, product_type: event.target.value })} /></label><div className="form-price-block"><button type="button" className="price-calc-hint" onClick={() => setPriceHelpOpen(true)}>{t("product.changeFormula")}</button><div className="form-two-columns form-price-fields"><label>{t("product.sellerUnitPrice")}<input required min="0.01" step="0.01" type="number" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} /></label><label>{t("product.currency")}<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as Product["currency"] })}><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label><label>{t("product.listingPrice")}<input min="0.01" step="0.01" type="number" value={form.listing_price_eur} placeholder={product.listing_price_eur ? undefined : t("product.waitingRate")} onChange={(event) => setForm({ ...form, listing_price_eur: event.target.value })} /></label></div>{product.pricing_formula?.uses_product_formula ? <small className="price-calc-hint">{t("product.customFormula")}</small> : null}{product.pricing_formula?.uses_manual_listing ? <small className="price-calc-hint">{t("product.manualListing")}</small> : null}</div><p>{t("product.warehouse", { city: product.warehouse_city ? (warehouseLabels[product.warehouse_city] ?? product.warehouse_city) : "—" })}</p><h3>{t("product.variants", { count: totalQuantity })}</h3>{form.variants.map((variant, index) => <div className="variant-editor" key={variant.id || index}><label>{t("product.colour")}<input required value={variant.color_hex} onChange={(event) => updateVariant(index, "color_hex", event.target.value)} /></label><label>{t("product.materials")}<input required value={variant.materials.join(", ")} onChange={(event) => updateVariant(index, "materials", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label><label>{t("product.length")}<input required type="number" min="0" value={variant.length_cm} onChange={(event) => updateVariant(index, "length_cm", event.target.value)} /></label><label>{t("product.width")}<input required type="number" min="0" value={variant.width_cm} onChange={(event) => updateVariant(index, "width_cm", event.target.value)} /></label><label>{t("product.height")}<input required type="number" min="0" value={variant.height_cm} onChange={(event) => updateVariant(index, "height_cm", event.target.value)} /></label><label>{t("product.quantity")}<input required type="number" min="0" value={variant.quantity} onChange={(event) => updateVariant(index, "quantity", event.target.value)} /></label></div>)}<button className="save-button" disabled={saving} type="submit">{saving ? t("product.saving") : t("product.saveChanges")}</button></form>
      <aside className="workspace-side"><section className="workspace-card">
        <p className="eyebrow">{t("product.ai")}</p>
        <h2>{t("product.aiTitle")}</h2>
        <p>{t("product.aiHint")}</p>
        <button className="ai-button" disabled={generating || descriptionGenerationInProgress} onClick={() => void generateDescription()}>{generating ? t("product.starting") : descriptionGenerationInProgress ? t("product.generating") : t("product.generateDescription")}</button>
        {generation && <div className="generation-status"><strong>{t("product.generationStatus", { status: generation.status.replaceAll("_", " ") })}</strong><button disabled={generating} onClick={() => void refreshGeneration()}>{t("product.refreshStatus")}</button>{generation.status === "succeeded" && <Link href={`/manager/products/${product.id}/listings`}>{t("listing.openPage")}</Link>}</div>}
        {generation?.status === "failed" && <p className="ai-draft-error">{generation.error?.detail || generation.error?.code || t("product.generationFailed")}</p>}
        {generationContent && draftForm && <form className="ai-draft" onSubmit={saveDraft}>
          <span className="ai-draft-heading">{t("product.draftHeading")}</span>
          <label className="ai-draft-field"><span>{t("product.draftTitle")}</span><input required maxLength={100} value={draftForm.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
          <label className="ai-draft-field"><span>{t("product.draftDescription")}</span><textarea required rows={9} value={draftForm.description} onChange={(event) => updateDraft("description", event.target.value)} /></label>
          <label className="ai-draft-field"><span>{t("product.draftBullets")}</span><textarea required rows={5} value={draftForm.bullets} onChange={(event) => updateDraft("bullets", event.target.value)} /></label>
          <small className="ai-draft-hint">{t("product.draftHint")}</small>
          <button className="save-button" type="submit" disabled={draftSaving || !draftDirty}>{draftSaving ? t("product.saving") : draftDirty ? t("product.saveDraft") : t("product.draftSaved")}</button>
          <button type="button" className="ai-apply-button" disabled={applying || draftDirty || draftSaving} onClick={() => void applyDraft()}>{applying ? t("listing.applying") : t("listing.apply")}</button>
          <small className="ai-draft-hint">{t("listing.applyHint")}</small>
        </form>}
      </section>
      <section className="workspace-card listing-prep-card">
        <p className="eyebrow">{t("listing.eyebrow")}</p>
        <h2>{t("listing.prepTitle")}</h2>
        <p>{t("listing.prepHint")}</p>
        <Link className="listing-open-marketplaces" href={`/manager/products/${product.id}/listings`}>{t("listing.openPage")}</Link>
        <Link className="listing-open-marketplaces" href={`/manager/marketplaces?product=${product.id}`}>{t("product.openMarketplaces")}</Link>
      </section>
      </aside></div>
  </section>{priceHelpOpen && product.pricing_formula ? <FormulaEditorDialog formula={product.pricing_formula} saving={saving} onClose={() => setPriceHelpOpen(false)} onSave={(overrides) => void saveProductFormula(overrides)} onReset={() => void resetProductFormula()} /> : null}
    {historyOpen ? <div className="price-help-overlay" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={() => setHistoryOpen(false)}>
      <div className="price-help-dialog history-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="price-help-heading">
          <h2 id="history-title">{t("product.history")}</h2>
          <button type="button" className="price-calc-hint" onClick={() => setHistoryOpen(false)}>{t("common.close")}</button>
        </div>
        <p>{t("product.historyIntro")}</p>
        {historyError && <p className="form-feedback error" role="alert">{historyError}</p>}
        {!historyError && historyCount === 0 && !historyLoading && <p>{t("product.historyEmpty")}</p>}
        {!historyError && historyCount > 0 && (
          <nav className="pagination" aria-label={t("product.historyPages")}>
            <button type="button" disabled={historyLoading || historyPage <= 1} onClick={() => void loadHistory(historyPage - 1)}>{t("common.previous")}</button>
            <span>{t("common.page", { page: historyPage })}</span>
            <button type="button" disabled={historyLoading || historyPage >= Math.ceil(historyCount / HISTORY_PAGE_SIZE)} onClick={() => void loadHistory(historyPage + 1)}>{t("common.next")}</button>
          </nav>
        )}
        {!historyError && history.length > 0 && (
          <ol className="history-list">
            {history.map((item) => (
              <li key={item.id}>
                <strong className={`manager-status ${item.decision}`}>{t(`status.${item.decision}` as MessageKey)}</strong>
                <span>{formatDate(item.created_at, true)} · {item.decision === "withdrawn" ? t("product.historySeller") : item.manager_username}</span>
                {item.decision === "withdrawn"
                  ? <p>{t("product.historyWithdrawnComment")}</p>
                  : item.comment ? <p>{item.comment}</p> : <p>{t("product.noComment")}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div> : null}
  </>;
}
