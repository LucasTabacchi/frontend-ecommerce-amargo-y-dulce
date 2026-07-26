type OrderLookupInput = {
  orderId: string;
  userDocumentId?: string | null;
  userId?: string | number | null;
};

type ProductLike = {
  id?: string | number | null;
  documentId?: string | null;
  attributes?: Record<string, any> | null;
  [key: string]: any;
};

function normalizeStatus(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function flattenProduct(row: ProductLike | null | undefined) {
  if (!row) return {};
  return row.attributes ? { id: row.id ?? null, documentId: row.documentId ?? null, ...row.attributes } : row;
}

function readMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function readOff(value: unknown) {
  const off = Number(value);
  return Number.isFinite(off) && off > 0 ? Math.min(100, Math.round(off)) : null;
}

function priceWithOff(price: number, off: number | null) {
  return off ? Math.round(price * (1 - off / 100)) : price;
}

export function canRetryOrderPayment(status?: string | null) {
  return normalizeStatus(status) === "pending";
}

export function buildUserScopedOrderLookupPath(input: OrderLookupInput) {
  const orderId = String(input.orderId ?? "").trim();
  const userDocumentId = String(input.userDocumentId ?? "").trim();
  const userId = input.userId != null ? String(input.userId).trim() : "";

  const sp = new URLSearchParams();
  sp.set("populate", "*");
  sp.set("filters[documentId][$eq]", orderId);
  sp.set("pagination[pageSize]", "1");

  if (userDocumentId) {
    sp.set("filters[user][documentId][$eq]", userDocumentId);
  } else if (userId) {
    sp.set("filters[user][id][$eq]", userId);
  }

  return `/api/orders?${sp.toString()}`;
}

export function buildRetriedOrderItems(items: any[], productsByDocumentId: Map<string, ProductLike>) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const productDocumentId = String(
        item?.productDocumentId ?? item?.product_documentId ?? item?.documentId ?? ""
      ).trim();
      if (!productDocumentId) return null;

      const product = flattenProduct(productsByDocumentId.get(productDocumentId));
      const qty = Math.max(1, Math.floor(Number(item?.qty ?? item?.quantity ?? 1) || 1));
      const price = readMoney(product?.price ?? item?.price);
      const off = readOff(product?.off ?? item?.off);

      return {
        productId: Number.isFinite(Number(product?.id ?? item?.productId ?? item?.id))
          ? Number(product?.id ?? item?.productId ?? item?.id)
          : null,
        productDocumentId,
        slug: String(product?.slug ?? item?.slug ?? "").trim(),
        title: String(product?.title ?? item?.title ?? "Producto").trim() || "Producto",
        qty,
        unit_price: priceWithOff(price, off),
        price,
        off,
      };
    })
    .filter(Boolean);
}

export function buildRetriedOrderUpdateData(params: {
  quoteJson: any;
  shippingCost: number;
  totalNumber: number;
  items: any[];
  fallbackCoupon?: string | null;
}) {
  const quoteCoupon = params.quoteJson?.coupon;
  const coupon =
    quoteCoupon?.applied === true
      ? String(quoteCoupon?.code ?? params.fallbackCoupon ?? "").trim() || null
      : null;

  return {
    subtotal: readMoney(params.quoteJson?.subtotal),
    discountTotal: readMoney(params.quoteJson?.discountTotal),
    appliedPromotions: Array.isArray(params.quoteJson?.appliedPromotions)
      ? params.quoteJson.appliedPromotions
      : [],
    coupon,
    shippingCost: readMoney(params.shippingCost),
    total: readMoney(params.totalNumber),
    items: Array.isArray(params.items) ? params.items : [],
  };
}
