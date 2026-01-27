// src/app/api/reviews/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/* ===================== helpers ===================== */

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function pickStrapiErrorMessage(details: any) {
  return (
    details?.error?.message ||
    details?.message ||
    details?.error ||
    (typeof details === "string" ? details : null) ||
    "Strapi error"
  );
}

async function fetchWithTimeout(input: string, init: RequestInit, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

function isNumericId(s: string) {
  return /^\d+$/.test(String(s || "").trim());
}

async function resolveProductNumericId(params: {
  strapiBase: string;
  token: string;
  productDocumentId: string;
}) {
  const { strapiBase, token, productDocumentId } = params;

  const sp = new URLSearchParams();
  sp.set("pagination[pageSize]", "1");
  sp.set("filters[documentId][$eq]", productDocumentId);

  const res = await fetchWithTimeout(`${strapiBase}/api/products?${sp.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json().catch(() => null);
  const row = json?.data?.[0];
  const idNum = Number(row?.id);

  return Number.isFinite(idNum) && idNum > 0 ? idNum : null;
}

function mapReviewRow(r: any) {
  const a = r?.attributes ?? r ?? {};
  const rating = Number(a?.rating ?? r?.rating ?? 0);

  // ✅ tu modelo tiene comment (Rich text)
  const comment = String(a?.comment ?? r?.comment ?? "").trim();

  return {
    id: r?.id ?? a?.id,
    rating: Number.isFinite(rating) ? rating : 0,
    title: String(a?.title ?? r?.title ?? "").trim() || undefined,
    // 👉 para el front, siempre devolvemos "text"
    text: comment || undefined,
    name: String(a?.name ?? r?.name ?? "").trim() || undefined,
    createdAt: String(a?.createdAt ?? r?.createdAt ?? "").trim() || undefined,
  };
}

/* ===================== GET ===================== */

export async function GET(req: Request) {
  const url = new URL(req.url);

  const productDocumentId = String(url.searchParams.get("productDocumentId") ?? "").trim();
  const productIdParam = String(url.searchParams.get("productId") ?? "").trim();

  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? 20);
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 20));

  if (!productDocumentId && !productIdParam) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );
  const token = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Falta STRAPI_TOKEN / STRAPI_API_TOKEN" }, { status: 500 });

  // ✅ IMPORTANTE:
  // En Strapi v5, filtrar por relation.documentId NO siempre funciona.
  // Lo más robusto es: resolver product.id numérico y filtrar por filters[product][id].
  let productId: number | null = null;

  try {
    if (productIdParam && isNumericId(productIdParam)) {
      productId = Number(productIdParam);
    } else if (productDocumentId) {
      productId = await resolveProductNumericId({ strapiBase, token, productDocumentId });
    }
  } catch (e) {
    console.error("[api/reviews][GET] resolve product failed:", e);
  }

  if (!productId) {
    // si no pudimos resolver el producto, devolvemos vacío (no error) para UX
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const sp = new URLSearchParams();
  sp.set("sort[0]", "createdAt:desc");
  sp.set("pagination[pageSize]", String(pageSize));
  sp.set("filters[product][id][$eq]", String(productId));

  try {
    const res = await fetchWithTimeout(`${strapiBase}/api/reviews?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[api/reviews][GET] Strapi error:", json);
      return NextResponse.json(
        { error: pickStrapiErrorMessage(json), details: json },
        { status: res.status }
      );
    }

    const rows = Array.isArray(json?.data) ? json.data : [];
    const data = rows.map(mapReviewRow);

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "Timeout hablando con Strapi (¿Render dormido?)"
        : e?.message || "Error";
    console.error("[api/reviews][GET] fatal:", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/* ===================== POST ===================== */

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const rating = Number(body?.rating ?? 0);

  // ✅ tu front manda comment; si viene text por compatibilidad, lo tomamos igual
  const comment = String(body?.comment ?? body?.text ?? "").trim();

  const title = String(body?.title ?? "").trim();
  const name = String(body?.name ?? "").trim();

  const productIdRaw = Number(body?.productId);
  const productDocumentId = String(body?.productDocumentId ?? "").trim();

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating inválido (1 a 5)" }, { status: 400 });
  }
  if (!comment) return NextResponse.json({ error: "Falta comentario" }, { status: 400 });

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );
  const token = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Falta STRAPI_TOKEN / STRAPI_API_TOKEN" }, { status: 500 });

  // 1) Resolver product numeric id (si podemos)
  let productId: number | null =
    Number.isFinite(productIdRaw) && productIdRaw > 0 ? productIdRaw : null;

  try {
    if (!productId && productDocumentId) {
      productId = await resolveProductNumericId({ strapiBase, token, productDocumentId });
    }
  } catch (e) {
    console.error("[api/reviews][POST] resolve product failed:", e);
  }

  if (!productId && !productDocumentId) {
    return NextResponse.json(
      { error: "Falta productId/productDocumentId" },
      { status: 400 }
    );
  }

  // 2) Payload base
  const baseData: any = {
    rating,
    comment,
    ...(title ? { title } : {}),
    ...(name ? { name } : {}),
  };

  // 3) Variantes de relación (según cómo Strapi acepte la relación)
  // Preferimos numérico si lo tenemos; si no, probamos documentId.
  const candidates: any[] = [];

  if (productId) {
    candidates.push({ data: { ...baseData, product: productId } });
    candidates.push({ data: { ...baseData, product: { connect: [productId] } } });
    candidates.push({ data: { ...baseData, product: { connect: [{ id: productId }] } } });
  }

  if (productDocumentId) {
    candidates.push({ data: { ...baseData, product: productDocumentId } });
    candidates.push({ data: { ...baseData, product: { connect: [productDocumentId] } } });
    candidates.push({ data: { ...baseData, product: { connect: [{ documentId: productDocumentId }] } } });
  }

  // dedupe simple por JSON string
  const seen = new Set<string>();
  const candidatePayloads = candidates.filter((p) => {
    const k = JSON.stringify(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let lastError: any = null;

  for (const payload of candidatePayloads) {
    try {
      const res = await fetchWithTimeout(
        `${strapiBase}/api/reviews`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        25000
      );

      const json = await res.json().catch(() => null);

      if (res.ok) {
        return NextResponse.json({ ok: true, created: json?.data ?? true }, { status: 201 });
      }

      lastError = json;
      console.error("[api/reviews][POST] Strapi rejected payload:", payload, json);
    } catch (e: any) {
      lastError = e;
      console.error("[api/reviews][POST] fatal:", e);

      const msg =
        e?.name === "AbortError"
          ? "Timeout hablando con Strapi (¿Render dormido?)"
          : e?.message || "Error";

      if (e?.name === "AbortError") {
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }
  }

  return NextResponse.json(
    { error: pickStrapiErrorMessage(lastError), details: lastError },
    { status: 500 }
  );
}
