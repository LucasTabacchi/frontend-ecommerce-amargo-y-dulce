import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function readUserJwtFromCookies() {
  const jar = cookies();
  return (
    jar.get("strapi_jwt")?.value ||
    jar.get("jwt")?.value ||
    jar.get("token")?.value ||
    jar.get("access_token")?.value ||
    null
  );
}

function isStoreAdmin(user: any) {
  return (
    user?.isStoreAdmin === true ||
    user?.isStoreAdmin === 1 ||
    user?.isStoreAdmin === "true"
  );
}

async function fetchCouponRows(jwt: string | null) {
  if (jwt) {
    const strapiBase = normalizeStrapiBase(
      process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
    );

    try {
      const filteredRes = await fetch(`${strapiBase}/api/promotions/my-coupons`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: "no-store",
      });
      const filteredJson = await filteredRes.json().catch(() => null);
      if (filteredRes.ok) return filteredJson as { data?: CouponRow[] };
    } catch {
      // Si la sesión local quedó inválida, dejamos que la página caiga al listado público.
    }
  }

  return fetcher<{ data?: CouponRow[] }>("/promotions/available", {
    method: "GET",
    cache: "no-store",
  });
}

type CouponRow = {
  id: number;
  documentId?: string | null;
  name?: string | null;
  description?: string | null;
  requiresCoupon?: boolean;
  code?: string | null;
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

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-AR");
}

function isCouponActiveNow(c: CouponRow) {
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
  const exhausted = Boolean(c.exhausted);

  return typeof c.isAvailable === "boolean" ? c.isAvailable : !isNotStarted && !isExpired && !exhausted;
}

export default async function CuponesPage() {
  const jwt = readUserJwtFromCookies();
  let serverIsStoreAdmin = false;

  const promotionsPromise = fetchCouponRows(jwt);

  const authPromise = (async () => {
    if (!jwt) return null;

    const strapiBase = normalizeStrapiBase(
      process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
    );

    try {
      const meRes = await fetch(`${strapiBase}/api/users/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: "no-store",
      });
      const meJson = await meRes.json().catch(() => null);
      return meRes.ok ? meJson : null;
    } catch {
      return null;
    }
  })();

  const [meJson, res] = await Promise.all([authPromise, promotionsPromise]);

  if (jwt && meJson) {
    serverIsStoreAdmin = isStoreAdmin(meJson);

    if (serverIsStoreAdmin) {
      redirect("/admin/pedidos");
    }
  }

  const allRows = Array.isArray(res?.data) ? res.data : [];
  const rows = allRows.filter((x) => Boolean(x.requiresCoupon && x.code) && isCouponActiveNow(x));

  return (
    <main>
      <Container>
        <div className="py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-neutral-900">Cupones</h1>
              <p className="mt-2 text-sm text-neutral-600">
                Explora los cupones activos disponibles para tus compras.
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                No necesitás guardarlos: en el checkout vas a poder seleccionar el cupón y el sistema validará si aplica a tu carrito.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-14 md:grid-cols-2">
          {rows.map((c) => {
            const minSubtotal = Number(c.minSubtotal ?? 0);
            const maxDiscount = Number(c.maxDiscount ?? 0);
            const expires = formatDate(c.endAt);
            const isFreeShipping = String(c.discountType || "").trim().toLowerCase() === "free_shipping";

            return (
              <article
                key={c.id}
                className="group relative overflow-hidden rounded-lg border border-red-100 bg-gradient-to-br from-white via-[#fff8f3] to-[#f4e8dd] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg"
              >
                <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-b from-red-600 via-red-500 to-[#7a2e18]" />
                <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-red-100 bg-[#f8f1eb]" />
                <div className="flex min-h-full flex-col p-6 pl-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-red-700">
                        {isFreeShipping ? "Beneficio de envío" : "Cupón especial"}
                      </div>
                      <h2 className="mt-1 text-xl font-extrabold text-neutral-950">
                        {c.name || "Cupón"}
                      </h2>
                    </div>
                    <div className="rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm">
                      {discountLabel(c)}
                    </div>
                  </div>

                  {c.description ? (
                    <p className="mt-3 text-sm leading-6 text-neutral-700">{c.description}</p>
                  ) : null}

                  <dl className="mt-5 grid gap-3 text-sm text-neutral-700 sm:grid-cols-2">
                    <div className="rounded-md bg-white/70 px-3 py-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Compra mínima
                      </dt>
                      <dd className="mt-1 font-bold text-neutral-950">
                        {minSubtotal > 0 ? formatARS(minSubtotal) : "Sin mínimo"}
                      </dd>
                    </div>
                    <div className="rounded-md bg-white/70 px-3 py-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Tope
                      </dt>
                      <dd className="mt-1 font-bold text-neutral-950">
                        {maxDiscount > 0 ? formatARS(maxDiscount) : "Sin tope"}
                      </dd>
                    </div>
                    <div className="rounded-md bg-white/70 px-3 py-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Vencimiento
                      </dt>
                      <dd className="mt-1 font-bold text-neutral-950">
                        {expires || "Sin fecha"}
                      </dd>
                    </div>
                    <div className="rounded-md bg-white/70 px-3 py-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Aplicación
                      </dt>
                      <dd className="mt-1 font-bold text-neutral-950">
                        No acumulable con productos en oferta
                      </dd>
                    </div>
                  </dl>

                  {c.scopeLabel ? (
                    <div className="mt-4 inline-flex w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                      {c.scopeLabel}
                    </div>
                  ) : null}

                  <div className="mt-5 border-t border-red-100 pt-3 text-xs text-neutral-500">
                    Disponible para seleccionar en el checkout si cumple las condiciones de la compra.
                  </div>
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
