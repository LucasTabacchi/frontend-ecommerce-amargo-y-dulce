"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import type { ProductCardItem } from "@/components/products/ProductCard";
import { getQuantityOptions } from "@/lib/stock-labels";

function quantityLabel(qty: number) {
  return `${qty} unidad${qty === 1 ? "" : "es"}`;
}

export function ProductPurchaseBox({
  item,
  stock,
}: {
  item: ProductCardItem;
  stock: number | null;
}) {
  const options = useMemo(() => getQuantityOptions(stock), [stock]);
  const [quantity, setQuantity] = useState(1);
  const [open, setOpen] = useState(false);

  if (!options.length) {
    return <AddToCartButton item={item} quantity={1} />;
  }

  const selected = options.includes(quantity) ? quantity : 1;
  const extra = typeof stock === "number" ? Math.max(0, stock - selected) : 0;

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="text-sm font-extrabold text-neutral-900">Stock disponible</div>

      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-left text-sm text-neutral-700"
          aria-expanded={open}
        >
          <span>Cantidad: </span>
          <span className="font-bold text-neutral-900">{quantityLabel(selected)}</span>
          <ChevronDown
            className={[
              "h-4 w-4 text-blue-600 transition",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
          {extra > 0 ? (
            <span className="text-neutral-500">
              (+{extra} disponible{extra === 1 ? "" : "s"})
            </span>
          ) : null}
        </button>

        {open && (
          <div className="absolute left-0 top-8 z-20 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white py-2 shadow-lg">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setQuantity(option);
                  setOpen(false);
                }}
                className={[
                  "block w-full px-5 py-3 text-left text-sm hover:bg-blue-50",
                  option === selected
                    ? "border-l-4 border-blue-600 font-bold text-blue-600"
                    : "border-l-4 border-transparent text-neutral-800",
                ].join(" ")}
              >
                {quantityLabel(option)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <AddToCartButton item={item} quantity={selected} />
      </div>
    </div>
  );
}
