export const CLAIMED_COUPONS_KEY = "amg_my_coupon_codes";

export type CouponClaimIdentity = {
  documentId?: string | null;
  code?: string | null;
};

export function normalizeCouponCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function normalizeCouponDocumentId(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
}

export function normalizeClaimedCouponValue(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : "";
}

export function sanitizeClaimedCouponValues(input: unknown, max = 200) {
  const source = Array.isArray(input) ? input : [];
  const values = new Set<string>();

  for (const raw of source) {
    const normalized = normalizeClaimedCouponValue(raw);
    if (!normalized) continue;
    values.add(normalized);
    if (values.size >= max) break;
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function toClaimedSet(values: Iterable<string> | readonly string[]) {
  return values instanceof Set
    ? values
    : new Set(sanitizeClaimedCouponValues(Array.isArray(values) ? values : Array.from(values ?? [])));
}

function hasLegacyCouponCode(claimed: Set<string>, legacyCode: string) {
  for (const value of claimed) {
    if (normalizeCouponCode(value) === legacyCode) return true;
  }
  return false;
}

function removeLegacyCouponCode(claimed: Set<string>, legacyCode: string) {
  let changed = false;

  for (const value of Array.from(claimed)) {
    if (normalizeCouponCode(value) !== legacyCode) continue;
    claimed.delete(value);
    changed = true;
  }

  return changed;
}

export function getPreferredCouponClaimValue(coupon: CouponClaimIdentity) {
  return normalizeCouponDocumentId(coupon.documentId) || normalizeCouponCode(coupon.code) || null;
}

export function isCouponClaimed(
  claimedValues: Iterable<string> | readonly string[],
  coupon: CouponClaimIdentity
) {
  const claimed = toClaimedSet(claimedValues);
  const documentId = normalizeCouponDocumentId(coupon.documentId);
  if (documentId && claimed.has(documentId)) return true;

  const legacyCode = normalizeCouponCode(coupon.code);
  if (legacyCode && hasLegacyCouponCode(claimed, legacyCode)) return true;

  return false;
}

export function markCouponClaimed(
  claimedValues: Iterable<string> | readonly string[],
  coupon: CouponClaimIdentity
) {
  const next = new Set(toClaimedSet(claimedValues));
  const preferredValue = getPreferredCouponClaimValue(coupon);
  const legacyCode = normalizeCouponCode(coupon.code);
  let changed = false;

  if (!preferredValue) {
    return { values: Array.from(next).sort((a, b) => a.localeCompare(b)), changed };
  }

  if (!next.has(preferredValue)) {
    next.add(preferredValue);
    changed = true;
  }

  if (preferredValue !== legacyCode && legacyCode) {
    changed = removeLegacyCouponCode(next, legacyCode) || changed;
  }

  return { values: Array.from(next).sort((a, b) => a.localeCompare(b)), changed };
}

export function migrateClaimedCoupon(
  claimedValues: Iterable<string> | readonly string[],
  coupon: CouponClaimIdentity
) {
  const isClaimed = isCouponClaimed(claimedValues, coupon);
  if (!isClaimed) {
    return {
      values: sanitizeClaimedCouponValues(Array.isArray(claimedValues) ? claimedValues : Array.from(claimedValues ?? [])),
      changed: false,
      isClaimed: false,
    };
  }

  const upgraded = markCouponClaimed(claimedValues, coupon);
  return { ...upgraded, isClaimed: true };
}

export function migrateClaimedCouponsForList<T extends CouponClaimIdentity>(
  claimedValues: Iterable<string> | readonly string[],
  coupons: readonly T[]
) {
  let nextValues = sanitizeClaimedCouponValues(
    Array.isArray(claimedValues) ? claimedValues : Array.from(claimedValues ?? [])
  );
  let changed = false;

  for (const coupon of coupons) {
    const migrated = migrateClaimedCoupon(nextValues, coupon);
    nextValues = migrated.values;
    changed = changed || migrated.changed;
  }

  return { values: nextValues, changed };
}
