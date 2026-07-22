export function shouldAdjustStockForPaidOrder(params: {
  previousStatus?: string | null;
  nextStatus?: string | null;
  stockAdjusted?: boolean | null;
}) {
  const next = String(params.nextStatus ?? "").trim().toLowerCase();
  return next === "paid" && params.stockAdjusted !== true;
}
