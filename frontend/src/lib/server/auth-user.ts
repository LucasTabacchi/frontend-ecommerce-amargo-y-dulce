import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";

function normBase(url: string) {
  let base = String(url || "").trim().replace(/\/$/, "");
  if (base.toLowerCase().endsWith("/api")) {
    base = base.slice(0, -4);
  }
  return base;
}

function normalizeUser(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id: Math.trunc(id),
    firstName: typeof raw.firstName === "string" ? raw.firstName : null,
    lastName: typeof raw.lastName === "string" ? raw.lastName : null,
    name: typeof raw.name === "string" ? raw.name : null,
    username: typeof raw.username === "string" ? raw.username : null,
    email: typeof raw.email === "string" ? raw.email : null,
    isStoreAdmin: Boolean(raw.isStoreAdmin),
  };
}

export const getServerAuthUser = cache(async function getServerAuthUser() {
  const jwt = cookies().get("strapi_jwt")?.value;
  if (!jwt) return null;

  const STRAPI = normBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ""
  );
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
