import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";
import { toCardItem } from "@/lib/strapi-mappers";

// ✅ Revalidar cada hora (ISR)
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Productos | Chocolates Artesanales",
  description: "Explorá nuestra amplia variedad de chocolates y bombones artesanales.",
};

type StrapiListResponse<T> = {
  data: Array<{ id: number; attributes: T; documentId?: string }>;
  meta?: any;
};

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function toStrOrNull(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q || "").trim();

  let products: any[] = [];
  let errorMsg: string | null = null;

  try {
    const sp = new URLSearchParams();
    sp.set("populate", "*");
    sp.set("pagination[pageSize]", "100");
    sp.set("sort[0]", "createdAt:desc");

    // ✅ IMPORTANTE:
    // En Strapi v5, el "published" se maneja con status=published.
    // El filtro publishedAt puede no comportarse como esperás según configuración.
    sp.set("status", "published");

    if (q) {
      sp.set("filters[$or][0][title][$containsi]", q);
      sp.set("filters[$or][1][slug][$containsi]", q);

      // ✅ Si description ahora es RichText (blocks), este filtro puede fallar/ser ignorado.
      // Lo dejamos para compatibilidad; si te da problemas, lo sacamos.
      sp.set("filters[$or][2][description][$containsi]", q);
    }

    // ✅ Server Component: pegamos directo a Strapi (evita salto por API interna)
    const res = await fetcher<StrapiListResponse<any>>(`/products?${sp.toString()}`, {
      // ✅ Para listar productos NO debería requerir auth.
      // Si tu fetcher usa auth=true para pegarle a Strapi con token, dejalo.
      // Pero para storefront público, esto debería ser false.
      auth: false,
      next: { revalidate: q ? 0 : 3600 },
    });

    const raw = Array.isArray(res?.data) ? res.data : [];

    // ✅ Aseguramos que cada card tenga documentId disponible (si tu mapper no lo preserva)
    products = raw.map((item: any) => {
      const card = toCardItem(item);

      const documentId =
        toStrOrNull(item?.documentId) ||
        toStrOrNull(item?.attributes?.documentId) ||
        toStrOrNull(card?.documentId);

      return {
        ...card,
        // guardamos también el numérico por si querés usarlo para keys / fallback
        id: card?.id ?? item?.id,
        documentId,
      };
    });
  } catch (err: any) {
    errorMsg = err?.message || "No se pudieron cargar los productos.";
  }

  return (
    <main>
      <Container>
        <div className="py-10">
          <h1 className="text-3xl font-extrabold text-neutral-900">Productos</h1>
          <p className="mt-2 text-sm text-neutral-600">
            {q ? (
              <>
                Resultados para{" "}
                <span className="font-semibold text-neutral-900">“{q}”</span>
              </>
            ) : (
              "Explorá nuestros productos artesanales."
            )}
          </p>

          {q && (
            <div className="mt-4 flex items-center gap-3">
              <Link href="/productos" className="text-sm underline text-neutral-700">
                Limpiar búsqueda
              </Link>
              <span className="text-sm text-neutral-400">•</span>
              <span className="text-sm text-neutral-600">
                {products.length} resultado{products.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        {errorMsg ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-neutral-800">
            <p>{errorMsg}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-neutral-700">
            No encontramos resultados para su búsqueda.
          </div>
        ) : (
          <div className="pb-14">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p: any) => {
                const hasOff = typeof p.off === "number" && p.off > 0;
                const basePrice = typeof p.price === "number" ? p.price : null;
                const finalPrice =
                  basePrice != null && hasOff
                    ? Math.round(basePrice * (1 - p.off / 100))
                    : basePrice;

                // ✅ URL estable: documentId (Strapi v5). Fallback: id numérico.
                const href = `/productos/${p.documentId || p.id}`;

                return (
                  <Link
                    key={String(p.documentId || p.id)}
                    href={href}
                    className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] w-full bg-neutral-100">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.title ?? "Producto"}
                          fill
                          className="object-cover transition group-hover:scale-105"
                          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, (max-width: 1280px) 30vw, 22vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                          Sin imagen
                        </div>
                      )}
                      {hasOff && (
                        <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                          -{p.off}%
                        </span>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="truncate text-base font-extrabold text-neutral-900">
                        {p.title ?? "Producto"}
                      </div>
                      <div className="mt-4">
                        {finalPrice != null ? (
                          <div className="flex items-baseline gap-2">
                            <div className="text-lg font-extrabold text-neutral-900">
                              {formatARS(finalPrice)}
                            </div>
                            {hasOff && basePrice != null && (
                              <div className="text-sm font-semibold text-neutral-400 line-through">
                                {formatARS(basePrice)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-neutral-600">Precio no disponible</div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Container>
    </main>
  );
}
