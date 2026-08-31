"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import Sidebar from "@/components/Sidebar";
import { authorizedFetch } from "@/lib/api";
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

type Product = {
  id: number;
  owner: number;
  title: string;
  product_type: string;
  unit_price: string;
  currency: "TRY" | "EUR" | "USD";
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
};

type FormState = {
  title: string;
  product_type: string;
  unit_price: string;
  currency: Product["currency"];
  variants: Variant[];
};

type Generation = { id: string; status: string; result: Record<string, unknown>; error: Record<string, unknown> };

const statusLabels: Record<string, string> = {
  draft: "Draft", submitted: "Awaiting review", under_review: "Under review",
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

function isImageGenerationInProgress(status?: string) {
  return status === "pending" || status === "processing" || status === "result_received";
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

function toForm(product: Product): FormState {
  return {
    title: product.title,
    product_type: product.product_type,
    unit_price: product.unit_price,
    currency: product.currency,
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

  const canModerate = product?.status === "submitted" || product?.status === "under_review";
  const totalQuantity = useMemo(
    () => form?.variants.reduce((total, variant) => total + Number(variant.quantity || 0), 0) ?? 0,
    [form],
  );
  const imageGenerationInProgress = useMemo(
    () => product?.images.some((image) => isImageGenerationInProgress(image.processing_status)) ?? false,
    [product],
  );
  const activeImageGenerationStatus = product?.images.find((image) => isImageGenerationInProgress(image.processing_status))?.processing_status;
  const descriptionGenerationInProgress = isGenerationInProgress(generation?.status);

  async function loadProduct(options?: { silent?: boolean }) {
    if (!Number.isInteger(productId) || productId < 1) return;
    if (!options?.silent) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await authorizedFetch(`/api/v1/products/${productId}/`);
      if (response.status === 401) return void router.replace("/login");
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

  useEffect(() => {
    if (!localStorage.getItem("benim_access_token")) return void router.replace("/login");

    async function loadInitialProduct() {
      try {
        const response = await authorizedFetch(`/api/v1/products/${productId}/`);
        if (response.status === 401) return void router.replace("/login");
        if (response.status === 404) throw new Error("Product was not found.");
        if (!response.ok) throw new Error("Unable to load product.");
        const data = await response.json() as Product;
        setProduct(data);
        setForm(toForm(data));
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
        if (!isGenerationInProgress(data.status)) window.localStorage.removeItem(generationStorageKey(productId));
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
      const payload = {
        ...form,
        variants: form.variants.map(({ color_hex, materials, width_cm, height_cm, length_cm, quantity }) => ({ color_hex, materials, width_cm, height_cm, length_cm, quantity: Number(quantity) })),
      };
      const response = await authorizedFetch(`/api/v1/products/${productId}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Changes could not be saved.");
      setProduct(data as Product); setForm(toForm(data as Product)); setFeedback("Product changes saved. Update marketplace listings when you are ready to sync them.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Changes could not be saved."); }
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
      if (!response.ok) throw new Error(data.detail || `Product could not be ${action}d.`);
      setProduct(data as Product); setForm(toForm(data as Product)); setFeedback(action === "approve" ? "Product approved and EANs assigned." : "Product rejected. The seller will receive the reason.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Moderation action failed."); }
    finally { setSaving(false); }
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

  async function generateImage(imageId: number) {
    const image = product?.images.find((item) => item.id === imageId);
    if (isImageGenerationInProgress(image?.processing_status)) return;
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
      if (!isGenerationInProgress(updatedGeneration.status)) {
        window.localStorage.removeItem(generationStorageKey(productId));
      }
      if (data.status === "succeeded") setFeedback("AI draft is ready. Open Marketplaces to review and apply it to listings.");
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
  if (error && !product) return <main className="app-shell"><Sidebar active="products" /><section className="content products-page"><p className="products-message error">{error}</p><Link className="back-link" href="/products">← Back to products</Link></section></main>;
  if (!product || !form) return null;

  return <main className="app-shell"><Sidebar active="products" /><section className="content product-workspace">
    <header className="topbar"><div><p className="eyebrow">Product workspace</p><h1>{product.title}</h1><p className="products-subtitle">Product #{product.id} · last updated {formatDate(product.updated_at, true)}</p></div><Link className="back-link" href="/products">← Products</Link></header>
    {error && <p className="form-feedback error" role="alert">{error}</p>}{feedback && <p className="form-feedback success">{feedback}</p>}
    {(descriptionGenerationInProgress || activeImageGenerationStatus) && <section className="workspace-card background-tasks-card"><div><p className="eyebrow">Background tasks</p><h2>Generation continues in the background</h2><p>You can safely leave or refresh this page. The server keeps processing and this screen checks the saved task every four seconds.</p></div>{descriptionGenerationInProgress && generation && <BackgroundProgress label="Description generation" status={generation.status} />}{activeImageGenerationStatus && <BackgroundProgress label="Image generation" status={activeImageGenerationStatus} />}</section>}
    <section className="workspace-summary"><article><span>Status</span><strong className={`manager-status ${product.status}`}>{statusLabels[product.status] ?? product.status}</strong></article><article><span>Stock</span><strong>{product.total_quantity} pcs</strong></article><article><span>EAN JV / XL</span><strong>{product.ean_jv || "—"} / {product.ean_xl || "—"}</strong></article><article><span>OTTO category</span><strong>{product.otto_category_name || "Not selected"}</strong></article></section>
    {canModerate && <section className="workspace-card moderation-card"><div><p className="eyebrow">Moderation</p><h2>Review this seller submission</h2><p>Approve assigns EANs. Reject sends the seller your reason.</p></div><div className="moderation-actions"><button className="approve-button" disabled={saving} onClick={() => void moderate("approve")}>Approve product</button><input value={rejectComment} onChange={(event) => setRejectComment(event.target.value)} placeholder="Reason for rejection" /><button className="reject-button" disabled={saving} onClick={() => void moderate("reject")}>Reject</button></div></section>}
    <div className="workspace-grid"><form className="workspace-card product-edit-form" onSubmit={saveProduct}><div><p className="eyebrow">Product data</p><h2>Edit product</h2><p>Changes are saved locally. Published listings are updated separately from Marketplaces.</p></div><label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Product type<input required value={form.product_type} onChange={(event) => setForm({ ...form, product_type: event.target.value })} /></label><div className="form-two-columns"><label>Unit price<input required min="0.01" step="0.01" type="number" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} /></label><label>Currency<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as Product["currency"] })}><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label></div><h3>Variants · {totalQuantity} pcs total</h3>{form.variants.map((variant, index) => <div className="variant-editor" key={variant.id || index}><label>Colour<input required value={variant.color_hex} onChange={(event) => updateVariant(index, "color_hex", event.target.value)} /></label><label>Materials<input required value={variant.materials.join(", ")} onChange={(event) => updateVariant(index, "materials", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label><label>Length cm<input required type="number" min="0" value={variant.length_cm} onChange={(event) => updateVariant(index, "length_cm", event.target.value)} /></label><label>Width cm<input required type="number" min="0" value={variant.width_cm} onChange={(event) => updateVariant(index, "width_cm", event.target.value)} /></label><label>Height cm<input required type="number" min="0" value={variant.height_cm} onChange={(event) => updateVariant(index, "height_cm", event.target.value)} /></label><label>Quantity<input required type="number" min="0" value={variant.quantity} onChange={(event) => updateVariant(index, "quantity", event.target.value)} /></label></div>)}<button className="save-button" disabled={saving} type="submit">{saving ? "Saving..." : "Save changes"}</button></form>
      <aside className="workspace-side"><section className="workspace-card"><p className="eyebrow">Images</p><h2>Images & generation</h2><p>Managers can add source images at any product stage, including after publication.</p><label className="upload-image-button">Add image<input accept="image/jpeg,image/png,image/webp" disabled={saving} type="file" onChange={(event) => void uploadImage(event)} /></label><div className="image-workspace-list">{product.images.map((image) => <article key={image.id}><img src={image.processed_image || image.image} alt="Product" /><div><strong>{image.is_primary ? "Primary image" : "Source image"}</strong><small>{image.processing_status.replaceAll("_", " ")}</small>{image.processing_error && <small className="image-error">{image.processing_error}</small>}<button disabled={saving || image.processing_status === "processing"} onClick={() => void generateImage(image.id)}>{image.processing_status === "processing" ? "Generating..." : "Generate image"}</button></div></article>)}</div></section><section className="workspace-card"><p className="eyebrow">AI content</p><h2>Descriptions for marketplaces</h2><p>Generates a reviewable draft for OTTO, Hood and Kaufland. It never overwrites listing text automatically.</p><button className="ai-button" disabled={generating} onClick={() => void generateDescription()}>{generating ? "Starting..." : "Generate description"}</button>{generation && <div className="generation-status"><strong>Generation: {generation.status}</strong><button disabled={generating} onClick={() => void refreshGeneration()}>Refresh status</button>{generation.status === "succeeded" && <Link href="/marketplaces">Review in Marketplaces →</Link>}</div>}</section><section className="workspace-card marketplace-next-step"><p className="eyebrow">Next step</p><h2>Marketplace listing</h2><p>Choose accounts, review marketplace-specific fields, then publish or update listings.</p><Link className="save-button" href="/marketplaces">Open Marketplaces</Link></section></aside></div>
  </section></main>;
}
