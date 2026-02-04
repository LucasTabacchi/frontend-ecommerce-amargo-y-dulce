// src/app/api/auth/google/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normBase(url: string) {
  return String(url || "")
    .trim()
    .replace(/\/$/, "");
}

function isHttps(req: Request) {
  const xf = req.headers.get("x-forwarded-proto");
  if (xf) return xf.toLowerCase().includes("https");
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

function readCookie(req: Request, name: string) {
  const h = req.headers.get("cookie") || "";
  const m = h.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

function safeInternalPath(p: string | null | undefined) {
  const v = String(p || "").trim();
  return v.startsWith("/") ? v : "/";
}

async function exchangeAccessTokenForJwt(strapiBase: string, access_token: string) {
  const url = `${strapiBase}/api/auth/google/callback?access_token=${encodeURIComponent(
    access_token
  )}`;

  const r = await fetch(url, { cache: "no-store" });
  const payload = await r.json().catch(() => null);

  if (!r.ok) {
    return { ok: false as const, status: r.status, payload };
  }

  const jwt = payload?.jwt;
  const user = payload?.user;

  if (!jwt || typeof jwt !== "string") {
    return { ok: false as const, status: 502, payload };
  }

  return { ok: true as const, status: 200, jwt, user };
}

/**
 * START + CALLBACK router
 *
 * START:
 *   GET /api/auth/google?start=1&next=/mi-perfil
 *   -> set cookie auth_return_to
 *   -> redirect to STRAPI /api/connect/google
 *
 * CALLBACK:
 *   GET /api/auth/google?access_token=...
 *   -> exchange token in Strapi
 *   -> set strapi_jwt cookie
 *   -> redirect back to auth_return_to (or /)
 */
export async function GET(req: Request) {
  const u = new URL(req.url);

  const STRAPI = normBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ""
  );

  // Si falta config, volvemos al home con error (para que el usuario no quede colgado)
  if (!STRAPI) {
    const back = new URL("/", u.origin);
    back.searchParams.set("auth_error", "missing_strapi_url");
    return NextResponse.redirect(back, { status: 302 });
  }

  // ===== START =====
  if (u.searchParams.get("start") === "1") {
    const next = safeInternalPath(u.searchParams.get("next") || "/");

    // Strapi v5: el redirect final al front se define en el provider del Admin.
    const target = `${STRAPI}/api/connect/google`;

    const res = NextResponse.redirect(target, { status: 302 });
    res.headers.set("Cache-Control", "no-store");

    res.cookies.set("auth_return_to", next, {
      httpOnly: true,
      secure: isHttps(req),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutos
    });

    return res;
  }

  // ===== CALLBACK =====
  const access_token = u.searchParams.get("access_token");
  if (!access_token) {
    const back = new URL("/", u.origin);
    back.searchParams.set("auth_error", "missing_access_token");
    return NextResponse.redirect(back, { status: 302 });
  }

  const ex = await exchangeAccessTokenForJwt(STRAPI, access_token);

  const returnTo = safeInternalPath(readCookie(req, "auth_return_to") || "/");
  const back = new URL(returnTo, u.origin);

  if (!ex.ok) {
    back.searchParams.set("auth_error", `strapi_${ex.status}`);
    return NextResponse.redirect(back, { status: 302 });
  }

  const res = NextResponse.redirect(back, { status: 302 });
  res.headers.set("Cache-Control", "no-store");

  // cookie principal de sesión
  res.cookies.set("strapi_jwt", ex.jwt, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  // limpiamos returnTo
  res.cookies.set("auth_return_to", "", {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}

/**
 * Compatibilidad con tu flujo anterior (POST con access_token).
 * POST /api/auth/google  { access_token }
 * -> set cookie strapi_jwt
 * -> devuelve { user }
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const access_token = body?.access_token;

  if (!access_token || typeof access_token !== "string") {
    return NextResponse.json({ error: "Missing access_token" }, { status: 400 });
  }

  const STRAPI = normBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ""
  );
  if (!STRAPI) {
    return NextResponse.json({ error: "Missing STRAPI_URL" }, { status: 500 });
  }

  const ex = await exchangeAccessTokenForJwt(STRAPI, access_token);

  if (!ex.ok) {
    return NextResponse.json(
      { error: "Strapi auth failed", details: ex.payload },
      { status: ex.status }
    );
  }

  const res = NextResponse.json({ user: ex.user });
  res.cookies.set("strapi_jwt", ex.jwt, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
