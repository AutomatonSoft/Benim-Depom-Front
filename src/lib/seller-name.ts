export function isValidSellerName(value: string): boolean {
  const name = value.normalize("NFC");
  return [...name].length >= 2 && [...name].length <= 40 && /^\p{L}+$/u.test(name);
}
