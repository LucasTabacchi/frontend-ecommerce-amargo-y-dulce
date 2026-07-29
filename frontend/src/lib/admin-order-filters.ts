export type AdminOrderStatusFilter = "paid" | "ready";

export function parseAdminOrderStatusFilter(raw?: string | null): AdminOrderStatusFilter {
  const value = String(raw ?? "").trim().toLowerCase();
  if (
    value === "ready" ||
    value === "delivery_shipped" ||
    value === "pickup_ready" ||
    value === "shipped"
  ) {
    return "ready";
  }

  return "paid";
}

export function getAdminOrderStatusFilterLabel(filter: AdminOrderStatusFilter) {
  if (filter === "ready") return "enviados o listos para retirar";
  return "pagados (para preparar)";
}

export function applyAdminOrderStatusFilter(
  searchParams: URLSearchParams,
  filter: AdminOrderStatusFilter
) {
  searchParams.set("filters[orderStatus][$eqi]", filter === "ready" ? "shipped" : "paid");
}
