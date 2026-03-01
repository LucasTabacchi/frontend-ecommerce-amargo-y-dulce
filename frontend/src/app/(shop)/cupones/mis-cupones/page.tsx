"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";

const CLAIMED_COUPONS_KEY = "amg_my_coupon_codes";

type CouponRow = {
  id: number;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
  minSubtotal?: number | null;
  maxDiscount?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  scopeLabel?: string | null;
  combinable?: boolean;
  exhausted?: boolean;
  isNotStarted?: boolean;
  isExpired?: boolean;
  isAvailable?: boolean;
};

function normalizeCode(code: string) {
  return String(code || "").trim().toUpperCase();
}

function pickApiErrorMessage(payload: any, fallback: string) {
  const msg =
    (typeof payload?.error === "string" && payload.error) ||
    (typeof payload?.error?.message === "string" && payload.error.message) ||
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.details?.error === "string" && payload.details.error) ||
    (typeof payload?.details?.message === "string" && payload.details.message) ||
    null;
  return msg && msg.trim() ? msg.trim() : fallback;
}

function readClaimedCodesFromStorage() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = localStorage.getItem(CLAIMED_COUPONS_KEY);
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(
      parsed
        .map((v) => normalizeCode(String(v)))
        .filter(Boolean)
    );
  } catch {
    return new Set<string>();
  }
}

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function discountLabel(c: CouponRow) {
  const t = String(c.discountType || "").trim().toLowerCase();
  const v = Number(c.discountValue ?? 0);
  if (t === "percent") return `${Math.round(v)}% OFF`;
  if (t === "fixed") return `${formatARS(Math.round(v))} OFF`;
  if (t === "free_shipping") return "Envío gratis";
  return "Beneficio especial";
}

function getCouponUiState(c: CouponRow) {
  const nowMs = Date.now();
  const startMs = c.startAt ? Date.parse(String(c.startAt)) : NaN;
  const endMs = c.endAt ? Date.parse(String(c.endAt)) : NaN;

  const isNotStarted =
    typeof c.isNotStarted === "boolean"
      ? c.isNotStarted
      : Number.isFinite(startMs)
      ? startMs > nowMs
      : false;
  const isExpired =
    typeof c.isExpired === "boolean"
      ? c.isExpired
      : Number.isFinite(endMs)
      ? endMs < nowMs
      : false;
  const isExhausted = Boolean(c.exhausted);
  const isAvailable =
    typeof c.isAvailable === "boolean" ? c.isAvailable : !isNotStarted && !isExpired && !isExhausted;

  let statusLabel: string | null = null;
  if (isExpired) statusLabel = "Vencido";
  else if (isNotStarted) statusLabel = "Próximamente";
  else if (isExhausted) statusLabel = "Agotado";

  return { isAvailable, isExpired, isNotStarted, isExhausted, statusLabel };
}

export default function MisCuponesPage() {
  const router = useRouter();
  const [meLoading, setMeLoading] = useState(true);
  const [me, setMe] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [claimVersion, setClaimVersion] = useState(0);

  useEffect(() => {
    (async () => {
      setMeLoading(true);
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j = await r.json().catch(() => ({ user: null }));
        setMe(j?.user ?? null);
      } catch {
        setMe(null);
      } finally {
        setMeLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!meLoading && !me) router.replace("/");
  }, [meLoading, me, router]);

  useEffect(() => {
    const onCouponsChanged = () => setClaimVersion((prev) => prev + 1);
    window.addEventListener("storage", onCouponsChanged);
    window.addEventListener("amg-coupons-changed", onCouponsChanged);
    return () => {
      window.removeEventListener("storage", onCouponsChanged);
      window.removeEventListener("amg-coupons-changed", onCouponsChanged);
    };
  }, []);

  useEffect(() => {
    if (!me || meLoading) return;
    (async () => {
      const claimedCodes = readClaimedCodesFromStorage();
      setLoading(true);
      setError(null);
      try {
        if (claimedCodes.size === 0) {
          setRows([]);
          return;
        }

        const r = await fetch("/api/promotions/my-coupons", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(pickApiErrorMessage(j, "No se pudieron cargar tus cupones."));
        const list = Array.isArray(j?.data) ? j.data : [];
        const filtered = list.filter((coupon: CouponRow) =>
          claimedCodes.has(normalizeCode(String(coupon?.code || "")))
        );
        setRows(filtered);
      } catch (e: any) {
        setRows([]);
        const raw = typeof e?.message === "string" ? e.message.trim() : "";
        const msg =
          raw && raw !== "[object Object]" ? raw : "No se pudieron cargar tus cupones.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [me, meLoading, claimVersion]);

  const rowsWithState = useMemo(
    () =>
      rows.map((c) => ({
        ...c,
        ...getCouponUiState(c),
      })),
    [rows]
  );
  const availableRows = rowsWithState.filter((c) => c.isAvailable);
  const unavailableRows = rowsWithState.filter((c) => !c.isAvailable);

  if (meLoading) {
    return (
      <main>
        <Container>
          <div className="py-10">Cargando…</div>
        </Container>
      </main>
    );
  }

  if (!me) return null;

  return (
    <main>
      <Container>
        <div className="py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-neutral-900">Mis cupones</h1>
              <p className="mt-2 text-sm text-neutral-600">
                Cupones aplicados por vos, incluyendo disponibles y no disponibles.
              </p>
            </div>
            <Link
              href="/cupones"
              className="rounded-full border px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Volver a cupones
            </Link>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-700">
            Cargando cupones...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 gap-6 pb-14 md:grid-cols-2">
            {availableRows.length > 0 ? (
              <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Disponibles
              </div>
            ) : null}

            {availableRows.map((c) => {
              const minSubtotal = Number(c.minSubtotal ?? 0);
              const maxDiscount = Number(c.maxDiscount ?? 0);
              const expires = c.endAt ? new Date(c.endAt) : null;
              return (
                <article
                  key={c.id}
                  className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
                >
                  <div className="text-lg font-extrabold text-neutral-900">{c.name || "Cupón"}</div>
                  <div className="mt-3 space-y-1 text-sm text-neutral-700">
                    <div>
                      Beneficio: <span className="font-semibold">{discountLabel(c)}</span>
                    </div>
                    {minSubtotal > 0 ? (
                      <div>
                        Compra mínima:{" "}
                        <span className="font-semibold">{formatARS(minSubtotal)}</span>
                      </div>
                    ) : null}
                    {maxDiscount > 0 ? (
                      <div>
                        Tope de descuento:{" "}
                        <span className="font-semibold">{formatARS(maxDiscount)}</span>
                      </div>
                    ) : null}
                    {c.scopeLabel ? <div>{c.scopeLabel}</div> : null}
                    {expires ? (
                      <div className="text-xs text-neutral-500">
                        Vence: {expires.toLocaleDateString("es-AR")}
                      </div>
                    ) : null}
                    <div>
                      Combinable:{" "}
                      <span className="font-semibold">{c.combinable ? "Sí" : "No"}</span>
                    </div>
                  </div>

                </article>
              );
            })}

            {unavailableRows.length > 0 ? (
              <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                No disponibles
              </div>
            ) : null}

            {unavailableRows.map((c) => {
              const minSubtotal = Number(c.minSubtotal ?? 0);
              const maxDiscount = Number(c.maxDiscount ?? 0);
              const expires = c.endAt ? new Date(c.endAt) : null;
              return (
                <article
                  key={`unavailable-${c.id}`}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm opacity-80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-lg font-extrabold text-neutral-900">{c.name || "Cupón"}</div>
                    {c.statusLabel ? (
                      <span className="rounded-full bg-neutral-200 px-2 py-1 text-[11px] font-semibold text-neutral-700">
                        {c.statusLabel}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-neutral-700">
                    <div>
                      Beneficio: <span className="font-semibold">{discountLabel(c)}</span>
                    </div>
                    {minSubtotal > 0 ? (
                      <div>
                        Compra mínima:{" "}
                        <span className="font-semibold">{formatARS(minSubtotal)}</span>
                      </div>
                    ) : null}
                    {maxDiscount > 0 ? (
                      <div>
                        Tope de descuento:{" "}
                        <span className="font-semibold">{formatARS(maxDiscount)}</span>
                      </div>
                    ) : null}
                    {c.scopeLabel ? <div>{c.scopeLabel}</div> : null}
                    {expires ? (
                      <div className="text-xs text-neutral-500">
                        Vence: {expires.toLocaleDateString("es-AR")}
                      </div>
                    ) : null}
                    <div>
                      Combinable:{" "}
                      <span className="font-semibold">{c.combinable ? "Sí" : "No"}</span>
                    </div>
                  </div>
                </article>
              );
            })}

            {rowsWithState.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
                Todavía no aplicaste cupones. Desde{" "}
                <Link href="/cupones" className="font-semibold underline">
                  Cupones
                </Link>{" "}
                presioná “Aplicar” y te van a aparecer acá.
              </div>
            ) : null}
          </div>
        )}
      </Container>
    </main>
  );
}
