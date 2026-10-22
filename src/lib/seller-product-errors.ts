const fields = new Set([
  "title", "product_type", "unit_price", "currency", "warehouse_city", "color", "materials", "material_composition",
  "width_cm", "height_cm", "length_cm", "quantity", "set_parts", "otto_attributes", "images", "change_comment",
  "variants",
]);

function flatten(value: unknown, path: string): Array<[string, string]> {
  if (Array.isArray(value)) return value.flatMap((item, index) => flatten(item, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => flatten(item, path ? `${path}.${key}` : key));
  if (typeof value === "string" || typeof value === "number") return [[path, String(value)]];
  return [];
}

function fieldForPath(path: string) {
  const parts = path.replace(/\[\d+\]/g, "").split(".").filter(Boolean);
  const leaf = parts.at(-1) || "";
  if (parts[0] === "set_parts") return "set_parts";
  if (parts[0] === "otto_attributes" || parts[0] === "otto_category_id" || parts[0] === "otto_category_group_id") return "otto_attributes";
  if (fields.has(leaf)) return leaf;
  const root = parts[0];
  return root === "variants" ? "variants" : "form";
}

export function sellerProductErrorDetails(data: unknown) {
  const fieldErrors: Record<string, string[]> = {};
  let message = "";
  for (const [path, text] of flatten(data, "")) {
    if (path === "detail" || path === "non_field_errors") {
      message ||= text;
      continue;
    }
    const field = fieldForPath(path);
    (fieldErrors[field] ||= []).push(text);
  }
  return {
    fields: Object.fromEntries(Object.entries(fieldErrors).map(([field, errors]) => [field, errors.join(" ")])),
    message: message || (fieldErrors.form ? "Some product details need attention. Review the form and try again." : ""),
  };
}
