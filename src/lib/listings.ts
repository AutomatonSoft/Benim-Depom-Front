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
