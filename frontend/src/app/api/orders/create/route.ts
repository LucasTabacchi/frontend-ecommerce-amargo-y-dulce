// src/app/api/orders/create/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function safeUUID() {
  const fn = (crypto as any)?.randomUUID;
  if (typeof fn === "function") return fn.call(crypto);
  return crypto.randomBytes(16).toString("hex");
}

function makeOrderNumber(numericId: string | number) {
  const n = Number(numericId);
  const padded = String(isNaN(n) ? numericId : n).padStart(4, "0");
  return `AMG-${padded}`;
}

async function strapiJSON(res: Response) {
  return await res.json().catch(() => null);
}

function badRequest(msg: string, fields?: Record<string, any>) {
  return NextResponse.json({ error: msg, fields }, { status: 400 });
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

/**
 * Lee /api/users/me con el JWT del usuario (cookie strapi_jwt)
 * y devuelve { id, documentId, email } si está logueado.
 */
async function getLoggedUser(strapiBase: string) {
  const jwt = cookies().get("strapi_jwt")?.value;
  if (!jwt) return null;

  try {
    const r = await fetch(`${strapiBase}/api/users/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });

    if (!r.ok) return null;

    const me = await r.json().catch(() => null);

    const id = me?.id ?? null;
    const documentId = me?.documentId ?? null;
    const email =
      typeof me?.email === "string" ? me.email.trim().toLowerCase() : null;

    if (!id && !documentId) return null;

    return { id, documentId, email };
  } catch {
    return null;
  }
}

/**
 * Construye el payload de Strapi v5 para setear una relación.
 */
function buildUserRelation(logged: { id: any; documentId: any } | null) {
  const doc = String(logged?.documentId ?? "").trim();
  if (doc) {
    return { user: { connect: [doc] } };
  }

  const idNum = Number(logged?.id);
  if (Number.isFinite(idNum) && idNum > 0) {
    return { user: { connect: [String(idNum)] } };
  }

  return {};
}

export async function POST(req: Request) {
  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337"
  );

  const token = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Falta STRAPI_TOKEN / STRAPI_API_TOKEN en .env (Next)" },
      { status: 500 }
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

  // ✅ usuario logueado (si existe)
  const logged = await getLoggedUser(strapiBase);

  // ===================== VALIDACIONES =====================

  const name = isNonEmptyString(incomingData.name) ? incomingData.name.trim() : "";

  // ✅ si está logueado, usamos SIEMPRE el email del usuario
  const email = logged?.email
    ? logged.email
    : isNonEmptyString(incomingData.email)
      ? incomingData.email.trim().toLowerCase()
      : "";

  const phone = isNonEmptyString(incomingData.phone) ? incomingData.phone.trim() : "";

  // ✅ DNI (opcional pero si viene, validamos)
  const dni = normalizeDni(incomingData.dni);

  if (name.length < 2) return badRequest("Nombre inválido", { name });
  if (!email.includes("@")) return badRequest("Email inválido", { email });
  if (phone.length < 6) return badRequest("Teléfono inválido", { phone });

  if (dni && (dni.length < 7 || dni.length > 10)) {
    return badRequest("DNI inválido (7 a 10 dígitos)", { dni });
  }

  // ✅ shipping policy
  const shippingMethod: ShippingMethod = readShippingMethod(incomingData.shippingMethod);
  const shippingCost = readMoney(incomingData.shippingCost, 0);
  const pickupPoint = isNonEmptyString(incomingData.pickupPoint) ? incomingData.pickupPoint.trim() : null;

  if (shippingCost < 0) return badRequest("shippingCost inválido", { shippingCost });

  // Dirección solo si es delivery
  const shipping = readShipping(incomingData);

  if (shippingMethod === "delivery") {
    if (shipping.street.length < 2) return badRequest("Falta street", { street: shipping.street });
    if (shipping.number.length < 1) return badRequest("Falta number", { number: shipping.number });
    if (shipping.city.length < 2) return badRequest("Falta city", { city: shipping.city });
    if (shipping.province.length < 2) return badRequest("Falta province", { province: shipping.province });
    if (shipping.postalCode.length < 4) return badRequest("Falta postalCode", { postalCode: shipping.postalCode });
  } else {
    // pickup
    // si querés exigir pickupPoint:
    if (!pickupPoint) {
      return badRequest("Falta pickupPoint para retiro en sucursal", { pickupPoint });
    }
  }

  const items = Array.isArray(incomingData.items) ? incomingData.items : [];
  if (items.length === 0) return badRequest("Tu carrito está vacío (items).");

  const subtotal = readMoney(incomingData.subtotal, 0);
  const discountTotal = readMoney(incomingData.discountTotal, 0);

  const total = Number(incomingData.total);
  if (!Number.isFinite(total) || total <= 0) {
    return badRequest("Total inválido", { total: incomingData.total });
  }

  // ===================== NORMALIZACIONES =====================

  const mpExternalReference = isNonEmptyString(incomingData.mpExternalReference)
    ? incomingData.mpExternalReference.trim()
    : safeUUID();

  const shippingTextDelivery =
    shipping.text ||
    `${shipping.street} ${shipping.number}, ${shipping.city}, ${shipping.province} (${shipping.postalCode})`;

  // 🔒 data “limpio” (whitelist)
  const baseData: any = {
    subtotal: subtotal || undefined,
    discountTotal: discountTotal || undefined,
    coupon: incomingData.coupon ?? undefined,
    appliedPromotions: incomingData.appliedPromotions ?? undefined,

    name,
    email,
    phone,

    // ✅ DNI snapshot
    dni: dni || null,

    // ✅ shipping fields
    shippingMethod,
    shippingCost,
    pickupPoint,

    total: Math.round(Number(total)),
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

  const relationPart = buildUserRelation(logged);

  // 1) CREATE en Strapi (intento con relación)
  let createPayload = { data: { ...baseData, ...relationPart } };

  console.log("[orders/create] → Strapi CREATE payload:", JSON.stringify(createPayload, null, 2));

  let createRes = await fetch(`${strapiBase}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(createPayload),
    cache: "no-store",
  });

  let created = await strapiJSON(createRes);

  // 🔁 Fallback: si Strapi tira Invalid key user, creamos SIN relación
  if (!createRes.ok && created?.error?.details?.key === "user") {
    console.warn("[orders/create] Strapi rechazó relation user, reintento sin user…");
    createPayload = { data: { ...baseData } };

    createRes = await fetch(`${strapiBase}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(createPayload),
      cache: "no-store",
    });

    created = await strapiJSON(createRes);
  }

  if (!createRes.ok) {
    console.error("[orders/create] Strapi CREATE returned", createRes.status, created);
    return NextResponse.json(
      { error: "Strapi error (create)", details: created },
      { status: createRes.status || 500 }
    );
  }

  const documentId = created?.data?.documentId ? String(created.data.documentId) : null;
  const numericId = created?.data?.id ? String(created.data.id) : null;

  if (!documentId) {
    return NextResponse.json(
      { error: "Strapi no devolvió documentId al crear la orden", strapi: created },
      { status: 500 }
    );
  }

  const orderNumber = numericId ? makeOrderNumber(numericId) : null;

  // 2) UPDATE en Strapi para setear orderNumber
  if (orderNumber) {
    const updatePayload = { data: { orderNumber, mpExternalReference } };
    const updateUrl = `${strapiBase}/api/orders/${encodeURIComponent(documentId)}`;

    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updatePayload),
      cache: "no-store",
    });

    if (!updateRes.ok) {
      const upd = await updateRes.text().catch(() => "");
      console.warn("[orders/create] Strapi UPDATE failed (no bloqueo):", updateRes.status, upd);
    }
  } else {
    console.warn("[orders/create] Strapi no devolvió numericId; no pude calcular orderNumber.");
  }

  return NextResponse.json({
    orderId: documentId,
    orderDocumentId: documentId,
    orderNumericId: numericId,
    orderNumber,
    mpExternalReference,
    strapi: created,
  });
}
