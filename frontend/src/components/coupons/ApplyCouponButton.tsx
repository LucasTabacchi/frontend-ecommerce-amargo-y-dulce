"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const CLAIMED_COUPONS_KEY = "amg_my_coupon_codes";
const STORE_ADMIN_FLAG_KEY = "amg_is_store_admin_v1";

function normalizeCode(code: string) {
  return String(code || "").trim().toUpperCase();
}

function readClaimedCoupons() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = localStorage.getItem(CLAIMED_COUPONS_KEY);
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return new Set<string>();
    return new Set(
      arr
        .map((v) => normalizeCode(String(v)))
        .filter(Boolean)
    );
  } catch {
    return new Set<string>();
  }
}

function saveClaimedCoupons(codes: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLAIMED_COUPONS_KEY, JSON.stringify(Array.from(codes)));
  window.dispatchEvent(new Event("amg-coupons-changed"));
}

function readStoreAdminFlag() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE_ADMIN_FLAG_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

type Props = {
  code: string;
  initialApplied?: boolean;
  initialIsStoreAdmin?: boolean;
  initialIsLoggedIn?: boolean;
  initialAuthResolved?: boolean;
};

export function ApplyCouponButton({
  code,
  initialApplied = false,
  initialIsStoreAdmin = false,
  initialIsLoggedIn = false,
  initialAuthResolved = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const normalized = normalizeCode(code);
  const [applied, setApplied] = useState(Boolean(initialApplied && normalized));
  const [isStoreAdmin, setIsStoreAdmin] = useState(Boolean(initialIsStoreAdmin));
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(initialIsLoggedIn));
  const [authResolved, setAuthResolved] = useState(Boolean(initialAuthResolved));
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const syncFromStorage = () => {
      const flag = readStoreAdminFlag();
      if (!alive) return;
      if (typeof flag === "boolean") setIsStoreAdmin(flag);
    };

    const refreshMe = async () => {
      try {
        const r = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });
        const j = await r.json().catch(() => ({ user: null }));
        if (!alive) return;
        const nextUser = j?.user ?? null;
        setIsLoggedIn(Boolean(nextUser?.id));
        setIsStoreAdmin(Boolean(nextUser?.isStoreAdmin));
        if (nextUser?.id) {
          const claimed = Array.isArray(nextUser?.claimedCoupons)
            ? nextUser.claimedCoupons
            : [];
          const localClaimed = readClaimedCoupons();
          const claimedSet = new Set(
            claimed
              .map((v: unknown) => normalizeCode(String(v ?? "")))
              .filter(Boolean)
          );
          setApplied(
            Boolean(normalized && (claimedSet.has(normalized) || localClaimed.has(normalized)))
          );
        } else {
          setApplied(false);
        }
      } catch {
        if (!alive) return;
        setIsLoggedIn(false);
        setApplied(false);
        syncFromStorage();
      } finally {
        if (alive) {
          setAuthResolved(true);
        }
      }
    };

    if (initialAuthResolved && initialIsLoggedIn && initialApplied && normalized) {
      const claimed = readClaimedCoupons();
      if (!claimed.has(normalized)) {
        claimed.add(normalized);
        saveClaimedCoupons(claimed);
      }
    }

    syncFromStorage();
    void refreshMe();
    window.addEventListener("amg-auth-changed", refreshMe);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      alive = false;
      window.removeEventListener("amg-auth-changed", refreshMe);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [normalized, initialAuthResolved, initialIsLoggedIn, initialApplied]);

  useEffect(() => {
    if (!authResolved) return;

    const syncState = () => {
      if (!isLoggedIn) {
        setApplied(false);
        return;
      }
      const claimed = readClaimedCoupons();
      setApplied(claimed.has(normalized));
    };

    syncState();
    window.addEventListener("amg-coupons-changed", syncState);
    window.addEventListener("storage", syncState);

    return () => {
      window.removeEventListener("amg-coupons-changed", syncState);
      window.removeEventListener("storage", syncState);
    };
  }, [normalized, isLoggedIn, authResolved]);

  useEffect(() => {
    if (isLoggedIn) setLoginNotice(null);
  }, [isLoggedIn]);

  async function onApply() {
    setLoginNotice(null);
    if (isStoreAdmin) return;
    if (!normalized) return;
    if (!authResolved) return;

    let loggedNow = isLoggedIn;
    try {
      const r = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      const j = await r.json().catch(() => ({ user: null }));
      const nextUser = j?.user ?? null;
      loggedNow = Boolean(nextUser?.id);
      setIsLoggedIn(loggedNow);
      setIsStoreAdmin(Boolean(nextUser?.isStoreAdmin));
    } catch {
      loggedNow = isLoggedIn;
    }

    if (!loggedNow) {
      const nextPath = pathname || "/cupones";
      setLoginNotice("Tenés que iniciar sesión para aplicar cupones.");
      router.push(`${nextPath}?login=1&next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const claimed = readClaimedCoupons();
    claimed.add(normalized);
    saveClaimedCoupons(claimed);
    setApplied(true);
  }

  const isLoadingButton = !authResolved;

  return (
    <>
      <button
        type="button"
        onClick={onApply}
        disabled={isLoadingButton || isStoreAdmin || !normalized || applied}
        className={[
          "rounded-full px-5 py-2 text-sm font-semibold",
          isLoadingButton
            ? "bg-neutral-200 text-neutral-500 cursor-wait"
            : isStoreAdmin
            ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
            : applied
            ? "bg-emerald-600 text-white"
            : "bg-red-600 text-white hover:bg-red-700",
        ].join(" ")}
      >
        {isLoadingButton
          ? "Cargando..."
          : isStoreAdmin
          ? "No disponible"
          : applied
          ? "Aplicado"
          : "Aplicar"}
      </button>
      {loginNotice ? (
        <p className="mt-2 text-xs text-amber-700">{loginNotice}</p>
      ) : null}
    </>
  );
}
