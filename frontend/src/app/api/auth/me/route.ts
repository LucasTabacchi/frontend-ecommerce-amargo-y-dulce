import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function normBase(url: string) {
  return String(url || "").trim().replace(/\/$/, "");
}

export async function GET() {
  const jwt = cookies().get("strapi_jwt")?.value;
  if (!jwt) return NextResponse.json({ user: null }, { status: 200 });

  const STRAPI = normBase(process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "");
  if (!STRAPI) return NextResponse.json({ user: null }, { status: 200 });

  const r = await fetch(`${STRAPI}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });

  if (!r.ok) return NextResponse.json({ user: null }, { status: 200 });

  const user = await r.json().catch(() => null);
  return NextResponse.json({ user }, { status: 200 });
}
