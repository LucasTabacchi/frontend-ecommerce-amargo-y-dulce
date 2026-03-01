import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductCardItem } from "@/components/products/ProductCard";

export type CartItem = ProductCardItem & {
  qty: number;
  documentId?: string | null;
  // ✅ stock disponible (si viene). Si es null/undefined => no limitamos.
  stock?: number | null;
};

type CartState = {
  items: CartItem[];

  // ✅ persist hydration flag (para evitar rehidratación pisando clear())
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  setItems: (items: CartItem[]) => void;
  addItem: (product: ProductCardItem, qty?: number) => void;
  removeItem: (slug: string) => void;
  inc: (slug: string) => void;
  dec: (slug: string) => void;
  clear: () => void;

  totalItems: () => number;
  totalPrice: () => number;
};

function normalizeQty(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  // ✅ PERMITE 0 (necesario para dec() y para poder filtrar/eliminar)
  return Math.max(0, Math.floor(n));
}

function normalizeIdToNumberOrZero(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function normStrOrNull(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

// ✅ toma stock desde product o attributes (Strapi)
// si no viene, devuelve null (sin límite)
function pickStockOrNull(product: any): number | null {
  const raw = product?.stock ?? product?.attributes?.stock ?? null;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

// ✅ clamp qty al stock si hay stock
function clampQty(nextQty: number, stock: number | null) {
  const q = normalizeQty(nextQty);
  if (stock == null) return q;
  return Math.min(q, stock);
}

/**
 * ✅ Normaliza el item para:
 * - qty válido
 * - id numérico (Strapi id)
 * - documentId (Strapi v5) si existe
 * - slug usable (fallback)
 * - stock si existe (para limitar qty)
 */
function normalizeCartItem(product: any, qty: number): CartItem {
  const idNum = normalizeIdToNumberOrZero(product?.id);

  const documentId =
    normStrOrNull(product?.documentId) ??
    normStrOrNull(product?.attributes?.documentId) ??
    normStrOrNull(product?.attributes?.document_id) ??
    null;

  const slug =
    normStrOrNull(product?.slug) ?? (idNum ? String(idNum) : documentId ?? "item");

  const price = Number(product?.price) || 0;

  const offRaw = product?.off;
  const off =
    offRaw == null || offRaw === ""
      ? undefined
      : Number.isFinite(Number(offRaw))
      ? Number(offRaw)
      : undefined;

  const stock = pickStockOrNull(product);

  return {
    ...(product as any),
    id: idNum as any, // ProductCardItem tipa id como number
    documentId,
    slug,
    price,
    off,
    stock,
    qty: normalizeQty(qty),
  } as CartItem;
}

function normalizeCartItems(items: any[]): CartItem[] {
  const input = Array.isArray(items) ? items : [];
  const map = new Map<string, CartItem>();

  for (const raw of input) {
    const qty = Math.max(1, normalizeQty(raw?.qty ?? 1));
    const normalized = normalizeCartItem(raw, qty);
    const key = normalized.documentId ?? normalized.slug;
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      if (typeof normalized.stock === "number" && normalized.stock <= 0) continue;
      const firstQty = Math.max(1, clampQty(normalized.qty, normalized.stock ?? null));
      map.set(key, { ...normalized, qty: firstQty });
      continue;
    }

    const stock =
      typeof existing.stock === "number"
        ? existing.stock
        : typeof normalized.stock === "number"
        ? normalized.stock
        : null;

    const mergedQty = Math.max(1, clampQty(normalizeQty(existing.qty) + normalizeQty(normalized.qty), stock));

    map.set(key, {
      ...existing,
      ...normalized,
      stock,
      qty: mergedQty,
    });
  }

  return Array.from(map.values());
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      setItems: (items) => set({ items: normalizeCartItems(items as any[]) }),

      addItem: (product, qty = 1) => {
        // ✅ al agregar, mínimo 1
        const addQty = Math.max(1, normalizeQty(qty));

        set((state) => {
          const normalized = normalizeCartItem(product, addQty);

          // ✅ clave de identidad:
          // - si hay documentId (v5), usamos eso
          // - sino, fallback a slug
          const key = normalized.documentId ?? normalized.slug;

          const existing = state.items.find((i: any) => (i.documentId ?? i.slug) === key);

          if (existing) {
            const existingStock =
              typeof existing.stock === "number" ? existing.stock : normalized.stock ?? null;

            return {
              items: state.items.map((i: any) => {
                if ((i.documentId ?? i.slug) !== key) return i;

                const nextQtyRaw = normalizeQty(i.qty) + addQty;
                const nextQty = Math.max(1, clampQty(nextQtyRaw, existingStock));

                return {
                  ...i,
                  // ✅ mantenemos stock (si aparece nuevo lo actualizamos)
                  stock: existingStock,
                  qty: nextQty,
                };
              }),
            };
          }

          // ✅ si el stock es 0, no lo agregamos (opcional UX)
          if (typeof normalized.stock === "number" && normalized.stock <= 0) {
            return { items: state.items };
          }

          // ✅ si el stock existe, clamp inicial también
          const initialQty = Math.max(1, clampQty(normalized.qty, normalized.stock ?? null));
          return { items: [...state.items, { ...normalized, qty: initialQty }] };
        });
      },

      removeItem: (slug) =>
        set((state) => ({
          items: state.items.filter((i) => i.slug !== slug),
        })),

      inc: (slug) =>
        set((state) => ({
          items: state.items.map((i) => {
            if (i.slug !== slug) return i;

            const stock = typeof i.stock === "number" ? i.stock : null;
            const nextQtyRaw = Math.max(1, normalizeQty(i.qty) + 1);
            const nextQty = Math.max(1, clampQty(nextQtyRaw, stock));

            return { ...i, qty: nextQty };
          }),
        })),

      dec: (slug) =>
        set((state) => ({
          items: state.items
            .map((i) => {
              if (i.slug !== slug) return i;
              // ✅ baja 1 y permite 0
              const nextQty = normalizeQty(i.qty) - 1;
              return { ...i, qty: normalizeQty(nextQty) };
            })
            // ✅ si llegó a 0, se elimina del carrito
            .filter((i) => normalizeQty(i.qty) > 0),
        })),

      clear: () => set({ items: [] }),

      // ✅ totalItems: no forzamos mínimo 1; sumamos qty real (0 no debería existir igual)
      totalItems: () => get().items.reduce((acc, i) => acc + normalizeQty(i.qty), 0),

      totalPrice: () =>
        get().items.reduce((acc, i: any) => {
          const qty = normalizeQty(i.qty);
          const price = Number(i.price) || 0;
          const off = Number(i.off) || 0;
          const hasOff = Number.isFinite(off) && off > 0;

          const finalPrice = hasOff ? Math.round(price * (1 - off / 100)) : price;
          return acc + finalPrice * qty;
        }, 0),
    }),
    {
      name: "amargo-dulce-cart",
      version: 5, // ✅ subimos versión porque agregamos setItems + merge más robusto
      migrate: (persisted: any) => {
        // zustand persist guarda { state, version }
        const state = persisted?.state ?? persisted ?? {};
        const items = Array.isArray(state?.items) ? state.items : [];
        const fixed = normalizeCartItems(items);

        return { ...persisted, state: { ...state, items: fixed } };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
