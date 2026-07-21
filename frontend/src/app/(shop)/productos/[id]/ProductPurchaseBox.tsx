"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import type { ProductCardItem } from "@/components/products/ProductCard";
import {
  getDetailAvailabilityLabel,
  getDetailStockWarning,
  getQuantityOptions,
} from "@/lib/stock-labels";

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
  const [manualQuantity, setManualQuantity] = useState("7");
  const [manualMode, setManualMode] = useState(false);
  const [open, setOpen] = useState(false);

  if (!options.length) {
    return <AddToCartButton item={item} quantity={1} />;
  }

  const manualValue = Math.max(7, Math.trunc(Number(manualQuantity) || 7));
  const selected = manualMode ? manualValue : options.includes(quantity) ? quantity : 1;
  const availabilityLabel = getDetailAvailabilityLabel(stock);
  const stockWarning = getDetailStockWarning(stock);

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
          {availabilityLabel ? (
            <span className="text-neutral-500">({availabilityLabel})</span>
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
                  setManualMode(false);
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
            <button
              type="button"
              onClick={() => {
                setManualMode(true);
                setManualQuantity(String(Math.max(7, manualValue)));
                setOpen(false);
              }}
              className="block w-full border-l-4 border-transparent px-5 py-3 text-left text-sm font-semibold text-neutral-800 hover:bg-blue-50"
            >
              Más de 6 unidades
            </button>
          </div>
        )}
      </div>

      {stockWarning ? (
        <div className="mt-2 text-xs font-semibold text-amber-700">
          {stockWarning}
        </div>
      ) : null}

      {manualMode ? (
        <label className="mt-3 block text-xs font-semibold text-neutral-700">
          Cantidad personalizada
          <input
            type="number"
            min={7}
            step={1}
            value={manualQuantity}
            onChange={(event) => setManualQuantity(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-red-500"
          />
        </label>
      ) : null}

      <div className="mt-4">
        <AddToCartButton item={item} quantity={selected} />
      </div>
    </div>
  );
}
