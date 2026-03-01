// src/app/api/promotions/quote/route.ts
import { NextResponse } from "next/server";
import { fetcher } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QuoteBody = {
  items?: Array<{ id?: number | null; documentId?: string | null; qty: number }>;
  coupon?: string | null;
  shipping?: number;
  [k: string]: any;
};

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
    const itemsRaw = Array.isArray(body?.items) ? body!.items : [];
    const items = itemsRaw
      .map((it) => {
        const id = Number(it?.id);
        const documentId = String(it?.documentId ?? "").trim();
        const qty = Math.max(1, Math.floor(Number(it?.qty ?? 1)));
        return {
          id: Number.isFinite(id) && id > 0 ? id : null,
          documentId: documentId || null,
          qty,
        };
      })
      .filter((it) => (it.id != null || !!it.documentId) && Number.isFinite(it.qty) && it.qty > 0);

    const payload = {
      ...body,
      items,
      coupon: String(body?.coupon ?? "").trim() || null,
      shipping: Number.isFinite(Number(body?.shipping)) ? Number(body?.shipping) : 0,
    };

    // Proxy al endpoint real de Strapi
    const data = await fetcher<any>("/promotions/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
