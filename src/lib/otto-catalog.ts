export type OttoAttributeValue = string | number;
export type OttoCatalogPage<T> = { results: T[]; next: number | null };

export function updateOttoAttribute(attributes: Record<string, unknown>, id: number, value: unknown) {
  const next = { ...attributes };
  const key = String(id);
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) delete next[key];
  else next[key] = value;
  return next;
}

export function parseOttoAttributeValue(type: string, raw: unknown): OttoAttributeValue | null {
  if (raw == null) return null;
  if (type === "STRING") return String(raw);
  if (type !== "INTEGER" && type !== "FLOAT") return null;

  const value = Number(raw);
  if (!Number.isFinite(value) || (type === "INTEGER" && !Number.isSafeInteger(value))) return null;
  return value;
}

export async function loadOttoCatalogPages<T>(
  path: string,
  request: (url: string) => Promise<OttoCatalogPage<T>>,
): Promise<T[]> {
  const values: T[] = [];
  let page = 1;
  let next: number | null;
  do {
    const response = await request(`${path}?page=${page}&limit=200`);
    values.push(...response.results);
    next = response.next;
    if (next) page = next;
  } while (next);
  return values;
}
