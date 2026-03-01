"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CLAIMED_COUPONS_KEY = "amg_my_coupon_codes";

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

type Props = {
  code: string;
};

export function ApplyCouponButton({ code }: Props) {
  const router = useRouter();
  const normalized = normalizeCode(code);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!normalized) return;
    const claimed = readClaimedCoupons();
    setApplied(claimed.has(normalized));
  }, [normalized]);

  function onApply() {
    if (!normalized) return;
    const claimed = readClaimedCoupons();
    claimed.add(normalized);
    saveClaimedCoupons(claimed);
    setApplied(true);
  }

  function onSearchProducts() {
    router.push("/productos#listado");
  }

  return (
    <button
      type="button"
      onClick={applied ? onSearchProducts : onApply}
      disabled={!normalized}
      className={[
        "rounded-full px-5 py-2 text-sm font-semibold text-white",
        applied ? "bg-neutral-900 hover:bg-neutral-800" : "bg-red-600 hover:bg-red-700",
      ].join(" ")}
    >
      {applied ? "Buscar productos" : "Aplicar"}
    </button>
  );
}
