import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { sanitizeClaimedCouponValues } from "@/lib/coupon-claims";
import {
  GOOGLE_PROFILE_COOKIE,
  decodeGoogleProfileName,
  mergeGoogleProfileName,
} from "@/lib/auth/google-profile-name";

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
    claimedCoupons: sanitizeClaimedCouponValues(raw.claimedCoupons),
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

function getServerAuthTimeoutMs() {
  const parsed = Number(process.env.SERVER_AUTH_TIMEOUT_MS);
  if (Number.isFinite(parsed) && parsed >= 1000) {
    return Math.floor(parsed);
  }
  return 5000;
}

export const getServerAuthUser = cache(async function getServerAuthUser() {
  const jwt = getServerUserJwt();
  if (!jwt) return null;

  const STRAPI = getStrapiBase();
  if (!STRAPI) return null;

  const timeoutMs = getServerAuthTimeoutMs();
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
    const user = normalizeUser(payload);
    const googleProfile = decodeGoogleProfileName(cookies().get(GOOGLE_PROFILE_COOKIE)?.value);
    return mergeGoogleProfileName(user, googleProfile);
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
