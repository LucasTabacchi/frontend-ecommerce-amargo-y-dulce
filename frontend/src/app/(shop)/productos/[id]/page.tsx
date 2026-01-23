import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ProductReviews } from "@/components/products/ProductReviews";

export const dynamic = "force-dynamic";

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function strapiMediaUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = (process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function pickAttr(row: any) {
  return row?.attributes ?? row ?? {};
}

function pickImage(rowOrAttr: any) {
  const attr = pickAttr(rowOrAttr);
  const img = attr?.images?.[0];
  const f = img?.formats;
  const url = f?.medium?.url || f?.small?.url || f?.thumbnail?.url || img?.url || "";
  return strapiMediaUrl(url);
}

function asNum(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const pid = String(params.id || "").trim();
  if (!pid) return notFound();

  const isNumeric = /^\d+$/.test(pid);

  let row: any | null = null;

  try {
    if (isNumeric) {
      // ✅ id numérico
      const sp = new URLSearchParams();
      sp.set("populate", "*");
      sp.set("pagination[pageSize]", "1");
      sp.set("filters[id][$eq]", pid);

      const list = await fetcher<any>(`/api/products?${sp.toString()}`, { auth: true });
      row = list?.data?.[0] ?? null;
    } else {
      // ✅ documentId (principal) + slug (fallback)
      const sp = new URLSearchParams();
      sp.set("populate", "*");
      sp.set("pagination[pageSize]", "1");

      sp.set("filters[$or][0][documentId][$eq]", pid);
      sp.set("filters[$or][1][slug][$eq]", pid);

      const list = await fetcher<any>(`/api/products?${sp.toString()}`, { auth: true });
      row = list?.data?.[0] ?? null;
    }
  } catch {
    return notFound();
  }

  if (!row) return notFound();

  const attr = pickAttr(row);

  // ✅ id numérico de Strapi (siempre existe)
  const id = asNum(row?.id ?? attr?.id, NaN);
  if (!Number.isFinite(id)) return notFound();

  // ✅ documentId (Strapi v5)
  const documentIdRaw = row?.documentId ?? attr?.documentId ?? attr?.document_id ?? null;
  const documentId = documentIdRaw ? String(documentIdRaw).trim() : null;

  const title = attr?.title ?? row?.title ?? "Producto";
  const description = attr?.description ?? row?.description ?? "";
  const category = attr?.category ?? row?.category ?? null;

  const price = asNum(attr?.price ?? row?.price, 0);

  const offRaw = attr?.off ?? row?.off ?? 0;
  const off = asNum(offRaw, 0);
  const hasOff = off > 0;
  const finalPrice = hasOff ? Math.round(price * (1 - off / 100)) : price;

  const stockRaw = attr?.stock ?? row?.stock ?? null;
  const stock = stockRaw == null ? null : asNum(stockRaw, 0);

  const imageUrl = pickImage(row);

  // slug puede ser null -> lo dejamos como opcional
  const slug = String(attr?.slug ?? row?.slug ?? "").trim() || String(id);

  return (
    <main>
      <Container>
        <div className="pt-8">
          <Link
            href="/productos"
            className="text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            ← Volver a productos
          </Link>
        </div>

        <div className="pt-6 pb-6">
          <h1 className="text-3xl font-extrabold text-neutral-900">{title}</h1>
          {category && (
            <p className="mt-1 text-sm font-semibold text-neutral-500">{String(category)}</p>
          )}
        </div>

        <div className="grid gap-8 pb-14 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="relative aspect-[4/3] w-full bg-neutral-100">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                  Sin imagen
                </div>
              )}

              {hasOff && (
                <span className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold text-white shadow-sm">
                  -{off}%
                </span>
              )}
            </div>
          </section>

          <aside className="h-fit rounded-2xl border bg-white p-6 lg:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-3">
                  <div className="text-3xl font-extrabold tracking-tight text-neutral-900">
                    {formatARS(finalPrice)}
                  </div>

                  {hasOff && (
                    <div className="text-base font-semibold text-neutral-400 line-through">
                      {formatARS(price)}
                    </div>
                  )}
                </div>

                {hasOff && (
                  <div className="mt-1 text-xs font-semibold text-red-600">
                    Ahorrás {formatARS(price - finalPrice)}
                  </div>
                )}
              </div>

              {stock != null && (
                <div
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {stock > 0 ? `Stock: ${stock}` : "Sin stock"}
                </div>
              )}
            </div>

            {description && (
              <div className="mt-5">
                <h2 className="text-sm font-extrabold text-neutral-900">Descripción</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700 whitespace-pre-line">
                  {description}
                </p>
              </div>
            )}

            <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>Retiro / Envío coordinado (podés ajustar este texto).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>Pagá con MercadoPago.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <AddToCartButton
                item={{
                  id, // id numérico de Strapi
                  documentId: documentId ?? undefined, // ✅ guardamos documentId en carrito/pedido
                  slug, // opcional
                  title,
                  price,
                  off: hasOff ? off : undefined,
                  imageUrl,
                }}
              />
              <p className="mt-3 text-center text-xs text-neutral-500">
                Podés revisar tu carrito antes de pagar.
              </p>
            </div>
          </aside>
        </div>

        {/* ✅ NUEVO: Opiniones / Valoración */}
        <div className="pb-14">
          <ProductReviews productDocumentId={documentId} productId={id} />
        </div>
      </Container>
    </main>
  );
}
