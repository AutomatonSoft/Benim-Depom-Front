type Dimensions = { width_cm: string; height_cm: string; length_cm: string };

type MarginProduct = {
  unit_price: string;
  currency: "EUR" | "USD" | "TRY";
  warehouse_city?: string;
  variants: Dimensions[];
  set_parts?: Dimensions[];
};

type MarginFormula = {
  margin: string | number;
  eur_to_try: string | null;
  eur_to_usd: string | null;
  city_tariffs_eur_per_cbm: Record<string, string | number>;
  de_size_tiers: Array<{
    min_cbm: string | number;
    max_cbm: string | number;
    price_eur: string | number;
  }>;
};

function nonNegativeNumber(value: string | number | null | undefined): number {
  if (value == null || String(value).trim() === "") return NaN;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

function volume(item: Dimensions): number {
  return nonNegativeNumber(item.width_cm)
    * nonNegativeNumber(item.height_cm)
    * nonNegativeNumber(item.length_cm) / 1_000_000;
}

export function calculateMarginEur(product: MarginProduct, formula: MarginFormula): number | null {
  if (!product.variants.length || !product.warehouse_city) return null;
  let purchase = nonNegativeNumber(product.unit_price);
  if (product.currency !== "EUR") {
    const rate = nonNegativeNumber(product.currency === "TRY" ? formula.eur_to_try : formula.eur_to_usd);
    if (!(rate > 0)) return null;
    purchase = Math.round((purchase / rate + Number.EPSILON) * 100) / 100;
  }
  const cbm = Number((Math.max(...product.variants.map(volume))
    + (product.set_parts ?? []).reduce((sum, part) => sum + volume(part), 0)).toFixed(12));
  const tariff = nonNegativeNumber(formula.city_tariffs_eur_per_cbm[product.warehouse_city]);
  const tier = formula.de_size_tiers.find((item) => {
    const min = nonNegativeNumber(item.min_cbm);
    const max = nonNegativeNumber(item.max_cbm);
    return min <= max && cbm >= min && cbm <= max;
  });
  if (!tier) return null;
  const delivery = nonNegativeNumber(tier.price_eur);
  const margin = (purchase + tariff * cbm + delivery) * nonNegativeNumber(formula.margin);
  return Number.isFinite(margin) ? Math.round((margin + Number.EPSILON) * 100) / 100 : null;
}
