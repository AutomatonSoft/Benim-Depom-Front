export function toggleSellerMultiValue(selected: string[], value: string) {
  return selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value];
}
