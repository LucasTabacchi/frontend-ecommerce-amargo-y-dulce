// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

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

// ✅ Actualizar datos personales (ej: dni)
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

  const dniRaw = String(body?.dni ?? "").trim();
  if (!dniRaw) {
    return NextResponse.json({ error: "DNI requerido" }, { status: 400 });
  }
  if (!/^\d{7,8}$/.test(dniRaw)) {
    return NextResponse.json(
      { error: "DNI inválido (7 u 8 dígitos)" },
      { status: 400 }
    );
  }

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

  // 2) Actualizar usuario en Strapi (Users & Permissions)
  const updRes = await fetch(`${STRAPI}/api/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dni: dniRaw }),
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
