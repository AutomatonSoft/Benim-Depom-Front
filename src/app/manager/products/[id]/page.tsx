"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import Sidebar from "@/components/Sidebar";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";

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
  seller?: { id: number; username: string; first_name: string; email: string };
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
  result: { universal?: { model?: string; content?: GenerationContent } } | null;
  error: { code?: string; detail?: string } | null;
};

type GalleryItem = { key: string; url: string; label: string; generated: boolean };

type DraftForm = { title: string; description: string; bullets: string };

const generatedModeLabels: Record<string, string> = {
  white: "White background",
  interior: "Interior",
  human: "Human",
};

const statusLabels: Record<string, string> = {
  draft: "Draft", submitted: "Awaiting review",
  approved: "Approved", rejected: "Rejected", deactivated: "Deactivated",
};

const defaultTargets = [
  { marketplace: "otto", account: "jv" }, { marketplace: "otto", account: "xl" },
  { marketplace: "hood", account: "jv" }, { marketplace: "hood", account: "xl" },
  { marketplace: "kaufland", account: "jv" }, { marketplace: "kaufland", account: "xl" },
];

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
          <h2 id="price-help-title">Startpreis formula</h2>
          <button type="button" className="price-calc-hint" onClick={onClose}>Close</button>
        </div>
        <p>These values apply only to this product. Saving recalculates listing EUR and does not change the global catalog.</p>
        <p className="price-help-formula">
          Listing EUR = round to .49 or .99 of<br />
          (purchase in EUR + city tariff × CBM + DE delivery) × (1 + margin + advertising + VAT)
        </p>
        <h3>Percentages</h3>
        <div className="formula-percent-grid">
          <label>Margin (0.75 = 75%)<input required step="0.01" min="0" type="number" value={String(draft.margin)} onChange={(event) => setField("margin", event.target.value)} /></label>
          <label>Advertising (0.19 = 19%)<input required step="0.01" min="0" type="number" value={String(draft.adv_fee)} onChange={(event) => setField("adv_fee", event.target.value)} /></label>
          <label>VAT (0.19 = 19%)<input required step="0.01" min="0" type="number" value={String(draft.vat)} onChange={(event) => setField("vat", event.target.value)} /></label>
        </div>
        <h3>EUR rates (how many units per 1 €)</h3>
        <div className="form-two-columns">
          <label>TRY per EUR<input step="0.0001" min="0.0001" type="number" value={String(draft.eur_to_try ?? "")} onChange={(event) => setField("eur_to_try", event.target.value)} /></label>
          <label>USD per EUR<input step="0.0001" min="0.0001" type="number" value={String(draft.eur_to_usd ?? "")} onChange={(event) => setField("eur_to_usd", event.target.value)} /></label>
        </div>
        <h3>City tariffs € / m³</h3>
        <div className="formula-city-grid">
          {cityOrder.map((city) => (
            <label key={city}>{warehouseLabels[city]}<input required step="0.01" min="0" type="number" value={String(draft.city_tariffs_eur_per_cbm[city] ?? "")} onChange={(event) => setCity(city, event.target.value)} /></label>
          ))}
        </div>
        <h3>DE delivery by volume</h3>
        {draft.de_size_tiers.map((tier, index) => (
          <div className="formula-tier-row" key={tier.code}>
            <strong>{tier.code}</strong>
            <label>From m³<input required step="0.001" min="0" type="number" value={String(tier.min_cbm)} onChange={(event) => setTier(index, "min_cbm", event.target.value)} /></label>
            <label>To m³<input required step="0.001" min="0" type="number" value={String(tier.max_cbm)} onChange={(event) => setTier(index, "max_cbm", event.target.value)} /></label>
            <label>Price €<input required step="0.01" min="0" type="number" value={String(tier.price_eur)} onChange={(event) => setTier(index, "price_eur", event.target.value)} /></label>
          </div>
        ))}
        <div className="price-help-actions">
          <button type="button" className="price-calc-hint" disabled={saving} onClick={onReset}>Use default formula</button>
          <button className="save-button" disabled={saving} type="submit">{saving ? "Saving..." : "Save for this product"}</button>
        </div>
      </form>
    </div>
  );
}

function toForm(product: Product): FormState {
  return {
    title: product.title,
    product_type: product.product_type,
    unit_price: product.unit_price,
    currency: product.currency,
    listing_price_eur: product.listing_price_eur ?? "",
    variants: product.variants.map((variant) => ({ ...variant, materials: [...variant.materials] })),
  };
}

export default function ProductWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
  const [priceHelpOpen, setPriceHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ModerationDecision[]>([]);
  const [historyError, setHistoryError] = useState("");

  const canModerate = product?.status === "submitted";
  const latestRejection = history.find((item) => item.decision === "rejected");
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
    for (const image of product.images) {
      items.push({ key: `source-${image.id}`, url: image.image, label: image.is_primary ? "Primary image" : "Source image", generated: false });
      if (image.processed_image) items.push({ key: `processed-${image.id}`, url: image.processed_image, label: "Processed image", generated: true });
      for (const generated of image.generated_images) {
        items.push({ key: `generated-${generated.id}`, url: generated.image, label: `Generated · ${generatedModeLabels[generated.mode] ?? generated.mode}`, generated: true });
      }
    }
    return items;
  }, [product]);
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
      setFeedback("AI draft saved. Applying it from Marketplaces will use your edited text.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Draft could not be saved."); }
    finally { setDraftSaving(false); }
  }

  async function loadProduct(options?: { silent?: boolean }) {
    if (!Number.isInteger(productId) || productId < 1) return;
    if (!options?.silent) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/`);
      if (response.status === 401) return void router.replace("/manager/login");
      if (response.status === 404) throw new Error("Product was not found.");
      if (!response.ok) throw new Error("Unable to load product.");
      const data = await response.json() as Product;
      setProduct(data);
      if (!options?.silent) setForm(toForm(data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load product.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }

  async function loadHistory() {
    if (!Number.isInteger(productId) || productId < 1) return;
    setHistoryError("");
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/moderation-history/`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setHistory(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setHistoryError("Unable to load moderation history.");
      setHistory([]);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem("benim_access_token")) return void router.replace("/manager/login");

    async function loadInitialProduct() {
      try {
        const response = await authorizedFetch(`/api/v1/products/${productId}/`);
        if (response.status === 401) return void router.replace("/manager/login");
        if (response.status === 404) throw new Error("Product was not found.");
        if (!response.ok) throw new Error("Unable to load product.");
        const data = await response.json() as Product;
        setProduct(data);
        setForm(toForm(data));
        try {
          const historyResponse = await authorizedFetch(`/api/v1/products/${productId}/moderation-history/`);
          if (!historyResponse.ok) throw new Error();
          const historyData = await historyResponse.json();
          setHistory(Array.isArray(historyData) ? historyData : historyData.results ?? []);
          setHistoryError("");
        } catch {
          setHistoryError("Unable to load moderation history.");
          setHistory([]);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load product.");
      } finally {
        setLoading(false);
      }
    }

    void loadInitialProduct();
  }, [productId, router]);

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
        body: JSON.stringify(action === "reject" ? { comment: rejectComment.trim() } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(data, `Product could not be ${action}d.`));
      setProduct(data as Product); setForm(toForm(data as Product)); setFeedback(action === "approve" ? "Product approved and EANs assigned." : "Product rejected. The seller will receive the reason.");
      await loadHistory();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Moderation action failed."); }
    finally { setSaving(false); }
  }

  async function requestAvailability() {
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/manager/products/${productId}/availability-request/`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(data, "Availability request could not be sent."));
<<<<<<< Updated upstream
      setProduct(data as Product);
=======
      const sentAt =
        typeof data.availability_reminder_sent_at === "string" && data.availability_reminder_sent_at
          ? data.availability_reminder_sent_at
          : new Date().toISOString();
      setProduct({ ...(data as Product), availability_reminder_sent_at: sentAt });
>>>>>>> Stashed changes
      setFeedback("Availability request sent to the seller.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Availability request could not be sent.");
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
    if (!window.confirm("Delete this image together with all its AI-generated variants?")) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/images/${imageId}/`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Image could not be deleted.");
      }
      setFeedback("Image deleted."); await loadProduct({ silent: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Image could not be deleted."); }
    finally { setSaving(false); }
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
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ targets: defaultTargets }),
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
      if (data.status === "succeeded") setFeedback("AI draft is ready. Review it below or open Marketplaces to apply it to listings.");
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

  if (loading) return <main className="app-shell"><Sidebar active="products" /><section className="content products-page"><p className="products-message">Loading product...</p></section></main>;
  if (error && !product) return <main className="app-shell"><Sidebar active="products" /><section className="content products-page"><p className="products-message error">{error}</p><Link className="back-link" href="/manager/products">← Back to products</Link></section></main>;
  if (!product || !form) return null;

  return <main className="app-shell"><Sidebar active="products" /><section className="content product-workspace">
    <header className="topbar"><div><p className="eyebrow">Product workspace</p><h1>{product.title}</h1><p className="products-subtitle">Product #{product.id} · last updated {formatDate(product.updated_at, true)}</p>{product.seller ? <p className="products-subtitle">Created by {product.seller.username}{product.seller.first_name ? ` · ${product.seller.first_name}` : ""}{product.seller.email ? ` · ${product.seller.email}` : ""}</p> : null}</div><div className="topbar-actions"><div className="availability-action"><button type="button" className="history-button" disabled={saving || product.status !== "approved"} title={product.status !== "approved" ? "Only approved products can receive an availability request." : undefined} onClick={() => void requestAvailability()}>Ask availability</button>{product.availability_reminder_sent_at ? <small>Last request: {formatDate(product.availability_reminder_sent_at, true)}</small> : null}</div><button type="button" className="history-button" onClick={() => { setHistoryOpen(true); void loadHistory(); }}>Moderation history</button><Link className="back-link" href="/manager/products">← Products</Link></div></header>
    {error && <p className="form-feedback error" role="alert">{error}</p>}{feedback && <p className="form-feedback success">{feedback}</p>}
    {(descriptionGenerationInProgress || activeImageGenerationStatus) && <section className="workspace-card background-tasks-card"><div><p className="eyebrow">Background tasks</p><h2>Generation continues in the background</h2><p>You can safely leave or refresh this page. The server keeps processing and this screen checks the saved task every four seconds.</p></div>{descriptionGenerationInProgress && generation && <BackgroundProgress label="Description generation" status={generation.status} />}{activeImageGenerationStatus && <BackgroundProgress label="Image generation" status={activeImageGenerationStatus} />}</section>}
    <section className="workspace-summary"><article><span>Status</span><strong className={`manager-status ${product.status}`}>{statusLabels[product.status] ?? product.status}</strong></article><article><span>Stock</span><strong>{product.total_quantity} pcs</strong></article><article><span>Seller price</span><strong>{formatMoney(product.unit_price, product.currency)}</strong></article><article><span>Listing EUR</span><strong>{product.listing_price_eur ? formatMoney(product.listing_price_eur, "EUR") : "—"}</strong></article></section>
    <section className="workspace-summary workspace-ean"><article><span>EAN JV</span><strong>{product.ean_jv?.trim() || "—"}</strong></article><article><span>EAN XL</span><strong>{product.ean_xl?.trim() || "—"}</strong></article></section>
    {product.currency !== "EUR" ? <p className="products-subtitle" role="note">{formatMoney(product.unit_price, product.currency)} → listing {product.listing_price_eur ? formatMoney(product.listing_price_eur, "EUR") : "not available until the daily euro rate is loaded"}.</p> : null}
    {product.status === "rejected" && <section className="workspace-card rejection-card"><div><p className="eyebrow">Rejection</p><h2>This product was rejected</h2><p>{latestRejection?.comment?.trim() || "No rejection reason was recorded."}</p></div></section>}
    {canModerate && <section className="workspace-card moderation-card"><div><p className="eyebrow">Moderation</p><h2>Review this seller submission</h2><p>Approve assigns EANs. Reject sends the seller your reason.</p></div><div className="moderation-actions"><button className="approve-button" disabled={saving} onClick={() => void moderate("approve")}>Approve product</button><input value={rejectComment} onChange={(event) => setRejectComment(event.target.value)} placeholder="Reason for rejection" /><button className="reject-button" disabled={saving} onClick={() => void moderate("reject")}>Reject</button></div></section>}
    <section className="workspace-card image-gallery-card">
      <div className="image-gallery-heading">
        <div>
          <p className="eyebrow">Images</p>
          <h2>Images & generation</h2>
          <p>Source and AI-generated images live here. Click a thumbnail to preview it, browse with the arrows, or open the full-size file in a new tab.</p>
        </div>
        <label className="upload-image-button">Add image<input accept="image/jpeg,image/png,image/webp" disabled={saving} type="file" onChange={(event) => void uploadImage(event)} /></label>
      </div>
      <div className="image-gallery-layout">
        <div className="image-gallery-viewer">
          <div className="image-gallery-stage">
            {selectedGalleryItem ? <>
              <img src={selectedGalleryItem.url} alt={selectedGalleryItem.label} />
              {selectedGalleryItem.generated && <span className="ai-badge">AI generated</span>}
              {galleryItems.length > 1 && <>
                <button type="button" className="image-gallery-nav prev" aria-label="Previous image" onClick={() => stepGallery(-1)}>‹</button>
                <button type="button" className="image-gallery-nav next" aria-label="Next image" onClick={() => stepGallery(1)}>›</button>
              </>}
            </> : <p className="image-gallery-empty">No images yet. Upload the first image to start.</p>}
          </div>
          {selectedGalleryItem && <div className="image-gallery-meta">
            <strong>{selectedGalleryItem.label}</strong>
            <span>{selectedImageIndex + 1} / {galleryItems.length}</span>
            <a href={selectedGalleryItem.url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
          </div>}
          {galleryItems.length > 1 && <div className="image-gallery-thumbs">
            {galleryItems.map((item, index) => <button key={item.key} type="button" className={index === selectedImageIndex ? "is-active" : ""} title={item.label} onClick={() => setSelectedImageKey(item.key)}><img src={item.url} alt={item.label} />{item.generated && <span className="ai-badge">AI</span>}</button>)}
          </div>}
        </div>
        <div className="image-workspace-list">
          {product.images.length === 0 && <p>No source images uploaded yet.</p>}
          {product.images.map((image) => <article key={image.id}>
            <img src={image.image} alt="Product" onClick={() => setSelectedImageKey(`source-${image.id}`)} />
            <div>
              <strong>{image.is_primary ? "Primary image" : "Source image"}</strong>
              <small>{image.processing_status === "idle" ? "Not generated" : image.processing_status.replaceAll("_", " ")}</small>
              {image.processing_error && <small className="image-error">{image.processing_error}</small>}
              {image.generated_images.length > 0 && <div className="generated-thumbs">
                {image.generated_images.map((generated) => <button key={generated.id} type="button" title={`Generated · ${generatedModeLabels[generated.mode] ?? generated.mode}`} onClick={() => setSelectedImageKey(`generated-${generated.id}`)}><img src={generated.image} alt={generated.mode} /><span className="ai-badge">AI</span></button>)}
              </div>}
              <div className="image-row-actions">
                <button disabled={saving || product.status !== "approved" || isImageGenerationInProgress(image)} onClick={() => void generateImage(image.id)}>{isImageGenerationInProgress(image) ? "Generating..." : product.status !== "approved" ? "Generate after approve" : image.generated_images.length ? "Generate again" : "Generate image"}</button>
                <button className="image-delete-button" disabled={saving || isImageGenerationInProgress(image)} onClick={() => void deleteImage(image.id)}>Delete</button>
              </div>
            </div>
          </article>)}
        </div>
      </div>
    </section>
    <div className="workspace-grid"><form className="workspace-card product-edit-form" onSubmit={saveProduct}><div><p className="eyebrow">Product data</p><h2>Edit product</h2><p>Changes are saved locally. Published listings are updated separately from Marketplaces.</p></div><label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Product type<input required value={form.product_type} onChange={(event) => setForm({ ...form, product_type: event.target.value })} /></label><div className="form-price-block"><button type="button" className="price-calc-hint" onClick={() => setPriceHelpOpen(true)}>Change formula</button><div className="form-two-columns form-price-fields"><label>Seller unit price<input required min="0.01" step="0.01" type="number" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} /></label><label>Currency<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as Product["currency"] })}><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label><label>Listing price (EUR)<input min="0.01" step="0.01" type="number" value={form.listing_price_eur} placeholder={product.listing_price_eur ? undefined : "Waiting for exchange rate"} onChange={(event) => setForm({ ...form, listing_price_eur: event.target.value })} /></label></div>{product.pricing_formula?.uses_product_formula ? <small className="price-calc-hint">This product uses a custom formula.</small> : null}{product.pricing_formula?.uses_manual_listing ? <small className="price-calc-hint">Listing EUR is a manual value for this product.</small> : null}</div><p>Warehouse: {product.warehouse_city ? (warehouseLabels[product.warehouse_city] ?? product.warehouse_city) : "—"}</p><h3>Variants · {totalQuantity} pcs total</h3>{form.variants.map((variant, index) => <div className="variant-editor" key={variant.id || index}><label>Colour<input required value={variant.color_hex} onChange={(event) => updateVariant(index, "color_hex", event.target.value)} /></label><label>Materials<input required value={variant.materials.join(", ")} onChange={(event) => updateVariant(index, "materials", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label><label>Length cm<input required type="number" min="0" value={variant.length_cm} onChange={(event) => updateVariant(index, "length_cm", event.target.value)} /></label><label>Width cm<input required type="number" min="0" value={variant.width_cm} onChange={(event) => updateVariant(index, "width_cm", event.target.value)} /></label><label>Height cm<input required type="number" min="0" value={variant.height_cm} onChange={(event) => updateVariant(index, "height_cm", event.target.value)} /></label><label>Quantity<input required type="number" min="0" value={variant.quantity} onChange={(event) => updateVariant(index, "quantity", event.target.value)} /></label></div>)}<button className="save-button" disabled={saving} type="submit">{saving ? "Saving..." : "Save changes"}</button></form>
      <aside className="workspace-side"><section className="workspace-card">
        <p className="eyebrow">AI content</p>
        <h2>Descriptions for marketplaces</h2>
        <p>Generates a reviewable draft for OTTO, Hood and Kaufland. It never overwrites listing text automatically.</p>
        <button className="ai-button" disabled={generating || descriptionGenerationInProgress} onClick={() => void generateDescription()}>{generating ? "Starting..." : descriptionGenerationInProgress ? "Generating..." : "Generate description"}</button>
        {generation && <div className="generation-status"><strong>Generation: {generation.status.replaceAll("_", " ")}</strong><button disabled={generating} onClick={() => void refreshGeneration()}>Refresh status</button>{generation.status === "succeeded" && <Link href="/manager/marketplaces">Review in Marketplaces →</Link>}</div>}
        {generation?.status === "failed" && <p className="ai-draft-error">{generation.error?.detail || generation.error?.code || "Generation failed. Try again."}</p>}
        {generationContent && draftForm && <form className="ai-draft" onSubmit={saveDraft}>
          <span className="ai-draft-heading">AI draft (German) · editable</span>
          <label className="ai-draft-field"><span>Title</span><input required maxLength={100} value={draftForm.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
          <label className="ai-draft-field"><span>Description</span><textarea required rows={9} value={draftForm.description} onChange={(event) => updateDraft("description", event.target.value)} /></label>
          <label className="ai-draft-field"><span>Bullet points · one per line</span><textarea required rows={5} value={draftForm.bullets} onChange={(event) => updateDraft("bullets", event.target.value)} /></label>
          <small className="ai-draft-hint">Title up to 100 characters. Description: two or three paragraphs separated by an empty line. Bullet points: three to five.</small>
          <button className="save-button" type="submit" disabled={draftSaving || !draftDirty}>{draftSaving ? "Saving..." : draftDirty ? "Save draft" : "Draft saved"}</button>
        </form>}
      </section><section className="workspace-card marketplace-next-step"><p className="eyebrow">Next step</p><h2>Marketplace listing</h2><p>Choose accounts, review marketplace-specific fields, then publish or update listings.</p><Link className="save-button" href="/manager/marketplaces">Open Marketplaces</Link></section></aside></div>
  </section>{priceHelpOpen && product.pricing_formula ? <FormulaEditorDialog formula={product.pricing_formula} saving={saving} onClose={() => setPriceHelpOpen(false)} onSave={(overrides) => void saveProductFormula(overrides)} onReset={() => void resetProductFormula()} /> : null}
    {historyOpen ? <div className="price-help-overlay" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={() => setHistoryOpen(false)}>
      <div className="price-help-dialog history-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="price-help-heading">
          <h2 id="history-title">Moderation history</h2>
          <button type="button" className="price-calc-hint" onClick={() => setHistoryOpen(false)}>Close</button>
        </div>
        <p>All approve and reject decisions for this product, newest first.</p>
        {historyError && <p className="form-feedback error" role="alert">{historyError}</p>}
        {!historyError && history.length === 0 && <p>No moderation decisions yet.</p>}
        <ol className="history-list">
          {history.map((item) => (
            <li key={item.id}>
              <strong className={`manager-status ${item.decision}`}>{statusLabels[item.decision] ?? item.decision}</strong>
              <span>{formatDate(item.created_at, true)} · {item.manager_username}</span>
              {item.comment ? <p>{item.comment}</p> : <p>No comment.</p>}
            </li>
          ))}
        </ol>
      </div>
    </div> : null}
  </main>;
}
