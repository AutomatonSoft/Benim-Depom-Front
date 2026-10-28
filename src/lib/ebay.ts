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
export type EbayCategory = { id: string; name: string; label?: string; is_leaf: boolean };
export type EbayAspect = {
  localizedAspectName: string;
  label?: string;
  aspectConstraint: {
    aspectRequired: boolean;
    aspectMode?: string;
    itemToAspectCardinality?: string;
    aspectMaxLength?: number;
  };
  aspectValues?: Array<{ localizedValue: string; label?: string }>;
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

export function ebayListingUrl(environment: EbayEnvironment, listingId: string) {
  if (!["sandbox", "production"].includes(environment) || !/^\d{1,64}$/.test(listingId)) return null;
  return `https://${environment === "sandbox" ? "www.sandbox.ebay.de" : "www.ebay.de"}/itm/${listingId}`;
}

export function ebayBaseTitle(title: string) {
  return title.replace(/\s*(?:\(BD\)|\bBD)\s*$/i, "").trim();
}

export function newEbayDraft(): EbayDraft {
  return { title: "", description: "", image_urls: [], price_eur: null, quantity: null,
    category_id: "", aspects: {}, regulatory: {}, fulfillment_policy_id: "", payment_policy_id: "",
    return_policy_id: "", merchant_location_key: "" };
}

export function ebayDraftPayload(draft: EbayDraft) {
  return {
    sync_product: true,
    title: ebayBaseTitle(draft.title), description: draft.description, category_id: draft.category_id,
    aspects: Object.fromEntries(Object.entries(draft.aspects).flatMap(([key, values]) => {
      const clean = values.map((value) => value.trim()).filter(Boolean);
      return clean.length ? [[key, clean]] : [];
    })),
  };
}
