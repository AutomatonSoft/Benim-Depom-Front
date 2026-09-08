export type Marketplace = "hood" | "otto" | "kaufland";
export type Account = "jv" | "xl";
export type ListingTarget = { marketplace: Marketplace; account: Account };

export const listingTargets: ListingTarget[] = [
  { marketplace: "otto", account: "jv" },
  { marketplace: "otto", account: "xl" },
  { marketplace: "hood", account: "jv" },
  { marketplace: "hood", account: "xl" },
  { marketplace: "kaufland", account: "jv" },
  { marketplace: "kaufland", account: "xl" },
];

export const listingTargetKey = (target: ListingTarget) => `${target.marketplace}:${target.account}`;

export const marketplaceName: Record<Marketplace, string> = {
  otto: "OTTO",
  hood: "Hood",
  kaufland: "Kaufland",
};

export const DEFAULT_OTTO_VAT = "FULL";

export const ottoCatalogLanguages = ["ru", "en", "tr", "de"] as const;
export type OttoCatalogLanguage = (typeof ottoCatalogLanguages)[number];

export function ottoCatalogPath(path: string, language: OttoCatalogLanguage) {
  const trimmed = path.replace(/^\/+|\/+$/g, "");
  if (language === "de") return `/api/v1/catalog/otto/${trimmed}/`;
  return `/api/v1/catalog/otto/${trimmed}/${language}/`;
}

export function defaultOttoShippingProfileId(
  profiles: Array<{ shipping_profile_id: string; shipping_profile_name: string }>,
) {
  const match = profiles.find((profile) => /4\s*[-–]\s*8\s*wochen/i.test(profile.shipping_profile_name));
  return match?.shipping_profile_id ?? "";
}

export function listingChannelLabel(target: ListingTarget) {
  return `${marketplaceName[target.marketplace]} ${target.account.toUpperCase()}`;
}

export function listingConfigPath(productId: number, target: ListingTarget) {
  return `/api/v1/orchestrator/products/${productId}/${target.marketplace}/${target.account}/configuration/`;
}

export function listingPreviewPath(
  productId: number,
  target: ListingTarget,
  kauflandMode: "create" | "update" = "create",
) {
  if (target.marketplace === "kaufland") {
    return `/api/v1/orchestrator/products/${productId}/kaufland/${target.account}/${kauflandMode}-payload-preview/`;
  }
  return `/api/v1/orchestrator/products/${productId}/${target.marketplace}/${target.account}/payload-preview/`;
}

export function formatListingErrors(errors: unknown): string {
  if (!errors) return "";
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) return errors.map(String).filter(Boolean).join(" ");
  if (typeof errors === "object") {
    return Object.entries(errors as Record<string, unknown>)
      .map(([field, value]) => {
        const text = Array.isArray(value) ? value.map(String).join(" ") : String(value ?? "");
        return text ? `${field}: ${text}` : field;
      })
      .join(" · ");
  }
  return "";
}

type OttoConfigPayload = {
  product_line?: string;
  description?: string;
  bullet_points?: string[];
  vat?: string;
  shipping_profile_id?: string;
  [key: string]: unknown;
};

type ShippingProfile = { shipping_profile_id: string; shipping_profile_name: string };

/** Ensure both OTTO JV/XL configs have VAT + shipping defaults persisted for preview/publish. */
export async function ensureOttoListingDefaults(
  productId: number,
  authorizedFetchFn: (input: string, init?: RequestInit) => Promise<Response>,
) {
  const ottoTargets = listingTargets.filter((target) => target.marketplace === "otto");
  const [jvProfilesResponse, xlProfilesResponse] = await Promise.all([
    authorizedFetchFn("/api/v1/catalog/otto/shipping-profiles/?account=jv"),
    authorizedFetchFn("/api/v1/catalog/otto/shipping-profiles/?account=xl"),
  ]);
  const profilesByAccount: Record<Account, ShippingProfile[]> = {
    jv: jvProfilesResponse.ok ? ((await jvProfilesResponse.json().catch(() => [])) as ShippingProfile[]) : [],
    xl: xlProfilesResponse.ok ? ((await xlProfilesResponse.json().catch(() => [])) as ShippingProfile[]) : [],
  };

  await Promise.all(
    ottoTargets.map(async (target) => {
      const response = await authorizedFetchFn(listingConfigPath(productId, target));
      if (!response.ok) return;
      const body = (await response.json().catch(() => null)) as { configuration?: OttoConfigPayload } | null;
      const configuration = body?.configuration || {};
      const vat = String(configuration.vat || "").trim();
      const shipping = String(configuration.shipping_profile_id || "").trim();
      const defaultShipping = defaultOttoShippingProfileId(profilesByAccount[target.account] || []);
      const nextVat = vat || DEFAULT_OTTO_VAT;
      const nextShipping = shipping || defaultShipping;
      if (vat && shipping) return;
      if (!nextShipping) return;

      await authorizedFetchFn(listingConfigPath(productId, target), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...configuration,
          vat: nextVat,
          shipping_profile_id: nextShipping,
        }),
      });
    }),
  );
}
