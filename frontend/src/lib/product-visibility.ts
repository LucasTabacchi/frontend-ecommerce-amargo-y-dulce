export function applyPublicProductVisibilityFilter(sp: URLSearchParams) {
  sp.set("filters[stock][$gt]", "0");
  return sp;
}

function pickAttr(row: any) {
  return row?.attributes ?? row ?? {};
}

function pickStock(row: any): number | null {
  const attr = pickAttr(row);
  const raw = attr?.stock ?? row?.stock ?? null;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function isPubliclyVisibleProduct(product: any) {
  const stock = pickStock(product);
  return typeof stock === "number" && stock > 0;
}

export function filterPubliclyVisibleProducts<T>(products: T[]): T[] {
  return (Array.isArray(products) ? products : []).filter(isPubliclyVisibleProduct);
}

export function filterPublicProductCards<T extends { stock?: unknown }>(products: T[]): T[] {
  return (Array.isArray(products) ? products : []).filter(isPubliclyVisibleProduct);
}
