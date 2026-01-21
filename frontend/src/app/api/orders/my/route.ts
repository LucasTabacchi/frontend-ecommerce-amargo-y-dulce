import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function pickIdForOps(row: any) {
  // Strapi v5: documentId; v4: id
  return row?.documentId ?? row?.id ?? row?.attributes?.documentId ?? row?.attributes?.id ?? null;
}

function pickField(row: any, key: string) {
  return row?.[key] ?? row?.attributes?.[key] ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337"
  );

  const token = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Falta STRAPI_API_TOKEN / STRAPI_TOKEN" },
      { status: 500 }
    );
  }

  const sp = new URLSearchParams();
  sp.set("filters[email][$eq]", email);
  sp.set("pagination[pageSize]", "50");
  sp.set("sort[0]", "createdAt:desc");
  sp.set("populate", "*"); // items/shippingAddress son json; populate no molesta

  const url = `${strapiBase}/api/orders?${sp.toString()}`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const json = await r.json().catch(() => null);

  if (!r.ok) {
    return NextResponse.json(
      { error: "Strapi error", status: r.status, details: json },
      { status: r.status }
    );
  }

  const data = Array.isArray(json?.data) ? json.data : [];
  const orders = data.map((row: any) => ({
    id: pickIdForOps(row),
    orderNumber: pickField(row, "orderNumber"),
    orderStatus: pickField(row, "orderStatus"),
    total: pickField(row, "total"),
    createdAt: pickField(row, "createdAt"),
    shippingAddress: pickField(row, "shippingAddress"),
    items: pickField(row, "items"),
  }));

  return NextResponse.json({ orders }, { status: 200 });
}
