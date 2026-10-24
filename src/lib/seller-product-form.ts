export function sellerProductFormData(payload: Record<string, unknown>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    form.append(key, ["variants", "set_parts", "otto_attributes"].includes(key) ? JSON.stringify(value) : value == null ? "" : String(value));
  }
  return form;
}

export function sellerMaterialInputs(materials: string[] = []) {
  return { material1: materials[0] || "", material2: materials[1] || "" };
}

export function sellerProductReviewFields(status: string, comment: string, readyForReview: boolean) {
  return {
    ...(readyForReview && ["draft", "rejected", "withdrawn"].includes(status) ? { resubmit_for_moderation: true } : {}),
    ...((status === "approved" && comment.trim().length > 0) || (status === "rejected" && readyForReview) ? { change_comment: comment.trim() } : {}),
  };
}

export function sellerMaterials(first: string, second: string) {
  return [first.trim(), second.trim()].filter(Boolean);
}

export const sellerProductTypes = ["Sofa", "Armchair", "Table", "Chair", "Bed", "Wardrobe", "Cabinet", "Bookshelf", "Desk", "Dresser", "Nightstand", "TV Unit", "Other"] as const;
const legacyProductTypeValues: Record<string, (typeof sellerProductTypes)[number]> = {
  "Диван": "Sofa", "Кресло": "Armchair", "Стол": "Table", "Стул": "Chair", "Кровать": "Bed",
  "Шкаф": "Wardrobe", "ТВ-тумба": "TV Unit", "Письменный стол": "Desk",
};

export function sellerProductTypeLabel(value: string) {
  return legacyProductTypeValues[value] || value;
}

export function sellerProductVariant(fields: {
  color: string;
  material_composition: string;
  width_cm: string;
  height_cm: string;
  length_cm: string;
  quantity: string;
}, materials: string[]) {
  return {
    color: fields.color.trim(),
    materials,
    material_composition: fields.material_composition.trim(),
    width_cm: fields.width_cm,
    height_cm: fields.height_cm,
    length_cm: fields.length_cm,
    quantity: Number(fields.quantity),
  };
}

export function sellerSetPartsPayload(parts: readonly {
  description: string;
  width_cm: string;
  height_cm: string;
  length_cm: string;
}[]) {
  return parts.map(({ description, width_cm, height_cm, length_cm }) => ({
    description: description.trim(), width_cm, height_cm, length_cm,
  }));
}
