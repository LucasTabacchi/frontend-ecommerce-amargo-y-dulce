export type CouponOptionRow = {
  id?: number | string | null;
  documentId?: string | null;
  code?: string | null;
  name?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  exhausted?: boolean | null;
  isNotStarted?: boolean | null;
  isExpired?: boolean | null;
  isAvailable?: boolean | null;
};

export type CouponOption = {
  id: number;
  documentId: string | null;
  code: string;
  name: string;
  startAt: string | null;
  endAt: string | null;
  exhausted: boolean;
  isNotStarted: boolean;
  isExpired: boolean;
  isAvailable: boolean;
  unavailableLabel: string | null;
};

export function normalizeCouponCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
}

export function buildCouponOptions(rows: readonly CouponOptionRow[], nowMs = Date.now()) {
  const options = new Map<string, CouponOption>();

  for (const row of rows) {
    const code = normalizeCouponCode(row?.code);
    if (!code || options.has(code)) continue;

    const startAt = normalizeOptionalString(row?.startAt);
    const endAt = normalizeOptionalString(row?.endAt);
    const startMs = startAt ? Date.parse(startAt) : NaN;
    const endMs = endAt ? Date.parse(endAt) : NaN;

    const exhausted = Boolean(row?.exhausted);
    const isNotStarted =
      typeof row?.isNotStarted === "boolean"
        ? row.isNotStarted
        : Number.isFinite(startMs)
        ? startMs > nowMs
        : false;
    const isExpired =
      typeof row?.isExpired === "boolean"
        ? row.isExpired
        : Number.isFinite(endMs)
        ? endMs < nowMs
        : false;
    const isAvailable =
      typeof row?.isAvailable === "boolean"
        ? row.isAvailable
        : !isNotStarted && !isExpired && !exhausted;
    const unavailableLabel = isExpired
      ? "Vencido"
      : isNotStarted
      ? "Próximamente"
      : exhausted
      ? "Agotado"
      : isAvailable
      ? null
      : "No disponible";

    options.set(code, {
      id: Number.isFinite(Number(row?.id)) ? Number(row?.id) : options.size + 1,
      documentId: normalizeOptionalString(row?.documentId),
      code,
      name: normalizeOptionalString(row?.name) || "Cupón",
      startAt,
      endAt,
      exhausted,
      isNotStarted,
      isExpired,
      isAvailable,
      unavailableLabel,
    });
  }

  return Array.from(options.values());
}

