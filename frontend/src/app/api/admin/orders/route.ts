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

async function fetchJson(url: string, init: RequestInit) {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const json = await r.json().catch(() => null);
  return { r, json };
}

function pickField(row: any, key: string) {
  return row?.[key] ?? row?.attributes?.[key] ?? null;
}

function pickIdForOps(row: any) {
  return (
    row?.documentId ??
    row?.attributes?.documentId ??
    row?.id ??
    row?.attributes?.id ??
    null
  );
}

export async function GET(req: Request) {
  const jwt = readUserJwtFromCookies();
  if (!jwt) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );

  const meRes = await fetchJson(`${strapiBase}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!meRes.r.ok || !meRes.json) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isStoreAdmin(meRes.json)) {
    return NextResponse.json({ error: "Forbidden: requiere isStoreAdmin" }, { status: 403 });
  }

  const serverToken = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN;
  if (!serverToken) {
    return NextResponse.json({ error: "Falta STRAPI_TOKEN/STRAPI_API_TOKEN" }, { status: 500 });
  }

  const url = new URL(`${strapiBase}/api/orders`);
  const sp = url.searchParams;
  sp.set("pagination[pageSize]", "100");
  sp.set("sort[0]", "createdAt:desc");
  sp.set("populate", "*");

  const q = new URL(req.url).searchParams.get("q");
  if (q && q.trim().length >= 2) {
    const qq = q.trim();
    sp.set("filters[$or][0][orderNumber][$containsi]", qq);
    sp.set("filters[$or][1][email][$containsi]", qq);
    sp.set("filters[$or][2][name][$containsi]", qq);
  }

  const ordersRes = await fetchJson(url.toString(), {
    headers: { Authorization: `Bearer ${serverToken}` },
  });

  if (!ordersRes.r.ok) {
    return NextResponse.json(
      { error: "No se pudieron cargar los pedidos", details: ordersRes.json },
      { status: ordersRes.r.status || 500 }
    );
  }

  const rows = Array.isArray(ordersRes.json?.data) ? ordersRes.json.data : [];

  const orders = rows.map((row: any) => ({
    id: pickIdForOps(row),
    orderNumber: pickField(row, "orderNumber"),
    orderStatus: pickField(row, "orderStatus"),
    total: pickField(row, "total"),
    createdAt: pickField(row, "createdAt"),
    name: pickField(row, "name"),
    email: pickField(row, "email"),
    phone: pickField(row, "phone"),
    shippingAddress: pickField(row, "shippingAddress"),
    items: pickField(row, "items"),
  }));

  return NextResponse.json({ orders }, { status: 200 });
}
