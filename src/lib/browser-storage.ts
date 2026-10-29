const OTTO_CACHE_PREFIX = "seller-otto-v1:";
const MAX_OTTO_CACHE_BYTES = 1024 * 1024;

function ottoCacheKeys(storage: Storage) {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key !== null && key.startsWith(OTTO_CACHE_PREFIX));
}

export function storeSellerOttoCatalog(storage: Storage, key: string, expires: number, values: unknown[]) {
  if (!key.startsWith(OTTO_CACHE_PREFIX)) throw new Error("Invalid OTTO cache key.");
  try {
    const encoded = JSON.stringify({ expires, values });
    const entries: Array<{ key: string; expires: number; bytes: number }> = [];
    for (const cachedKey of ottoCacheKeys(storage)) {
      const raw = storage.getItem(cachedKey) || "";
      let saved;
      try { saved = JSON.parse(raw); } catch { /* Remove malformed cache entries below. */ }
      if (cachedKey === key || !saved || !Number.isFinite(saved.expires) || saved.expires <= Date.now() || !Array.isArray(saved.values)) {
        storage.removeItem(cachedKey);
      } else {
        entries.push({ key: cachedKey, expires: saved.expires, bytes: 2 * (cachedKey.length + raw.length) });
      }
    }
    const bytes = 2 * (key.length + encoded.length);
    let total = entries.reduce((sum, entry) => sum + entry.bytes, bytes <= MAX_OTTO_CACHE_BYTES ? bytes : 0);
    for (const entry of entries.sort((a, b) => a.expires - b.expires)) {
      if (total <= MAX_OTTO_CACHE_BYTES) break;
      storage.removeItem(entry.key);
      total -= entry.bytes;
    }
    if (bytes <= MAX_OTTO_CACHE_BYTES) storage.setItem(key, encoded);
  } catch { /* Optional disk cache; the catalog remains available in memory. */ }
}

export function setSessionItem(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch (error) {
    if (!(error instanceof Error) || !["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(error.name)) throw error;
    // A disposable catalog cache must never prevent saving an authenticated session.
    for (const cachedKey of ottoCacheKeys(storage)) storage.removeItem(cachedKey);
    storage.setItem(key, value);
  }
}
