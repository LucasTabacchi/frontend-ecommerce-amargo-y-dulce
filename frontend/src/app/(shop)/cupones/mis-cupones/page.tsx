"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";

type CouponRow = {
  id: number;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
  minSubtotal?: number | null;
  maxDiscount?: number | null;
  endAt?: string | null;
  scopeLabel?: string | null;
  combinable?: boolean;
};

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

export default function MisCuponesPage() {
  const router = useRouter();
  const [meLoading, setMeLoading] = useState(true);
  const [me, setMe] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    if (!me || meLoading) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/promotions/my-coupons", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "No se pudieron cargar tus cupones.");
        setRows(Array.isArray(j?.data) ? j.data : []);
      } catch (e: any) {
        setRows([]);
        setError(e?.message || "No se pudieron cargar tus cupones.");
      } finally {
        setLoading(false);
      }
    })();
  }, [me, meLoading]);

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
                Cupones disponibles para aplicar en tu checkout.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/cupones"
                className="rounded-full border px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Ver todos
              </Link>
              <Link
                href="/checkout"
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Ir a checkout
              </Link>
            </div>
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
            {rows.map((c) => {
              const minSubtotal = Number(c.minSubtotal ?? 0);
              const maxDiscount = Number(c.maxDiscount ?? 0);
              const expires = c.endAt ? new Date(c.endAt) : null;
              return (
                <article
                  key={c.id}
                  className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
                >
                  <div className="text-lg font-extrabold text-neutral-900">{c.name || "Cupón"}</div>
                  <div className="mt-1 text-xs font-semibold text-neutral-700">
                    Código: {c.code || "—"}
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

                  <div className="mt-5">
                    <Link
                      href={`/checkout?coupon=${encodeURIComponent(String(c.code || ""))}`}
                      className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Aplicar en checkout
                    </Link>
                  </div>
                </article>
              );
            })}

            {rows.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
                No tenés cupones activos por ahora.
              </div>
            ) : null}
          </div>
        )}
      </Container>
    </main>
  );
}
