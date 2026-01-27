import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function normBase(url: string) {
  return String(url || "").trim().replace(/\/$/, "");
}

export async function POST(req: Request) {
  const { access_token } = await req.json().catch(() => ({}));

  if (!access_token) {
    return NextResponse.json({ error: "Missing access_token" }, { status: 400 });
  }

  const STRAPI = normBase(process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "");
  if (!STRAPI) {
    return NextResponse.json({ error: "Missing STRAPI_URL" }, { status: 500 });
  }

  const url = `${STRAPI}/api/auth/google/callback?access_token=${encodeURIComponent(access_token)}`;
  const r = await fetch(url, { cache: "no-store" });
  const payload = await r.json().catch(() => null);

  if (!r.ok) {
    return NextResponse.json({ error: "Strapi auth failed", details: payload }, { status: r.status });
  }

  const jwt = payload?.jwt;
  const user = payload?.user;

  if (!jwt) {
    return NextResponse.json({ error: "No jwt returned by Strapi", details: payload }, { status: 502 });
  }

  cookies().set("strapi_jwt", jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ user });
}
