"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowDown, ArrowUp, Camera, LoaderCircle, Plus, Star, Trash2 } from "lucide-react";
import { SellerNotice } from "@/components/SellerShell";
import { SellerLocalized, useSellerI18n } from "@/components/seller/SellerI18n";
import OttoFields, { type OttoValue } from "@/components/seller/OttoFields";
import SellerProductImage from "@/components/seller/SellerProductImage";
import { sellerRequest, type SellerProduct, type SellerVariant } from "@/lib/seller";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const cities = [["IST", "Istanbul"], ["ANK", "Ankara"], ["IZM", "Izmir"], ["BUR", "Bursa"], ["KSY", "Kars"], ["INE", "Inegol"]] as const;
type Fields = {
  title: string;
  product_type: string;
  unit_price: string;
  currency: "TRY" | "EUR" | "USD";
  warehouse_city: string;
  color: string;
  materials: string;
  material_composition: string;
  width_cm: string;
  height_cm: string;
  length_cm: string;
  quantity: string;
  comment: string;
};
type SetPart = SellerProduct["set_parts"][number];
type SetPartField = "description" | "width_cm" | "height_cm" | "length_cm";

const empty: Fields = {
  title: "", product_type: "", unit_price: "", currency: "TRY", warehouse_city: "INE",
  color: "", materials: "", material_composition: "", width_cm: "", height_cm: "",
  length_cm: "", quantity: "1", comment: "",
};

function fieldsFor(product: SellerProduct): Fields {
  const variant = product.variants[0];
  return {
    title: product.title,
    product_type: product.product_type,
    unit_price: product.unit_price,
    currency: product.currency,
    warehouse_city: product.warehouse_city,
    color: variant?.color || "",
    materials: variant?.materials.join(", ") || "",
    material_composition: variant?.material_composition || "",
    width_cm: variant?.width_cm || "",
    height_cm: variant?.height_cm || "",
    length_cm: variant?.length_cm || "",
    quantity: String(variant?.quantity ?? 1),
    comment: "",
  };
}

export default function ProductEditor({ product }: { product?: SellerProduct }) {
  const { t } = useSellerI18n();
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(product ? () => fieldsFor(product) : empty);
  const [setParts, setSetParts] = useState<SetPart[]>(() => product?.set_parts || []);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [resubmit, setResubmit] = useState(false);
  const [otto, setOtto] = useState<OttoValue>(() => ({
    group: product?.otto_category_group_id ?? null,
    category: product?.otto_category_id ?? null,
    attributes: product?.otto_attributes ?? {},
  }));
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    idempotencyKey.current = null;
    setFields(current => ({ ...current, [key]: value }));
  }

  function chooseFiles(selected: File[]) {
    if (selected.length + (product?.images.length || 0) > 20) {
      setError(t("A product can have at most 20 photos."));
      return;
    }
    const invalid = selected.find(file =>
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 40 * 1024 * 1024,
    );
    if (invalid) {
      setError(t("{file} must be JPEG, PNG, or WebP and no larger than 40 MB.", { file: invalid.name }));
      return;
    }
    idempotencyKey.current = null;
    setError("");
    setFiles(selected);
    setPreviews(selected.map(file => URL.createObjectURL(file)));
  }

  function updateSetPart(index: number, key: SetPartField, value: string) {
    idempotencyKey.current = null;
    setSetParts(current => current.map((part, position) => position === index ? { ...part, [key]: value } : part));
  }

  function moveFile(index: number, step: number) {
    const target = index + step;
    if (target < 0 || target >= files.length) return;
    const reordered = [...files];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    chooseFiles(reordered);
  }

  function removeFile(index: number) {
    chooseFiles(files.filter((_, current) => current !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const materials = fields.materials.split(",").map(value => value.trim()).filter(Boolean);
    if (materials.length < 1 || materials.length > 2) {
      setError(t("Enter one or two materials, separated by commas."));
      return;
    }
    if (setParts.some(part =>
      !part.description.trim() ||
      [part.width_cm, part.height_cm, part.length_cm].some(value => !Number.isFinite(Number(value)) || Number(value) <= 0),
    )) {
      setError(t("Complete the description and positive dimensions for each set part."));
      return;
    }
    if (!product && files.length === 0) {
      setError(t("Add at least one product photo."));
      return;
    }

    setBusy(true);
    const variant: SellerVariant = {
      color: fields.color.trim(),
      materials,
      material_composition: fields.material_composition.trim(),
      width_cm: fields.width_cm,
      height_cm: fields.height_cm,
      length_cm: fields.length_cm,
      quantity: Number(fields.quantity),
    };
    const body = {
      title: fields.title.trim(),
      product_type: fields.product_type.trim(),
      unit_price: fields.unit_price,
      currency: fields.currency,
      warehouse_city: fields.warehouse_city,
      variants: [variant],
      set_parts: setParts.map(({ description, width_cm, height_cm, length_cm }) => ({ description: description.trim(), width_cm, height_cm, length_cm })),
      otto_category_group_id: otto.group,
      otto_category_id: otto.category,
      otto_attributes: otto.attributes,
    };

    try {
      if (product) {
        const payload = { ...body, change_comment: fields.comment, ...(resubmit ? { resubmit_for_moderation: true } : {}) };
        let updateBody: BodyInit;
        const headers: HeadersInit = {};
        if (files.length) {
          const form = new FormData();
          Object.entries(payload).forEach(([key, value]) =>
            form.append(key, ["variants", "set_parts", "otto_attributes"].includes(key) ? JSON.stringify(value) : String(value)),
          );
          files.forEach(file => form.append("images", file));
          updateBody = form;
        } else {
          headers["Content-Type"] = "application/json";
          updateBody = JSON.stringify(payload);
        }
        const saved = await sellerRequest<SellerProduct>(`/api/v1/products/${product.id}/`, { method: "PATCH", headers, body: updateBody });
        const pending = !!saved.pending_changes && Object.keys(saved.pending_changes).length > 0;
        setSuccess(saved.status === "submitted" || pending ? t("Your changes were sent for review.") : t("Product saved."));
        window.setTimeout(() => router.push(`/seller/products/${product.id}`), 700);
      } else {
        const form = new FormData();
        Object.entries(body).forEach(([key, value]) =>
          form.append(key, ["variants", "set_parts", "otto_attributes"].includes(key) ? JSON.stringify(value) : String(value)),
        );
        files.forEach(file => form.append("images", file));
        idempotencyKey.current ??= crypto.randomUUID();
        const created = await sellerRequest<SellerProduct>("/api/v1/products/", {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey.current },
          body: form,
        });
        idempotencyKey.current = null;
        const status = created.status.replaceAll("_", " ");
        setSuccess(t("Product created with status: {status}", { status: t(status.charAt(0).toUpperCase() + status.slice(1)) }));
        window.setTimeout(() => router.push(`/seller/products/${created.id}`), 700);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not save product."));
    } finally {
      setBusy(false);
    }
  }

  async function removeImage(imageId: number) {
    if (!product || !window.confirm(t("Remove this product photo?"))) return;
    setBusy(true);
    setError("");
    try {
      await sellerRequest(`/api/v1/products/${product.id}/images/${imageId}/`, { method: "DELETE" });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not remove image."));
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(imageId: number) {
    if (!product) return;
    setBusy(true);
    setError("");
    try {
      await sellerRequest(`/api/v1/products/${product.id}/images/${imageId}/make-primary/`, { method: "POST", body: "{}" });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not update primary image."));
    } finally {
      setBusy(false);
    }
  }

  async function moveExisting(index: number, step: number) {
    if (!product) return;
    const target = index + step;
    if (target < 0 || target >= product.images.length) return;
    const imageIds = product.images.map(image => image.id);
    [imageIds[index], imageIds[target]] = [imageIds[target], imageIds[index]];
    setBusy(true);
    setError("");
    try {
      await sellerRequest(`/api/v1/products/${product.id}/images/reorder/`, { method: "POST", body: JSON.stringify({ image_ids: imageIds }) });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not reorder photos."));
    } finally {
      setBusy(false);
    }
  }

  const field = (name: keyof Fields, label: string, type = "text", required = true) => <label className="seller-field">
    {t(label)}
      <Input
      required={required}
      type={type}
      step={type === "number" ? name === "quantity" ? "1" : "0.01" : undefined}
      min={type === "number" ? name === "quantity" ? "1" : "0.01" : undefined}
      value={fields[name]}
      onChange={event => set(name, event.target.value as Fields[typeof name])}
    />
  </label>;

  return <SellerLocalized>
    <form className="seller-product-form" onSubmit={submit}>
      {error && <SellerNotice>{error}</SellerNotice>}
      {success && <SellerNotice kind="success">{success}</SellerNotice>}
      <div className="seller-product-form-layout">
        <div className="seller-product-form-main">
          <section className="seller-card seller-photo-upload" onDragOver={event => event.preventDefault()} onDrop={event => {
            event.preventDefault();
            chooseFiles([...files, ...Array.from(event.dataTransfer.files)]);
          }}>
            <h2>{t(product ? "Add photos" : "Product photos")}</h2>
            <p>{t(product ? "Select or drop additional photos for this product." : "Select or drop up to 20 JPEG, PNG or WebP images. The first photo will be the main image.")} {t("Maximum 40 MB each.")}</p>
            <label className="seller-field">{t("Photos")}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple required={!product} onChange={event => chooseFiles(Array.from(event.target.files || []))} />
            </label>
            <label className="seller-button seller-camera-picker"><Camera size={18} strokeWidth={1.8} aria-hidden="true" />{t("Take photo")}<input className="seller-camera-picker-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => {
              const captured = Array.from(event.target.files || []);
              if (captured.length) chooseFiles([...files, ...captured]);
              event.currentTarget.value = "";
            }} /></label>
            {files.length > 0 && <div className="seller-photo-list">{files.map((file, index) => <div className="seller-photo-row" key={`${file.name}-${index}`}>
              {/* Local previews use blob URLs created by this form. */}
              <Image unoptimized src={previews[index]} alt={t("Selected product photo {number}", { number: index + 1 })} width={64} height={64} />
              <span className="seller-photo-name">{!product && index === 0 ? <><Star size={16} strokeWidth={1.8} aria-hidden="true" />{t("Main photo")} · </> : null}{file.name}</span>
              {!product && <>
                <button type="button" className="seller-icon-button" aria-label={`${t("Move earlier")}: ${file.name}`} title={t("Move earlier")} disabled={index === 0} onClick={() => moveFile(index, -1)}><ArrowUp size={18} strokeWidth={1.8} aria-hidden="true" /></button>
                <button type="button" className="seller-icon-button" aria-label={`${t("Move later")}: ${file.name}`} title={t("Move later")} disabled={index === files.length - 1} onClick={() => moveFile(index, 1)}><ArrowDown size={18} strokeWidth={1.8} aria-hidden="true" /></button>
              </>}
              <button type="button" className="seller-icon-button danger" aria-label={`${t("Remove")}: ${file.name}`} title={t("Remove")} onClick={() => removeFile(index)}><Trash2 size={18} strokeWidth={1.8} aria-hidden="true" /></button>
            </div>)}</div>}
          </section>

          {product && product.images.length > 0 && <section className="seller-card">
            <h2>{t("Current photos")}</h2>
            <p className="seller-field-hint">{t("Sellers can add, remove, reorder, or choose the main photo. Replacing an existing photo is not available to seller accounts.")}</p>
            <div className="seller-photo-grid">{product.images.map((image, index) => <div className="seller-photo-tile" key={image.id}>
              <SellerProductImage src={image.thumbnail || image.image} alt={image.is_primary ? t("Main product photo") : t("Product photo")} />
              {image.is_primary ? <span className="seller-badge approved"><Star size={16} strokeWidth={1.8} aria-hidden="true" />{t("Main photo")}</span> : <button type="button" className="seller-icon-button" aria-label={`${t("Make main")} ${index + 1}`} title={t("Make main")} disabled={busy} onClick={() => void makePrimary(image.id)}><Star size={18} strokeWidth={1.8} aria-hidden="true" /></button>}
              <div className="seller-photo-actions">
                <button type="button" className="seller-icon-button" aria-label={`${t("Move earlier")}: ${t("Product photo")} ${index + 1}`} title={t("Move earlier")} disabled={busy || index === 0} onClick={() => void moveExisting(index, -1)}><ArrowUp size={18} strokeWidth={1.8} aria-hidden="true" /></button>
                <button type="button" className="seller-icon-button" aria-label={`${t("Move later")}: ${t("Product photo")} ${index + 1}`} title={t("Move later")} disabled={busy || index === product.images.length - 1} onClick={() => void moveExisting(index, 1)}><ArrowDown size={18} strokeWidth={1.8} aria-hidden="true" /></button>
                <button type="button" className="seller-icon-button danger" aria-label={`${t("Remove")}: ${t("Product photo")} ${index + 1}`} title={t("Remove")} disabled={busy} onClick={() => void removeImage(image.id)}><Trash2 size={18} strokeWidth={1.8} aria-hidden="true" /></button>
              </div>
            </div>)}</div>
          </section>}

          <section className="seller-card">
            <h2>{t("Product information")}</h2>
            <div className="seller-form-grid">
              {field("title", "Product title")}
              {field("product_type", "Product type")}
            </div>
          </section>

          <section className="seller-card">
            <h2>{t("Variant details")}</h2>
            <p>{t("One color variant is supported per product. Add materials separated by commas.")}</p>
            <div className="seller-form-grid">
              {field("color", "Color")}
              {field("materials", "Materials (up to 2)")}
              {field("material_composition", "Material composition", "text", false)}
              <div className="seller-dimensions-row">
                {field("width_cm", "Width (cm)", "number")}
                {field("height_cm", "Height (cm)", "number")}
                {field("length_cm", "Length (cm)", "number")}
              </div>
            </div>
          </section>

          <section className="seller-card">
            <div className="seller-section-heading">
              <div><h2>{t("Set parts (optional)")}</h2><p>{t("Add up to 20 additional pieces with their own dimensions.")}</p></div>
              <button type="button" className="seller-button" disabled={setParts.length >= 20} onClick={() => {
                idempotencyKey.current = null;
                setSetParts(current => [...current, { description: "", width_cm: "", height_cm: "", length_cm: "" }]);
              }}><Plus size={18} strokeWidth={1.8} aria-hidden="true" />{t("Add set part")}</button>
            </div>
            {setParts.length > 0 ? <div className="seller-stack">{setParts.map((part, index) => <fieldset className="seller-set-part" key={part.id ?? index}>
              <legend>{t("Piece")} {index + 1}</legend>
              <label className="seller-field">{t("Description")}
                <Input required maxLength={2000} value={part.description} onChange={event => updateSetPart(index, "description", event.target.value)} />
              </label>
              <div className="seller-dimensions-row">
                {(["width_cm", "height_cm", "length_cm"] as const).map(key => <label key={key} className="seller-field">{t(key === "width_cm" ? "Width (cm)" : key === "height_cm" ? "Height (cm)" : "Length (cm)")}
                  <Input required type="number" min="0.01" step="0.01" value={part[key]} onChange={event => updateSetPart(index, key, event.target.value)} />
                </label>)}
              </div>
              <button type="button" className="seller-button danger" onClick={() => {
                idempotencyKey.current = null;
                setSetParts(current => current.filter((_, position) => position !== index));
              }}><Trash2 size={18} strokeWidth={1.8} aria-hidden="true" />{t("Remove set part")}</button>
            </fieldset>)}</div> : <p className="seller-field-hint">{t("No additional set parts.")}</p>}
          </section>

          <OttoFields value={otto} onChange={value => {
            idempotencyKey.current = null;
            setOtto(value);
          }} />

        </div>

        <aside className="seller-product-form-side">
          <section className="seller-card">
            <h2>{t("Price and stock")}</h2>
            <div className="seller-form-grid">
              {field("unit_price", "Unit price", "number")}
              <div className="seller-field-row">
                <label className="seller-field">{t("Currency")}
                  <Select value={fields.currency} onChange={event => set("currency", event.target.value as Fields["currency"])}>
                    {["TRY", "EUR", "USD"].map(currency => <option key={currency}>{currency}</option>)}
                  </Select>
                </label>
                {field("quantity", "Quantity", "number")}
              </div>
              <label className="seller-field">{t("Warehouse city")}
                <Select value={fields.warehouse_city} onChange={event => set("warehouse_city", event.target.value)}>
                  {cities.map(([code, label]) => <option key={code} value={code}>{t(label)}</option>)}
                </Select>
              </label>
            </div>
          </section>

          <section className="seller-card seller-submission-note">
            <h2>{t(product ? "Review status" : "Review after submission")}</h2>
            {product ? <><span className={`seller-badge ${product.status}`}>{t(product.status.replaceAll("_", " "))}</span><p>{t("Changes to a product may be sent for moderation according to its current status.")}</p></> : <p>{t("Submitting creates the product and sends it for review. You can follow its status from My products.")}</p>}
          </section>

          {product && ["approved", "rejected", "withdrawn"].includes(product.status) && <section className="seller-card">
            <h2>{t("Review note")}</h2>
            <label className="seller-field">{t("Comment for reviewer")}
              <textarea maxLength={2000} value={fields.comment} onChange={event => set("comment", event.target.value)} />
            </label>
            {["rejected", "withdrawn"].includes(product.status) && <label className="seller-checkbox">
              <input type="checkbox" checked={resubmit} onChange={event => { idempotencyKey.current = null; setResubmit(event.target.checked); }} />
              {t("Resubmit for moderation")}
            </label>}
          </section>}

          <div className="seller-form-actions">
            <button className="seller-button primary" disabled={busy}>
              <LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} strokeWidth={1.8} aria-hidden="true" />
              {busy ? t(files.length ? "Uploading photos…" : "Saving…") : product ? t("Save changes") : t("Send for review")}
            </button>
          </div>
        </aside>
      </div>
    </form>
  </SellerLocalized>;
}
