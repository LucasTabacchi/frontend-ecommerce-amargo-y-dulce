import Link from "next/link";
import { ProductCard, type ProductCardItem } from "@/components/products/ProductCard";

type HomeBestSellersProps = {
  products: (ProductCardItem & { off?: number })[];
};

/**
 * Sección del home: "PRODUCTOS MÁS COMPRADOS"
 * - Recibe productos desde la Home (Strapi)
 * - Renderiza ProductCard sin mocks
 */
export function HomeBestSellers({ products }: HomeBestSellersProps) {
  if (!products || products.length === 0) {
    return null; // o un placeholder si preferís
  }

  return (
      <section className="py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-center">
            <h2 className="text-xs font-extrabold tracking-[0.22em] text-neutral-800">
              PRODUCTOS MAS COMPRADOS
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p: any) => (
              <div key={String(p.documentId ?? p.id)} className="w-full">
                <ProductCard item={p} />
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/productos"
              className="rounded-full bg-orange-600 px-6 py-2 text-sm font-bold text-white hover:bg-orange-700"
            >
              Mas productos
            </Link>
          </div>
        </div>
      </section>
    );
  }
