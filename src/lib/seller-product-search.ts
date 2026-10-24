export const SELLER_PRODUCT_OPTION_LIMIT = 10;

export function sellerProductSearchUrl(search = "") {
  const query = new URLSearchParams({ page_size: String(SELLER_PRODUCT_OPTION_LIMIT) });
  if (search.trim()) query.set("search", search.trim());
  return `/api/v1/products/?${query}`;
}

export function firstSellerProductOptions<T>(products: T[]) {
  return products.slice(0, SELLER_PRODUCT_OPTION_LIMIT);
}
