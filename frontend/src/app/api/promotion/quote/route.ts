import { NextResponse } from "next/server";
import { fetcher } from "@/lib/fetcher";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  const coupon = String(body?.coupon ?? "").trim();
  const shipping = Number(body?.shipping ?? 0) || 0;

  try {
    // Llama a Strapi (si tu fetcher tiene auth:true, usa STRAPI_API_TOKEN server-side)
    const res = await fetcher("/api/promotions/quote", {
      method: "POST",
      auth: true,
      body: { items, coupon, shipping },
    });

    return NextResponse.json(res, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { subtotal: 0, discountTotal: 0, total: 0, appliedPromotions: [] },
      { status: 200 }
    );
  }
}
