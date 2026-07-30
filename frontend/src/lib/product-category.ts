export function formatProductCategoryLabel(category: unknown) {
  const value = String(category ?? "").trim();
  return value ? `Categoría: ${value}` : null;
}
