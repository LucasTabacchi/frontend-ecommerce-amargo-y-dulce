"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function GoogleRedirectPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = sp.get("access_token");
    if (!accessToken) {
      setErr("No llegó access_token. Revisá el Redirect URL en Strapi Providers.");
      return;
    }

    (async () => {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setErr(json?.error || "No se pudo iniciar sesión.");
        return;
      }

      router.replace("/"); // o donde quieras
    })();
  }, [sp, router]);

  if (err) return <div className="p-6">Error: {err}</div>;
  return <div className="p-6">Conectando con Google…</div>;
}
