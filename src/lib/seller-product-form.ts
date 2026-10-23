export function sellerMaterialInputs(materials: string[] = []) {
  return { material1: materials[0] || "", material2: materials[1] || "" };
}

export function sellerMaterials(first: string, second: string) {
  return [first.trim(), second.trim()].filter(Boolean);
}
