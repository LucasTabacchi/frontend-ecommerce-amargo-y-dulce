import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";

export const dynamic = "force-dynamic";

/**
 * Soportamos Strapi v4 (data[].attributes) y Strapi v5 (data[] plano)
 */
type PromotionAttributes = {
  name?: string;
  enabled?: boolean;
  publishedAt?: string | null;
  requiresCoupon?: boolean;
  code?: string | null;
  discountType?: string;
  discountValue?: number;
  minSubtotal?: number | null;
  minBoxes?: number | null;
  minItems?: number | null;
  combinable?: boolean;
  priority?: number;
};

type PromotionV4 = { id: number; attributes: PromotionAttributes };
type PromotionV5 = { id?: number } & PromotionAttributes;
type PromotionAny = PromotionV4 | PromotionV5;

type StrapiList<T> = { data: T[] };

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function pickPromo(p: any): { id: number; a: PromotionAttributes } | null {
  if (!p) return null;
  const a: PromotionAttributes = (p.attributes ?? p) as PromotionAttributes;
  const id = Number(p.id ?? (a as any)?.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { id, a };
}

export default async function PromocionesPage() {
  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "50");
  qs.set("sort[0]", "priority:asc");
  qs.set("filters[enabled][$eq]", "true");
  qs.set("filters[publishedAt][$notNull]", "true");

  // ✅ con el fetcher nuevo podés usar con o sin /api; dejo sin /api para evitar confusiones
  const res = await fetcher<StrapiList<PromotionAny>>(`/promotions?${qs.toString()}`, {
    cache: "no-store",
  });

  const promosRaw = Array.isArray(res?.data) ? res.data : [];
  const promos = promosRaw.map(pickPromo).filter(Boolean) as Array<{
    id: number;
    a: PromotionAttributes;
  }>;

  return (
    <main>
      <Container>
        <div className="py-10">
          <h1 className="text-3xl font-extrabold text-neutral-900">Promociones</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Estas promos se calculan automáticamente en el carrito y checkout.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-14 md:grid-cols-2">
          {promos.map(({ id, a }) => {
            const isCoupon = !!a?.requiresCoupon && !!a?.code;

            const discountLabel =
              a?.discountType === "percent"
                ? `${Number(a?.discountValue ?? 0)}% OFF`
                : a?.discountType ?? "—";

            return (
              <div
                key={id}
                className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <div className="text-lg font-extrabold text-neutral-900">
                  {a?.name ?? "Promoción"}
                </div>

                <div className="mt-2 space-y-1 text-sm text-neutral-700">
                  <div>
                    Tipo: <span className="font-semibold">{discountLabel}</span>
                  </div>

                  {a?.minSubtotal ? (
                    <div>
                      Mínimo:{" "}
                      <span className="font-semibold">
                        {formatARS(Number(a.minSubtotal))}
                      </span>
                    </div>
                  ) : null}

                  {a?.minBoxes ? (
                    <div>
                      Mínimo: <span className="font-semibold">{Number(a.minBoxes)}</span>{" "}
                      cajas
                    </div>
                  ) : null}

                  {isCoupon ? (
                    <div>
                      Cupón: <span className="font-semibold">{a.code}</span>
                    </div>
                  ) : (
                    <div>No requiere cupón</div>
                  )}

                  <div>
                    Combinable:{" "}
                    <span className="font-semibold">{a?.combinable ? "Sí" : "No"}</span>
                  </div>

                  {isCoupon ? (
                    <div className="text-xs text-neutral-500">
                      Si usás cupón, no se combinan otras promos.
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex gap-3">
                  <Link
                    href="/productos#listado"
                    className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white"
                  >
                    Ver bombones
                  </Link>
                  <Link
                    href="/carrito"
                    className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900"
                  >
                    Ir al carrito
                  </Link>
                </div>
              </div>
            );
          })}

          {promos.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
              No hay promociones activas en este momento.
            </div>
          ) : null}
        </div>
      </Container>
    </main>
  );
}
