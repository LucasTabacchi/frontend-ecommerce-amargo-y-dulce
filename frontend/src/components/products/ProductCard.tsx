// src/components/products/ProductCard.tsx
import Link from "next/link";
import Image from "next/image";

/**
 * Tipo simple para un producto.
 * Compatible con Strapi v5
 */
export type ProductCardItem = {
  id: number; // id numérico interno (v4/v5)
  slug: string;
  title: string;
  description?: string;
  price: number;
  imageUrl?: string;
  off?: number;
  category?: string;
  documentId?: string | null;
  stock?: number | null;
};

/**
 * Card reutilizable de producto:
 * - Implementa Container Queries para adaptabilidad basada en el contenedor.
 * - Utiliza Tipografía Fluida para mejor legibilidad.
 */
export function ProductCard({ item }: { item: ProductCardItem }) {
  const hasOff = typeof item.off === "number" && item.off > 0;
  const finalPrice = hasOff ? Math.round(item.price * (1 - item.off! / 100)) : item.price;

  const href = item.documentId ? `/productos/${encodeURIComponent(item.documentId)}` : `/productos/${item.id}`;

  return (
    <div className="@container h-full">
      <Link
        href={href}
        className="group flex flex-col h-full rounded-lg border border-neutral-200 bg-white p-4 transition hover:shadow-sm @[400px]:flex-row @[400px]:gap-4"
      >
        {/* Imagen / Placeholder */}
        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-neutral-100 @[400px]:w-1/3 @[400px]:aspect-square">
          {/* Badge descuento */}
          {hasOff && (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold text-white @[400px]:text-xs">
              {item.off}% OFF
            </span>
          )}

          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="text-xs text-neutral-500">Imagen próximamente</div>
          )}
        </div>

        {/* Texto */}
        <div className="mt-3 flex flex-col flex-1 @[400px]:mt-0">
          <h3 className="text-fluid-sm font-semibold text-neutral-900 group-hover:underline @[400px]:text-fluid-base">
            {item.title}
          </h3>

          {item.description ? (
            <p className="mt-1 line-clamp-2 text-fluid-xs text-neutral-600">{item.description}</p>
          ) : (
            <p className="mt-1 text-fluid-xs text-neutral-400">—</p>
          )}

          {/* Stock (opcional) */}
          {typeof item.stock === "number" && (
            <div className="mt-auto pt-2 text-fluid-xs text-neutral-600">
              Stock: <span className="font-semibold">{item.stock}</span>
            </div>
          )}

          {/* Precio */}
          <div className="mt-2">
            {hasOff ? (
              <div className="flex items-baseline gap-2">
                <span className="text-fluid-xs font-semibold text-neutral-400 line-through">
                  ${item.price.toLocaleString("es-AR")}
                </span>
                <span className="text-fluid-sm font-semibold text-neutral-900 @[400px]:text-fluid-base">
                  ${finalPrice.toLocaleString("es-AR")}
                </span>
              </div>
            ) : (
              <div className="text-fluid-sm font-semibold text-neutral-900 @[400px]:text-fluid-base">
                ${item.price.toLocaleString("es-AR")}
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
