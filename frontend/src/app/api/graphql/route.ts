// src/app/api/graphql/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  // por si STRAPI_URL viene con /api, lo quitamos (GraphQL suele ser /graphql)
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function extractCookieJWT(cookieHeader: string) {
  // Si tu cookie se llama distinto (por ej "strapi_jwt"), cambiá acá
  const token = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("jwt="))
    ?.slice("jwt=".length);

  return token || null;
}

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await safeJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: { message: "Invalid JSON body. Expected { query, variables? }" } },
      { status: 400 }
    );
  }

  const base = normalizeStrapiBase(process.env.STRAPI_URL || "");
  const endpoint = process.env.STRAPI_GRAPHQL_ENDPOINT || "/graphql";
  const url = `${base}${endpoint}`;

  const cookie = req.headers.get("cookie") || "";
  const jwt = extractCookieJWT(cookie);

  const headers: Record<string, string> = {
    // 👇 importante: en minúscula (algunos setups/edge/cors son quisquillosos)
    "content-type": "application/json",
  };

  // 1) Prioridad: JWT del usuario (para permisos Authenticated)
  if (jwt) headers.authorization = `Bearer ${jwt}`;

  // 2) Alternativa: token server-to-server (opcional)
  if (!jwt && process.env.STRAPI_API_TOKEN) {
    headers.authorization = `Bearer ${process.env.STRAPI_API_TOKEN}`;
  }

  // Si tu Strapi usa cookies para auth (no JWT header), reenviamos cookies
  // (no rompe nada si no lo usa)
  if (cookie) headers.cookie = cookie;

  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: "Failed to reach Strapi GraphQL", details: String(err?.message || err) } },
      { status: 502 }
    );
  }

  // Strapi siempre responde JSON en GraphQL, pero igual lo hacemos safe
  let data: any = null;
  try {
    data = await r.json();
  } catch {
    const text = await r.text().catch(() => "");
    return NextResponse.json(
      { error: { message: "Non-JSON response from Strapi", status: r.status, body: text } },
      { status: 502 }
    );
  }

  return NextResponse.json(data, { status: r.status });
}

// (Opcional) si querés permitir GET para debug rápido:
// /api/graphql?query=...&variables=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  const variablesRaw = searchParams.get("variables");

  if (!query) {
    return NextResponse.json(
      { error: { message: "Missing query param. Use ?query=...&variables=..." } },
      { status: 400 }
    );
  }

  let variables: any = undefined;
  if (variablesRaw) {
    try {
      variables = JSON.parse(variablesRaw);
    } catch {
      return NextResponse.json(
        { error: { message: "Invalid variables JSON in query string" } },
        { status: 400 }
      );
    }
  }

  // Reutilizamos POST internamente
  const fakeReq = new Request(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({ query, variables }),
  });

  return POST(fakeReq);
}
