export type ShippingMethod = "delivery" | "pickup";

export function calcShippingARS(subtotal: number, method: ShippingMethod) {
  if (method === "pickup") return 0;

  // delivery
  if (subtotal > 65000) return 0;
  if (subtotal > 40000) return 4500;
  return 9000;
}
