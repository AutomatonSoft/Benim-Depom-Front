export function eanIsValid(value: string) {
  if (!/^(?:[0-9]{8}|[0-9]{13})$/.test(value)) return false;
  const body = value.slice(0, -1);
  const sum = Array.from(body)
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(value.slice(-1));
}

export function parseEanTokens(value: string) {
  return value.split(/[\s,;]+/).map((ean) => ean.trim()).filter(Boolean);
}

export function parseEans(value: string) {
  return Array.from(new Set(parseEanTokens(value)));
}
