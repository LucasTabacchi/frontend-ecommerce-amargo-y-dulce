import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

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

async function fetchWithTimeout(input: string, init: RequestInit, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const base = normalizeStrapiBase(
      process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ""
    );
    if (!base) {
      return NextResponse.json({ ok: false, error: "Falta STRAPI_URL" }, { status: 500 });
    }

    // Si el usuario está logueado como tienda, bloqueamos creación de quejas.
    const jwt = readUserJwtFromCookies();
    if (jwt) {
      const meRes = await fetchWithTimeout(`${base}/api/users/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const meJson = await meRes.json().catch(() => null);

      if (meRes.ok && isStoreAdmin(meJson)) {
        return NextResponse.json(
          { ok: false, error: "Las cuentas tienda no pueden enviar reclamos." },
          { status: 403 }
        );
      }
    }

    const res = await fetchWithTimeout(`${base}/api/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 👇 NO mandamos Authorization para que aplique "Public" permissions
      },
      body: JSON.stringify({ data: body }),
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await res.json().catch(() => null)
        : await res.text().catch(() => null);

      console.error("STRAPI /complaints ERROR", { status: res.status, payload });

      return NextResponse.json(
        { ok: false, status: res.status, details: payload },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("NEXT /api/complaints ERROR", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
