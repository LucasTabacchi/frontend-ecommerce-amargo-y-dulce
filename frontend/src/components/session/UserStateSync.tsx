"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCartStore } from "@/store/cart.store";

const CLAIMED_COUPONS_KEY = "amg_my_coupon_codes";
const USER_SYNC_KEY_PREFIX = "amg_user_state_synced_v1:";
const LAST_AUTH_USER_ID_KEY = "amg_last_auth_user_id_v1";
const STORE_ADMIN_FLAG_KEY = "amg_is_store_admin_v1";

function userSyncKey(userId: number) {
  return `${USER_SYNC_KEY_PREFIX}${userId}`;
}

function markUserSynced(userId: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(userSyncKey(userId), "1");
  } catch {}
}

function readLastAuthUserId() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_AUTH_USER_ID_KEY);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.trunc(n);
  } catch {
    return null;
  }
}

function writeLastAuthUserId(userId: number | null) {
  if (typeof window === "undefined") return;
  try {
    if (typeof userId === "number" && Number.isFinite(userId) && userId > 0) {
      localStorage.setItem(LAST_AUTH_USER_ID_KEY, String(Math.trunc(userId)));
    } else {
      localStorage.removeItem(LAST_AUTH_USER_ID_KEY);
    }
  } catch {}
}

function writeStoreAdminFlag(isStoreAdmin: boolean | null) {
  if (typeof window === "undefined") return;
  try {
    if (typeof isStoreAdmin !== "boolean") {
      localStorage.removeItem(STORE_ADMIN_FLAG_KEY);
      return;
    }
    localStorage.setItem(STORE_ADMIN_FLAG_KEY, isStoreAdmin ? "1" : "0");
  } catch {}
}

function normalizeCouponCode(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

function sanitizeClaimedCoupons(input: unknown, max = 200) {
  const arr = Array.isArray(input) ? input : [];
  const out = new Set<string>();
  for (const raw of arr) {
    const code = normalizeCouponCode(raw);
    if (!code) continue;
    out.add(code);
    if (out.size >= max) break;
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

function readLocalClaimedCoupons() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CLAIMED_COUPONS_KEY);
    const parsed = JSON.parse(raw || "[]");
    return sanitizeClaimedCoupons(parsed);
  } catch {
    return [];
  }
}

function writeLocalClaimedCoupons(codes: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLAIMED_COUPONS_KEY, JSON.stringify(sanitizeClaimedCoupons(codes)));
  window.dispatchEvent(new Event("amg-coupons-changed"));
}

function normNum(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normInt(v: unknown, fallback = 0) {
  return Math.trunc(normNum(v, fallback));
}

function normStr(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function sanitizeCartItems(input: unknown, max = 150) {
  const arr = Array.isArray(input) ? input : [];
  const out: any[] = [];

  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;

    const id = Math.max(0, normInt((raw as any).id, 0));
    const documentId = normStr((raw as any).documentId);
    const slug = normStr((raw as any).slug) || documentId || (id > 0 ? String(id) : null);
    if (!slug) continue;

    const qty = Math.max(1, Math.min(99, normInt((raw as any).qty, 1)));
    const title = normStr((raw as any).title) || "Producto";

    const item: Record<string, any> = {
      id,
      documentId,
      slug,
      title,
      description: normStr((raw as any).description),
      price: Math.max(0, normNum((raw as any).price, 0)),
      imageUrl: normStr((raw as any).imageUrl),
      category: normStr((raw as any).category),
      qty,
    };

    const off = normNum((raw as any).off, 0);
    if (Number.isFinite(off) && off > 0) item.off = Math.min(100, off);

    const stockRaw = (raw as any).stock;
    item.stock =
      stockRaw === null || stockRaw === undefined || stockRaw === ""
        ? null
        : Math.max(0, normInt(stockRaw, 0));

    out.push(item);
    if (out.length >= max) break;
  }

  return out;
}

function cartKey(it: any) {
  return String(it?.documentId || it?.slug || "").trim();
}

function clampQty(qty: number, stock: number | null) {
  const safeQty = Math.max(1, Math.trunc(qty || 1));
  if (typeof stock !== "number") return safeQty;
  return Math.max(1, Math.min(safeQty, stock));
}

function mergeCart(remoteRaw: unknown, localRaw: unknown) {
  const remote = sanitizeCartItems(remoteRaw);
  const local = sanitizeCartItems(localRaw);
  const map = new Map<string, any>();

  for (const it of [...remote, ...local]) {
    const key = cartKey(it);
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      if (typeof it.stock === "number" && it.stock <= 0) continue;
      map.set(key, { ...it, qty: clampQty(it.qty, it.stock ?? null) });
      continue;
    }

    const stock =
      typeof existing.stock === "number"
        ? existing.stock
        : typeof it.stock === "number"
        ? it.stock
        : null;

    // Importante: no sumar qty entre remoto/local porque bootstrapSync se ejecuta
    // en refresh/focus y eso inflaba unidades. Tomamos la mayor cantidad observada.
    const nextQty = clampQty(Math.max(existing.qty || 1, it.qty || 1), stock);

    map.set(key, {
      ...existing,
      ...it,
      stock,
      qty: nextQty,
    });
  }

  return sanitizeCartItems(Array.from(map.values()));
}

function signatureOf(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function UserStateSync() {
  const items = useCartStore((s) => s.items);
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const setItems = useCartStore((s) => s.setItems);

  const [userId, setUserId] = useState<number | null>(null);
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  const lastCartSigRef = useRef("");
  const lastCouponSigRef = useRef("");
  const cartTimerRef = useRef<any>(null);
  const bootstrappedUserIdRef = useRef<number | null>(null);
  const forceEmptyCartRef = useRef(false);

  const CART_PENDING_SYNC_KEY_PREFIX = "amg_cart_pending_sync_v1:";
  const PENDING_CART_TTL_MS = 2 * 60_000;

  function cartPendingSyncKey(userId: number) {
    return `${CART_PENDING_SYNC_KEY_PREFIX}${userId}`;
  }

  function readPendingCartSync(userId: number) {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(cartPendingSyncKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const sig = String(parsed?.sig ?? "");
      const at = Number(parsed?.at ?? 0);
      if (!sig || !Number.isFinite(at) || at <= 0) return null;
      return { sig, at };
    } catch {
      return null;
    }
  }

  function writePendingCartSync(userId: number, sig: string) {
    if (typeof window === "undefined") return;
    if (!sig) return;
    try {
      localStorage.setItem(
        cartPendingSyncKey(userId),
        JSON.stringify({ sig, at: Date.now() })
      );
    } catch {}
  }

  function clearPendingCartSync(userId: number | null) {
    if (typeof window === "undefined") return;
    if (typeof userId !== "number" || !Number.isFinite(userId) || userId <= 0) return;
    try {
      localStorage.removeItem(cartPendingSyncKey(Math.trunc(userId)));
    } catch {}
  }

  const cartPayload = useMemo(() => sanitizeCartItems(items), [items]);

  async function saveUserPrefs(partial: { claimedCoupons?: string[]; cartItems?: any[] }) {
    const hasCoupons = Object.prototype.hasOwnProperty.call(partial, "claimedCoupons");
    const hasCart = Object.prototype.hasOwnProperty.call(partial, "cartItems");
    if (!hasCoupons && !hasCart) return false;

    const r = await fetch("/api/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }).catch(() => null);

    if (!r) return false;
    if (r.status === 401) {
      setUserId(null);
      return false;
    }

    return r.ok;
  }

  async function saveCartNow(forceItems?: any[]) {
    if (!userId) return false;
    const payload = sanitizeCartItems(forceItems ?? useCartStore.getState().items);
    const nextSig = signatureOf(payload);
    if (nextSig === lastCartSigRef.current) {
      clearPendingCartSync(userId);
      return true;
    }

    writePendingCartSync(userId, nextSig);
    const ok = await saveUserPrefs({ cartItems: payload });
    if (ok) {
      lastCartSigRef.current = nextSig;
      clearPendingCartSync(userId);
    }
    return ok;
  }

  useEffect(() => {
    if (!hasHydrated) return;
    let alive = true;

    const bootstrapSync = async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j = await r.json().catch(() => ({ user: null }));
        if (!alive) return;

        const user = j?.user ?? null;
        if (!user?.id) {
          const lastUser = readLastAuthUserId();
          if (typeof lastUser === "number") {
            clearPendingCartSync(lastUser);
          }
          setUserId(null);
          bootstrappedUserIdRef.current = null;
          lastCartSigRef.current = "";
          lastCouponSigRef.current = "";
          writeLocalClaimedCoupons([]);
          writeStoreAdminFlag(null);
          setInitialSyncDone(true);
          return;
        }

        const nextUserId = Number(user.id);
        const nextIsStoreAdmin = Boolean(user?.isStoreAdmin);
        setUserId(nextUserId);
        writeStoreAdminFlag(nextIsStoreAdmin);
        const isFirstSyncForUser = bootstrappedUserIdRef.current !== nextUserId;
        const lastAuthUserId = readLastAuthUserId();
        const switchedAccount =
          typeof lastAuthUserId === "number" && lastAuthUserId !== nextUserId;

        if (switchedAccount && typeof lastAuthUserId === "number") {
          clearPendingCartSync(lastAuthUserId);
        }

        const remoteCoupons = sanitizeClaimedCoupons(user?.claimedCoupons);
        const localCoupons = readLocalClaimedCoupons();

        const remoteCart = sanitizeCartItems(user?.cartItems);
        const localCart = sanitizeCartItems(useCartStore.getState().items);

        // Solo en el primer sync del usuario actual hacemos merge local+remoto
        // si el backend está vacío (migración de carrito invitado -> cuenta).
        // Si backend ya tiene datos, backend manda para no revivir items borrados
        // desde otro dispositivo.
        const shouldMergeCart =
          isFirstSyncForUser &&
          remoteCart.length === 0 &&
          localCart.length > 0;
        const shouldMergeCoupons =
          isFirstSyncForUser &&
          !switchedAccount &&
          remoteCoupons.length === 0 &&
          localCoupons.length > 0;
        const forceEmptyCart = forceEmptyCartRef.current;

        const remoteCouponSig = signatureOf(remoteCoupons);
        const remoteCartSig = signatureOf(remoteCart);
        const localCouponSig = signatureOf(localCoupons);
        const localCartSig = signatureOf(localCart);

        const pendingCart = readPendingCartSync(nextUserId);
        const hasRecentPendingCart =
          !nextIsStoreAdmin &&
          Boolean(pendingCart?.sig) &&
          pendingCart?.sig === localCartSig &&
          Date.now() - Number(pendingCart?.at ?? 0) <= PENDING_CART_TTL_MS;

        const shouldPreferLocalPendingCart =
          !forceEmptyCart &&
          !shouldMergeCart &&
          hasRecentPendingCart &&
          remoteCartSig !== localCartSig;

        const mergedCoupons = nextIsStoreAdmin
          ? []
          : isFirstSyncForUser
          ? shouldMergeCoupons
            ? sanitizeClaimedCoupons([...remoteCoupons, ...localCoupons])
            : remoteCoupons
          : remoteCoupons;
        const mergedCart = nextIsStoreAdmin
          ? []
          : forceEmptyCart
          ? []
          : shouldMergeCart
          ? mergeCart(remoteCart, localCart)
          : shouldPreferLocalPendingCart
          ? localCart
          : remoteCart;

        const mergedCouponSig = signatureOf(mergedCoupons);
        const mergedCartSig = signatureOf(mergedCart);

        // Seteamos signature de cupones para evitar rebotes de eventos locales.
        lastCouponSigRef.current = mergedCouponSig;

        // Para carrito solo marcamos synced cuando la fuente de verdad es remota.
        if (!forceEmptyCart && !shouldMergeCart && !shouldPreferLocalPendingCart) {
          lastCartSigRef.current = mergedCartSig;
        }

        if (localCouponSig !== mergedCouponSig) {
          writeLocalClaimedCoupons(mergedCoupons);
        }

        if (localCartSig !== mergedCartSig) {
          setItems(mergedCart as any);
        }

        const shouldPersistCoupons =
          (shouldMergeCoupons || nextIsStoreAdmin) &&
          remoteCouponSig !== mergedCouponSig;

        if (shouldPersistCoupons) {
          await saveUserPrefs({ claimedCoupons: mergedCoupons });
        }

        const shouldPersistCart =
          (shouldMergeCart || forceEmptyCart || nextIsStoreAdmin || shouldPreferLocalPendingCart) &&
          remoteCartSig !== mergedCartSig;

        if (shouldPersistCart) {
          writePendingCartSync(nextUserId, mergedCartSig);
          const cartOk = await saveUserPrefs({ cartItems: mergedCart });
          if (cartOk) {
            lastCartSigRef.current = mergedCartSig;
            clearPendingCartSync(nextUserId);
          }
        } else if (remoteCartSig === mergedCartSig) {
          clearPendingCartSync(nextUserId);
        }

        if (forceEmptyCart) {
          forceEmptyCartRef.current = false;
        }
        markUserSynced(nextUserId);
        writeLastAuthUserId(nextUserId);
        bootstrappedUserIdRef.current = nextUserId;
      } finally {
        if (alive) setInitialSyncDone(true);
      }
    };

    bootstrapSync();

    const onFocus = () => {
      bootstrapSync();
    };

    const onAuthChanged = () => {
      bootstrapSync();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("amg-auth-changed", onAuthChanged);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("amg-auth-changed", onAuthChanged);
    };
  }, [hasHydrated, setItems]);

  useEffect(() => {
    if (!userId || !initialSyncDone || !hasHydrated) return;

    const nextSig = signatureOf(cartPayload);
    if (nextSig === lastCartSigRef.current) {
      clearPendingCartSync(userId);
      return;
    }

    writePendingCartSync(userId, nextSig);

    if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    cartTimerRef.current = setTimeout(async () => {
      await saveCartNow(cartPayload);
    }, 150);

    return () => {
      if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    };
  }, [userId, initialSyncDone, hasHydrated, cartPayload]);

  useEffect(() => {
    if (!userId || !initialSyncDone || !hasHydrated) return;

    const flush = () => {
      const payload = sanitizeCartItems(useCartStore.getState().items);
      const nextSig = signatureOf(payload);
      if (nextSig === lastCartSigRef.current) {
        clearPendingCartSync(userId);
        return;
      }

      writePendingCartSync(userId, nextSig);

      // keepalive evita perder cambios al recargar/cerrar pestaña.
      fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartItems: payload }),
        keepalive: true,
      }).catch(() => null);
    };

    const onPageHide = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, initialSyncDone, hasHydrated]);

  useEffect(() => {
    const onForceEmpty = () => {
      forceEmptyCartRef.current = true;
      setItems([]);
      lastCartSigRef.current = signatureOf([]);
      if (typeof userId === "number") {
        writePendingCartSync(userId, signatureOf([]));
      }
      saveUserPrefs({ cartItems: [] });
    };

    window.addEventListener("amg-cart-force-empty", onForceEmpty);
    return () => {
      window.removeEventListener("amg-cart-force-empty", onForceEmpty);
    };
  }, [setItems, userId]);

  useEffect(() => {
    if (!userId || !initialSyncDone) return;

    const syncCoupons = async () => {
      const claimed = readLocalClaimedCoupons();
      const nextSig = signatureOf(claimed);
      if (nextSig === lastCouponSigRef.current) return;

      const ok = await saveUserPrefs({ claimedCoupons: claimed });
      if (ok) {
        lastCouponSigRef.current = nextSig;
      }
    };

    const onChange = () => {
      syncCoupons();
    };

    window.addEventListener("amg-coupons-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("amg-coupons-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [userId, initialSyncDone]);

  return null;
}


