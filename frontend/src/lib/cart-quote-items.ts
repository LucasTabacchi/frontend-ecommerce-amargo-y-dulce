export type CartQuoteSourceItem = {
  id?: unknown;
  documentId?: unknown;
  productDocumentId?: unknown;
  slug?: unknown;
  qty?: unknown;
};

export type CartQuoteItem = {
  id: number | null;
  documentId: string | null;
  slug: string | null;
  qty: number;
};

function normalizeId(value: unknown) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeQty(value: unknown) {
  const qty = Number(value);
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.floor(qty));
}

export function buildCartQuoteItems(items: CartQuoteSourceItem[]): CartQuoteItem[] {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: normalizeId(item?.id),
      documentId: normalizeText(item?.documentId ?? item?.productDocumentId),
      slug: normalizeText(item?.slug),
      qty: normalizeQty(item?.qty),
    }))
    .filter((item) => item.id !== null || Boolean(item.documentId) || Boolean(item.slug));
}
