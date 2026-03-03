import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isHttps(req: Request) {
  const xf = req.headers.get("x-forwarded-proto");
  if (xf) return xf.toLowerCase().includes("https");
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function expireCookieEverywhere(res: NextResponse, name: string, secure: boolean) {
  const base = {
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };

  res.cookies.set({ name, ...base });
  res.cookies.set({ name: `__Secure-${name}`, ...base });
  // __Host- siempre requiere path="/", secure=true y sin domain.
  res.cookies.set({ name: `__Host-${name}`, ...base, path: "/", secure: true });
}

export async function POST(req: Request) {
  const secure = isHttps(req);
  const res = NextResponse.json({ ok: true });
  expireCookieEverywhere(res, "strapi_jwt", secure);
  expireCookieEverywhere(res, "auth_return_to", secure);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
