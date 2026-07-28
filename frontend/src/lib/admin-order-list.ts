export type AdminOrderListRow = {
  id?: string | number | null;
  orderNumber?: string | number | null;
};

function normalizeOrderIdentifier(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function removeAdminOrderFromCurrentList<T extends AdminOrderListRow>(
  orders: T[],
  orderIdOrNumber: string | number | null | undefined
) {
  const target = normalizeOrderIdentifier(orderIdOrNumber);
  if (!target) return orders;

  const next = orders.filter((order) => {
    const id = normalizeOrderIdentifier(order.id);
    const orderNumber = normalizeOrderIdentifier(order.orderNumber);
    return id !== target && orderNumber !== target;
  });

  return next.length === orders.length ? orders : next;
}
