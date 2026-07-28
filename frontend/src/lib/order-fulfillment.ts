export type NormalizedOrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "failed"
  | "cancelled"
  | "unknown";

export type FulfillmentMethod = "delivery" | "pickup";

export type TrackingStep = {
  key: "pending" | "paid" | "shipped" | "delivered";
  label: string;
};

export function normalizeOrderStatus(status?: string | null): NormalizedOrderStatus {
  const value = String(status || "").toLowerCase();
  if (value === "paid") return "paid";
  if (value === "pending") return "pending";
  if (value === "shipped") return "shipped";
  if (value === "delivered") return "delivered";
  if (value === "failed") return "failed";
  if (value === "cancelled") return "cancelled";
  return "unknown";
}

export function getFulfillmentMethod(order: {
  shippingMethod?: string | null;
  pickupPoint?: string | null;
  shippingAddress?: { source?: string | null; label?: string | null; text?: string | null } | null;
}): FulfillmentMethod {
  const shippingMethod = String(order?.shippingMethod || "").trim().toLowerCase();
  if (shippingMethod === "pickup") return "pickup";

  const addressSource = String(order?.shippingAddress?.source || "").trim().toLowerCase();
  if (addressSource === "pickup") return "pickup";

  const pickupPoint = String(order?.pickupPoint || "").trim();
  if (pickupPoint) return "pickup";

  const addressText = String(order?.shippingAddress?.text || order?.shippingAddress?.label || "")
    .trim()
    .toLowerCase();
  if (addressText.includes("retiro en sucursal")) return "pickup";

  return "delivery";
}

export function getOrderStatusLabel(
  status?: string | null,
  fulfillmentMethod: FulfillmentMethod = "delivery"
) {
  const normalized = normalizeOrderStatus(status);
  const isPickup = fulfillmentMethod === "pickup";

  if (normalized === "paid") return "Pagado";
  if (normalized === "pending") return "Pendiente";
  if (normalized === "shipped") return isPickup ? "Listo para retirar" : "Enviado";
  if (normalized === "delivered") return isPickup ? "Retirado" : "Entregado";
  if (normalized === "failed") return "Fallido";
  if (normalized === "cancelled") return "Cancelado";
  return "—";
}

export function getTrackingSteps(fulfillmentMethod: FulfillmentMethod = "delivery"): TrackingStep[] {
  const isPickup = fulfillmentMethod === "pickup";

  return [
    { key: "pending", label: "Pendiente" },
    { key: "paid", label: "Pagado" },
    { key: "shipped", label: isPickup ? "Listo para retirar" : "Enviado" },
    { key: "delivered", label: isPickup ? "Retirado" : "Entregado" },
  ];
}

export function getOrderActionByStatus(
  status?: string | null,
  fulfillmentMethod: FulfillmentMethod = "delivery"
) {
  const normalized = normalizeOrderStatus(status);
  const isPickup = fulfillmentMethod === "pickup";

  if (normalized === "paid") {
    return {
      nextStatus: "shipped",
      label: isPickup ? "Marcar como listo para retirar" : "Marcar como enviado",
    };
  }

  if (normalized === "shipped") {
    return {
      nextStatus: "delivered",
      label: isPickup ? "Marcar como retirado" : "Marcar como entregado",
    };
  }

  return null;
}
