export function getLowStockLabel(stock: unknown, threshold = 3) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return null;

  const available = Math.trunc(n);
  if (available <= 0 || available > threshold) return null;

  return available === 1 ? "ULTIMA UNIDAD" : `ULTIMAS ${available}`;
}

export function getCartLowStockBadgeLabel(stock: unknown, threshold = 10) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return null;

  const available = Math.trunc(n);
  if (available <= 0 || available > threshold) return null;

  return available === 1 ? "¡ÚLTIMA!" : `ÚLTIMAS ${available}`;
}

export function getDetailStockLine(stock: unknown) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return null;

  const available = Math.trunc(n);
  if (available <= 0) return null;

  const availabilityLabel = getDetailAvailabilityLabel(stock);
  if (!availabilityLabel) return "Cantidad: 1 unidad";

  return `Cantidad: 1 unidad (${availabilityLabel})`;
}

export function getDetailAvailabilityLabel(stock: unknown) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return null;

  const available = Math.trunc(n);
  if (available <= 0 || available <= 10) return null;
  return "+10 disponibles";
}

export function getDetailStockWarning(stock: unknown) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return null;

  const available = Math.trunc(n);
  if (available <= 0 || available > 10) return null;
  return available === 1
    ? "¡Últimas unidades! — Queda 1 disponible"
    : `¡Últimas unidades! — Quedan ${available} disponibles`;
}

export function getQuantityOptions(stock: unknown, maxOptions = 6) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return [];

  const available = Math.max(0, Math.trunc(n));
  if (available <= 0) return [];

  const limit = Math.max(1, Math.trunc(maxOptions));
  return Array.from({ length: limit }, (_, index) => index + 1);
}

export function getStockExceededMessage(
  stock: unknown,
  requestedQuantity: unknown,
  currentQuantity = 0,
) {
  if (stock === null || stock === undefined || stock === "") return null;

  const available = Number(stock);
  if (!Number.isFinite(available)) return null;

  const requested = Number(requestedQuantity);
  if (!Number.isFinite(requested)) return null;

  const current = Number(currentQuantity);
  const inCart = Number.isFinite(current) ? Math.max(0, Math.trunc(current)) : 0;
  const remaining = Math.max(0, Math.trunc(available) - inCart);

  return Math.trunc(requested) > remaining ? "Sin stock" : null;
}

export function getCartLimitReachedMessage(stock: unknown, currentQuantity: unknown) {
  if (stock === null || stock === undefined || stock === "") return null;

  const available = Number(stock);
  if (!Number.isFinite(available) || available <= 0) return null;

  const current = Number(currentQuantity);
  if (!Number.isFinite(current)) return null;

  return Math.trunc(current) >= Math.trunc(available)
    ? "Ya tenés todas las unidades disponibles en el carrito"
    : null;
}

export function getOutOfStockDetailCopy(stock: unknown) {
  if (stock === null || stock === undefined || stock === "") return null;

  const n = Number(stock);
  if (!Number.isFinite(n)) return null;

  const available = Math.trunc(n);
  if (available > 0) return null;

  return {
    actionLabel: "No hay stock",
    badgeLabel: null,
    helperText: null,
  };
}
