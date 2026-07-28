import { NextResponse } from "next/server";
import {
  buildProductProxyRequestOptions,
  buildProductProxySearch,
  isFreshProductProxyRequest,
} from "@/lib/product-proxy-cache";

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

export async function GET(
  req: Request,
  ctx: { params: { id: string } }
) {
  const base = getBase();
  const token = getToken();

  const { searchParams } = new URL(req.url);
  const fresh = isFreshProductProxyRequest(searchParams);
  const qs = buildProductProxySearch(searchParams);

  const id = encodeURIComponent(ctx.params.id);
  const url = `${base}/api/products/${id}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, buildProductProxyRequestOptions({ fresh, token }));

  const text = await res.text().catch(() => "");
  const response = new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });

  if (!fresh && res.ok) {
    response.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  }

  return response;
}
