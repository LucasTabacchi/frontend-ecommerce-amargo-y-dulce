export type CheckoutSummaryItem = {
  price?: unknown;
  off?: unknown;
  qty?: unknown;
};

export type CheckoutDisplaySummaryInput = {
  items: CheckoutSummaryItem[];
  effectiveSubtotal: number;
  effectiveDiscount: number;
  effectiveTotal: number;
};

function normalizeMoney(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function normalizeOptionalMoney(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

function normalizeQty(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function originalItemsSubtotal(items: CheckoutSummaryItem[]) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    return acc + normalizeMoney(item?.price) * normalizeQty(item?.qty);
  }, 0);
}

export function buildCheckoutDisplaySummary(input: CheckoutDisplaySummaryInput) {
  const originalSubtotal = Math.round(originalItemsSubtotal(input.items));
  const effectiveSubtotal = Math.round(normalizeMoney(input.effectiveSubtotal));
  const effectiveDiscount = Math.round(normalizeMoney(input.effectiveDiscount));
  const fallbackTotal = Math.max(0, effectiveSubtotal - effectiveDiscount);
  const providedTotal = normalizeOptionalMoney(input.effectiveTotal);
  const totalBeforeShipping = Math.round(providedTotal ?? fallbackTotal);
  const subtotal = Math.max(originalSubtotal, effectiveSubtotal, totalBeforeShipping);
  const discount = Math.max(0, subtotal - totalBeforeShipping);

  return {
    subtotal,
    discount,
    totalBeforeShipping,
  };
}
