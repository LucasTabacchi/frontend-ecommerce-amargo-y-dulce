// src/app/api/promotions/quote/route.ts
import { NextResponse } from "next/server";
import { fetcher } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QuoteBody = {
  items?: Array<{ id: number; qty: number }>;
  coupon?: string | null;
  shipping?: number;
  [k: string]: any;
};

function toNum(v: any, def = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : def;
}

function getOffFromProduct(p: any): number {
  // Strapi v4: { id, attributes: { off } }
  // Strapi v5 (a veces): { id, off } o { id, attributes: { off } }
  const off =
    p?.off ??
    p?.attributes?.off ??
    p?.data?.off ??
    p?.data?.attributes?.off ??
    0;

  return Math.max(0, toNum(off, 0));
}

async function hasDiscountedItems(productIds: number[]) {
  if (!productIds.length) return false;

  // Armamos query: /products?filters[id][$in]=1&filters[id][$in]=2&fields[0]=off
  const qs = new URLSearchParams();
  for (const id of productIds) qs.append("filters[id][$in]", String(id));

  // pedimos solo el campo off (y opcionalmente title para debug)
  qs.append("fields[0]", "off");
  qs.append("pagination[pageSize]", String(Math.min(100, productIds.length)));

  // Tu fetcher ya sabe pegarle a Strapi con base url
  // OJO: endpoint "products" (ajustá si tu colección se llama distinto)
  const res = await fetcher<any>(`/products?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

  // si cualquiera tiene off > 0 => hay descuento
  return list.some((p: any) => getOffFromProduct(p) > 0);
}

export async function POST(req: Request) {
  let body: QuoteBody | null = null;
  try {
    body = (await req.json()) as QuoteBody;
  } catch {
    return NextResponse.json(
      { error: "Body inválido (se esperaba JSON)" },
      { status: 400 }
    );
  }

  try {
    const items = Array.isArray(body?.items) ? body!.items : [];
    const coupon = String(body?.coupon ?? "").trim();

    // Si hay cupón, verificamos si hay productos con descuento (off > 0)
    if (coupon && items.length) {
      const ids = items
        .map((it) => Number(it?.id))
        .filter((n) => Number.isFinite(n) && n > 0);

      if (ids.length) {
        const discounted = await hasDiscountedItems(ids);

        if (discounted) {
          // ✅ Regla: cupón NO combinable con productos con descuento
          body = { ...body, coupon: null };

          // opcional: marca para debug/UI si querés
          // (no rompe nada si el front ignora este campo)
          (body as any).__couponBlocked = "DISCOUNTED_ITEMS";
        }
      }
    }

    // Proxy al endpoint real de Strapi
    const data = await fetcher<any>("/promotions/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error calculando quote" },
      { status: 500 }
    );
  }
}
