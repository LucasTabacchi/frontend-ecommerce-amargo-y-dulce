// src/components/cart/CartBadge.tsx
"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart.store";

function normalizeQty(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function CartBadge() {
  // ✅ totalItems ya suma qty real (y evita NaN)
  const count = useCartStore((s) =>
    typeof s.totalItems === "function"
      ? s.totalItems()
      : s.items.reduce((acc, it: any) => acc + normalizeQty(it?.qty), 0)
  );

  // ✅ Evita mismatch (persist/hydration)
  const hasHydrated = useCartStore((s) => (s as any).hasHydrated ?? true);

  // Evita mismatch SSR: no mostramos nada; recién en cliente aparece
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (!hasHydrated) return null;
  if (count <= 0) return null;

  // ✅ clamp visual por si explota (99+)
  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-extrabold leading-none text-white"
      aria-label={`Carrito: ${count} item${count === 1 ? "" : "s"}`}
      title={`${count} item${count === 1 ? "" : "s"}`}
    >
      {label}
    </span>
  );
}
