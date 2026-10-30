import { ottoCatalogPath, type OttoCatalogLanguage } from "./listings.ts";
import { loadOttoCatalogPages, type OttoCatalogPage } from "./otto-catalog.ts";
import { sellerRequest } from "./seller.ts";
import { storeSellerOttoCatalog } from "./browser-storage.ts";

export type SellerOttoGroup = { category_group_id: number; category_group: string };
export type SellerOttoCategory = { category_id: number; name: string };

const lifetime = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expires: number; promise: Promise<unknown[]> }>();

function loadCatalog<T>(path: string): Promise<T[]> {
  const key = `seller-otto-v1:${path}`;
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise as Promise<T[]>;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved?.expires > Date.now() && Array.isArray(saved.values)) {
      const promise = Promise.resolve(saved.values as T[]);
      cache.set(key, { expires: saved.expires, promise });
      return promise;
    }
  } catch { /* Storage may be unavailable; keep the in-memory cache. */ }

  const expires = Date.now() + lifetime;
  const promise = loadOttoCatalogPages<T>(path, url => sellerRequest<OttoCatalogPage<T>>(url), 3)
    .then(values => {
      try { storeSellerOttoCatalog(localStorage, key, expires, values); } catch { /* Storage may be unavailable. */ }
      return values;
    }).catch(error => { cache.delete(key); throw error; });
  cache.set(key, { expires, promise });
  return promise;
}

export function loadSellerOttoGroups(language: OttoCatalogLanguage) {
  return loadCatalog<SellerOttoGroup>(ottoCatalogPath("category-groups", language));
}

export function loadSellerOttoCategories(language: OttoCatalogLanguage, group: number) {
  return loadCatalog<SellerOttoCategory>(ottoCatalogPath(`category-groups/${group}/categories`, language));
}

export async function prefetchSellerOttoCatalog(language: OttoCatalogLanguage, signal: AbortSignal) {
  const groups = await loadSellerOttoGroups(language);
  const pending = groups.values();
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (!signal.aborted) {
      const next = pending.next();
      if (next.done) return;
      await loadSellerOttoCategories(language, next.value.category_group_id);
    }
  }));
}
