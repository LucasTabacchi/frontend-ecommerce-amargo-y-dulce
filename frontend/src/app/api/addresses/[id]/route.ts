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

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try {
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
