export function getLowStockLabel(stock: unknown, threshold = 3) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return null;

  const available = Math.trunc(n);
  if (available <= 0 || available > threshold) return null;

  return available === 1 ? "ULTIMA UNIDAD" : `ULTIMAS ${available}`;
}

export function getDetailStockLine(stock: unknown) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return null;

  const available = Math.trunc(n);
  if (available <= 0) return null;
  if (available === 1) return "Cantidad: 1 unidad";

  const extra = available - 1;
  return `Cantidad: 1 unidad (+${extra} disponible${extra === 1 ? "" : "s"})`;
}

export function getQuantityOptions(stock: unknown, maxOptions = 6) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return [];

  const available = Math.max(0, Math.trunc(n));
  const limit = Math.min(available, Math.max(1, Math.trunc(maxOptions)));
  return Array.from({ length: limit }, (_, index) => index + 1);
}
