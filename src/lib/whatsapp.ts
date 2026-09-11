export function whatsappChatUrl(phone: string | null | undefined): string | null {
  const raw = (phone || "").trim();
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 8) return null;

  return `https://wa.me/${digits}`;
}
