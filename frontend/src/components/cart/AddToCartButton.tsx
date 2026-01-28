"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCartStore } from "@/store/cart.store";
import type { ProductCardItem } from "@/components/products/ProductCard";

function toIntStock(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

function getKey(p: any) {
  const doc = String(p?.documentId ?? "").trim();
  if (doc) return `doc:${doc}`;
  const slug = String(p?.slug ?? "").trim();
  if (slug) return `slug:${slug}`;
  const id = Number(p?.id);
  if (Number.isFinite(id) && id > 0) return `id:${id}`;
  return "unknown";
}

export function AddToCartButton({ item }: { item: ProductCardItem }) {
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);

  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  const stock = useMemo(() => toIntStock((item as any)?.stock), [item]);
  const key = useMemo(() => getKey(item), [item]);

  const currentQty = useMemo(() => {
    const found = items.find((it: any) => getKey(it) === key);
    const q = Number(found?.qty ?? 0);
    return Number.isFinite(q) ? Math.max(0, Math.trunc(q)) : 0;
  }, [items, key]);

  const out = stock !== null && stock <= 0;
  const limitReached = stock !== null && currentQty >= stock;
  const remaining = stock !== null ? Math.max(0, stock - currentQty) : null;

  function showTemp(text: string) {
    setMsg(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMsg(null), 2200);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div>
      <button
        type="button"
        disabled={out || limitReached}
        onClick={() => {
          // ✅ pre-check (no depende de que el store devuelva {ok})
          if (stock !== null && stock <= 0) {
            showTemp("Sin stock disponible.");
            return;
          }
          if (stock !== null && currentQty >= stock) {
            showTemp(`Solo queda${stock === 1 ? "" : "n"} ${stock} en stock.`);
            return;
          }

          const before = currentQty;

          addItem(item, 1);

          // ✅ post-check: si no aumentó, probablemente quedó clamped
          const after = (() => {
            const found = useCartStore
              .getState()
              .items.find((it: any) => getKey(it) === key);
            const q = Number(found?.qty ?? 0);
            return Number.isFinite(q) ? Math.max(0, Math.trunc(q)) : 0;
          })();

          if (stock !== null && after >= stock && before >= stock) {
            showTemp(`Solo queda${stock === 1 ? "" : "n"} ${stock} en stock.`);
            return;
          }

          if (after === before) {
            // no cambió (por algún clamp o estado)
            if (stock !== null) showTemp(`Solo queda${stock === 1 ? "" : "n"} ${stock} en stock.`);
            else showTemp("No se pudo agregar.");
            return;
          }

          // ✅ ok
          if (stock !== null && after >= stock) {
            showTemp(`Agregado ✅ (llegaste al máximo: ${stock})`);
          } else if (stock !== null && remaining !== null && remaining <= 2) {
            showTemp(`Agregado ✅ (quedan ${Math.max(0, stock - after)})`);
          } else {
            showTemp("Agregado al carrito ✅");
          }
        }}
        className={[
          "w-full rounded-full px-5 py-3 text-sm font-semibold transition",
          out || limitReached
            ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
            : "bg-red-600 text-white hover:bg-red-700",
        ].join(" ")}
      >
        {out
          ? "Sin stock"
          : limitReached
          ? stock !== null
            ? `Máximo ${stock} en carrito`
            : "Máximo alcanzado"
          : remaining !== null
          ? `Agregar al carrito (quedan ${remaining})`
          : "Agregar al carrito"}
      </button>

      {/* Mensaje UX */}
      {msg && <div className="mt-2 text-xs text-neutral-600">{msg}</div>}

      {/* Hint permanente si queda poco */}
      {!out && stock !== null && remaining !== null && remaining > 0 && remaining <= 3 && !msg && (
        <div className="mt-2 text-xs text-amber-700">
          Atención: solo queda{remaining === 1 ? "" : "n"} {remaining}.
        </div>
      )}
    </div>
  );
}
