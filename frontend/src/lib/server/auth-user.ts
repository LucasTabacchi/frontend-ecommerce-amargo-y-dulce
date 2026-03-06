import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";

export type ServerAuthUser = {
  id: number;
  documentId: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  username: string | null;
  email: string | null;
  dni: string | null;
  isStoreAdmin: boolean;
  claimedCoupons: string[];
  cartItems: any[];
};

function normBase(url: string) {
  let base = String(url || "").trim().replace(/\/$/, "");
  if (base.toLowerCase().endsWith("/api")) {
    base = base.slice(0, -4);
  }
  return base;
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
  return Array.from(out);
}

function sanitizeCartItems(input: unknown, max = 150) {
  const arr = Array.isArray(input) ? input : [];
  const out: any[] = [];

  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    out.push(raw);
    if (out.length >= max) break;
  }

  return out;
}

function normalizeUser(raw: any): ServerAuthUser | null {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id: Math.trunc(id),
    documentId: typeof raw.documentId === "string" ? raw.documentId : null,
    firstName: typeof raw.firstName === "string" ? raw.firstName : null,
    lastName: typeof raw.lastName === "string" ? raw.lastName : null,
    name: typeof raw.name === "string" ? raw.name : null,
    username: typeof raw.username === "string" ? raw.username : null,
    email: typeof raw.email === "string" ? raw.email : null,
    dni: typeof raw.dni === "string" ? raw.dni : null,
    isStoreAdmin: Boolean(raw.isStoreAdmin),
    claimedCoupons: sanitizeClaimedCoupons(raw.claimedCoupons),
    cartItems: sanitizeCartItems(raw.cartItems),
  };
}

export function getStrapiBase() {
  return normBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ""
  );
}

export function getServerUserJwt() {
  return cookies().get("strapi_jwt")?.value ?? null;
}

export const getServerAuthUser = cache(async function getServerAuthUser() {
  const jwt = getServerUserJwt();
  if (!jwt) return null;

  const STRAPI = getStrapiBase();
  if (!STRAPI) return null;

  const timeoutMs = 1200;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${STRAPI}/api/users/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => null);

    if (!res || !res.ok) return null;

    const payload = await res.json().catch(() => null);
    return normalizeUser(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
});

export async function requireServerAuthUser(opts?: {
  unauthenticatedRedirect?: string;
  storeAdminRedirect?: string;
}) {
  const user = await getServerAuthUser();
  if (!user) {
    redirect(opts?.unauthenticatedRedirect ?? "/");
  }
  if (user.isStoreAdmin) {
    redirect(opts?.storeAdminRedirect ?? "/admin/pedidos");
  }
  return user;
}
