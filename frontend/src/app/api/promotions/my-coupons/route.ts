import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function pickApiErrorMessage(payload: any, fallback: string) {
  const msg =
    (typeof payload?.error === "string" && payload.error) ||
    (typeof payload?.error?.message === "string" && payload.error.message) ||
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.details?.error === "string" && payload.details.error) ||
    (typeof payload?.details?.message === "string" && payload.details.message) ||
    null;
  return msg && msg.trim() ? msg.trim() : fallback;
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

export async function GET() {
  const jwt = readUserJwtFromCookies();
  if (!jwt) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );

  const r = await fetch(`${strapiBase}/api/promotions/my-coupons`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  const json = await r.json().catch(() => null);

  if (!r.ok) {
    return NextResponse.json(
      {
        error: pickApiErrorMessage(json, "No se pudieron cargar tus cupones."),
        details: json,
      },
      { status: r.status || 500 }
    );
  }

  return NextResponse.json(json, { status: 200 });
}
