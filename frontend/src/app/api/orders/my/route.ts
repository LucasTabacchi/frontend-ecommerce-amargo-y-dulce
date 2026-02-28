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

function pickIdForOps(row: any) {
  // Strapi v5: documentId; v4: id
  return (
    row?.documentId ??
    row?.attributes?.documentId ??
    row?.id ??
    row?.attributes?.id ??
    null
  );
}

function pickField(row: any, key: string) {
  return row?.[key] ?? row?.attributes?.[key] ?? null;
}

async function fetchJson(url: string, init: RequestInit) {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const json = await r.json().catch(() => null);
  return { r, json };
}

export async function GET() {
  const jwt = cookies().get("strapi_jwt")?.value;
  if (!jwt) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337"
  );

  // 1) Usuario logueado
  const meRes = await fetchJson(`${strapiBase}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!meRes.r.ok) {
    return NextResponse.json(
      { error: "JWT inválido o expirado", status: meRes.r.status, details: meRes.json },
      { status: 401 }
    );
  }

  const me = meRes.json;

  // Strapi v5 suele tener documentId en user
  const userDocumentId = String(me?.documentId ?? "").trim();
  const userId = me?.id ?? null; // por compat

  if (!userDocumentId && !userId) {
    return NextResponse.json(
      { error: "No se pudo resolver usuario (sin documentId/id)" },
      { status: 500 }
    );
  }

  // 2) Pedidos del usuario (preferimos relación user)
  // En v5 la relación se filtra por documentId:
  // filters[user][documentId][$eq]=<docId>
  let ordersRes: { r: Response; json: any } | null = null;

  if (userDocumentId) {
    const sp = new URLSearchParams();
    sp.set("pagination[pageSize]", "50");
    sp.set("sort[0]", "createdAt:desc");
    sp.set("populate", "*");
    sp.set("filters[user][documentId][$eq]", userDocumentId);

    ordersRes = await fetchJson(`${strapiBase}/api/orders?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
  } else if (userId) {
    // fallback: algunos setups siguen aceptando id
    const sp = new URLSearchParams();
    sp.set("pagination[pageSize]", "50");
    sp.set("sort[0]", "createdAt:desc");
    sp.set("populate", "*");
    sp.set("filters[user][id][$eq]", String(userId));

    ordersRes = await fetchJson(`${strapiBase}/api/orders?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
  }

  if (!ordersRes || !ordersRes.r.ok) {
    return NextResponse.json(
      { error: "Strapi error", status: ordersRes?.r?.status, details: ordersRes?.json },
      { status: ordersRes?.r?.status || 500 }
    );
  }

  const data = Array.isArray(ordersRes.json?.data) ? ordersRes.json.data : [];

  const orders = data.map((row: any) => ({
    id: pickIdForOps(row),

    orderNumber: pickField(row, "orderNumber"),
    orderStatus: pickField(row, "orderStatus"),
    total: pickField(row, "total"),
    createdAt: pickField(row, "createdAt"),

    // ✅ Envío / Retiro
    shippingMethod: pickField(row, "shippingMethod"),
    shippingCost: pickField(row, "shippingCost"),
    pickupPoint: pickField(row, "pickupPoint"),

    shippingAddress: pickField(row, "shippingAddress"),
    items: pickField(row, "items"),
  }));

  return NextResponse.json({ orders }, { status: 200 });
}
