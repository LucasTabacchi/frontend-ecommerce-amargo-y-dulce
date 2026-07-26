// src/app/api/orders/create/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import {
  buildPendingOrderLookupPath,
  findMatchingPendingOrder,
} from "@/lib/pending-order-reuse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function normalizeBaseUrl(url: string) {
  const u = String(url ?? "").trim();
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function safeUUID() {
  const fn = (crypto as any)?.randomUUID;
  if (typeof fn === "function") return fn.call(crypto);
  return crypto.randomBytes(16).toString("hex");
}

async function strapiJSON(res: Response) {
  return await res.json().catch(() => null);
}

function badRequest(msg: string, fields?: Record<string, any>) {
  return NextResponse.json({ error: msg, fields }, { status: 400 });
}

function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as Partial<T>;
}

function pickMpErrorMessage(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  if (payload?.cause?.[0]?.description) return payload.cause[0].description;
  return fallback;
}

function readShipping(obj: any) {
  const s = obj?.shippingAddress ?? null;
  return {
    street: isNonEmptyString(s?.street) ? s.street.trim() : "",
    number: isNonEmptyString(s?.number) ? s.number.trim() : "",
    city: isNonEmptyString(s?.city) ? s.city.trim() : "",
    province: isNonEmptyString(s?.province) ? s.province.trim() : "",
    postalCode: isNonEmptyString(s?.postalCode) ? s.postalCode.trim() : "",
    notes: isNonEmptyString(s?.notes) ? s.notes.trim() : "",
    text: isNonEmptyString(s?.text) ? s.text.trim() : "",
    source: isNonEmptyString(s?.source) ? s.source.trim() : "",
    addressId: isNonEmptyString(s?.addressId) ? s.addressId.trim() : "",
    label: isNonEmptyString(s?.label) ? s.label.trim() : "",
  };
}

/** ✅ Normaliza DNI: solo dígitos */
function normalizeDni(v: any) {
  const raw = String(v ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  return digits.length ? digits : "";
}

type ShippingMethod = "delivery" | "pickup";

function readShippingMethod(v: any): ShippingMethod {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "pickup") return "pickup";
  return "delivery";
}

function readMoney(v: any, def = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : def;
}

function calcShippingARS(baseTotal: number, method: ShippingMethod) {
  if (method === "pickup") return 0;
  if (baseTotal > 65000) return 0;
  if (baseTotal > 40000) return 4500;
  return 9000;
}

function buildQuoteItems(items: any[]) {
  return (Array.isArray(items) ? items : [])
    .map((it) => {
      const id = Number(it?.productId ?? it?.id);
      const documentId = String(it?.productDocumentId ?? it?.documentId ?? "").trim();
      const slug = String(it?.slug ?? "").trim();
      const qty = Math.max(1, Math.floor(Number(it?.qty ?? it?.quantity ?? 1)));
      return {
        id: Number.isFinite(id) && id > 0 ? id : null,
        documentId: documentId || null,
        slug: slug || null,
        qty,
      };
    })
    .filter((it) => (it.id != null || !!it.documentId || !!it.slug) && Number.isFinite(it.qty) && it.qty > 0);
}

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

/**
 * Lee JWT del usuario desde cookies (probamos varios nombres comunes).
 * Ajustá/limpiá si ya sabés el nombre exacto.
 */
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

async function fetchUserPendingOrders(strapiBase: string, jwt: string, user: any) {
  try {
    const path = buildPendingOrderLookupPath({
      userDocumentId: user?.documentId,
      userId: user?.id,
    });
    const res = await fetch(`${strapiBase}${path}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
    const json = await strapiJSON(res);
    if (!res.ok) return [];
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

async function validateStockForPayment(strapiBase: string, jwt: string, items: any[]) {
  const need = new Map<string, { requested: number; title?: string }>();

  for (const it of Array.isArray(items) ? items : []) {
    const doc = String(it?.productDocumentId ?? it?.documentId ?? "").trim();
    const qty = Number(it?.qty ?? it?.quantity ?? 0);
    if (!doc || !Number.isFinite(qty) || qty <= 0) continue;

    const prev = need.get(doc);
    need.set(doc, {
      requested: (prev?.requested ?? 0) + Math.floor(qty),
      title: String(it?.title ?? prev?.title ?? "Producto"),
    });
  }

  const docIds = Array.from(need.keys());
  if (!docIds.length) return;

  const sp = new URLSearchParams();
  sp.set("pagination[pageSize]", String(Math.min(docIds.length, 100)));
  sp.set("fields[0]", "title");
  sp.set("fields[1]", "stock");
  sp.set("fields[2]", "documentId");
  sp.set("filters[publishedAt][$notNull]", "true");
  docIds.forEach((doc, i) => sp.set(`filters[$or][${i}][documentId][$eq]`, doc));

  const res = await fetch(`${strapiBase}/api/products?${sp.toString()}`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  const json = await strapiJSON(res);

  if (!res.ok) {
    const err: any = new Error("STRAPI_PRODUCTS_FETCH_FAILED");
    err.code = "STRAPI_PRODUCTS_FETCH_FAILED";
    err.status = res.status;
    err.details = json;
    throw err;
  }

  const rows = Array.isArray(json?.data) ? json.data : [];
  const byDoc = new Map<string, any>();
  for (const row of rows) {
    const doc = pickDocumentId(row);
    if (doc) byDoc.set(doc, row);
  }

  const problems: Array<{ productDocumentId: string; title: string; requested: number; available: number }> = [];

  for (const doc of docIds) {
    const requested = need.get(doc)!.requested;
    const row = byDoc.get(doc);

    if (!row) {
      problems.push({
        productDocumentId: doc,
        title: need.get(doc)?.title ?? "Producto",
        requested,
        available: 0,
      });
      continue;
    }

    const stock = pickStock(row);
    if (stock === null) continue;

    if (stock < requested) {
      problems.push({
        productDocumentId: doc,
        title: pickTitle(row),
        requested,
        available: stock,
      });
    }
  }

  if (problems.length) {
    const err: any = new Error("OUT_OF_STOCK");
    err.code = "OUT_OF_STOCK";
    err.problems = problems;
    throw err;
  }
}

async function createMercadoPagoPreference(params: {
  orderId: string;
  orderNumber: string | null;
  mpExternalReference: string;
  data: any;
  accessToken: string;
  siteUrl: string;
}) {
  const { orderId, orderNumber, mpExternalReference, data, accessToken, siteUrl } = params;
  const totalNumber = Math.round(Number(data?.total ?? 0));

  if (!Number.isFinite(totalNumber) || totalNumber <= 0) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Total final inválido para generar preferencia.", total: totalNumber },
        { status: 400 }
      ),
    };
  }

  const preferenceBody = {
    items: [
      {
        title: orderNumber ? `Pedido ${orderNumber}` : "Compra Amargo y Dulce",
        quantity: 1,
        unit_price: totalNumber,
        currency_id: "ARS",
      },
    ],
    external_reference: mpExternalReference,
    back_urls: {
      success: `${siteUrl}/gracias?status=success&orderId=${encodeURIComponent(orderId)}`,
      failure: `${siteUrl}/gracias?status=failure&orderId=${encodeURIComponent(orderId)}`,
      pending: `${siteUrl}/gracias?status=pending&orderId=${encodeURIComponent(orderId)}`,
    },
    auto_return: "approved",
    notification_url: `${siteUrl}/api/mp/webhook`,
    metadata: cleanObject({
      orderId,
      orderNumber: orderNumber ?? undefined,
      mpExternalReference,
      shippingMethod: data?.shippingMethod,
      pickupPoint: data?.pickupPoint ?? undefined,
      total: String(data?.total ?? totalNumber),
      subtotal: String(data?.subtotal ?? 0),
      discountTotal: String(data?.discountTotal ?? 0),
      coupon: data?.coupon ?? undefined,
    }),
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferenceBody),
    cache: "no-store",
  });
  const pref = await strapiJSON(res);

  if (!res.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: pickMpErrorMessage(pref, "MercadoPago rechazó la preferencia"),
          status: res.status,
          details: pref,
        },
        { status: res.status || 500 }
      ),
    };
  }

  return {
    ok: true as const,
    pref,
  };
}

export async function POST(req: Request) {
  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337"
  );

  // ✅ Ahora el checkout crea órdenes SOLO logueado
  const jwt = readUserJwtFromCookies();
  if (!jwt) {
    return NextResponse.json(
      { error: "No autorizado: iniciá sesión para crear una orden." },
      { status: 401 }
    );
  }

  // Cuentas de tienda no pueden comprar.
  const meRes = await fetch(`${strapiBase}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  const meJson = await strapiJSON(meRes);

  if (!meRes.ok || !meJson) {
    return NextResponse.json(
      { error: "No autorizado: sesión inválida." },
      { status: 401 }
    );
  }

  if (isStoreAdmin(meJson)) {
    return NextResponse.json(
      { error: "Las cuentas tienda no pueden crear órdenes de compra." },
      { status: 403 }
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido (se esperaba JSON)" },
      { status: 400 }
    );
  }

  const incomingData =
    body && typeof body === "object" && "data" in body ? body.data : body;

  if (!incomingData || typeof incomingData !== "object") {
    return NextResponse.json(
      { error: "Body inválido: se esperaba un objeto con datos de la orden" },
      { status: 400 }
    );
  }

  const shouldCreatePaymentPreference = incomingData.createPaymentPreference === true;

  // ===================== VALIDACIONES =====================

  const name = isNonEmptyString(incomingData.name) ? incomingData.name.trim() : "";
  const email = isNonEmptyString(incomingData.email)
    ? incomingData.email.trim().toLowerCase()
    : "";
  const phone = isNonEmptyString(incomingData.phone) ? incomingData.phone.trim() : "";

  const dni = normalizeDni(incomingData.dni);

  if (name.length < 2) return badRequest("Nombre inválido", { name });
  if (!email.includes("@")) return badRequest("Email inválido", { email });
  if (phone.length < 6) return badRequest("Teléfono inválido", { phone });

  if (dni && (dni.length < 7 || dni.length > 10)) {
    return badRequest("DNI inválido (7 a 10 dígitos)", { dni });
  }

  const shippingMethod: ShippingMethod = readShippingMethod(incomingData.shippingMethod);
  const pickupPoint = isNonEmptyString(incomingData.pickupPoint)
    ? incomingData.pickupPoint.trim()
    : null;

  const shipping = readShipping(incomingData);

  if (shippingMethod === "delivery") {
    if (shipping.street.length < 2) return badRequest("Falta street", { street: shipping.street });
    if (shipping.number.length < 1) return badRequest("Falta number", { number: shipping.number });
    if (shipping.city.length < 2) return badRequest("Falta city", { city: shipping.city });
    if (shipping.province.length < 2) return badRequest("Falta province", { province: shipping.province });
    if (shipping.postalCode.length < 4) return badRequest("Falta postalCode", { postalCode: shipping.postalCode });
  } else {
    if (!pickupPoint) {
      return badRequest("Falta pickupPoint para retiro en sucursal", { pickupPoint });
    }
  }

  const items = Array.isArray(incomingData.items) ? incomingData.items : [];
  if (items.length === 0) return badRequest("Tu carrito está vacío (items).");

  const quoteItems = buildQuoteItems(items);
  if (!quoteItems.length) {
    return badRequest("Los items no tienen productId/documentId/slug válido.");
  }

  const couponRequested = isNonEmptyString(incomingData.coupon)
    ? incomingData.coupon.trim()
    : "";

  const pendingOrdersPromise = fetchUserPendingOrders(strapiBase, jwt, meJson);
  const stockValidationPromise = shouldCreatePaymentPreference
    ? validateStockForPayment(strapiBase, jwt, items).then(
        () => null,
        (error) => error
      )
    : Promise.resolve(null);

  const quoteRes = await fetch(`${strapiBase}/api/promotions/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      items: quoteItems,
      coupon: couponRequested || null,
      shipping: 0,
    }),
    cache: "no-store",
  });
  const quoteJson = await strapiJSON(quoteRes);

  if (!quoteRes.ok) {
    return NextResponse.json(
      { error: "No se pudo recalcular promociones en servidor.", details: quoteJson },
      { status: 500 }
    );
  }

  const subtotal = readMoney(quoteJson?.subtotal, 0);
  const discountTotal = readMoney(quoteJson?.discountTotal, 0);
  const promoTotal = readMoney(quoteJson?.total, 0);
  if (promoTotal <= 0) {
    return badRequest("Total inválido luego de recalcular promociones.");
  }

  if (shouldCreatePaymentPreference) {
    const stockError = await stockValidationPromise;
    if (stockError) {
      if (stockError?.code === "OUT_OF_STOCK") {
        return NextResponse.json(
          { error: "Sin stock suficiente", code: "OUT_OF_STOCK", problems: stockError.problems ?? [] },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: stockError?.message || "Error validando stock",
          code: stockError?.code,
          details: stockError?.details,
        },
        { status: 500 }
      );
    }
  }

  const shippingCost = calcShippingARS(promoTotal, shippingMethod);
  const finalTotal = Math.max(0, promoTotal + shippingCost);
  const appliedPromotions = Array.isArray(quoteJson?.appliedPromotions)
    ? quoteJson.appliedPromotions
    : [];
  const acceptedCoupon =
    quoteJson?.coupon?.applied === true
      ? String(quoteJson?.coupon?.code || couponRequested || "").trim() || null
      : null;

  // ===================== NORMALIZACIONES =====================

  const mpExternalReference = isNonEmptyString(incomingData.mpExternalReference)
    ? incomingData.mpExternalReference.trim()
    : safeUUID();

  const shippingTextDelivery =
    shipping.text ||
    `${shipping.street} ${shipping.number}, ${shipping.city}, ${shipping.province} (${shipping.postalCode})`;

  // 🔒 data “limpio” (whitelist)
  // OJO: NO mandamos user. Lo setea Strapi desde el JWT.
  const data: any = {
    subtotal: subtotal || 0,
    discountTotal: discountTotal || 0,
    coupon: acceptedCoupon,
    appliedPromotions,

    name,
    email,
    phone,
    dni: dni || null,

    shippingMethod,
    shippingCost,
    pickupPoint,

    total: finalTotal,
    items,

    shippingAddress:
      shippingMethod === "pickup"
        ? {
            source: "pickup",
            addressId: null,
            label: "Retiro en sucursal",
            street: null,
            number: null,
            city: null,
            province: null,
            postalCode: null,
            notes: null,
            text: pickupPoint ? `Retiro en sucursal: ${pickupPoint}` : "Retiro en sucursal",
          }
        : {
            source: shipping.source || (incomingData?.shippingAddress?.addressId ? "saved_address" : "manual"),
            addressId: shipping.addressId || null,
            label: shipping.label || null,

            street: shipping.street,
            number: shipping.number,
            city: shipping.city,
            province: shipping.province,
            postalCode: shipping.postalCode,
            notes: shipping.notes || null,
            text: shippingTextDelivery,
          },

    mpExternalReference,
  };

  const pendingOrders = await pendingOrdersPromise;
  const reusableOrder = findMatchingPendingOrder(pendingOrders, data);

  if (reusableOrder) {
    const documentId = reusableOrder?.documentId ? String(reusableOrder.documentId) : null;
    const numericId = reusableOrder?.id != null ? String(reusableOrder.id) : null;
    const orderNumber = reusableOrder?.orderNumber ?? null;
    const orderId = documentId ?? numericId;
    const mpExternalReferenceForPayment = reusableOrder?.mpExternalReference ?? mpExternalReference;

    if (shouldCreatePaymentPreference) {
      if (!orderId) {
        return NextResponse.json(
          { error: "La orden pendiente no tiene identificador para generar el pago." },
          { status: 500 }
        );
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

      const prefResult = await createMercadoPagoPreference({
        orderId,
        orderNumber,
        mpExternalReference: mpExternalReferenceForPayment,
        data,
        accessToken,
        siteUrl,
      });
      if (!prefResult.ok) return prefResult.response;

      return NextResponse.json({
        orderId,
        orderDocumentId: documentId,
        orderNumericId: numericId,
        orderNumber,
        mpExternalReference: mpExternalReferenceForPayment,
        reusedPendingOrder: true,
        id: prefResult.pref?.id,
        init_point: prefResult.pref?.init_point,
        sandbox_init_point: prefResult.pref?.sandbox_init_point,
      });
    }

    return NextResponse.json({
      orderId,
      orderDocumentId: documentId,
      orderNumericId: numericId,
      orderNumber,
      mpExternalReference: mpExternalReferenceForPayment,
      reusedPendingOrder: true,
    });
  }

  const createPayload = { data };

  // ✅ Crear la orden en Strapi COMO USUARIO (Bearer JWT)
  const createRes = await fetch(`${strapiBase}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(createPayload),
    cache: "no-store",
  });

  const created = await strapiJSON(createRes);

  if (!createRes.ok) {
    return NextResponse.json(
      { error: "Strapi error (create)", details: created },
      { status: createRes.status || 500 }
    );
  }

  // Strapi v5 suele devolver documentId + id
  const documentId = created?.data?.documentId ? String(created.data.documentId) : null;
  const numericId = created?.data?.id != null ? String(created.data.id) : null;
  const orderNumber = created?.data?.orderNumber ?? null; // si lifecycle ya lo seteo
  const orderId = documentId ?? numericId;

  if (shouldCreatePaymentPreference) {
    if (!orderId) {
      return NextResponse.json(
        { error: "La orden creada no tiene identificador para generar el pago." },
        { status: 500 }
      );
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

    const prefResult = await createMercadoPagoPreference({
      orderId,
      orderNumber,
      mpExternalReference,
      data,
      accessToken,
      siteUrl,
    });
    if (!prefResult.ok) return prefResult.response;

    return NextResponse.json({
      orderId,
      orderDocumentId: documentId,
      orderNumericId: numericId,
      orderNumber,
      mpExternalReference,
      id: prefResult.pref?.id,
      init_point: prefResult.pref?.init_point,
      sandbox_init_point: prefResult.pref?.sandbox_init_point,
    });
  }

  return NextResponse.json({
    orderId,
    orderDocumentId: documentId,
    orderNumericId: numericId,
    orderNumber,
    mpExternalReference,
  });
}
