export type ProductReviewTarget = {
  productDocumentId?: string | null;
  productId?: number | string | null;
};

export type ReviewPermissionReason = "not_purchased" | "already_reviewed" | null;

function flat(row: any) {
  return row?.attributes ? { id: row?.id, ...row.attributes } : row ?? {};
}

function text(v: unknown) {
  return String(v ?? "").trim();
}

function numericId(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function pickProductDocumentId(row: any) {
  const f = flat(row);
  return (
    text(f?.productDocumentId) ||
    text(f?.product_documentId) ||
    text(f?.product?.documentId) ||
    text(f?.product?.data?.documentId) ||
    text(f?.product?.data?.attributes?.documentId) ||
    text(f?.documentId) ||
    ""
  );
}

function pickProductId(row: any) {
  const f = flat(row);
  return (
    numericId(f?.productId) ??
    numericId(f?.id_producto) ??
    numericId(f?.product?.id) ??
    numericId(f?.product?.data?.id) ??
    numericId(f?.id) ??
    null
  );
}

function isCompletedOrder(order: any) {
  const f = flat(order);
  const status = text(f?.orderStatus ?? f?.status ?? f?.paymentStatus).toLowerCase();
  return ["paid", "shipped", "delivered", "approved", "success"].includes(status);
}

function productMatches(row: any, target: ProductReviewTarget) {
  const wantedDoc = text(target.productDocumentId);
  const wantedId = numericId(target.productId);
  const rowDoc = pickProductDocumentId(row);
  const rowId = pickProductId(row);

  if (wantedDoc && rowDoc && wantedDoc === rowDoc) return true;
  if (wantedId && rowId && wantedId === rowId) return true;
  return false;
}

export function hasPurchasedProduct(orders: any[], target: ProductReviewTarget) {
  return (Array.isArray(orders) ? orders : []).some((order) => {
    if (!isCompletedOrder(order)) return false;
    const f = flat(order);
    const items = Array.isArray(f?.items) ? f.items : [];
    return items.some((item: any) => productMatches(item, target));
  });
}

export function hasExistingUserReview(
  reviews: any[],
  userKey: string,
  target: ProductReviewTarget,
) {
  const normalizedUserKey = text(userKey).toLowerCase();
  if (!normalizedUserKey) return false;

  return (Array.isArray(reviews) ? reviews : []).some((review) => {
    const f = flat(review);
    const reviewUserKey = text(
      f?.userKey ?? f?.name ?? f?.email ?? f?.user?.email ?? f?.user?.data?.attributes?.email
    ).toLowerCase();

    return reviewUserKey === normalizedUserKey && productMatches(f, target);
  });
}

export function buildReviewPermission(
  purchased: boolean,
  alreadyReviewed: boolean,
): { canReview: boolean; reason: ReviewPermissionReason } {
  if (!purchased) return { canReview: false, reason: "not_purchased" };
  if (alreadyReviewed) return { canReview: false, reason: "already_reviewed" };
  return { canReview: true, reason: null };
}
