export function isValidSellerPhone(value: string): boolean {
  if (!value.trim()) return true;
  const compact = value.trim().replace(/[\s().-]/g, "").replace(/^00/, "+");
  return /^\+?[1-9]\d{7,14}$/.test(compact);
}
