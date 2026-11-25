/**
 * "Kurzbeschreibung" — the 4-line logistics summary a manager sees in the
 * product tables: seller price, packed volume, origin country, warehouse city.
 * Country and city are both derived from the single `warehouse_city` field.
 */

export type Currency = "TRY" | "EUR" | "USD";
export type Country = "TR" | "IT" | "PL";

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "TRY"];
export const COUNTRIES: readonly Country[] = ["TR", "IT", "PL"];
/** Turkish warehouse cities in display order. */
export const TURKISH_CITIES = ["IST", "ANK", "IZM", "BUR", "INE", "KSY"] as const;

const FOREIGN_WAREHOUSE: Record<Exclude<Country, "TR">, string> = { IT: "ITA", PL: "POL" };

export type ShortDescriptionProduct = {
  unit_price: string;
  currency: string;
  warehouse_city?: string | null;
  cbm?: string | null;
  cbm_calculated?: string | null;
  cbm_override?: string | null;
};

export type ShortDescriptionDraft = {
  price: string;
  currency: Currency;
  cbm: string;
  country: Country;
  city: string;
};

export type ShortDescriptionPayload = {
  unit_price?: string;
  currency?: Currency;
  warehouse_city?: string;
  cbm_override?: string | null;
};

export function countryOf(warehouseCity?: string | null): Country {
  if (warehouseCity === "ITA") return "IT";
  if (warehouseCity === "POL") return "PL";
  return "TR";
}

/** City code for Turkish warehouses; empty for Italy / Poland. */
export function cityOf(warehouseCity?: string | null): string {
  return countryOf(warehouseCity) === "TR" ? warehouseCity || "" : "";
}

export function warehouseCityFor(country: Country, city: string): string {
  return country === "TR" ? city : FOREIGN_WAREHOUSE[country];
}

/** "3775.00" → "3775", "3775.50" → "3775.5". */
export function trimAmount(value: string | null | undefined): string {
  if (value == null || String(value).trim() === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(value);
}

export function shortDescriptionLines(product: ShortDescriptionProduct) {
  return {
    price: `${trimAmount(product.unit_price)} ${product.currency}`,
    cbm: product.cbm ? `${product.cbm} cbm` : "— cbm",
    country: countryOf(product.warehouse_city),
    city: cityOf(product.warehouse_city),
    manualCbm: product.cbm_override != null && product.cbm_override !== "",
  };
}

export function draftFromProduct(product: ShortDescriptionProduct): ShortDescriptionDraft {
  const country = countryOf(product.warehouse_city);
  return {
    price: trimAmount(product.unit_price),
    currency: (CURRENCIES as readonly string[]).includes(product.currency) ? (product.currency as Currency) : "TRY",
    cbm: product.cbm ?? "",
    country,
    city: cityOf(product.warehouse_city) || (country === "TR" ? "IST" : ""),
  };
}

function sameNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  if ((a ?? "") === "" || (b ?? "") === "") return (a ?? "") === (b ?? "");
  return Number(a) === Number(b);
}

export type DraftError = "price" | "cbm" | "city";

export function validateDraft(draft: ShortDescriptionDraft): DraftError | null {
  const price = Number(draft.price);
  if (!draft.price.trim() || !Number.isFinite(price) || price < 0.01) return "price";
  if (draft.cbm.trim()) {
    const cbm = Number(draft.cbm);
    if (!Number.isFinite(cbm) || cbm < 0.001) return "cbm";
  }
  if (draft.country === "TR" && !(TURKISH_CITIES as readonly string[]).includes(draft.city)) return "city";
  return null;
}

/**
 * Only fields that actually changed. An empty volume clears the manual value;
 * a volume equal to the calculated one also clears it, so the product keeps
 * following its dimensions.
 */
export function buildPayload(product: ShortDescriptionProduct, draft: ShortDescriptionDraft): ShortDescriptionPayload {
  const payload: ShortDescriptionPayload = {};
  if (!sameNumber(draft.price, product.unit_price)) payload.unit_price = Number(draft.price).toFixed(2);
  if (draft.currency !== product.currency) payload.currency = draft.currency;

  const warehouse = warehouseCityFor(draft.country, draft.city);
  if (warehouse !== (product.warehouse_city ?? "")) payload.warehouse_city = warehouse;

  const cbm = draft.cbm.trim();
  if (!sameNumber(cbm, product.cbm)) {
    payload.cbm_override = !cbm || sameNumber(cbm, product.cbm_calculated) ? null : Number(cbm).toFixed(3);
  }
  return payload;
}
