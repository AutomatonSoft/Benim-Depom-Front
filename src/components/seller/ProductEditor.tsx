"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Camera, Info, Layers, LoaderCircle, Palette, Plus, Ruler, Save, Star, Tag, Trash2, Warehouse, X, type LucideIcon } from "lucide-react";
import { SellerNotice } from "@/components/SellerShell";
import { SellerLocalized, useSellerI18n } from "@/components/seller/SellerI18n";
import OttoFields, { type OttoValue } from "@/components/seller/OttoFields";
import SellerProductImage from "@/components/seller/SellerProductImage";
import { SellerSearchableSelect, SellerSelect } from "@/components/seller/SellerSelect";
import { SellerApiError, sellerRequest, type SellerImage, type SellerProduct, type SellerVariant } from "@/lib/seller";
import { sellerProductErrorDetails } from "@/lib/seller-product-errors";
import { makeSellerPhotoPrimary, reorderSellerPhoto } from "@/lib/seller-product-photos";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { sellerMaterialInputs, sellerMaterials, sellerProductFormData, sellerProductReviewFields, sellerProductTypeLabel, sellerProductTypes, sellerProductVariant, sellerSetPartsPayload } from "@/lib/seller-product-form";

const cities = [["IST", "Istanbul"], ["ANK", "Ankara"], ["IZM", "Izmir"], ["BUR", "Bursa"], ["KSY", "Kars"], ["INE", "Inegol"]] as const;
type Fields = {
  title: string;
  product_type: string;
  unit_price: string;
  currency: "" | "TRY" | "EUR" | "USD";
  warehouse_city: string;
  color: string;
  material1: string;
  material2: string;
  material_composition: string;
  width_cm: string;
  height_cm: string;
  length_cm: string;
  quantity: string;
  comment: string;
};
type SetPart = SellerProduct["set_parts"][number];
type EditorPhoto =
  | { key: string; kind: "saved"; image: SellerImage }
  | { key: string; kind: "new"; file: File; preview: string };
type SetPartField = "description" | "width_cm" | "height_cm" | "length_cm";

const empty: Fields = {
  title: "", product_type: "", unit_price: "", currency: "", warehouse_city: "",
  color: "", material1: "", material2: "", material_composition: "", width_cm: "", height_cm: "",
  length_cm: "", quantity: "", comment: "",
};

function fieldsFor(product: SellerProduct): Fields {
  const variant = product.variants[0];
  return {
    title: product.title,
    product_type: sellerProductTypeLabel(product.product_type),
    unit_price: product.unit_price,
    currency: product.currency,
    warehouse_city: product.warehouse_city,
    color: variant?.color || "",
    ...sellerMaterialInputs(variant?.materials),
    material_composition: variant?.material_composition || "",
    width_cm: variant?.width_cm || "",
    height_cm: variant?.height_cm || "",
    length_cm: variant?.length_cm || "",
    quantity: String(variant?.quantity ?? 1),
    comment: "",
  };
}

export default function ProductEditor({ product, onSavingChange, readOnly = false }: { product?: SellerProduct; onSavingChange?: (saving: boolean) => void; readOnly?: boolean }) {
  const { t } = useSellerI18n();
  const initialProduct = product ? { ...product, ...product.pending_changes, images: product.images } as SellerProduct : undefined;
  const [fields, setFields] = useState<Fields>(initialProduct ? () => fieldsFor(initialProduct) : empty);
  const [setParts, setSetParts] = useState<SetPart[]>(() => initialProduct?.set_parts || []);
  const [photos, setPhotos] = useState<EditorPhoto[]>(() => [...(product?.images || [])]
    .sort((first, second) => Number(second.is_primary) - Number(first.is_primary))
    .map(image => ({ key: `saved-${image.id}`, kind: "saved", image })));
  const files = photos.flatMap(photo => photo.kind === "new" ? [photo.file] : []);
  const existingImages = photos.flatMap((photo, index) => photo.kind === "saved" ? [{ ...photo.image, is_primary: index === 0 }] : []);
  const savedProduct = useRef(product);
  const previewUrls = useRef(new Set<string>());
  const draggedPhoto = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<EditorPhoto | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [otto, setOtto] = useState<OttoValue>(() => ({
    group: initialProduct?.otto_category_group_id ?? null,
    category: initialProduct?.otto_category_id ?? null,
    attributes: initialProduct?.otto_attributes ?? {},
  }));
  const idempotencyKey = useRef<string | null>(null);
  const submitInFlight = useRef(false);
  const submitted = useRef(false);
  const invalidFieldScrollScheduled = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollToServerError = useRef(false);

  useEffect(() => {
    if (!scrollToServerError.current) return;
    scrollToServerError.current = false;
    formRef.current?.querySelector<HTMLElement>(".seller-field-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fieldErrors]);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => { urls.forEach(URL.revokeObjectURL); urls.clear(); };
  }, []);

  function centerInvalidField(event: FormEvent<HTMLFormElement>) {
    if (invalidFieldScrollScheduled.current) return true;
    const selector = "input:invalid, select:invalid, textarea:invalid";
    const missingProductType = !fields.product_type.trim();
    const missingWarehouseCity = !fields.warehouse_city;
    const missingCurrency = !fields.currency;
    const missingPhotos = photos.length === 0;
    const invalidSelectors = [selector, ...(missingPhotos ? [".seller-photo-dropzone"] : []), ...(missingProductType ? [".seller-product-type-field"] : []), ...(missingWarehouseCity ? [".seller-warehouse-city-field"] : []), ...(missingCurrency ? [".seller-currency-field"] : [])];
    const firstInvalid = event.currentTarget.querySelector<HTMLElement>(invalidSelectors.join(", "));
    if (!firstInvalid) return false;
    const errors = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector))
      .filter(field => field.name)
      .map(field => [field.name, field.validity.valueMissing ? t("This field is required.") : field.validationMessage] as const);
    setFieldErrors(current => ({ ...current, ...Object.fromEntries(errors), ...(missingPhotos ? { images: t("Add at least one product photo.") } : {}), ...(missingProductType ? { product_type: t("This field is required.") } : {}), ...(missingWarehouseCity ? { warehouse_city: t("This field is required.") } : {}), ...(missingCurrency ? { currency: t("This field is required.") } : {}) }));
    invalidFieldScrollScheduled.current = true;
    window.setTimeout(() => {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      invalidFieldScrollScheduled.current = false;
    }, 0);
    return true;
  }

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    idempotencyKey.current = null;
    setFieldErrors(current => { const next = { ...current }; delete next[key]; return next; });
    setFields(current => ({ ...current, [key]: value }));
  }

  function chooseFiles(selected: File[]) {
    if (readOnly || submitInFlight.current) return;
    if (selected.length === 0) return;
    if (photos.length + selected.length > 20) {
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
    setFieldErrors(current => { const next = { ...current }; delete next.images; return next; });
    const added: EditorPhoto[] = selected.map(file => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      return { key: crypto.randomUUID(), kind: "new", file, preview };
    });
    setPhotos(current => [...current, ...added]);
  }

  function updateSetPart(index: number, key: SetPartField, value: string) {
    idempotencyKey.current = null;
    setFieldErrors(current => { const next = { ...current }; delete next.set_parts; delete next[`set_part_${index}_${key}`]; return next; });
    setSetParts(current => current.map((part, position) => position === index ? { ...part, [key]: value } : part));
  }

  function makePrimary(index: number) {
    if (readOnly || submitInFlight.current) return;
    idempotencyKey.current = null;
    setPhotos(current => makeSellerPhotoPrimary(current, index));
  }

  function movePhoto(from: number, to: number) {
    if (readOnly || submitInFlight.current) return;
    idempotencyKey.current = null;
    setPhotos(current => reorderSellerPhoto(current, from, to));
  }

  function removePhoto(key: string) {
    if (readOnly || submitInFlight.current) return;
    idempotencyKey.current = null;
    const photo = photos.find(item => item.key === key);
    if (photo?.kind === "new") {
      URL.revokeObjectURL(photo.preview);
      previewUrls.current.delete(photo.preview);
    }
    setPhotos(current => current.filter(photo => photo.key !== key));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || submitInFlight.current || submitted.current) return;
    if (centerInvalidField(event)) return;
    setError("");
    setFieldErrors({});
    const materials = sellerMaterials(fields.material1, fields.material2);
    if (materials.length < 1 || materials.length > 2) {
      setFieldErrors({ materials: t("Add at least one material.") });
      return;
    }
    if (setParts.some(part =>
      !part.description.trim() ||
      [part.width_cm, part.height_cm, part.length_cm].some(value => !Number.isFinite(Number(value)) || Number(value) <= 0),
    )) {
      setFieldErrors({ set_parts: t("Complete the description and positive dimensions for each set part.") });
      return;
    }
    submitInFlight.current = true;
    setBusy(true);
    onSavingChange?.(true);
    const variant: SellerVariant = sellerProductVariant(fields, materials);
    const body = {
      title: fields.title.trim(),
      product_type: fields.product_type.trim(),
      unit_price: fields.unit_price,
      currency: fields.currency,
      warehouse_city: fields.warehouse_city,
      variants: [variant],
      set_parts: sellerSetPartsPayload(setParts),
      otto_category_group_id: otto.group,
      otto_category_id: otto.category,
      otto_attributes: otto.attributes,
    };

    let partiallySaved = false;
    let saveResult: string;
    try {
      if (product) {
        const baseline = savedProduct.current || product;
        const keptIds = new Set(existingImages.map(image => image.id));
        const removedIds = baseline.images.filter(image => !keptIds.has(image.id)).map(image => image.id);
        const photosChanged = files.length > 0 || removedIds.length > 0 || existingImages.some((image, index) => image.id !== baseline.images[index]?.id || image.is_primary !== baseline.images[index]?.is_primary);
        const payload = { ...body, ...sellerProductReviewFields(product.status, fields.comment, !photosChanged) };
        let saved = await sellerRequest<SellerProduct>(`/api/v1/products/${product.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
        savedProduct.current = saved;
        partiallySaved = true;
        if (photosChanged) {
          let desiredPhotos = [...photos];
          for (const imageId of removedIds) {
            if (!saved.images.some(image => image.id === imageId)) continue;
            await sellerRequest(`/api/v1/products/${product.id}/images/${imageId}/`, { method: "DELETE" });
            saved.images = saved.images.filter(image => image.id !== imageId);
          }
          const uploads = desiredPhotos.filter(photo => photo.kind === "new");
          for (const photo of uploads) {
            const form = new FormData();
            form.append("image", photo.file);
            const image = await sellerRequest<SellerImage>(`/api/v1/products/${product.id}/images/`, { method: "POST", body: form });
            saved.images = [...saved.images, image];
            desiredPhotos = desiredPhotos.map(item => item.key === photo.key ? { key: photo.key, kind: "saved", image } : item);
            setPhotos([...desiredPhotos]);
            URL.revokeObjectURL(photo.preview);
            previewUrls.current.delete(photo.preview);
          }
          const imageIds = desiredPhotos.flatMap(photo => photo.kind === "saved" ? [photo.image.id] : []);
          const primaryId = imageIds[0];
          if (imageIds.some((imageId, index) => imageId !== saved.images[index]?.id)) {
            await sellerRequest(`/api/v1/products/${product.id}/images/reorder/`, { method: "POST", body: JSON.stringify({ image_ids: imageIds }) });
            saved.images = imageIds.map((id, index) => ({ ...saved.images.find(image => image.id === id)!, is_primary: index === 0 }));
          }
          if (primaryId && saved.images.find(image => image.is_primary)?.id !== primaryId) {
            await sellerRequest(`/api/v1/products/${product.id}/images/${primaryId}/make-primary/`, { method: "POST", body: "{}" });
            saved.images = saved.images.map(image => ({ ...image, is_primary: image.id === primaryId }));
          }
          if (["draft", "rejected", "withdrawn"].includes(product.status)) {
            saved = await sellerRequest<SellerProduct>(`/api/v1/products/${product.id}/`, { method: "PATCH", body: JSON.stringify(sellerProductReviewFields(product.status, fields.comment, true)) });
          } else {
            saved = await sellerRequest<SellerProduct>(`/api/v1/products/${product.id}/`);
          }
          savedProduct.current = saved;
        }
        submitted.current = true;
        const pending = !!saved.pending_changes && Object.keys(saved.pending_changes).length > 0;
        saveResult = saved.status === "submitted" || pending ? "updated-review" : "updated";
      } else {
        const form = sellerProductFormData(body);
        files.forEach(file => form.append("images", file));
        idempotencyKey.current ??= crypto.randomUUID();
        const created = await sellerRequest<SellerProduct>("/api/v1/products/", {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey.current },
          body: form,
        });
        submitted.current = true;
        idempotencyKey.current = null;
        saveResult = created.status === "submitted" ? "created-review" : "created";
      }
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Fully reload the catalogue after a completed save.
      window.location.assign(`/seller/products?saved=${saveResult}`);
    } catch (e) {
      if (e instanceof SellerApiError) {
        const details = sellerProductErrorDetails(e.data);
        scrollToServerError.current = Object.keys(details.fields).length > 0;
        setFieldErrors(details.fields);
        setError(details.message || (Object.keys(details.fields).length ? t("Some product details need attention. Review the highlighted fields.") : e.message));
      } else {
        setError(e instanceof Error ? e.message : t("Could not save product."));
      }
      if (partiallySaved) setError(current => `${t("Some changes were saved. Save again to finish the remaining changes.")} ${current}`);
    } finally {
      if (!submitted.current) submitInFlight.current = false;
      setBusy(submitted.current);
      onSavingChange?.(false);
    }
  }

  const field = (name: keyof Fields, label: string, type = "text", required = true) => <label className="seller-field">
    {t(label)}
      <Input
      name={name}
      required={required}
      type={type}
      aria-invalid={Boolean(fieldErrors[name])}
      step={type === "number" ? name === "quantity" ? "1" : "0.01" : undefined}
      min={type === "number" ? name === "quantity" ? "1" : "0.01" : undefined}
      value={fields[name]}
      onChange={event => set(name, event.target.value as Fields[typeof name])}
    />
    {fieldErrors[name] && <small className="seller-field-error">{fieldErrors[name]}</small>}
  </label>;

  const heading = (title: string, Icon: LucideIcon, accent = "navy") => <div className={`seller-editor-heading ${accent}`}><span className="seller-editor-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span><h2>{t(title)}</h2></div>;

  return <SellerLocalized>
    <form ref={formRef} className="seller-product-form" noValidate onSubmit={submit}>
      {error && <SellerNotice>{error}</SellerNotice>}
      <fieldset className="seller-editor-fields" disabled={busy || readOnly}>
      <div className="seller-product-form-layout">
        <div className="seller-product-form-main">
          <section className="seller-card seller-photo-upload" onDragOver={event => event.preventDefault()} onDrop={event => {
            event.preventDefault();
            chooseFiles(Array.from(event.dataTransfer.files));
          }}>
            {heading(product ? "Add photos" : "Product photos", Camera, "orange")}
            <div className={existingImages.length + files.length > 0 ? "seller-photo-gallery" : undefined}>
              {photos.map((photo, index) => <div
                className={`seller-gallery-photo${dropTarget === photo.key ? " drop-target" : ""}`}
                key={photo.key}
                role="group"
                aria-label={`${t("Product photo")} ${index + 1}`}
                tabIndex={busy || readOnly ? -1 : 0}
                aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                draggable={!busy && !readOnly}
                onDragStart={event => {
                  if (busy || readOnly || submitInFlight.current) { event.preventDefault(); return; }
                  draggedPhoto.current = photo.key;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", photo.key);
                }}
                onDragOver={event => {
                  if (!draggedPhoto.current) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "move";
                  setDropTarget(photo.key);
                }}
                onDrop={event => {
                  if (!draggedPhoto.current) return;
                  event.preventDefault();
                  event.stopPropagation();
                  movePhoto(photos.findIndex(item => item.key === draggedPhoto.current), index);
                  draggedPhoto.current = null;
                  setDropTarget(null);
                }}
                onDragEnd={() => { draggedPhoto.current = null; setDropTarget(null); }}
                onKeyDown={event => {
                  if (event.target !== event.currentTarget || !event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                  event.preventDefault();
                  movePhoto(index, index + (event.key === "ArrowLeft" ? -1 : 1));
                }}
              >
                <div className={`seller-gallery-frame${index === 0 ? " main" : ""}`}>
                  <div className="seller-gallery-preview" role="button" tabIndex={0} aria-label={`${t("View photo")} ${index + 1}`} onClick={() => setViewingPhoto(photo)} onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setViewingPhoto(photo); }
                  }}>
                  {photo.kind === "saved"
                    ? <SellerProductImage src={photo.image.thumbnail || photo.image.image} alt={index === 0 ? t("Main product photo") : t("Product photo")} />
                    : <Image unoptimized draggable={false} src={photo.preview} alt={t("Selected product photo {number}", { number: index + 1 })} width={240} height={240} />}
                  </div>
                  <button type="button" className="seller-gallery-star" aria-label={`${t("Make main")} ${index + 1}`} aria-pressed={index === 0} title={t("Make main")} onClick={() => makePrimary(index)}><Star size={18} strokeWidth={1.8} aria-hidden="true" /></button>
                  <button type="button" className="seller-gallery-remove" aria-label={`${t("Remove")}: ${t("Product photo")} ${index + 1}`} title={t("Remove")} onClick={() => removePhoto(photo.key)}><Trash2 size={17} strokeWidth={1.8} aria-hidden="true" /></button>
                  {index === 0 ? <span className="seller-gallery-main-label">{t("Main photo")}</span> : photo.kind === "new" ? <span className="seller-gallery-new-label">{t("New photo")}</span> : null}
                </div>
              </div>)}
              {photos.length < 20 && <label className={`seller-photo-dropzone${existingImages.length + files.length > 0 ? " seller-photo-add-card" : ""}${fieldErrors.images ? " invalid" : ""}`}>
                {existingImages.length + files.length > 0 ? <>
                  <span className="seller-upload-camera"><Camera size={28} strokeWidth={1.8} aria-hidden="true" /></span>
                  <strong>{t("Add photos")}</strong>
                </> : <>
                  <span className="seller-upload-camera"><Camera size={30} strokeWidth={1.8} aria-hidden="true" /></span>
                  <strong>{t("Photograph your product")}</strong>
                  <span>{t("Select or drop photos")}</span>
                  <small>{t(product ? "Add JPEG, PNG, or WebP photos up to 40 MB each. 20 photos total, including existing photos." : "Up to 20 photos. The first photo will be the main image. JPEG, PNG, or WebP, up to 40 MB each.")}</small>
                </>}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label={t("Photos")} aria-required={existingImages.length + files.length === 0} aria-invalid={Boolean(fieldErrors.images)} onChange={event => {
                  chooseFiles(Array.from(event.target.files || []));
                  event.currentTarget.value = "";
                }} />
              </label>}
            </div>
            {photos.length > 1 && <p className="seller-gallery-help">{t("Drag photos to change their order. Click the star to swap a photo with the main one.")}</p>}
            {fieldErrors.images && <small className="seller-field-error seller-photo-error">{fieldErrors.images}</small>}
            {photos.length < 20 && <label className="seller-button seller-camera-picker"><Camera size={18} strokeWidth={1.8} aria-hidden="true" />{t("Take photo")}<input className="seller-camera-picker-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => {
              const captured = Array.from(event.target.files || []);
              if (captured.length) chooseFiles(captured);
              event.currentTarget.value = "";
            }} /></label>}
          </section>

          <div className="seller-product-policy"><Info size={22} aria-hidden="true" /><p>{t("You may list only new products. Used products cannot be uploaded.")}</p></div>

          <section className="seller-card">
            {heading("Product information", Tag)}
            <div className="seller-form-grid">
              {field("title", "Product title")}
              <div className="seller-price-row">
                {field("unit_price", "Unit price", "number")}
                <div className="seller-field seller-currency-field"><span>{t("Currency (required)")}</span>
                  <SellerSelect ariaLabel={t("Currency")} aria-required aria-invalid={Boolean(fieldErrors.currency)} aria-describedby={fieldErrors.currency ? "seller-currency-error" : undefined} value={fields.currency} onValueChange={value => set("currency", value as Fields["currency"])} placeholder={t("Choose a currency")} options={["TRY", "EUR", "USD"].map(currency => ({ value: currency, label: currency }))} />
                  {fieldErrors.currency && <small id="seller-currency-error" className="seller-field-error">{fieldErrors.currency}</small>}
                </div>
              </div>
            </div>
          </section>

          <section className="seller-card">
            {heading("Product type", Layers, "orange")}
            <div className="seller-field seller-product-type-field">
              <span>{t("Product type (required)")}</span>
              <SellerSearchableSelect
                aria-required
                aria-invalid={Boolean(fieldErrors.product_type)}
                aria-describedby={fieldErrors.product_type ? "seller-product-type-error" : undefined}
                value={fields.product_type}
                onValueChange={value => set("product_type", value)}
                placeholder={t("Choose a product type")}
                ariaLabel={t("Product type")}
                options={[
                  ...sellerProductTypes.map(value => ({ value, label: t(value) })),
                  ...(fields.product_type && !sellerProductTypes.includes(fields.product_type as (typeof sellerProductTypes)[number])
                    ? [{ value: fields.product_type, label: fields.product_type }]
                    : []),
                ]}
              />
              {fieldErrors.product_type && <small id="seller-product-type-error" className="seller-field-error">{fieldErrors.product_type}</small>}
            </div>
          </section>

          <OttoFields value={otto} onChange={value => {
            idempotencyKey.current = null;
            setFieldErrors(current => { const next = { ...current }; delete next.otto_attributes; return next; });
            setOtto(value);
          }} />
          {fieldErrors.otto_attributes && <div role="alert" className="seller-field-error seller-otto-error"><Info size={20} aria-hidden="true" /><span>{fieldErrors.otto_attributes}</span></div>}

          <section className="seller-card">
            {heading("Color", Palette)}
            {fieldErrors.variants && <small className="seller-field-error">{fieldErrors.variants}</small>}
            <div className="seller-info-notice"><Info size={18} aria-hidden="true" /><p>{t("Each product has one color. To sell this product in another color, add it as a new product.")}</p></div>
            <div className="seller-form-grid">
              {field("color", "Color")}
            </div>
          </section>

          <section className="seller-card seller-size-card">
            {heading("Size options", Ruler, "orange")}
            <div className="seller-info-notice"><Info size={18} aria-hidden="true" /><p>{t("For a single item, enter one size. For a set, add each part below. Additional sizes are saved as set parts.")}</p></div>
            <fieldset className="seller-size-variant">
              <legend>{t("Product size 1")}</legend>
              <div className="seller-dimensions-row">
                {field("length_cm", "Length (cm)", "number")}
                {field("width_cm", "Width (cm)", "number")}
                {field("height_cm", "Height (cm)", "number")}
              </div>
            </fieldset>
            <div className="seller-size-parts" role="group" aria-labelledby="seller-size-parts-heading">
              <div className="seller-size-parts-summary">
                <span><strong id="seller-size-parts-heading">{t("Set part sizes (optional)")}</strong><small>{t("Add up to 20 additional pieces with their own dimensions.")}</small></span>
                <span className="seller-badge">{setParts.length}</span>
              </div>
              <div className="seller-size-parts-content">
              {fieldErrors.set_parts && <small className="seller-field-error">{fieldErrors.set_parts}</small>}
              {setParts.length > 0 ? <div className="seller-stack">{setParts.map((part, index) => <fieldset className="seller-set-part" key={part.id ?? index}>
              <legend>{t("Set part size {number}", { number: index + 1 })}</legend>
              <label className="seller-field">{t("Part description")}
                <Input name={`set_part_${index}_description`} required maxLength={2000} value={part.description} aria-invalid={Boolean(fieldErrors[`set_part_${index}_description`])} onChange={event => updateSetPart(index, "description", event.target.value)} />
                {fieldErrors[`set_part_${index}_description`] && <small className="seller-field-error">{fieldErrors[`set_part_${index}_description`]}</small>}
              </label>
              <div className="seller-dimensions-row">
                {(["length_cm", "width_cm", "height_cm"] as const).map(key => <label key={key} className="seller-field">{t(key === "width_cm" ? "Width (cm)" : key === "height_cm" ? "Height (cm)" : "Length (cm)")}
                  <Input name={`set_part_${index}_${key}`} required type="number" min="0.01" step="0.01" value={part[key]} aria-invalid={Boolean(fieldErrors[`set_part_${index}_${key}`])} onChange={event => updateSetPart(index, key, event.target.value)} />
                  {fieldErrors[`set_part_${index}_${key}`] && <small className="seller-field-error">{fieldErrors[`set_part_${index}_${key}`]}</small>}
                </label>)}
              </div>
              <button type="button" className="seller-button danger" onClick={() => {
                idempotencyKey.current = null;
                setFieldErrors(current => {
                  const next = { ...current };
                  delete next.set_parts;
                  Object.keys(next).filter(name => name.startsWith("set_part_")).forEach(name => delete next[name]);
                  return next;
                });
                setSetParts(current => current.filter((_, position) => position !== index));
              }}><Trash2 size={18} strokeWidth={1.8} aria-hidden="true" />{t("Remove set part")}</button>
            </fieldset>)}</div> : <p className="seller-field-hint">{t("No additional set parts.")}</p>}
              <button type="button" className="seller-button" disabled={setParts.length >= 20} onClick={() => {
                idempotencyKey.current = null;
                setSetParts(current => [...current, { description: "", width_cm: "", height_cm: "", length_cm: "" }]);
              }}><Plus size={18} strokeWidth={1.8} aria-hidden="true" />{t("Add set part size")}</button>
              </div>
            </div>
          </section>

          <section className="seller-card">
            {heading("Materials", Layers)}
            <div className="seller-form-grid">
              {fieldErrors.materials && <small className="seller-field-error">{fieldErrors.materials}</small>}
              <div className="seller-field-row">
                {field("material1", "Material 1")}
                {field("material2", "Material 2 (optional)", "text", false)}
              </div>
              {field("material_composition", "Material composition", "text", false)}
              <div className="seller-info-notice seller-material-helper"><Info size={18} aria-hidden="true" /><p>{t("For soft materials such as fabric: 70% polyester, 25% cotton, 5% elastane. Hard materials such as wood or metal do not require a composition.")}</p></div>
            </div>
          </section>
        </div>

        <div className="seller-product-form-side">
          <section className="seller-card seller-price-stock">
            {heading("Stock and warehouse", Warehouse, "orange")}
            <div className="seller-form-grid">
              {field("quantity", "Stock quantity", "number")}
              <div className="seller-field seller-warehouse-city-field"><span>{t("Warehouse city (required)")}</span>
                <SellerSelect ariaLabel={t("Warehouse city")} aria-required aria-invalid={Boolean(fieldErrors.warehouse_city)} aria-describedby={fieldErrors.warehouse_city ? "seller-warehouse-city-error" : undefined} value={fields.warehouse_city} onValueChange={value => set("warehouse_city", value)} placeholder={t("Choose a warehouse city")} options={cities.map(([value, label]) => ({ value, label: t(label) }))} />
                {fieldErrors.warehouse_city && <small id="seller-warehouse-city-error" className="seller-field-error">{fieldErrors.warehouse_city}</small>}
              </div>
            </div>
          </section>

          <section className="seller-card seller-submission-note">
            <h2>{t(product ? "Review status" : "Review after submission")}</h2>
            {product ? <><span className={`seller-badge ${product.status}`}>{t(product.status.replaceAll("_", " "))}</span>{product.status !== "deactivated" && <p>{t("Changes to a product may be sent for moderation according to its current status.")}</p>}</> : <p>{t("Submitting creates the product and sends it for review. You can follow its status from My products.")}</p>}
          </section>

          {product && ["approved", "rejected"].includes(product.status) && <section className="seller-card">
            <h2>{t("Review note")}</h2>
            <label className="seller-field">{t("Comment for reviewer")}
              <textarea name="change_comment" maxLength={2000} value={fields.comment} aria-invalid={Boolean(fieldErrors.change_comment)} onChange={event => set("comment", event.target.value)} />
              {fieldErrors.change_comment && <small className="seller-field-error">{fieldErrors.change_comment}</small>}
            </label>
          </section>}

          <div className="seller-form-actions">
            <button className="seller-button primary" disabled={busy}>
              {busy ? <LoaderCircle className="seller-spinner" size={18} strokeWidth={1.8} aria-hidden="true" /> : <Save size={18} strokeWidth={1.8} aria-hidden="true" />}
              {busy ? t(files.length ? "Uploading photos…" : "Saving…") : t("Save product")}
            </button>
          </div>
        </div>
      </div>
      </fieldset>
    </form>
    <Dialog open={viewingPhoto !== null} onOpenChange={open => { if (!open) setViewingPhoto(null); }}>
      <DialogContent className="seller-photo-viewer" showCloseButton={false} aria-describedby={undefined} onClick={event => { if (event.target === event.currentTarget) setViewingPhoto(null); }}>
        <DialogTitle className="sr-only">{t("Product photo")}</DialogTitle>
        <DialogClose asChild><button type="button" className="seller-photo-viewer-close" aria-label={t("Close")}><X size={24} aria-hidden="true" /></button></DialogClose>
        {viewingPhoto && <SellerProductImage key={viewingPhoto.key} className="seller-photo-viewer-image" src={viewingPhoto.kind === "saved" ? viewingPhoto.image.image || viewingPhoto.image.preview || viewingPhoto.image.thumbnail : viewingPhoto.preview} alt={t("Product photo")} />}
      </DialogContent>
    </Dialog>
  </SellerLocalized>;
}
