import { NextResponse } from "next/server";
import { fetcher } from "@/lib/fetcher";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function readUserJwtFromCookies() {
  const jar = cookies();
  return (
    jar.get("strapi_jwt")?.value ||
    jar.get("jwt")?.value ||
    jar.get("token")?.value ||
    jar.get("access_token")?.value ||
    null
  );
}

function isStoreAdmin(user: any) {
  return (
    user?.isStoreAdmin === true ||
    user?.isStoreAdmin === 1 ||
    user?.isStoreAdmin === "true"
  );
}

export async function GET() {
  const jwt = readUserJwtFromCookies();
  if (jwt) {
    const strapiBase = normalizeStrapiBase(
      process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
    );

    const meRes = await fetch(`${strapiBase}/api/users/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
    const meJson = await meRes.json().catch(() => null);
    if (meRes.ok && isStoreAdmin(meJson)) {
      return NextResponse.json(
        { error: "Las cuentas tienda no pueden acceder a cupones." },
        { status: 403 }
      );
    }
  }

  try {
    const data = await fetcher<any>("/promotions/available", {
      method: "GET",
      cache: "no-store",
    });
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "No se pudieron cargar los cupones." },
      { status: 500 }
    );
  }
}
