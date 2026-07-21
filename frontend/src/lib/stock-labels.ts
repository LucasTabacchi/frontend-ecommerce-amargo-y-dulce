export function getLowStockLabel(stock: unknown, threshold = 3) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return null;

  const available = Math.trunc(n);
  if (available <= 0 || available > threshold) return null;

  return available === 1 ? "ULTIMA UNIDAD" : `ULTIMAS ${available}`;
}
