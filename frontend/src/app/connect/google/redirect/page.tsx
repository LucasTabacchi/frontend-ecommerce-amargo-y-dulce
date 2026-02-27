"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function GoogleRedirectContent() {
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
      // 1) Autenticar con Strapi (guarda la cookie strapi_jwt)
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

      // 2) Obtener el nombre real desde Google usando el access_token
      try {
        const profileRes = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (profileRes.ok) {
          const profile = await profileRes.json();

          const firstName = profile.given_name || "";
          const lastName = profile.family_name || "";

          // 3) Guardar firstName y lastName en Strapi (la cookie ya fue seteada)
          if (firstName) {
            await fetch("/api/auth/me", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ firstName, lastName }),
              credentials: "include",
            });
          }
        }
      } catch {
        // Si falla guardar el nombre no bloqueamos el login, seguimos igual
      }

      router.replace("/");
    })();
  }, [sp, router]);

  if (err) return <div className="p-6">Error: {err}</div>;
  return <div className="p-6">Conectando con Google…</div>;
}

export default function GoogleRedirectPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando…</div>}>
      <GoogleRedirectContent />
    </Suspense>
  );
}
