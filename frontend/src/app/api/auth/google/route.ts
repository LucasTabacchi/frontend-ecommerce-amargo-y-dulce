// src/app/api/auth/google/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildGoogleProfileUserPatch,
  GOOGLE_PROFILE_COOKIE,
  encodeGoogleProfileName,
  mergeGoogleProfileName,
  normalizeGoogleProfileName,
  type GoogleProfileName,
} from "@/lib/auth/google-profile-name";

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

async function fetchGoogleProfileName(accessToken: string): Promise<GoogleProfileName | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return normalizeGoogleProfileName(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

async function syncGoogleProfileToStrapiUser(params: {
  strapiBase: string;
  jwt: string;
  user: any;
  googleProfile: GoogleProfileName | null;
}) {
  const { strapiBase, jwt, user, googleProfile } = params;
  const userId = Number(user?.id);
  const payload = buildGoogleProfileUserPatch(user, googleProfile);

  if (!Number.isFinite(userId) || userId <= 0 || !payload) return user;

  try {
    const res = await fetch(`${strapiBase}/api/users/${Math.trunc(userId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const updated = await res.json().catch(() => null);
    if (!res.ok || !updated || typeof updated !== "object") return user;

    return { ...user, ...updated };
  } catch (error) {
    console.error("[api/auth/google] No se pudo sincronizar el perfil de Google:", error);
    return user;
  }
}

function setGoogleProfileCookie(
  res: NextResponse,
  profile: GoogleProfileName | null,
  secure: boolean
) {
  const value = encodeGoogleProfileName(profile);
  if (!value) return;

  res.cookies.set(GOOGLE_PROFILE_COOKIE, value, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/**
 * START + CALLBACK router
 *
 * START:
 *   GET /api/auth/google?start=1&next=/mi-perfil
 *   -> redirige a Strapi /api/connect/google (Grant/session/state)
 *   -> Strapi -> Google -> Strapi callback -> Frontend /connect/google/redirect
 *
 * CALLBACK (flujo alternativo GET con access_token):
 *   GET /api/auth/google?access_token=...
 *   -> exchange token en Strapi
 *   -> set strapi_jwt cookie
 *   -> redirect back to auth_return_to (or /)
 */
export async function GET(req: Request) {
  const u = new URL(req.url);

  const STRAPI = normBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ""
  );

  if (!STRAPI) {
    const back = new URL("/", u.origin);
    back.searchParams.set("auth_error", "missing_strapi_url");
    return NextResponse.redirect(back, { status: 302 });
  }

  // ===== START =====
  // Soporta ambos formatos:
  // - /api/auth/google?start=1
  // - /api/auth/google   (legacy links como /login)
  const hasAccessToken = !!u.searchParams.get("access_token");
  const shouldStart =
    u.searchParams.get("start") === "1" ||
    (!u.searchParams.has("start") && !hasAccessToken);

  if (shouldStart) {
    const next = safeInternalPath(u.searchParams.get("next") || "/");
    const frontendRedirect = new URL("/connect/google/redirect", u.origin);
    frontendRedirect.searchParams.set("next", next);

    // ✅ Flujo recomendado por Strapi:
    // arrancamos en /api/connect/google para que Grant/session/state se manejen del lado Strapi.
    const strapiConnectUrl = new URL(`${STRAPI}/api/connect/google`);
    strapiConnectUrl.searchParams.set("callback", frontendRedirect.toString());

    const res = NextResponse.redirect(strapiConnectUrl.toString(), { status: 302 });
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
  const googleProfile = await fetchGoogleProfileName(access_token);

  const returnTo = safeInternalPath(readCookie(req, "auth_return_to") || "/");
  const back = new URL(returnTo, u.origin);

  if (!ex.ok) {
    back.searchParams.set("auth_error", `strapi_${ex.status}`);
    return NextResponse.redirect(back, { status: 302 });
  }

  await syncGoogleProfileToStrapiUser({
    strapiBase: STRAPI,
    jwt: ex.jwt,
    user: ex.user,
    googleProfile,
  });

  const res = NextResponse.redirect(back, { status: 302 });
  res.headers.set("Cache-Control", "no-store");

  res.cookies.set("strapi_jwt", ex.jwt, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  setGoogleProfileCookie(res, googleProfile, isHttps(req));

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

  // Evita doble intercambio de access_token si la sesión ya está activa.
  const existingJwt = cookies().get("strapi_jwt")?.value || null;
  const googleProfile = await fetchGoogleProfileName(access_token);
  if (existingJwt) {
    const meRes = await fetch(`${STRAPI}/api/users/me`, {
      headers: { Authorization: `Bearer ${existingJwt}` },
      cache: "no-store",
    });
    const meJson = await meRes.json().catch(() => null);
    if (meRes.ok && meJson) {
      const syncedUser = await syncGoogleProfileToStrapiUser({
        strapiBase: STRAPI,
        jwt: existingJwt,
        user: meJson,
        googleProfile,
      });
      const res = NextResponse.json(
        { user: mergeGoogleProfileName(syncedUser, googleProfile), reusedSession: true },
        { status: 200 }
      );
      setGoogleProfileCookie(res, googleProfile, isHttps(req));
      return res;
    }
  }

  const ex = await exchangeAccessTokenForJwt(STRAPI, access_token);

  if (!ex.ok) {
    return NextResponse.json(
      { error: "Strapi auth failed", details: ex.payload },
      { status: ex.status }
    );
  }

  const isHttpsReq = req.headers.get("x-forwarded-proto")?.includes("https") ?? false;

  const syncedUser = await syncGoogleProfileToStrapiUser({
    strapiBase: STRAPI,
    jwt: ex.jwt,
    user: ex.user,
    googleProfile,
  });

  const res = NextResponse.json({ user: mergeGoogleProfileName(syncedUser, googleProfile) });
  res.cookies.set("strapi_jwt", ex.jwt, {
    httpOnly: true,
    secure: isHttpsReq,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  setGoogleProfileCookie(res, googleProfile, isHttpsReq);

  return res;
}
