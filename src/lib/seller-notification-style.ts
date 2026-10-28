export function sellerNotificationTone(type: string) {
  if (type === "product_sold") return "sale";
  if (type.includes("price")) return "price";
  if (type.includes("availability") || type.includes("confirmation")) return "availability";
  if (type.includes("rejected") || type.includes("change_requested")) return "warning";
  if (type.includes("approved")) return "approved";
  if (type.includes("message")) return "message";
  return "update";
}
