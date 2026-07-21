export type CartAvailabilityStatus = "available" | "insufficient" | "paused";

export type CartAvailabilityItem = {
  documentId?: string | null;
  slug?: string | null;
  qty?: number | null;
  price?: number | null;
  off?: number | null;
};

export type ProductAvailability = {
  documentId?: string | null;
  slug?: string | null;
  stock?: number | null;
  isActive?: boolean | null;
};

export type CartItemAvailability = {
  status: CartAvailabilityStatus;
  purchasable: boolean;
  message: string | null;
  availableStock: number | null;
};

function normalizeQty(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function normalizeStock(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

function priceWithOff(price: unknown, off: unknown) {
  const amount = Number(price);
  const discount = Number(off);
  const safePrice = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  if (!Number.isFinite(discount) || discount <= 0) return safePrice;
  return Math.round(safePrice * (1 - Math.min(100, discount) / 100));
}

export function getCartItemAvailability(
  item: CartAvailabilityItem,
  product?: ProductAvailability | null
): CartItemAvailability {
  const stock = normalizeStock(product?.stock);
  const isActive = product ? product.isActive !== false : false;
  const qty = normalizeQty(item?.qty);

  if (!product || !isActive || stock === 0) {
    return {
      status: "paused",
      purchasable: false,
      message: "Publicación pausada",
      availableStock: stock,
    };
  }

  if (typeof stock === "number" && qty > stock) {
    return {
      status: "insufficient",
      purchasable: false,
      message: "Stock insuficiente",
      availableStock: stock,
    };
  }

  return {
    status: "available",
    purchasable: true,
    message: null,
    availableStock: stock,
  };
}

export function getCartAvailabilitySummary(
  items: CartAvailabilityItem[],
  productsByKey: Map<string, ProductAvailability>
) {
  let purchasableSubtotal = 0;
  let blockedCount = 0;

  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const key = String(item?.documentId || item?.slug || "").trim();
    const product = key ? productsByKey.get(key) : null;
    const availability = getCartItemAvailability(item, product);

    if (availability.purchasable) {
      purchasableSubtotal += priceWithOff(item?.price, item?.off) * normalizeQty(item?.qty);
    } else {
      blockedCount += 1;
    }

    return { key, item, product, availability };
  });

  return {
    rows,
    blockedCount,
    hasBlockedItems: blockedCount > 0,
    purchasableSubtotal,
  };
}
