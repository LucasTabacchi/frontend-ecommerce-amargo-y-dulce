import { NextResponse } from "next/server";
import { fetcher } from "@/lib/fetcher";

export const dynamic = "force-dynamic";

type MPItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: "ARS";
};

function normalizeBaseUrl(url: string) {
  const u = String(url ?? "").trim();
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function pickMpErrorMessage(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  if (payload?.cause?.[0]?.description) return payload.cause[0].description;
  return fallback;
}

// Evita mandar undefined/null/"" en metadata
function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
}

/* ===================== STOCK VALIDATION (BEFORE PAY) ===================== */

function pickAttr(row: any) {
  return row?.attributes ?? row ?? {};
}
function pickDocumentId(row: any): string | null {
  const attr = pickAttr(row);
  const v =
    row?.documentId ??
    row?.attributes?.documentId ??
    row?.attributes?.document_id ??
    attr?.documentId ??
    attr?.document_id ??
    null;

  const s = v != null ? String(v).trim() : "";
  return s ? s : null;
}
function pickTitle(row: any): string {
  const attr = pickAttr(row);
  return String(attr?.title ?? row?.title ?? "Producto");
}
function pickStock(row: any): number | null {
  const attr = pickAttr(row);
  const raw = attr?.stock ?? row?.stock ?? null;
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function validateStockOrThrow(items: any[]) {
  const need = new Map<string, { requested: number; title?: string }>();

  for (const it of Array.isArray(items) ? items : []) {
    const doc = String(it?.productDocumentId ?? "").trim();
    const qty = Number(it?.qty ?? it?.quantity ?? 0);
    if (!doc || !Number.isFinite(qty) || qty <= 0) continue;

    const prev = need.get(doc);
    need.set(doc, {
      requested: (prev?.requested ?? 0) + qty,
      title: String(it?.title ?? prev?.title ?? "Producto"),
    });
  }

  const docIds = Array.from(need.keys());
  if (!docIds.length) return;

  const sp = new URLSearchParams();
  sp.set("pagination[pageSize]", String(Math.min(docIds.length, 100)));
  sp.set("populate", "*");
  sp.set("filters[publishedAt][$notNull]", "true");

  docIds.forEach((doc, i) => {
    sp.set(`filters[$or][${i}][documentId][$eq]`, doc);
  });

  const list = await fetcher<any>(`/api/products?${sp.toString()}`, { auth: true });
  const rows = Array.isArray(list?.data) ? list.data : [];

  const byDoc = new Map<string, any>();
  for (const r of rows) {
    const doc = pickDocumentId(r);
    if (doc) byDoc.set(doc, r);
  }

  const problems: Array<{ productDocumentId: string; title: string; requested: number; available: number }> = [];

  for (const doc of docIds) {
    const requested = need.get(doc)!.requested;
    const row = byDoc.get(doc);

    if (!row) {
      problems.push({ productDocumentId: doc, title: need.get(doc)?.title ?? "Producto", requested, available: 0 });
      continue;
    }

    const stock = pickStock(row);
    if (stock === null) continue;

    if (stock < requested) {
      problems.push({ productDocumentId: doc, title: pickTitle(row), requested, available: stock });
    }
  }

  if (problems.length) {
    const err: any = new Error("OUT_OF_STOCK");
    err.code = "OUT_OF_STOCK";
    err.problems = problems;
    throw err;
  }
}

/* ===================== ROUTE ===================== */

export async function POST(req: Request) {
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (se esperaba JSON)" }, { status: 400 });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Falta MP_ACCESS_TOKEN en el servidor" }, { status: 500 });
  }

  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const siteUrl = normalizeBaseUrl(rawSiteUrl);

  if (!isHttpUrl(siteUrl)) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL inválida (http/https requerido)", got: rawSiteUrl },
      { status: 500 }
    );
  }

  const {
    orderId,
    orderNumber,
    items,
    mpExternalReference,

    // totals pro
    total,
    subtotal,
    discountTotal,
    coupon,
    appliedPromotions,
  } = body ?? {};

  if (!orderId) {
    return NextResponse.json({ error: "Falta orderId (id real de Strapi)" }, { status: 400 });
  }

  if (!mpExternalReference || typeof mpExternalReference !== "string") {
    return NextResponse.json(
      { error: "Falta mpExternalReference (debe venir desde /api/orders/create)" },
      { status: 400 }
    );
  }

  const totalNumber = Number(total);
  if (!Number.isFinite(totalNumber) || totalNumber <= 0) {
    return NextResponse.json({ error: "Falta total válido (quote.total)" }, { status: 400 });
  }

  // ✅ 1) VALIDAR STOCK ANTES DE PAGAR
  try {
    await validateStockOrThrow(Array.isArray(items) ? items : []);
  } catch (e: any) {
    if (e?.code === "OUT_OF_STOCK") {
      return NextResponse.json(
        { error: "Sin stock suficiente", code: "OUT_OF_STOCK", problems: e.problems ?? [] },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: e?.message || "Error validando stock" }, { status: 500 });
  }

  // Normalizar items (solo sanity check)
  const normalizedItems: MPItem[] = (Array.isArray(items) ? items : [])
    .map((it: any) => {
      const title = String(it?.title ?? "Producto").trim();
      const quantityRaw = Number(it?.qty ?? it?.quantity ?? 1);
      const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.floor(quantityRaw)) : 1;
      const unit_price = Number(it?.unit_price ?? it?.price ?? 0);

      return { title: title || "Producto", quantity, unit_price, currency_id: "ARS" as const };
    })
    .filter((it) => it.title && it.quantity > 0 && Number.isFinite(it.unit_price) && it.unit_price > 0);

  if (normalizedItems.length === 0) {
    return NextResponse.json({ error: "No hay items válidos para crear la preferencia" }, { status: 400 });
  }

  // 🔒 Cobrar EXACTAMENTE el total final
  const chargeItems: MPItem[] = [
    {
      title: orderNumber ? `Pedido ${String(orderNumber)}` : "Compra Amargo y Dulce",
      quantity: 1,
      unit_price: Math.round(totalNumber),
      currency_id: "ARS",
    },
  ];

  const external_reference = mpExternalReference;

  const notification_url = `${siteUrl}/api/mp/webhook`;

  const back_urls = {
    success: `${siteUrl}/gracias?status=success&orderId=${encodeURIComponent(String(orderId))}`,
    failure: `${siteUrl}/gracias?status=failure&orderId=${encodeURIComponent(String(orderId))}`,
    pending: `${siteUrl}/gracias?status=pending&orderId=${encodeURIComponent(String(orderId))}`,
  };

  const promoIds =
    Array.isArray(appliedPromotions)
      ? appliedPromotions.map((p: any) => p?.id).filter((x: any) => Number.isFinite(Number(x))).slice(0, 12)
      : [];

  const preferenceBody = {
    items: chargeItems,
    external_reference,
    back_urls,
    auto_return: "approved",
    notification_url,
    metadata: cleanObject({
      orderId: String(orderId),
      orderNumber: orderNumber ? String(orderNumber) : undefined,
      mpExternalReference: external_reference,
      subtotal: subtotal != null ? String(subtotal) : undefined,
      discountTotal: discountTotal != null ? String(discountTotal) : undefined,
      coupon: typeof coupon === "string" ? coupon : undefined,
      promotionIds: promoIds.length ? promoIds.join(",") : undefined,
    }),
  };

  // ❗ Log mínimo para no inflar el payload
  console.log("[create-preference] orderId:", String(orderId), "total:", Math.round(totalNumber));

  try {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("[create-preference] MP error (short):", {
        status: res.status,
        message: pickMpErrorMessage(data, "MercadoPago rechazó la preferencia"),
      });

      // ❗ devolver poco (evita 455k)
      return NextResponse.json(
        {
          error: pickMpErrorMessage(data, "MercadoPago rechazó la preferencia"),
          status: res.status,
        },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      mpExternalReference: external_reference,
      orderId: String(orderId),
    });
  } catch (e: any) {
    console.error("[create-preference] fetch error:", e?.message || e);
    return NextResponse.json({ error: "Error conectando con MercadoPago" }, { status: 500 });
  }
}
