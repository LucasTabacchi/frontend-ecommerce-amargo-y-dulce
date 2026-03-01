// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normBase(url: string) {
  return String(url || "").trim().replace(/\/$/, "");
}

function pickStrapiErr(j: any, fallback: string) {
  return (
    j?.error?.message ||
    j?.message ||
    j?.error ||
    (typeof j === "string" ? j : null) ||
    fallback
  );
}

function hasOwn(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(obj ?? {}, key);
}

function toOptionalString(v: unknown) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normInt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function normNumber(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCouponCode(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

function sanitizeClaimedCoupons(input: unknown, max = 200) {
  const arr = Array.isArray(input) ? input : [];
  const out = new Set<string>();
  for (const raw of arr) {
    const code = normalizeCouponCode(raw);
    if (!code) continue;
    out.add(code);
    if (out.size >= max) break;
  }
  return Array.from(out);
}

function sanitizeCartItems(input: unknown, max = 150) {
  const arr = Array.isArray(input) ? input : [];
  const out: any[] = [];

  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;

    const id = Math.max(0, normInt((raw as any).id, 0));
    const documentId = toOptionalString((raw as any).documentId);
    const slug =
      toOptionalString((raw as any).slug) ||
      documentId ||
      (id > 0 ? String(id) : null);

    if (!slug) continue;

    const title = toOptionalString((raw as any).title) || "Producto";
    const description = toOptionalString((raw as any).description);
    const imageUrl = toOptionalString((raw as any).imageUrl);
    const category = toOptionalString((raw as any).category);

    const price = Math.max(0, normNumber((raw as any).price, 0));

    const offRaw = normNumber((raw as any).off, 0);
    const off = Number.isFinite(offRaw) && offRaw > 0 ? Math.min(100, offRaw) : undefined;

    const qty = Math.max(1, Math.min(99, normInt((raw as any).qty, 1)));

    const stockRaw = (raw as any).stock;
    const stock =
      stockRaw === null || stockRaw === undefined || stockRaw === ""
        ? null
        : Math.max(0, normInt(stockRaw, 0));

    const item: Record<string, any> = {
      id,
      documentId,
      slug,
      title,
      description,
      price,
      imageUrl,
      category,
      qty,
      stock,
    };

    if (typeof off === "number") item.off = off;

    out.push(item);
    if (out.length >= max) break;
  }

  return out;
}

export async function GET() {
  const jwt = cookies().get("strapi_jwt")?.value;
  if (!jwt) return NextResponse.json({ user: null }, { status: 200 });

  const STRAPI = normBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ""
  );
  if (!STRAPI) return NextResponse.json({ user: null }, { status: 200 });

  const r = await fetch(`${STRAPI}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });

  if (!r.ok) return NextResponse.json({ user: null }, { status: 200 });

  const user = await r.json().catch(() => null);
  const normalizedUser =
    user && typeof user === "object"
      ? {
          ...user,
          isStoreAdmin: Boolean((user as any)?.isStoreAdmin),
          claimedCoupons: sanitizeClaimedCoupons((user as any)?.claimedCoupons),
          cartItems: sanitizeCartItems((user as any)?.cartItems),
        }
      : user;

  return NextResponse.json({ user: normalizedUser }, { status: 200 });
}

// ✅ Actualizar datos personales (dni / firstName / lastName / name)
// ✅ También persistimos preferencias de cuenta: claimedCoupons + cartItems
export async function PUT(req: Request) {
  const jwt = cookies().get("strapi_jwt")?.value;
  if (!jwt) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const STRAPI = normBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ""
  );
  if (!STRAPI) {
    return NextResponse.json({ error: "STRAPI_URL no configurado" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (JSON)" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido (JSON)" }, { status: 400 });
  }

  const hasDni = hasOwn(body, "dni");
  const hasFirstName = hasOwn(body, "firstName");
  const hasLastName = hasOwn(body, "lastName");
  const hasName = hasOwn(body, "name");
  const hasClaimedCoupons = hasOwn(body, "claimedCoupons");
  const hasCartItems = hasOwn(body, "cartItems");

  if (!hasDni && !hasFirstName && !hasLastName && !hasName && !hasClaimedCoupons && !hasCartItems) {
    return NextResponse.json(
      { error: "No hay campos para actualizar" },
      { status: 400 }
    );
  }

  let dniToSave: string | null | undefined = undefined;
  if (hasDni) {
    const parsedDni = toOptionalString(body.dni);
    if (parsedDni && !/^\d{7,8}$/.test(parsedDni)) {
      return NextResponse.json(
        { error: "DNI inválido (7 u 8 dígitos)" },
        { status: 400 }
      );
    }
    dniToSave = parsedDni;
  }

  const firstNameToSave = hasFirstName ? toOptionalString(body.firstName) : undefined;
  const lastNameToSave = hasLastName ? toOptionalString(body.lastName) : undefined;
  const nameToSave = hasName ? toOptionalString(body.name) : undefined;
  const claimedCouponsToSave = hasClaimedCoupons
    ? sanitizeClaimedCoupons(body.claimedCoupons)
    : undefined;
  const cartItemsToSave = hasCartItems ? sanitizeCartItems(body.cartItems) : undefined;

  // 1) Traer el usuario actual para obtener su id
  const meRes = await fetch(`${STRAPI}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });

  const meJson = await meRes.json().catch(() => null);
  if (!meRes.ok || !meJson?.id) {
    return NextResponse.json(
      { error: pickStrapiErr(meJson, "No se pudo leer el usuario") },
      { status: meRes.status || 500 }
    );
  }

  const userId = meJson.id;
  const currentFirstName = toOptionalString(meJson?.firstName);
  const currentLastName = toOptionalString(meJson?.lastName);

  const payload: Record<string, any> = {};
  if (hasDni) payload.dni = dniToSave ?? null;
  if (hasFirstName) payload.firstName = firstNameToSave ?? null;
  if (hasLastName) payload.lastName = lastNameToSave ?? null;
  if (hasClaimedCoupons) payload.claimedCoupons = claimedCouponsToSave ?? [];
  if (hasCartItems) payload.cartItems = cartItemsToSave ?? [];

  if (hasName) {
    payload.name = nameToSave ?? null;
  } else if (hasFirstName || hasLastName) {
    const nextFirst = hasFirstName ? firstNameToSave : currentFirstName;
    const nextLast = hasLastName ? lastNameToSave : currentLastName;
    const fullName = [nextFirst, nextLast].filter(Boolean).join(" ").trim();
    payload.name = fullName || null;
  }

  // 2) Actualizar usuario en Strapi (Users & Permissions)
  const updRes = await fetch(`${STRAPI}/api/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const updJson = await updRes.json().catch(() => null);

  if (!updRes.ok) {
    return NextResponse.json(
      { error: pickStrapiErr(updJson, "Forbidden") },
      { status: updRes.status || 500 }
    );
  }

  // devolvemos user actualizado (Strapi devuelve el user)
  const normalizedUser =
    updJson && typeof updJson === "object"
      ? {
          ...updJson,
          isStoreAdmin: Boolean((updJson as any)?.isStoreAdmin),
          claimedCoupons: sanitizeClaimedCoupons((updJson as any)?.claimedCoupons),
          cartItems: sanitizeCartItems((updJson as any)?.cartItems),
        }
      : updJson;

  return NextResponse.json({ user: normalizedUser }, { status: 200 });
}
