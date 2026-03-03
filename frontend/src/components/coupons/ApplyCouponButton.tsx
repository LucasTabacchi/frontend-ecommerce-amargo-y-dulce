"use client";

import { useEffect, useState } from "react";

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
};

export function ApplyCouponButton({ code }: Props) {
  const normalized = normalizeCode(code);
  const [applied, setApplied] = useState(false);
  const [isStoreAdmin, setIsStoreAdmin] = useState(false);

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
        setIsStoreAdmin(Boolean(j?.user?.isStoreAdmin));
      } catch {
        if (!alive) return;
        syncFromStorage();
      }
    };

    syncFromStorage();
    refreshMe();
    window.addEventListener("amg-auth-changed", refreshMe);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      alive = false;
      window.removeEventListener("amg-auth-changed", refreshMe);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!normalized) return;

    const syncState = () => {
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
  }, [normalized]);

  function onApply() {
    if (isStoreAdmin) return;
    if (!normalized) return;
    const claimed = readClaimedCoupons();
    claimed.add(normalized);
    saveClaimedCoupons(claimed);
    setApplied(true);
  }

  return (
    <button
      type="button"
      onClick={onApply}
      disabled={isStoreAdmin || !normalized || applied}
      className={[
        "rounded-full px-5 py-2 text-sm font-semibold text-white",
        isStoreAdmin
          ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
          : applied
          ? "bg-emerald-600"
          : "bg-red-600 hover:bg-red-700",
      ].join(" ")}
    >
      {isStoreAdmin ? "No disponible para cuenta tienda" : applied ? "Aplicado" : "Aplicar"}
    </button>
  );
}
