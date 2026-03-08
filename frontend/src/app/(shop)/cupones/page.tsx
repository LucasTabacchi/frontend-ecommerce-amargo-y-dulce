import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";
import { ApplyCouponButton } from "@/components/coupons/ApplyCouponButton";
import {
  isCouponClaimed,
  sanitizeClaimedCouponValues,
} from "@/lib/coupon-claims";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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
  let serverAuthResolved = !jwt;
  let serverIsLoggedIn = false;
  let serverIsStoreAdmin = false;
  const serverClaimedCoupons = new Set<string>();

  if (jwt) {
    const strapiBase = normalizeStrapiBase(
      process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
    );

    try {
      const meRes = await fetch(`${strapiBase}/api/users/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: "no-store",
      });
      const meJson = await meRes.json().catch(() => null);
      if (meRes.ok) {
        serverAuthResolved = true;
        serverIsLoggedIn = Boolean(meJson?.id);
        serverIsStoreAdmin = isStoreAdmin(meJson);

        if (serverIsStoreAdmin) {
          redirect("/admin/pedidos");
        }

        const claimed = sanitizeClaimedCouponValues(meJson?.claimedCoupons);
        for (const value of claimed) serverClaimedCoupons.add(value);
      }
    } catch {
      // Si falla auth check, continuamos sin redirigir.
    }
  }

  const res = await fetcher<{ data?: CouponRow[] }>("/promotions/available", {
    method: "GET",
    cache: "no-store",
  });
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
                Explora cupones activos, aplicalos y guardalos en Mis cupones.
              </p>
              <p className="mt-1 text-sm text-neutral-500">
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
            const couponCode = String(c.code || "");
            return (
              <article
                key={c.id}
                className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <div className="text-lg font-extrabold text-neutral-900">{c.name || "Cupón"}</div>
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
                  <ApplyCouponButton
                    documentId={c.documentId ?? null}
                    code={couponCode}
                    initialApplied={isCouponClaimed(serverClaimedCoupons, {
                      documentId: c.documentId ?? null,
                      code: couponCode,
                    })}
                    initialIsLoggedIn={serverIsLoggedIn}
                    initialIsStoreAdmin={serverIsStoreAdmin}
                    initialAuthResolved={serverAuthResolved}
                  />
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
