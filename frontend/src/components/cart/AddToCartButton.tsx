"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCartStore } from "@/store/cart.store";
import type { ProductCardItem } from "@/components/products/ProductCard";
import { useAuthStore } from "@/store/auth.store";
import { LoginModal } from "@/components/auth/LoginModal";
import { getAddToCartAuthDecision } from "@/lib/cart-auth-guard";
import {
  getCartLimitReachedMessage,
  getOutOfStockDetailCopy,
  getStockExceededMessage,
} from "@/lib/stock-labels";

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
  showLowStockHint = true,
}: {
  item: ProductCardItem;
  quantity?: number;
  showLowStockHint?: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const authResolved = useAuthStore((s) => s.resolved);
  const user = useAuthStore((s) => s.user);

  const [msg, setMsg] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const timerRef = useRef<any>(null);

  const stock = useMemo(() => toIntStock((item as any)?.stock), [item]);
  const key = useMemo(() => getKey(item), [item]);
  const authDecision = getAddToCartAuthDecision({ authResolved, user });

  const currentQty = useMemo(() => {
    const found = items.find((it: any) => getKey(it) === key);
    const q = Number(found?.qty ?? 0);
    return Number.isFinite(q) ? Math.max(0, Math.trunc(q)) : 0;
  }, [items, key]);

  const out = stock !== null && stock <= 0;
  const outOfStockCopy = getOutOfStockDetailCopy(stock);
  const authLoading = authDecision === "auth-loading";
  const loginRequired = authDecision === "login-required";
  const blockedForStoreUser = authDecision === "store-admin-blocked";
  const limitReached = stock !== null && currentQty >= stock;
  const limitReachedMessage = getCartLimitReachedMessage(stock, currentQty);
  const remaining = stock !== null ? Math.max(0, stock - currentQty) : null;
  const requestedQty = Math.max(1, Math.trunc(Number(quantity) || 1));
  const stockExceededMessage = !out && !limitReachedMessage
    ? getStockExceededMessage(stock, requestedQty, currentQty)
    : null;
  const isDisabled =
    authLoading || blockedForStoreUser || out || limitReached || Boolean(stockExceededMessage);

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
          if (authLoading) {
            showTemp("Verificando sesión...");
            return;
          }
          if (loginRequired) {
            setLoginOpen(true);
            return;
          }
          if (blockedForStoreUser) {
            showTemp("La cuenta tienda no puede comprar.");
            return;
          }
          // ✅ pre-check (no depende de que el store devuelva {ok})
          if (stock !== null && stock <= 0) {
            showTemp(outOfStockCopy?.actionLabel ?? "No hay stock");
            return;
          }
          if (stock !== null && currentQty >= stock) {
            showTemp(limitReachedMessage ?? "No hay más unidades disponibles para este producto.");
            return;
          }
          if (stockExceededMessage) {
            showTemp(stockExceededMessage);
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
            showTemp(limitReachedMessage ?? "No hay más unidades disponibles para este producto.");
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
        {authLoading
          ? "Verificando..."
          : blockedForStoreUser
          ? "No disponible"
          : out
          ? outOfStockCopy?.actionLabel ?? "No hay stock"
          : limitReachedMessage
          ? "Máximo en carrito"
          : stockExceededMessage || limitReached
          ? "Sin stock"
          : remaining !== null
          ? "Agregar al carrito"
          : "Agregar al carrito"}
      </button>

      {/* Mensaje UX */}
      {msg && <div className="mt-2 text-xs text-neutral-600">{msg}</div>}

      {/* Hint permanente si queda poco */}
      {!blockedForStoreUser &&
      !out &&
      showLowStockHint &&
      stock !== null &&
      remaining !== null &&
      remaining > 0 &&
      remaining <= 3 &&
      !msg && (
        <div className="mt-2 text-xs text-amber-700">Últimas unidades disponibles.</div>
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => setLoginOpen(false)}
      />
    </div>
  );
}
