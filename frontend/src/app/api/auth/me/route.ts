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
  return NextResponse.json({ user }, { status: 200 });
}

// ✅ Actualizar datos personales (dni / firstName / lastName / name)
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

  if (!hasDni && !hasFirstName && !hasLastName && !hasName) {
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

  const payload: Record<string, string | null> = {};
  if (hasDni) payload.dni = dniToSave ?? null;
  if (hasFirstName) payload.firstName = firstNameToSave ?? null;
  if (hasLastName) payload.lastName = lastNameToSave ?? null;

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
  return NextResponse.json({ user: updJson }, { status: 200 });
}
