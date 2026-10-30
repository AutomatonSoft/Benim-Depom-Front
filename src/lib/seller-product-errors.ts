import { sellerApiErrorDetails, sellerErrorEntries, sellerErrorMessage } from "./seller-error-messages.ts";

const fields = new Set([
  "title", "model", "product_type", "unit_price", "currency", "warehouse_city", "color", "materials", "material_composition",
  "width_cm", "height_cm", "length_cm", "quantity", "set_parts", "otto_attributes", "images", "change_comment",
  "variants",
]);

function fieldForPath(path: string) {
  const part = path.match(/^set_parts(?:\[(\d+)\]|\.(\d+))\.(description|width_cm|height_cm|length_cm)/);
  if (part) return `set_part_${part[1] ?? part[2]}_${part[3]}`;
  const parts = path.replace(/\[\d+\]/g, "").split(".").filter(Boolean);
  const leaf = parts.at(-1) || "";
  if (parts[0] === "set_parts") return "set_parts";
  if (parts[0] === "otto_attributes" || parts[0] === "otto_category_id" || parts[0] === "otto_category_group_id") return "otto_attributes";
  if (["images", "image", "image_ids"].includes(parts[0])) return "images";
  if (leaf === "change_comment") return "change_comment";
  if (fields.has(leaf)) return leaf;
  const root = parts[0];
  return root === "variants" ? "variants" : "form";
}

export function sellerProductErrorDetails(data: unknown) {
  const fieldErrors: Record<string, string[]> = {};
  let message = "";
  for (const { path, text } of sellerErrorEntries(data)) {
    const friendly = sellerErrorMessage(text) || sellerApiErrorDetails(null).message;
    if (path === "detail" || path === "non_field_errors" || path === "") {
      message ||= friendly;
      continue;
    }
    const field = fieldForPath(path);
    (fieldErrors[field] ||= []).push(friendly);
  }
  return {
    fields: Object.fromEntries(Object.entries(fieldErrors).map(([field, errors]) => [field, errors.join(" ")])),
    message: message || fieldErrors.form?.join("\n") || "",
  };
}
