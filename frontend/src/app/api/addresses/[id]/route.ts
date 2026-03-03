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

function getStrapiUrl(path: string) {
  const base = normalizeStrapiBase(process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "");
  if (!base) throw new Error("Falta STRAPI_URL en .env (ej: http://localhost:1337)");
  return `${base}/api${path.startsWith("/") ? path : `/${path}`}`;
}

function pickStrapiErrorMessage(payload: any) {
  return (
    payload?.error?.message ||
    payload?.message ||
    payload?.error ||
    (typeof payload === "string" ? payload : null) ||
    "Strapi error"
  );
}

function authHeaders() {
  const jwt = cookies().get("strapi_jwt")?.value;
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

function readUserJwtFromCookies() {
  return cookies().get("strapi_jwt")?.value || null;
}

function isStoreAdmin(user: any) {
  return (
    user?.isStoreAdmin === true ||
    user?.isStoreAdmin === 1 ||
    user?.isStoreAdmin === "true"
  );
}

async function ensureNotStoreAdmin(base: string, jwt: string | null) {
  if (!base) return { ok: true as const };
  if (!jwt) return { ok: true as const };

  const meRes = await fetch(`${base}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  const meJson = await meRes.json().catch(() => null);

  if (meRes.ok && isStoreAdmin(meJson)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Las cuentas tienda no pueden gestionar direcciones." },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const };
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try {
    const base = normalizeStrapiBase(process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "");
    const guard = await ensureNotStoreAdmin(base, readUserJwtFromCookies());
    if (!guard.ok) return guard.response;

    const id = ctx.params.id;
    const body = await req.json().catch(() => ({}));

    const res = await fetch(getStrapiUrl(`/addresses/${encodeURIComponent(id)}`), {
      method: "PUT",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
        Accept: "application/json",
      } as HeadersInit,
      body: JSON.stringify({ data: { ...body } }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: pickStrapiErrorMessage(data), details: data },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true, data: data?.data ?? null }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error actualizando dirección" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const base = normalizeStrapiBase(process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "");
    const guard = await ensureNotStoreAdmin(base, readUserJwtFromCookies());
    if (!guard.ok) return guard.response;

    const id = ctx.params.id;

    const res = await fetch(getStrapiUrl(`/addresses/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: {
        ...authHeaders(),
        Accept: "application/json",
      } as HeadersInit,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: pickStrapiErrorMessage(data), details: data },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error eliminando dirección" },
      { status: 500 }
    );
  }
}
