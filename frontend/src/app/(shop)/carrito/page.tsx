// src/app/(shop)/carrito/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart.store";
import {
  getCartAvailabilitySummary,
  getCurrentCartItemSnapshot,
} from "@/lib/cart-availability";
import { buildCartQuoteItems } from "@/lib/cart-quote-items";

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function priceWithOff(price: number, off?: number) {
  const hasOff = typeof off === "number" && off > 0;
  return hasOff ? Math.round(price * (1 - off / 100)) : price;
}

type Quote = {
  subtotal: number;
  discountTotal: number;
  total: number;
  appliedPromotions: Array<{
    id: number;
    name: string;
    code?: string | null;
    amount: number;
    meta?: any;
  }>;
};

type MeResponse = { user: any | null };
type ProductAvailabilityRow = {
  documentId?: string | null;
  slug?: string | null;
  stock?: number | null;
  isActive?: boolean | null;
  price?: number | null;
  off?: number | null;
};

function normalizeQty(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normStock(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

function normPrice(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

function normOff(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.trunc(n)));
}

function cartItemKey(it: any) {
  return String(it?.documentId || it?.slug || "").trim();
}

function pickProductAttr(row: any) {
  return row?.attributes ?? row ?? {};
}

function toProductAvailability(row: any): ProductAvailabilityRow | null {
  const attr = pickProductAttr(row);
  const documentId = String(row?.documentId ?? attr?.documentId ?? attr?.document_id ?? "").trim();
  const slug = String(attr?.slug ?? row?.slug ?? "").trim();
  const stock = normStock(attr?.stock ?? row?.stock);
  const price = normPrice(attr?.price ?? row?.price);
  const off = normOff(attr?.off ?? row?.off);

  if (!documentId && !slug) return null;

  return {
    documentId: documentId || null,
    slug: slug || null,
    stock,
    price,
    off,
    isActive: true,
  };
}

export default function CarritoPage() {
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const inc = useCartStore((s) => s.inc);
  const dec = useCartStore((s) => s.dec);
  const removeItem = useCartStore((s) => s.removeItem);
  const setItems = useCartStore((s) => s.setItems);

  // ✅ auth (para bloquear checkout)
  const [meLoading, setMeLoading] = useState(true);
  const [me, setMe] = useState<any | null>(null);

  // ✅ alerta simple (sin librerías)
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const alertTimerRef = useRef<any>(null);
  const [availabilityByKey, setAvailabilityByKey] = useState<Map<string, ProductAvailabilityRow>>(
    () => new Map()
  );
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  function showAlert(msg: string) {
    setAlertMsg(msg);
    if (alertTimerRef.current) window.clearTimeout(alertTimerRef.current);
    alertTimerRef.current = window.setTimeout(() => setAlertMsg(null), 2500);
  }

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) window.clearTimeout(alertTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const docIds = Array.from(
      new Set(
        (items as any[])
          .map((it) => String(it?.documentId ?? "").trim())
          .filter(Boolean)
      )
    );

    if (!items.length) {
      setAvailabilityByKey(new Map());
      setAvailabilityReady(true);
      setAvailabilityLoading(false);
      return;
    }

    if (!docIds.length) {
      const fallback = new Map<string, ProductAvailabilityRow>();
      for (const it of items as any[]) {
        const key = cartItemKey(it);
        if (!key) continue;
        fallback.set(key, {
          documentId: it?.documentId ?? null,
          slug: it?.slug ?? null,
          stock: normStock(it?.stock),
          isActive: true,
        });
      }
      setAvailabilityByKey(fallback);
      setAvailabilityReady(true);
      setAvailabilityLoading(false);
      return;
    }

    (async () => {
      try {
        setAvailabilityLoading(true);
        setAvailabilityReady(false);

        const sp = new URLSearchParams();
        sp.set("pagination[pageSize]", String(Math.min(docIds.length, 100)));
        sp.set("fields[0]", "title");
        sp.set("fields[1]", "stock");
        sp.set("fields[2]", "slug");
        sp.set("fields[3]", "price");
        sp.set("fields[4]", "off");
        docIds.forEach((doc, i) => {
          sp.set(`filters[$or][${i}][documentId][$eq]`, doc);
        });

        const res = await fetch(`/api/products?${sp.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!alive) return;

        const rows = Array.isArray(json?.data) ? json.data : [];
        const next = new Map<string, ProductAvailabilityRow>();

        for (const row of rows) {
          const product = toProductAvailability(row);
          if (!product) continue;
          if (product.documentId) next.set(product.documentId, product);
          if (product.slug) next.set(product.slug, product);
        }

        for (const it of items as any[]) {
          if (it?.documentId) continue;
          const key = cartItemKey(it);
          if (!key || next.has(key)) continue;
          next.set(key, {
            documentId: it?.documentId ?? null,
            slug: it?.slug ?? null,
            stock: normStock(it?.stock),
            isActive: true,
          });
        }

        let cartChanged = false;
        const refreshedItems = (items as any[]).map((it) => {
          const docKey = String(it?.documentId ?? "").trim();
          const slugKey = String(it?.slug ?? "").trim();
          const product =
            (docKey ? next.get(docKey) : null) ??
            (slugKey ? next.get(slugKey) : null) ??
            null;

          if (!product) return it;

          const current = getCurrentCartItemSnapshot(it, product) as any;
          const previousOff = it.off == null ? null : it.off;
          const previousStock = it.stock == null ? null : it.stock;
          if (
            !Object.is(current.price, it.price) ||
            !Object.is(current.off ?? null, previousOff) ||
            !Object.is(current.stock ?? null, previousStock)
          ) {
            cartChanged = true;
          }
          return current;
        });

        if (cartChanged) {
          setItems(refreshedItems as any);
        }

        setAvailabilityByKey(next);
        setAvailabilityReady(true);
      } catch {
        if (!alive) return;
        const fallback = new Map<string, ProductAvailabilityRow>();
        for (const it of items as any[]) {
          const key = cartItemKey(it);
          if (!key) continue;
          fallback.set(key, {
            documentId: it?.documentId ?? null,
            slug: it?.slug ?? null,
            stock: normStock(it?.stock),
            isActive: true,
          });
        }
        setAvailabilityByKey(fallback);
        setAvailabilityReady(true);
      } finally {
        if (alive) setAvailabilityLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [items, setItems]);

  // ✅ obtener sesión
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j: MeResponse = await r.json().catch(() => ({ user: null }));
        if (!alive) return;
        setMe(j.user ?? null);
      } catch {
        if (!alive) return;
        setMe(null);
      } finally {
        if (!alive) return;
        setMeLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const availabilityProducts = useMemo(() => {
    if (availabilityReady) return availabilityByKey;

    const fallback = new Map<string, ProductAvailabilityRow>();
    for (const it of items as any[]) {
      const key = cartItemKey(it);
      if (!key) continue;
      fallback.set(key, {
        documentId: it?.documentId ?? null,
        slug: it?.slug ?? null,
        stock: normStock(it?.stock),
        isActive: true,
      });
    }
    return fallback;
  }, [availabilityByKey, availabilityReady, items]);

  const cartAvailability = useMemo(
    () => getCartAvailabilitySummary(items as any[], availabilityProducts as any),
    [items, availabilityProducts]
  );

  // ✅ Quote desde backend (reglas PRO) — SIN cupón en carrito
  const [quote, setQuote] = useState<Quote>({
    subtotal: 0,
    discountTotal: 0,
    total: 0,
    appliedPromotions: [],
  });
  const [isQuoting, setIsQuoting] = useState(false);

  // El backend trae precios reales y calcula promociones desde id, documentId o slug.
  const payloadItems = useMemo(() => {
    return buildCartQuoteItems(
      cartAvailability.rows
        .filter((row) => row.availability.purchasable)
        .map((row) => row.item as any)
    );
  }, [cartAvailability.rows]);

  useEffect(() => {
    let alive = true;

    if (!payloadItems.length) {
      setQuote({ subtotal: 0, discountTotal: 0, total: 0, appliedPromotions: [] });
      setIsQuoting(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setIsQuoting(true);

        const res = await fetch("/api/promotions/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: payloadItems,
            coupon: "",
            shipping: 0,
          }),
          cache: "no-store",
        });

        const data = (await res.json().catch(() => null)) as Quote | null;
        if (!alive) return;

        if (!res.ok || !data) {
          const s = Math.round(cartAvailability.purchasableSubtotal);
          setQuote({ subtotal: s, discountTotal: 0, total: s, appliedPromotions: [] });
          return;
        }

        setQuote({
          subtotal: Number(data?.subtotal) || 0,
          discountTotal: Number(data?.discountTotal) || 0,
          total: Number(data?.total) || 0,
          appliedPromotions: Array.isArray(data?.appliedPromotions) ? data.appliedPromotions : [],
        });
      } catch {
        if (!alive) return;
        const s = Math.round(cartAvailability.purchasableSubtotal);
        setQuote({ subtotal: s, discountTotal: 0, total: s, appliedPromotions: [] });
      } finally {
        if (alive) setIsQuoting(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [payloadItems, cartAvailability.purchasableSubtotal]);

  const effectiveSubtotal = payloadItems.length
    ? quote.subtotal || Math.round(cartAvailability.purchasableSubtotal)
    : 0;
  const effectiveDiscount = payloadItems.length ? quote.discountTotal : 0;
  const effectiveTotal = payloadItems.length
    ? quote.total || Math.max(0, effectiveSubtotal - effectiveDiscount)
    : 0;
  const isStoreAdmin = Boolean(me?.isStoreAdmin);

  useEffect(() => {
    if (!meLoading && isStoreAdmin) {
      router.replace("/admin/pedidos");
    }
  }, [meLoading, isStoreAdmin, router]);

  if (!meLoading && isStoreAdmin) {
    return null;
  }

  // ✅ handler: bloquear checkout si no hay sesión
  function onCheckoutClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (items.length === 0) return;

    // mientras carga, no hacemos nada (evita flashes raros)
    if (meLoading) {
      e.preventDefault();
      return;
    }

    if (!me) {
      e.preventDefault();

      // (opcional) alerta explicativa. Si no la querés, borrá esta línea.
      showAlert("Tenés que iniciar sesión para finalizar la compra.");

      // ✅ NO ir a home: quedate en carrito y dispará el modal via ?login=1
      router.push(`/carrito?login=1&next=${encodeURIComponent("/checkout")}`);
      return;
    }

    if (isStoreAdmin) {
      e.preventDefault();
      showAlert("La cuenta tienda no puede realizar compras.");
      return;
    }

    if (availabilityLoading || !availabilityReady) {
      e.preventDefault();
      showAlert("Estamos verificando el stock actual. Intentá nuevamente en unos segundos.");
      return;
    }

    if (cartAvailability.hasBlockedItems) {
      e.preventDefault();
      showAlert("Hay productos no disponibles en el carrito. Eliminá o ajustá esos items para continuar.");
    }
  }

  return (
    <main>
      <Container>
        {/* Header */}
        <div className="py-10">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-6 w-6 text-neutral-900" />
            <h1 className="text-3xl font-extrabold text-neutral-900">Carrito</h1>
          </div>
          <p className="mt-2 text-sm text-neutral-600">
            Revisá tus bombones antes de finalizar la compra.
          </p>

          {/* ✅ Alert banner */}
          {alertMsg && (
            <div
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
              role="status"
              aria-live="polite"
            >
              {alertMsg}
            </div>
          )}

          {!meLoading && isStoreAdmin && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
              Tu cuenta está en modo tienda. Podés gestionar pedidos desde{" "}
              <Link href="/admin/pedidos" className="font-semibold underline">
                Panel tienda
              </Link>
              .
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 pb-14 lg:grid-cols-[1fr_380px]">
          {/* LISTA */}
          <section className="space-y-4">
            {items.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-neutral-600">Tu carrito está vacío.</p>
                <Link
                  href="/productos#listado"
                  className="mt-4 inline-flex rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Ver bombones
                </Link>
              </div>
            ) : (
              cartAvailability.rows.map((row) => {
                const it: any = row.item;
                const availability = row.availability;
                const unit = priceWithOff(it.price, it.off);
                const hasOff = typeof it.off === "number" && it.off > 0;

                const qty = Math.max(1, normalizeQty(it.qty) || 1);

                // ✅ stock actual de Strapi si ya se verificó; fallback al local.
                const stock =
                  availability.availableStock !== null
                    ? availability.availableStock
                    : normStock(it.stock);
                const hasStock = typeof stock === "number";

                const paused = availability.status === "paused";
                const stockInsufficient = availability.status === "insufficient";
                const blocked = !availability.purchasable;
                const reachedLimit = hasStock && stock > 0 && qty >= stock;

                return (
                  <div
                    key={row.key || it.slug}
                    className={[
                      "rounded-xl border p-5 shadow-sm transition",
                      blocked
                        ? "border-neutral-300 bg-neutral-50"
                        : "border-neutral-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-4">
                      {/* Imagen */}
                      <div
                        className={[
                          "relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-neutral-200",
                          paused ? "grayscale" : "",
                        ].join(" ")}
                      >
                        {it.imageUrl ? (
                          <Image
                            src={it.imageUrl}
                            alt={it.title}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                            Sin imagen
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold text-neutral-900 break-words">{it.title}</div>
                            <div className="mt-1 text-sm text-neutral-600">{it.description}</div>

                            {blocked && (
                              <div
                                className={[
                                  "mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                                  paused
                                    ? "bg-neutral-200 text-neutral-700"
                                    : "bg-amber-50 text-amber-800",
                                ].join(" ")}
                              >
                                {availability.message}
                              </div>
                            )}

                            {hasOff ? (
                              <div className="mt-2 inline-flex items-center gap-2 text-xs">
                                <span className="rounded-full bg-red-600 px-2 py-1 font-bold text-white">
                                  {it.off}% OFF
                                </span>
                                <span className="text-neutral-500 line-through whitespace-nowrap">
                                  {formatARS(it.price)}
                                </span>
                                <span className="font-semibold text-neutral-900 whitespace-nowrap">
                                  {formatARS(unit)}
                                </span>
                              </div>
                            ) : null}

                            {/* ✅ stock badge + hint */}
                            {hasStock && !paused && (
                              <div className="mt-2 text-xs">
                                {stockInsufficient ? (
                                  <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">
                                    Solo quedan {stock}
                                  </span>
                                ) : reachedLimit ? (
                                  <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">
                                    Solo queda {stock}
                                  </span>
                                ) : stock <= 3 ? (
                                  <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">
                                    Quedan {stock}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => removeItem(it.slug)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-neutral-50"
                            aria-label={`Eliminar ${it.title} del carrito`}
                            title="Eliminar"
                            type="button"
                          >
                            <Trash2 className="h-5 w-5 text-neutral-500" />
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          {/* Cantidad */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => dec(it.slug)}
                              disabled={paused}
                              className={[
                                "inline-flex h-11 w-11 items-center justify-center rounded-md border bg-white",
                                paused
                                  ? "cursor-not-allowed border-neutral-200 opacity-50"
                                  : "border-neutral-200 hover:bg-neutral-50",
                              ].join(" ")}
                              aria-label={`Disminuir cantidad de ${it.title}`}
                              type="button"
                            >
                              <Minus className="h-4 w-4" />
                            </button>

                            <div className="min-w-[34px] text-center text-sm font-semibold">
                              {qty}
                            </div>

                            <button
                              onClick={() => {
                                if (paused) {
                                  showAlert(`La publicación de "${it.title}" está pausada.`);
                                  return;
                                }
                                if (stockInsufficient || reachedLimit) {
                                  showAlert(`Solo queda ${stock} de "${it.title}".`);
                                  return;
                                }
                                inc(it.slug);
                              }}
                              disabled={paused || stockInsufficient || reachedLimit}
                              className={[
                                "inline-flex h-11 w-11 items-center justify-center rounded-md border bg-white",
                                paused || stockInsufficient || reachedLimit
                                  ? "cursor-not-allowed border-neutral-200 opacity-50"
                                  : "border-neutral-200 hover:bg-neutral-50",
                              ].join(" ")}
                              aria-label={`Aumentar cantidad de ${it.title}`}
                              type="button"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Precio total del item */}
                          <div className="text-right text-sm font-bold text-neutral-900">
                            {blocked ? (
                              <span className="text-neutral-500">No disponible</span>
                            ) : (
                              formatARS(unit * qty)
                            )}
                          </div>
                        </div>

                        {stockInsufficient && (
                          <p className="mt-3 text-xs text-red-700">
                            Pediste {qty}, pero solo quedan {stock}. Bajá la cantidad para continuar.
                          </p>
                        )}

                        {paused && (
                          <p className="mt-3 text-xs text-neutral-600">
                            Este producto ya no está disponible. Eliminá el item para continuar.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Botón seguir comprando */}
            {items.length > 0 && (
              <div className="pt-2">
                <Link
                  href="/productos#listado"
                  className="inline-flex rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Seguir comprando
                </Link>
              </div>
            )}
          </section>

          {/* RESUMEN */}
          <aside className="h-fit rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-neutral-900">Resumen</h2>

            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between text-neutral-700">
                <span>Subtotal</span>
                <span className="font-semibold text-neutral-900">
                  {formatARS(effectiveSubtotal)}
                </span>
              </div>

              <div className="my-3 h-px bg-neutral-200" />

              <div className="flex justify-between text-base">
                <span className="font-extrabold text-neutral-900">Total</span>
                <span className="font-extrabold text-neutral-900 whitespace-nowrap">
                  {formatARS(effectiveTotal)}
                </span>
              </div>

              {isQuoting ? (
                <div className="pt-2 text-xs text-neutral-500">Calculando promociones…</div>
              ) : null}

              {availabilityLoading ? (
                <div className="pt-2 text-xs text-neutral-500">Verificando stock actual…</div>
              ) : null}

              {cartAvailability.hasBlockedItems ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Hay {cartAvailability.blockedCount} producto
                  {cartAvailability.blockedCount === 1 ? "" : "s"} no disponible
                  {cartAvailability.blockedCount === 1 ? "" : "s"} en el carrito. Eliminá o ajustá esos
                  items para poder finalizar la compra.
                </div>
              ) : null}
            </div>

            <Link
              href="/checkout"
              onClick={onCheckoutClick}
              aria-disabled={
                items.length === 0 ||
                meLoading ||
                isStoreAdmin ||
                availabilityLoading ||
                cartAvailability.hasBlockedItems
              }
              className={[
                "mt-6 block w-full rounded-full bg-red-600 py-3 text-center text-sm font-semibold text-white hover:bg-red-700",
                items.length === 0 ||
                meLoading ||
                isStoreAdmin ||
                availabilityLoading ||
                cartAvailability.hasBlockedItems
                  ? "pointer-events-none opacity-50"
                  : "",
              ].join(" ")}
            >
              {isStoreAdmin
                ? "No disponible"
                : cartAvailability.hasBlockedItems
                ? "Corregí el carrito"
                : availabilityLoading
                ? "Verificando stock..."
                : "Finalizar compra"}
            </Link>

            <p className="mt-3 text-center text-xs text-neutral-500">
              El total final se calcula con reglas de promociones en el backend.
            </p>
          </aside>
        </div>
      </Container>
    </main>
  );
}
