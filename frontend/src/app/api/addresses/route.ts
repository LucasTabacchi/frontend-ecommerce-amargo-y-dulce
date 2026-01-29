import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function getStrapiUrl(path: string) {
  const base = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ""
  );
  if (!base)
    throw new Error("Falta STRAPI_URL en .env (ej: http://localhost:1337)");
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

// ✅ Normaliza para que el front use siempre documentId como "id"
function normalizeAddress(x: any) {
  if (!x || typeof x !== "object") return x;
  const documentId = x?.documentId ?? x?.attributes?.documentId ?? null;
  const numericId = x?.id ?? x?.attributes?.id ?? null;

  return {
    ...x,
    id: documentId ?? numericId, // ✅ preferimos documentId (v5)
    documentId: documentId ?? null,
    numericId: typeof numericId === "number" ? numericId : Number(numericId) || null,
  };
}

/**
 * GET /api/addresses
 * Lista direcciones del usuario logueado
 */
export async function GET() {
  try {
    const res = await fetch(
      getStrapiUrl(
        "/addresses?pagination[pageSize]=100&sort=isDefault:desc,createdAt:desc"
      ),
      {
        headers: {
          ...authHeaders(),
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: pickStrapiErrorMessage(data), details: data },
        { status: res.status }
      );
    }

    // Strapi v5 devuelve { data: [...] }
    const list = Array.isArray(data?.data) ? data.data : [];
    const normalized = list.map(normalizeAddress);

    return NextResponse.json({ data: normalized }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error cargando direcciones" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/addresses
 * Crea dirección del usuario logueado
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const res = await fetch(getStrapiUrl("/addresses"), {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          label: body.label ?? null,
          fullName: body.fullName ?? null,
          phone: body.phone ?? null,
          street: body.street ?? null,
          number: body.number ?? null,
          floor: body.floor ?? null,
          apartment: body.apartment ?? null,
          city: body.city ?? null,
          province: body.province ?? null,
          zip: body.zip ?? null,
          notes: body.notes ?? null,
          isDefault: Boolean(body.isDefault),
          // ⚠️ NO mandamos user acá: lo fuerza Strapi (controller) o lo setea tu backend
        },
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: pickStrapiErrorMessage(data), details: data },
        { status: res.status }
      );
    }

    // ✅ devolvemos la dirección normalizada (id = documentId)
    const created = data?.data ? normalizeAddress(data.data) : null;

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error creando dirección" },
      { status: 500 }
    );
  }
}
