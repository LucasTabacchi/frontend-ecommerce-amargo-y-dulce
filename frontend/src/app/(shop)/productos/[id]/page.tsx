// src/app/(shop)/productos/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ProductReviews } from "@/components/products/ProductReviews";

export const revalidate = 3600;

interface Props {
  params: { id: string };
}

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

function asNum(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStrOrNull(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function richTextToPlainText(v: any) {
  if (!v) return "";
  if (typeof v === "string") return v;

  if (Array.isArray(v)) {
    return v
      .map((block) =>
        Array.isArray(block?.children)
          ? block.children.map((c: any) => c?.text ?? "").join("")
          : ""
      )
      .join("\n")
      .trim();
  }

  return String(v);
}

function pickImage(rowOrAttr: any) {
  const attr = pickAttr(rowOrAttr);

  const v5first = Array.isArray(attr?.images)
    ? attr.images?.[0]
    : Array.isArray(attr?.images?.data)
    ? attr.images.data?.[0]
    : attr?.images;

  const img = v5first?.attributes ?? v5first;
  if (!img) return "";

  const f = img?.formats;
  const url =
    f?.medium?.url ||
    f?.small?.url ||
    f?.thumbnail?.url ||
    img?.url ||
    "";

  return strapiMediaUrl(url);
}

async function getProduct(pid: string) {
  const clean = String(pid || "").trim();
  if (!clean) return null;

  const isNumeric = /^\d+$/.test(clean);

  try {
    // ✅ Si llega un ID numérico, resolvemos con findOne y redirigimos
    if (isNumeric) {
      const res = await fetcher<any>(`/products/${clean}?populate=*`, {
        next: { revalidate: 3600 },
      });

      const row = res?.data ?? null;
      const documentId =
        row?.documentId ??
        row?.attributes?.documentId ??
        null;

      if (documentId) {
        redirect(`/productos/${documentId}`);
      }

      return row;
    }

    // ✅ Si llega documentId o slug
    const sp = new URLSearchParams();
    sp.set("populate", "*");
    sp.set("pagination[pageSize]", "1");
    sp.set("status", "published");
    sp.set("filters[$or][0][documentId][$eq]", clean);
    sp.set("filters[$or][1][slug][$eq]", clean);

    const list = await fetcher<any>(`/products?${sp.toString()}`, {
      next: { revalidate: 3600 },
    });

    return list?.data?.[0] ?? null;
  } catch (e) {
    console.error("[productos/[id]] getProduct error:", e);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.id);
  if (!product) return { title: "Producto no encontrado" };

  const attr = pickAttr(product);

  const title = String(attr?.title ?? "Producto");
  const description =
    richTextToPlainText(attr?.description) ||
    `Comprá ${title} en nuestra tienda online.`;

  const img = pickImage(product);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: img ? [{ url: img }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const row = await getProduct(params.id);
  if (!row) return notFound();

  const attr = pickAttr(row);

  const id = asNum(row?.id ?? attr?.id, NaN);
  if (!Number.isFinite(id)) return notFound();

  const documentId =
    toStrOrNull(row?.documentId) ??
    toStrOrNull(attr?.documentId) ??
    null;

  const title = String(attr?.title ?? "Producto");
  const description = richTextToPlainText(attr?.description);
  const category = attr?.category ?? null;

  const price = asNum(attr?.price, 0);
  const off = asNum(attr?.off, 0);
  const hasOff = off > 0;
  const finalPrice = hasOff
    ? Math.round(price * (1 - off / 100))
    : price;

  const stock = attr?.stock != null ? asNum(attr?.stock, 0) : null;
  const slug = String(attr?.slug ?? "").trim() || String(id);
  const outOfStock = stock != null && stock <= 0;

  const imageUrl = pickImage(row);

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
            <p className="mt-1 text-sm font-semibold text-neutral-500">
              {String(category)}
            </p>
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
                  <div className="text-3xl font-extrabold text-neutral-900">
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
                    stock > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {stock > 0 ? `Stock: ${stock}` : "Sin stock"}
                </div>
              )}
            </div>

            {description && (
              <div className="mt-5">
                <h2 className="text-sm font-extrabold text-neutral-900">
                  Descripción
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700 whitespace-pre-line">
                  {description}
                </p>
              </div>
            )}

            <div className="mt-6">
              <AddToCartButton
                item={{
                  id,
                  documentId: documentId ?? undefined,
                  slug,
                  title,
                  price,
                  off: hasOff ? off : undefined,
                  imageUrl,
                  stock,
                }}
              />

              {outOfStock ? (
                <p className="mt-3 text-center text-xs font-semibold text-red-700">
                  Este producto no tiene stock disponible.
                </p>
              ) : (
                <p className="mt-3 text-center text-xs text-neutral-500">
                  Podés revisar tu carrito antes de pagar.
                </p>
              )}
            </div>
          </aside>
        </div>

        <div className="pb-14">
          <ProductReviews
            productDocumentId={documentId ?? undefined}
            productId={id}
          />
        </div>
      </Container>
    </main>
  );
}
