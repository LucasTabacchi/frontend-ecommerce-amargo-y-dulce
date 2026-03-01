import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";
import { ApplyCouponButton } from "@/components/coupons/ApplyCouponButton";

export const dynamic = "force-dynamic";

type CouponRow = {
  id: number;
  name?: string | null;
  description?: string | null;
  requiresCoupon?: boolean;
  code?: string | null;
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

export default async function CuponesPage() {
  const res = await fetcher<{ data?: CouponRow[] }>("/promotions/available", {
    method: "GET",
    cache: "no-store",
  });
  const allRows = Array.isArray(res?.data) ? res.data : [];
  const rows = allRows.filter((x) => Boolean(x.requiresCoupon && x.code));

  return (
    <main>
      <Container>
        <div className="py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-neutral-900">Cupones</h1>
              <p className="mt-2 text-sm text-neutral-600">
                Explora cupones activos, aplicalos y guardalos en Mis cupones.
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Aplica al cupón para luego poder usarlo.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/cupones/mis-cupones"
                className="rounded-full border px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Mis cupones
              </Link>
            </div>
          </div>
        </div>

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
                    Beneficio:{" "}
                    <span className="font-semibold">{discountLabel(c)}</span>
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

                <div className="mt-5 flex gap-3">
                  <ApplyCouponButton code={String(c.code || "")} />
                </div>
              </article>
            );
          })}

          {rows.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
              No hay cupones activos en este momento.
            </div>
          ) : null}
        </div>
      </Container>
    </main>
  );
}
