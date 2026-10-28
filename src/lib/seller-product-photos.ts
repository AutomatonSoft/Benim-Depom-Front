export function makeSellerPhotoPrimary<T>(photos: readonly T[], index: number): T[] {
  const next = [...photos];
  if (index > 0 && index < next.length) [next[0], next[index]] = [next[index], next[0]];
  return next;
}

export function reorderSellerPhoto<T>(photos: readonly T[], from: number, to: number): T[] {
  const next = [...photos];
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
  const [photo] = next.splice(from, 1);
  next.splice(to, 0, photo);
  return next;
}
