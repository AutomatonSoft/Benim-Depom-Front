"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  EmptyState,
  Feedback,
  PageFrame,
  PageHeader,
  Panel,
  PanelHeader,
  StatCard,
  StatusBadge,
} from "@/components/manager/ui";
import { ConfirmDialog } from "@/components/manager/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage, authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { listingTargetKey, listingTargets } from "@/lib/listings";
import { cn } from "@/lib/utils";
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
  generatedId?: number;
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

  return (
    <div className="grid gap-1.5 text-xs text-primary" aria-live="polite">
      <div className="flex justify-between gap-3">
        <span className="font-semibold text-muted-foreground">{label}</span>
        <strong className="capitalize">{isComplete ? "Ready" : isFailed ? "Failed" : normalizedStatus}</strong>
    </div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-secondary">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-300",
            isFailed ? "bg-[var(--ui-danger)]" : "bg-[var(--brand-accent)]",
            isActive && "animate-pulse",
          )}
          style={{ width }}
        />
      </span>
    </div>
  );
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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(20,47,85,0.45)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-help-title"
      onClick={onClose}
    >
      <form
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-[0_18px_48px_rgba(20,47,85,0.16)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
          <h2 id="price-help-title" className="text-lg font-extrabold text-primary">{t("formula.title")}</h2>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t("common.close")}</Button>
        </div>
        <p className="text-sm text-muted-foreground">{t("formula.intro")}</p>
        <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold leading-relaxed text-primary">
          {t("formula.listing")}<br />
          {t("formula.listingRest")}
        </p>
        <div className="mt-4 grid gap-5">
          <section className="grid gap-3">
            <h3 className="text-sm font-extrabold text-primary">{t("formula.percentages")}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>{t("formula.margin")}</Label>
                <Input required step="0.01" min="0" type="number" value={String(draft.margin)} onChange={(event) => setField("margin", event.target.value)} />
              </div>
              <div>
                <Label>{t("formula.advertising")}</Label>
                <Input required step="0.01" min="0" type="number" value={String(draft.adv_fee)} onChange={(event) => setField("adv_fee", event.target.value)} />
              </div>
              <div>
                <Label>{t("formula.vat")}</Label>
                <Input required step="0.01" min="0" type="number" value={String(draft.vat)} onChange={(event) => setField("vat", event.target.value)} />
              </div>
            </div>
          </section>
          <section className="grid gap-3">
            <h3 className="text-sm font-extrabold text-primary">{t("formula.rates")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("formula.try")}</Label>
                <Input step="0.0001" min="0.0001" type="number" value={String(draft.eur_to_try ?? "")} onChange={(event) => setField("eur_to_try", event.target.value)} />
              </div>
              <div>
                <Label>{t("formula.usd")}</Label>
                <Input step="0.0001" min="0.0001" type="number" value={String(draft.eur_to_usd ?? "")} onChange={(event) => setField("eur_to_usd", event.target.value)} />
              </div>
            </div>
          </section>
          <section className="grid gap-3">
            <h3 className="text-sm font-extrabold text-primary">{t("formula.cityTariffs")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {cityOrder.map((city) => (
                <div key={city}>
                  <Label>{warehouseLabels[city]}</Label>
                  <Input required step="0.01" min="0" type="number" value={String(draft.city_tariffs_eur_per_cbm[city] ?? "")} onChange={(event) => setCity(city, event.target.value)} />
                </div>
              ))}
            </div>
          </section>
          <section className="grid gap-3">
            <h3 className="text-sm font-extrabold text-primary">{t("formula.deDelivery")}</h3>
            <div className="grid gap-2">
              {draft.de_size_tiers.map((tier, index) => (
                <div className="grid gap-2 rounded-xl border border-border bg-[#f8fafc] p-3 sm:grid-cols-[56px_1fr_1fr_1fr] sm:items-end" key={tier.code}>
                  <strong className="text-sm font-extrabold text-primary">{tier.code}</strong>
                  <div>
                    <Label>{t("formula.from")}</Label>
                    <Input required step="0.001" min="0" type="number" value={String(tier.min_cbm)} onChange={(event) => setTier(index, "min_cbm", event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("formula.to")}</Label>
                    <Input required step="0.001" min="0" type="number" value={String(tier.max_cbm)} onChange={(event) => setTier(index, "max_cbm", event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("formula.price")}</Label>
                    <Input required step="0.01" min="0" type="number" value={String(tier.price_eur)} onChange={(event) => setTier(index, "price_eur", event.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" disabled={saving} onClick={onReset}>{t("formula.useDefault")}</Button>
          <Button disabled={saving} type="submit">{saving ? t("product.saving") : t("formula.save")}</Button>
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
  const [pendingDeleteImageId, setPendingDeleteImageId] = useState<number | null>(null);
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
      for (const generated of image.generated_images) {
        items.push({
          key: `generated-${generated.id}`,
          url: generated.image,
          label: `${t("product.aiGenerated")} · ${t(`mode.${generated.mode}` as MessageKey)}`,
          generated: true,
          sourceImageId: image.id,
          generatedId: generated.id,
        });
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
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/images/${imageId}/`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Image could not be deleted.");
      }
      setFeedback(t("product.imageDeleted"));
      setPendingDeleteImageId(null);
      await loadProduct({ silent: true });
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
    const image = product?.images.find((item) => item.id === imageId);
    if (product?.status !== "approved") {
      setError(t("product.imageGenAfterApprove"));
      return;
    }
    if (!image?.is_primary) {
      setError(t("product.generateCoverOnly"));
      return;
    }
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

  if (loading) {
    return (
      <PageFrame>
        <p className="text-sm font-semibold text-muted-foreground">{t("product.loading")}</p>
      </PageFrame>
    );
  }

  if (error && !product) {
    return (
      <PageFrame>
        <Feedback className="mb-4">{error}</Feedback>
        <Button asChild variant="secondary">
          <Link href="/manager/products">{t("product.backToList")}</Link>
        </Button>
      </PageFrame>
    );
  }

  if (!product || !form) return null;
  const sellerEur = sellerPriceEur(product);
  const previouslyRejected = product.status === "submitted" && product.last_moderation_decision === "rejected";

  return (
    <>
      <PageFrame>
        <PageHeader
          breadcrumbs={[
            { label: t("nav.products"), href: "/manager/products" },
            { label: `#${product.id}` },
          ]}
          eyebrow={t("product.workspace")}
          title={product.title}
          description={
            <div className="grid gap-1">
              <p>{t("product.updated", { id: product.id, date: formatDate(product.updated_at, true) })}</p>
              {product.seller ? (
                <p>
                  {t("product.createdBy", { name: product.seller.username })}
                  {product.seller.first_name ? ` · ${product.seller.first_name}` : ""}
                  {product.seller.email ? ` · ${product.seller.email}` : ""}
                </p>
              ) : null}
            </div>
          }
          secondaryActions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={product.status}>{t(`status.${product.status}` as MessageKey)}</StatusBadge>
              <Button asChild variant="secondary">
                <Link href="/manager/products">{t("product.back")}</Link>
              </Button>
            </div>
          }
        />

        {error ? <Feedback className="mb-3">{error}</Feedback> : null}
        {feedback ? <Feedback tone="success" className="mb-3">{feedback}</Feedback> : null}

        {(descriptionGenerationInProgress || activeImageGenerationStatus) ? (
          <Panel className="mb-4" padded>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">{t("product.background")}</p>
            <h2 className="text-lg font-extrabold text-primary">{t("product.backgroundTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("product.backgroundHint")}</p>
            <div className="mt-4 grid gap-3">
              {descriptionGenerationInProgress && generation ? (
                <BackgroundProgress label={t("product.descGeneration")} status={generation.status} />
              ) : null}
              {activeImageGenerationStatus ? (
                <BackgroundProgress label={t("product.imageGeneration")} status={activeImageGenerationStatus} />
              ) : null}
            </div>
          </Panel>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("product.statusEyebrow")}
            value={t(`status.${product.status}` as MessageKey)}
            hint={previouslyRejected ? t("products.previouslyRejected") : undefined}
          />
          <StatCard label={t("product.stock")} value={t("products.pcs", { count: product.total_quantity })} />
          <StatCard
            label={t("product.sellerPrice")}
            value={`${formatMoney(product.unit_price, product.currency)}${sellerEur ? ` (${sellerEur})` : ""}`}
          />
          <StatCard
            label={t("product.listingEur")}
            value={product.listing_price_eur ? formatMoney(product.listing_price_eur, "EUR") : "—"}
            tone="accent"
          />
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <StatCard label="EAN JV" value={product.ean_jv?.trim() || "—"} tone="navy" />
          <StatCard label="EAN XL" value={product.ean_xl?.trim() || "—"} tone="navy" />
        </div>

        <Panel className="mb-4" padded>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <Button
                type="button"
                variant="accent"
                disabled={saving || product.status !== "approved"}
                title={product.status !== "approved" ? t("product.askAvailabilityHint") : undefined}
                onClick={() => void requestAvailability()}
              >
                {t("product.askAvailability")}
              </Button>
              {product.availability_reminder_sent_at ? (
                <small className="text-xs font-semibold text-muted-foreground">
                  {t("product.lastRequest", { date: formatDate(product.availability_reminder_sent_at, true) })}
                </small>
              ) : null}
              {product.availability_confirmed_at ? (
                <small className="text-xs font-semibold text-muted-foreground">
                  {t("product.lastResponse")}{" "}
                  <span className={product.is_available ? "font-extrabold text-[var(--ui-success)]" : "font-extrabold text-[var(--ui-danger)]"}>
                    {product.is_available ? t("common.yes") : t("common.no")}
                  </span>
                  , {formatDate(product.availability_confirmed_at, true)}
                </small>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setHistoryOpen(true);
                void loadHistory(1);
              }}
            >
              {t("product.history")}
            </Button>
          </div>
        </Panel>

        {sellerWithdrew ? (
          <Panel className="mb-4 border-[rgba(247,148,29,0.35)] bg-gradient-to-b from-[#fffaf3] to-[#fff6ea]" padded>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">{t("product.withdrawal")}</p>
            <h2 className="text-lg font-extrabold text-primary">{t("product.withdrawnTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("product.withdrawnHint")}</p>
          </Panel>
        ) : null}

        {product.status === "rejected" && !sellerWithdrew ? (
          <Panel className="mb-4 border-[rgba(195,60,51,0.25)] bg-gradient-to-b from-[#fff7f6] to-[#ffefed]" padded>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ui-danger)]">{t("product.rejection")}</p>
            <h2 className="text-lg font-extrabold text-[var(--ui-danger)]">{t("product.rejectedTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{latestRejection?.comment?.trim() || t("product.noRejectReason")}</p>
          </Panel>
        ) : null}

        {pendingEntries.length > 0 ? (
          <Panel className="mb-4" padded>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">{t("product.pendingChanges")}</p>
            <h2 className="text-lg font-extrabold text-primary">{t("product.pendingTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("product.pendingHint")}</p>
            <dl className="mt-4 grid gap-3">
              {pendingEntries.map(([field, value]) => (
                <div key={field} className="rounded-xl border border-border bg-[#f8fafc] px-3 py-2.5">
                  <dt className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">{field}</dt>
                  <dd className="mt-1 grid gap-1 text-sm">
                    <small className="text-muted-foreground" title={t("product.pendingOld")}>{currentFieldValue(product, field)}</small>
                    <strong className="font-bold text-primary" title={t("product.pendingNew")}>{formatChangeValue(value)}</strong>
                  </dd>
                </div>
              ))}
            </dl>
            <Button className="mt-4" disabled={saving} onClick={() => void approveSellerChanges()}>
              {saving ? t("product.saving") : t("product.approveChanges")}
            </Button>
          </Panel>
        ) : null}

        {canModerate ? (
          <Panel className="mb-4" padded>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">{t("product.moderation")}</p>
            <h2 className="text-lg font-extrabold text-primary">{t("product.reviewTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("product.reviewHint")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button disabled={saving} onClick={() => void moderate("approve")}>{t("product.approve")}</Button>
              <Input
                className="min-w-[220px] flex-1"
                value={rejectComment}
                onChange={(event) => setRejectComment(event.target.value)}
                placeholder={t("product.rejectReason")}
              />
              <Button variant="destructive" disabled={saving} onClick={() => void moderate("reject")}>{t("product.reject")}</Button>
            </div>
          </Panel>
        ) : null}

        {canChangeApprovedStatus ? (
          <Panel className="mb-4" padded>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">{t("product.statusEyebrow")}</p>
            <h2 className="text-lg font-extrabold text-primary">{t("product.changeStatus")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("product.changeStatusHintBefore")}
              <Link className="font-bold text-[var(--brand-accent)] hover:underline" href="/manager/marketplaces">{t("nav.marketplaces")}</Link>
              {t("product.changeStatusHintAfter")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button disabled={saving} onClick={() => void changeApprovedStatus("submitted")}>{t("product.returnToReview")}</Button>
              <Input
                className="min-w-[220px] flex-1"
                value={rejectComment}
                onChange={(event) => setRejectComment(event.target.value)}
                placeholder={t("product.rejectReason")}
              />
              <Button variant="destructive" disabled={saving} onClick={() => void changeApprovedStatus("rejected")}>{t("product.reject")}</Button>
            </div>
          </Panel>
        ) : null}

        <Panel className="mb-4">
          <PanelHeader
            eyebrow={t("product.images")}
            title={t("product.imagesTitle")}
            actions={
              <label className="inline-flex h-10 cursor-pointer items-center rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-[#e4ebf4]">
                {t("product.addImage")}
                <input
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={saving}
                  type="file"
                  onChange={(event) => void uploadImage(event)}
                />
              </label>
            }
          />
          <div className="border-b border-border px-4 py-2 text-sm text-muted-foreground">{t("product.imagesHint")}</div>
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="grid gap-3">
              <div className="relative grid min-h-[280px] place-items-center overflow-hidden rounded-2xl border border-border bg-[#f3f6fa]">
                {selectedGalleryItem ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedGalleryItem.url} alt={selectedGalleryItem.label} className="max-h-[420px] w-full object-contain" />
                    {selectedGalleryItem.generated ? (
                      <span className="absolute left-3 top-3 rounded-lg bg-[var(--brand-accent)] px-2 py-1 text-[11px] font-extrabold text-white">
                        {t("product.aiGenerated")}
                      </span>
                    ) : null}
                    {galleryItems.length > 1 ? (
                      <>
                        <button
                          type="button"
                          className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
                          aria-label={t("product.prevImage")}
                          onClick={() => stepGallery(-1)}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
                          aria-label={t("product.nextImage")}
                          onClick={() => stepGallery(1)}
                        >
                          ›
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <EmptyState title={t("product.noImages")} />
                )}
              </div>
              {selectedGalleryItem ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <strong className="font-extrabold text-primary">{selectedGalleryItem.label}</strong>
                  <span className="text-muted-foreground">{selectedImageIndex + 1} / {galleryItems.length}</span>
                  <a className="font-bold text-[var(--brand-accent)] hover:underline" href={selectedGalleryItem.url} target="_blank" rel="noreferrer">
                    {t("product.openTab")}
                  </a>
                </div>
              ) : null}
              {galleryItems.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {galleryItems.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      title={item.label}
                      onClick={() => setSelectedImageKey(item.key)}
                      className={cn(
                        "relative size-16 overflow-hidden rounded-xl border-2",
                        index === selectedImageIndex ? "border-[var(--brand-accent)]" : "border-border",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.label} className="size-full object-cover" />
                      {item.isPrimary ? <span className="absolute right-1 top-1 size-2 rounded-full bg-[var(--brand-accent)]" aria-hidden="true" /> : null}
                      {item.generated ? (
                        <span className="absolute bottom-1 left-1 rounded bg-[var(--brand-accent)] px-1 text-[9px] font-extrabold text-white">AI</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 content-start">
              {product.images.length === 0 ? <p className="text-sm text-muted-foreground">{t("product.noSourceImages")}</p> : null}
              {product.images.length > 1 ? <p className="text-xs font-semibold text-muted-foreground">{t("product.reorderHint")}</p> : null}
              {sortProductImages(product.images).map((image, index) => {
                const canReorder = product.images.length > 1;
                return (
                  <article
                    key={image.id}
                    className={cn(
                      "flex gap-3 rounded-2xl border border-border bg-card p-3",
                      image.is_primary && "border-[rgba(247,148,29,0.45)] bg-gradient-to-b from-[#fffaf3] to-card",
                      dragImageId === image.id && "opacity-60",
                      dropTargetId === image.id && dragImageId !== image.id && "ring-2 ring-[var(--brand-accent)]",
                    )}
                    onDragOver={(event) => onImageDragOver(event, image.id)}
                    onDrop={(event) => onImageDrop(event, image.id)}
                    onDragEnd={onImageDragEnd}
                  >
                    {canReorder ? (
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="grid cursor-grab gap-0.5 px-1 py-2"
                          title={t("product.dragToReorder")}
                          aria-hidden="true"
                          draggable
                          onDragStart={(event) => onImageDragStart(event, image.id)}
                        >
                          <span className="block h-0.5 w-3 rounded bg-muted-foreground" />
                          <span className="block h-0.5 w-3 rounded bg-muted-foreground" />
                          <span className="block h-0.5 w-3 rounded bg-muted-foreground" />
                        </span>
                        <div className="grid gap-1">
                          <Button type="button" size="sm" variant="secondary" className="h-7 px-2" disabled={saving || index === 0} aria-label={t("product.moveUp")} onClick={() => moveImageBy(image.id, -1)}>↑</Button>
                          <Button type="button" size="sm" variant="secondary" className="h-7 px-2" disabled={saving || index === product.images.length - 1} aria-label={t("product.moveDown")} onClick={() => moveImageBy(image.id, 1)}>↓</Button>
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border"
                      onClick={() => setSelectedImageKey(`source-${image.id}`)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.image} alt="" className="size-full object-cover" />
                      <span className="absolute bottom-1 left-1 rounded bg-primary/80 px-1.5 text-[10px] font-bold text-white">{index + 1}</span>
                    </button>
                    <div className="min-w-0 flex-1 grid gap-1">
                      <strong className="text-sm font-extrabold text-primary">{image.is_primary ? t("product.primaryImage") : t("product.sourceImage")}</strong>
                      <small className="text-xs text-muted-foreground">
                        {image.processing_status === "idle" ? t("product.notGenerated") : image.processing_status.replaceAll("_", " ")}
                      </small>
                      {image.processing_error ? <small className="text-xs font-semibold text-[var(--ui-danger)]">{image.processing_error}</small> : null}
                      {image.generated_images.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {image.generated_images.map((generated) => (
                            <button
                              key={generated.id}
                              type="button"
                              className="size-11 overflow-hidden rounded-lg border border-border"
                              title={`${t("product.aiGenerated")} · ${t(`mode.${generated.mode}` as MessageKey)}`}
                              onClick={() => setSelectedImageKey(`generated-${generated.id}`)}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={generated.image} alt={generated.mode} className="size-full object-cover" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {image.is_primary ? (
                          <span className="rounded-lg bg-[var(--ui-warn-bg)] px-2 py-1 text-[11px] font-extrabold text-[var(--ui-warn)]">
                            {t("product.coverBadge")}
                          </span>
                        ) : null}
                        {image.is_primary ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={saving || product.status !== "approved" || isImageGenerationInProgress(image)}
                            onClick={() => void generateImage(image.id)}
                          >
                            {isImageGenerationInProgress(image)
                              ? t("product.generating")
                              : product.status !== "approved"
                                ? t("product.generateAfterApprove")
                                : image.generated_images.length
                                  ? t("product.generateAgain")
                                  : t("product.generateImage")}
                          </Button>
                        ) : (
                          <small className="text-xs text-muted-foreground">{t("product.generateCoverOnly")}</small>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={saving || isImageGenerationInProgress(image)}
                          onClick={() => setPendingDeleteImageId(image.id)}
                        >
                          {t("product.delete")}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <Panel padded>
            <form className="grid gap-4" onSubmit={saveProduct}>
        <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">{t("product.data")}</p>
                <h2 className="text-lg font-extrabold text-primary">{t("product.edit")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("product.editHint")}</p>
        </div>
              <div>
                <Label>{t("product.fieldTitle")}</Label>
                <Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      </div>
              <div>
                <Label>{t("product.fieldType")}</Label>
                <Input required value={form.product_type} onChange={(event) => setForm({ ...form, product_type: event.target.value })} />
          </div>
              <div className="grid gap-3 rounded-2xl border border-border bg-[#f8fafc] p-4">
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setPriceHelpOpen(true)}>
                  {t("product.changeFormula")}
                </Button>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>{t("product.sellerUnitPrice")}</Label>
                    <Input required min="0.01" step="0.01" type="number" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} />
        </div>
            <div>
                    <Label>{t("product.currency")}</Label>
                    <FilterSelect value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as Product["currency"] })}>
                      <option value="TRY">TRY</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </FilterSelect>
              </div>
                  <div>
                    <Label>{t("product.listingPrice")}</Label>
                    <Input
                      min="0.01"
                      step="0.01"
                      type="number"
                      value={form.listing_price_eur}
                      placeholder={product.listing_price_eur ? undefined : t("product.waitingRate")}
                      onChange={(event) => setForm({ ...form, listing_price_eur: event.target.value })}
                    />
            </div>
        </div>
                {product.pricing_formula?.uses_product_formula ? (
                  <small className="text-xs font-semibold text-[var(--brand-accent)]">{t("product.customFormula")}</small>
                ) : null}
                {product.pricing_formula?.uses_manual_listing ? (
                  <small className="text-xs font-semibold text-[var(--brand-accent)]">{t("product.manualListing")}</small>
                ) : null}
      </div>
              <p className="text-sm font-semibold text-muted-foreground">
                {t("product.warehouse", { city: product.warehouse_city ? (warehouseLabels[product.warehouse_city] ?? product.warehouse_city) : "—" })}
              </p>
              <h3 className="text-base font-extrabold text-primary">{t("product.variants", { count: totalQuantity })}</h3>
              {form.variants.map((variant, index) => (
                <div className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3" key={variant.id || index}>
                  <div>
                    <Label>{t("product.colour")}</Label>
                    <Input required value={variant.color_hex} onChange={(event) => updateVariant(index, "color_hex", event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("product.materials")}</Label>
                    <Input
                      required
                      value={variant.materials.join(", ")}
                      onChange={(event) => updateVariant(index, "materials", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
                    />
                  </div>
                  <div>
                    <Label>{t("product.length")}</Label>
                    <Input required type="number" min="0" value={variant.length_cm} onChange={(event) => updateVariant(index, "length_cm", event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("product.width")}</Label>
                    <Input required type="number" min="0" value={variant.width_cm} onChange={(event) => updateVariant(index, "width_cm", event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("product.height")}</Label>
                    <Input required type="number" min="0" value={variant.height_cm} onChange={(event) => updateVariant(index, "height_cm", event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("product.quantity")}</Label>
                    <Input required type="number" min="0" value={variant.quantity} onChange={(event) => updateVariant(index, "quantity", event.target.value)} />
                  </div>
                </div>
              ))}
              <Button disabled={saving} type="submit">{saving ? t("product.saving") : t("product.saveChanges")}</Button>
            </form>
          </Panel>

          <aside className="grid gap-4 content-start">
            <Panel padded>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">{t("product.ai")}</p>
              <h2 className="text-lg font-extrabold text-primary">{t("product.aiTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("product.aiHint")}</p>
              <Button
                className="mt-4 w-full"
                variant="accent"
                disabled={generating || descriptionGenerationInProgress}
                onClick={() => void generateDescription()}
              >
                {generating ? t("product.starting") : descriptionGenerationInProgress ? t("product.generating") : t("product.generateDescription")}
              </Button>
              {generation ? (
                <div className="mt-3 grid gap-2 rounded-xl border border-border bg-[#f8fafc] p-3">
                  <strong className="text-sm font-bold text-primary">
                    {t("product.generationStatus", { status: generation.status.replaceAll("_", " ") })}
                  </strong>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={generating} onClick={() => void refreshGeneration()}>
                      {t("product.refreshStatus")}
                    </Button>
                    {generation.status === "succeeded" ? (
                      <Button asChild size="sm" variant="link">
                        <Link href={`/manager/products/${product.id}/listings`}>{t("listing.openPage")}</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {generation?.status === "failed" ? (
                <Feedback className="mt-3">{generation.error?.detail || generation.error?.code || t("product.generationFailed")}</Feedback>
              ) : null}
              {generationContent && draftForm ? (
                <form className="mt-4 grid gap-3" onSubmit={saveDraft}>
                  <span className="text-sm font-extrabold text-primary">{t("product.draftHeading")}</span>
                  <div>
                    <Label>{t("product.draftTitle")}</Label>
                    <Input required maxLength={100} value={draftForm.title} onChange={(event) => updateDraft("title", event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("product.draftDescription")}</Label>
                    <Textarea required rows={9} value={draftForm.description} onChange={(event) => updateDraft("description", event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("product.draftBullets")}</Label>
                    <Textarea required rows={5} value={draftForm.bullets} onChange={(event) => updateDraft("bullets", event.target.value)} />
                  </div>
                  <small className="text-xs text-muted-foreground">{t("product.draftHint")}</small>
                  <Button type="submit" disabled={draftSaving || !draftDirty}>
                    {draftSaving ? t("product.saving") : draftDirty ? t("product.saveDraft") : t("product.draftSaved")}
                  </Button>
                  <Button type="button" variant="accent" disabled={applying || draftDirty || draftSaving} onClick={() => void applyDraft()}>
                    {applying ? t("listing.applying") : t("listing.apply")}
                  </Button>
                  <small className="text-xs text-muted-foreground">{t("listing.applyHint")}</small>
                </form>
              ) : null}
            </Panel>

            <Panel padded>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)]">{t("listing.eyebrow")}</p>
              <h2 className="text-lg font-extrabold text-primary">{t("listing.prepTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("listing.prepHint")}</p>
              <div className="mt-4 grid gap-2">
                <Button asChild variant="secondary">
                  <Link href={`/manager/products/${product.id}/listings`}>{t("listing.openPage")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/manager/marketplaces?product=${product.id}`}>{t("product.openMarketplaces")}</Link>
                </Button>
              </div>
            </Panel>
          </aside>
        </div>
      </PageFrame>

      {priceHelpOpen && product.pricing_formula ? (
        <FormulaEditorDialog
          formula={product.pricing_formula}
          saving={saving}
          onClose={() => setPriceHelpOpen(false)}
          onSave={(overrides) => void saveProductFormula(overrides)}
          onReset={() => void resetProductFormula()}
        />
      ) : null}

      {historyOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(20,47,85,0.45)] p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-title"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-[0_18px_48px_rgba(20,47,85,0.16)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
              <h2 id="history-title" className="text-lg font-extrabold text-primary">{t("product.history")}</h2>
              <Button type="button" variant="secondary" size="sm" onClick={() => setHistoryOpen(false)}>{t("common.close")}</Button>
            </div>
            <p className="text-sm text-muted-foreground">{t("product.historyIntro")}</p>
            {historyError ? <Feedback className="mt-3">{historyError}</Feedback> : null}
            {!historyError && historyCount === 0 && !historyLoading ? (
              <EmptyState className="py-8" title={t("product.historyEmpty")} />
            ) : null}
            {!historyError && historyCount > 0 ? (
              <div className="mt-3 flex items-center justify-end gap-2 text-xs font-bold text-muted-foreground" aria-label={t("product.historyPages")}>
                <Button type="button" size="sm" variant="secondary" disabled={historyLoading || historyPage <= 1} onClick={() => void loadHistory(historyPage - 1)}>
                  {t("common.previous")}
                </Button>
                <span>{t("common.page", { page: historyPage })}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={historyLoading || historyPage >= Math.ceil(historyCount / HISTORY_PAGE_SIZE)}
                  onClick={() => void loadHistory(historyPage + 1)}
                >
                  {t("common.next")}
                </Button>
              </div>
            ) : null}
            {!historyError && history.length > 0 ? (
              <ol className="mt-4 grid gap-3">
                {history.map((item) => (
                  <li key={item.id} className="rounded-xl border border-border bg-[#f8fafc] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.decision}>{t(`status.${item.decision}` as MessageKey)}</StatusBadge>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatDate(item.created_at, true)} · {item.decision === "withdrawn" ? t("product.historySeller") : item.manager_username}
                      </span>
                    </div>
                    {item.decision === "withdrawn" ? (
                      <p className="mt-2 text-sm text-primary">{t("product.historyWithdrawnComment")}</p>
                    ) : item.comment ? (
                      <p className="mt-2 text-sm text-primary">{item.comment}</p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">{t("product.noComment")}</p>
                    )}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteImageId != null}
        onOpenChange={(open) => {
          if (!open && !saving) setPendingDeleteImageId(null);
        }}
        title={t("product.delete")}
        description={t("product.deleteImageConfirm")}
        cancelLabel={t("common.cancel")}
        confirmLabel={saving ? t("product.saving") : t("product.delete")}
        loading={saving}
        onConfirm={() => {
          if (pendingDeleteImageId != null) void deleteImage(pendingDeleteImageId);
        }}
      />
    </>
  );
}
