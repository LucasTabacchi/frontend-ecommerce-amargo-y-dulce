type PendingOrderLookupInput = {
  userDocumentId?: string | null;
  userId?: string | number | null;
};

type NormalizedOrderItem = ReturnType<typeof normalizeItem>;

function flattenRow(row: any) {
  if (!row) return null;
  if (row?.attributes) return { id: row.id ?? null, documentId: row.documentId ?? null, ...row.attributes };
  return row;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeMoney(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function normalizeQty(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
}

function normalizeNullableText(value: unknown) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeItem(item: any) {
  const productDocumentId = normalizeNullableText(
    item?.productDocumentId ?? item?.product_documentId ?? item?.documentId
  );
  const productId = Number(item?.productId ?? item?.id);

  return {
    productDocumentId,
    productId: Number.isFinite(productId) && productId > 0 ? Math.floor(productId) : null,
    slug: normalizeNullableText(item?.slug),
    qty: normalizeQty(item?.qty ?? item?.quantity),
    price: normalizeMoney(item?.price),
    unitPrice: normalizeMoney(item?.unit_price ?? item?.unitPrice ?? item?.price),
    off: item?.off == null ? null : normalizeMoney(item.off),
  };
}

function normalizeAddress(address: any) {
  const structured = {
    source: normalizeNullableText(address?.source),
    addressId: normalizeNullableText(address?.addressId ?? address?.id),
    label: normalizeNullableText(address?.label),
    street: normalizeNullableText(address?.street),
    number: normalizeNullableText(address?.number),
    floor: normalizeNullableText(address?.floor),
    apartment: normalizeNullableText(address?.apartment),
    city: normalizeNullableText(address?.city),
    province: normalizeNullableText(address?.province),
    postalCode: normalizeNullableText(address?.postalCode ?? address?.zip),
  };
  const hasStructuredAddress = Boolean(
    structured.street ||
      structured.number ||
      structured.city ||
      structured.province ||
      structured.postalCode
  );

  return {
    ...structured,
    text: hasStructuredAddress ? null : normalizeNullableText(address?.text),
  };
}

export function buildPendingOrderLookupPath(input: PendingOrderLookupInput) {
  const userDocumentId = String(input.userDocumentId ?? "").trim();
  const userId = input.userId != null ? String(input.userId).trim() : "";

  const sp = new URLSearchParams();
  sp.set("pagination[pageSize]", "20");
  sp.set("sort[0]", "createdAt:desc");
  sp.set("populate", "*");
  sp.set("filters[orderStatus][$eq]", "pending");

  if (userDocumentId) {
    sp.set("filters[user][documentId][$eq]", userDocumentId);
  } else if (userId) {
    sp.set("filters[user][id][$eq]", userId);
  }

  return `/api/orders?${sp.toString()}`;
}

export function getPendingOrderSignature(order: any) {
  const flat = flattenRow(order) ?? {};
  const items = (Array.isArray(flat?.items) ? flat.items : [])
    .map(normalizeItem)
    .sort((a: NormalizedOrderItem, b: NormalizedOrderItem) => {
      const ak = `${a.productDocumentId ?? ""}|${a.productId ?? ""}|${a.slug ?? ""}`;
      const bk = `${b.productDocumentId ?? ""}|${b.productId ?? ""}|${b.slug ?? ""}`;
      return ak.localeCompare(bk);
    });

  return {
    shippingMethod: normalizeText(flat?.shippingMethod || "delivery"),
    pickupPoint: normalizeNullableText(flat?.pickupPoint),
    shippingCost: normalizeMoney(flat?.shippingCost),
    coupon: normalizeNullableText(flat?.coupon),
    total: normalizeMoney(flat?.total),
    shippingAddress: normalizeAddress(flat?.shippingAddress ?? {}),
    items,
  };
}

export function findMatchingPendingOrder(candidates: any[], currentOrderData: any) {
  const target = JSON.stringify(getPendingOrderSignature(currentOrderData));

  for (const row of Array.isArray(candidates) ? candidates : []) {
    const flat = flattenRow(row);
    if (normalizeText(flat?.orderStatus) !== "pending") continue;
    if (JSON.stringify(getPendingOrderSignature(flat)) === target) return flat;
  }

  return null;
}
