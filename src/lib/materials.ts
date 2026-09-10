export function materialPair(values?: string[] | null): [string, string] {
  const list = (values || []).map((item) => String(item).trim()).filter(Boolean);
  return [list[0] ?? "", list[1] ?? ""];
}

export function materialsPayload(first: string, second: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const raw of [first, second]) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}
