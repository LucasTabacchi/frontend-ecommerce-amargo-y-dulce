"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCartStore } from "@/store/cart.store";
import type { ProductCardItem } from "@/components/products/ProductCard";
import { useAuthStore } from "@/store/auth.store";

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

export function AddToCartButton({
  item,
  quantity = 1,
}: {
  item: ProductCardItem;
  quantity?: number;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const authResolved = useAuthStore((s) => s.resolved);
  const isStoreAdmin = useAuthStore((s) => Boolean(s.user?.isStoreAdmin));

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
  const blockedForStoreUser = authResolved && isStoreAdmin;
  const limitReached = stock !== null && currentQty >= stock;
  const remaining = stock !== null ? Math.max(0, stock - currentQty) : null;
  const requestedQty = Math.max(1, Math.trunc(Number(quantity) || 1));
  const exceedsRemaining = remaining !== null && requestedQty > remaining;
  const isDisabled = blockedForStoreUser || out || limitReached || exceedsRemaining;

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
        disabled={isDisabled}
        onClick={() => {
          if (blockedForStoreUser) {
            showTemp("La cuenta tienda no puede comprar.");
            return;
          }
          // ✅ pre-check (no depende de que el store devuelva {ok})
          if (stock !== null && stock <= 0) {
            showTemp("Publicación pausada.");
            return;
          }
          if (stock !== null && currentQty >= stock) {
            showTemp("No hay más unidades disponibles para este producto.");
            return;
          }
          if (remaining !== null && requestedQty > remaining) {
            showTemp("No hay suficientes unidades disponibles para esa cantidad.");
            return;
          }

          const before = currentQty;

          addItem(item, requestedQty);

          // ✅ post-check: si no aumentó, probablemente quedó clamped
          const after = (() => {
            const found = useCartStore
              .getState()
              .items.find((it: any) => getKey(it) === key);
            const q = Number(found?.qty ?? 0);
            return Number.isFinite(q) ? Math.max(0, Math.trunc(q)) : 0;
          })();

          if (stock !== null && after >= stock && before >= stock) {
            showTemp("No hay más unidades disponibles para este producto.");
            return;
          }

          if (after === before) {
            // no cambió (por algún clamp o estado)
            if (stock !== null) showTemp("No hay más unidades disponibles para este producto.");
            else showTemp("No se pudo agregar.");
            return;
          }

          // ✅ ok
          if (stock !== null && after >= stock) {
            showTemp("Agregado ✅");
          } else if (stock !== null && remaining !== null && remaining <= 2) {
            showTemp("Agregado ✅");
          } else {
            showTemp("Agregado al carrito ✅");
          }
        }}
        className={[
          "w-full rounded-full px-5 py-3 text-sm font-semibold transition",
          isDisabled
            ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
            : "bg-red-600 text-white hover:bg-red-700",
        ].join(" ")}
      >
        {blockedForStoreUser
          ? "No disponible"
          : out
          ? "Publicación pausada"
          : limitReached || exceedsRemaining
          ? "Cantidad máxima seleccionada"
          : remaining !== null
          ? "Agregar al carrito"
          : "Agregar al carrito"}
      </button>

      {/* Mensaje UX */}
      {msg && <div className="mt-2 text-xs text-neutral-600">{msg}</div>}

      {/* Hint permanente si queda poco */}
      {!blockedForStoreUser &&
      !out &&
      stock !== null &&
      remaining !== null &&
      remaining > 0 &&
      remaining <= 3 &&
      !msg && (
        <div className="mt-2 text-xs text-amber-700">Últimas unidades disponibles.</div>
      )}
    </div>
  );
}
