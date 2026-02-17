import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getBase() {
  return (
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337"
  ).replace(/\/$/, "");
}

function getToken() {
  return process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || "";
}

export async function GET(req: Request) {
  const base = getBase();
  const token = getToken();

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();

  const url = `${base}/api/products${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
