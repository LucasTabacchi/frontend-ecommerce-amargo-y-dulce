import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function deleteCookieEverywhere(name: string) {
  const jar = cookies();

  // ✅ Forma recomendada (Next 13+)
  try {
    jar.delete(name);
  } catch {
    // ignore
  }

  // ✅ Fallback: overwrite con expiración en el pasado
  const base = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
  };

  jar.set(name, "", base);

  // Si alguna vez la guardaste con prefijos de seguridad:
  jar.set(`__Secure-${name}`, "", base);
  jar.set(`__Host-${name}`, "", { ...base, path: "/" }); // __Host- no lleva domain
}

export async function POST() {
  deleteCookieEverywhere("strapi_jwt");

  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
