import Link from "next/link";
import {
  ProductCard,
  type ProductCardItem,
} from "@/components/products/ProductCard";

type HomeBestSellersProps = {
  products: (ProductCardItem & { off?: number })[];
};

/**
 * Sección del home: "PRODUCTOS MÁS COMPRADOS"
 * - Implementa un grid intrínseco que se adapta automáticamente al contenido.
 * - Utiliza espaciado fluido para márgenes y paddings.
 */
export function HomeBestSellers({ products }: HomeBestSellersProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="py-fluid-lg">
      <div className="mx-auto w-full max-w-7xl px-fluid-sm md:px-fluid-md lg:px-fluid-lg">
        <div className="flex items-center justify-center">
          <h2 className="text-fluid-xs font-extrabold tracking-[0.35em] text-neutral-900">
            PRODUCTOS MÁS COMPRADOS
          </h2>
        </div>

        {/* ✅ Grid intrínseco con auto-fit y minmax */}
        <div className="mt-fluid-md grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-fluid-md">
          {products.map((p: any) => (
            <div
              key={String(p.documentId ?? p.id)}
              className="w-full"
            >
              <ProductCard item={p} />
            </div>
          ))}
        </div>

        <div className="mt-fluid-md flex justify-center">
          <Link
            href="/productos"
            className="rounded-full bg-orange-600 px-fluid-md py-2 text-fluid-sm font-bold text-white hover:bg-orange-700 transition-colors"
          >
            Más productos
          </Link>
        </div>
      </div>
    </section>
  );
}
