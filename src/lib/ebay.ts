export type EbayEnvironment = "sandbox" | "production";
export type EbayContact = {
  companyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  phone?: string;
  contactUrl?: string;
};
export type EbayRegulatory = {
  manufacturer?: EbayContact;
  responsiblePersons?: Array<EbayContact & { types: string[] }>;
};
export type EbayDraft = {
  id?: number;
  title: string;
  description: string;
  image_urls: string[];
  price_eur: string | null;
  quantity: number | null;
  category_id: string;
  aspects: Record<string, string[]>;
  fulfillment_policy_id: string;
  payment_policy_id: string;
  return_policy_id: string;
  merchant_location_key: string;
  regulatory: EbayRegulatory;
};
type Policy = { id: string; name: string; applicable_to_furniture: boolean };
export type EbayReadiness = {
  account: "depotum";
  environment: EbayEnvironment;
  ready_for_listing_setup: boolean;
  missing_requirements: string[];
  warnings?: string[];
  errors: Record<string, string>;
  policies: Record<"fulfillment" | "payment" | "return", Policy[] | null>;
  inventory_locations: Array<{ merchant_location_key: string; name: string; usable: boolean }> | null;
};
export type EbayPreparation = {
  status: "processing" | "prepared" | "published" | "withdrawn" | "failed" | "uncertain";
  environment: EbayEnvironment;
  sku: string;
  offer_id: string;
  listing_id: string;
  last_error: string;
};
export type EbaySnapshot = {
  environment: EbayEnvironment;
  remote_status: string | null;
  listing_status: string | null;
  remote_listing_id: string;
  preparation: EbayPreparation;
  offer: { listingDescription?: string; pricingSummary?: { price?: { value: string; currency: string } } } | null;
};
export type EbayChecks = {
  ready: boolean;
  environment: EbayEnvironment;
  preview_hash: string;
  blocking_reasons: string[];
  warnings?: string[];
  manual_checks: string[];
};
export type EbayCategory = { id: string; name: string; is_leaf: boolean };
export type EbayAspect = {
  localizedAspectName: string;
  aspectConstraint: {
    aspectRequired: boolean;
    aspectMode?: string;
    itemToAspectCardinality?: string;
    aspectMaxLength?: number;
  };
  aspectValues?: Array<{ localizedValue: string }>;
};
export type EbayAspectSchema = { category: EbayCategory; aspects: EbayAspect[] };
export type EbayProduct = {
  id: number;
  title: string;
  product_type?: string;
  status: string;
  ean_jv: string;
  listing_price_eur?: string | null;
  total_quantity?: number;
  variants: Array<{ color?: string; materials?: string[]; width_cm?: string; length_cm?: string; height_cm?: string; quantity: number }>;
  set_parts?: Array<{ description?: string; width_cm?: string; length_cm?: string; height_cm?: string }>;
  images: Array<{
    id: number;
    image: string;
    is_primary: boolean;
    generated_images: Array<{ id: number; image: string; thumbnail?: string; mode: string }>;
  }>;
};
export type EbayAiContent = { title: string; description: string; color?: string; materials?: string[] };
export type EbayGeneration = {
  id: string;
  product_id: number;
  status: string;
  result?: { universal?: { content?: EbayAiContent } };
  error?: unknown;
};

export function ebayListingUrl(environment: EbayEnvironment, listingId: string) {
  if (!["sandbox", "production"].includes(environment) || !/^\d{1,64}$/.test(listingId)) return null;
  return `https://${environment === "sandbox" ? "www.sandbox.ebay.de" : "www.ebay.de"}/itm/${listingId}`;
}

export function ebayProductImages(product: EbayProduct) {
  return [...product.images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).flatMap((source) => {
    const generated = ["white", "interior", "human", "xl_cover"].flatMap((mode) =>
      source.generated_images.filter((image) => image.mode === mode).map((image) => ({ url: image.image, thumbnail: image.thumbnail || image.image, label: `#${source.id} · ${mode}` })),
    );
    return [...generated, { url: source.image, thumbnail: source.image, label: `#${source.id} · original` }];
  }).filter((image, index, all) => image.url && all.findIndex((other) => other.url === image.url) === index);
}

export function newEbayDraft(product: EbayProduct, readiness: EbayReadiness): EbayDraft {
  const policy = (kind: keyof EbayReadiness["policies"]) => {
    const choices = readiness.policies[kind]?.filter((item) => item.applicable_to_furniture) ?? [];
    return choices.length === 1 ? choices[0].id : "";
  };
  const locations = readiness.inventory_locations?.filter((item) => item.usable) ?? [];
  const primary = product.images.find((image) => image.is_primary) ?? product.images[0];
  const generated = primary?.generated_images.filter((image) => ["white", "interior", "human"].includes(image.mode)) ?? [];
  const images = ["white", "interior", "human"].flatMap((mode) => generated.filter((image) => image.mode === mode).map((image) => image.image));
  return {
    title: product.title,
    description: "",
    image_urls: images.length ? images : product.images.map((image) => image.image).filter(Boolean).slice(0, 24),
    price_eur: product.listing_price_eur ?? null,
    quantity: product.total_quantity ?? product.variants.reduce((total, variant) => total + variant.quantity, 0),
    category_id: "", aspects: {}, regulatory: {},
    fulfillment_policy_id: policy("fulfillment"), payment_policy_id: policy("payment"), return_policy_id: policy("return"),
    merchant_location_key: locations.length === 1 ? locations[0].merchant_location_key : "",
  };
}

export function ebayAspectDefaults(schema: EbayAspectSchema, product: EbayProduct, content?: EbayAiContent) {
  const variant = product.variants[0];
  const cm = (value?: string) => value && Number(value) > 0 ? `${Number(value)} cm` : "";
  const candidates: Record<string, string> = {
    Breite: cm(variant?.width_cm), Länge: cm(variant?.length_cm), Höhe: cm(variant?.height_cm),
    Farbe: content?.color || variant?.color || "",
    Material: (content?.materials || variant?.materials || []).join("/"),
    Produktart: product.product_type || "",
  };
  const aspects: Record<string, string[]> = {};
  for (const aspect of schema.aspects) {
    const value = candidates[aspect.localizedAspectName];
    if (!value) continue;
    if (aspect.aspectConstraint.aspectMode === "SELECTION_ONLY" && !aspect.aspectValues?.some((item) => item.localizedValue === value)) continue;
    aspects[aspect.localizedAspectName] = [value];
  }
  for (const [index, part] of (product.set_parts ?? []).entries()) {
    const dimensions = [part.width_cm, part.length_cm, part.height_cm];
    if (dimensions.every((value) => value && Number(value) > 0)) {
      const name = `Maße Teil ${index + 2} (B × L × H)`;
      aspects[name] = [`${dimensions.map(Number).join(" × ")} cm`];
    }
  }
  return aspects;
}

export function ebayDraftPayload(draft: EbayDraft) {
  return {
    title: draft.title, description: draft.description, image_urls: draft.image_urls,
    price_eur: draft.price_eur || null, quantity: draft.quantity, category_id: draft.category_id,
    fulfillment_policy_id: draft.fulfillment_policy_id, payment_policy_id: draft.payment_policy_id,
    return_policy_id: draft.return_policy_id, merchant_location_key: draft.merchant_location_key,
    regulatory: draft.regulatory,
    aspects: Object.fromEntries(Object.entries(draft.aspects).flatMap(([key, values]) => {
      const clean = values.map((value) => value.trim()).filter(Boolean);
      return clean.length ? [[key, clean]] : [];
    })),
  };
}
