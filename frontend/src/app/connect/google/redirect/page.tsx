"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function GoogleRedirectContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [err, setErr] = useState<string | null>(null);
  const startedRef = useRef(false);
  const storageKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const accessToken = sp.get("access_token");
    const next = (() => {
      const raw = String(sp.get("next") || "/").trim();
      return raw.startsWith("/") ? raw : "/";
    })();
    if (!accessToken) {
      setErr("No llegó access_token. Revisá el Redirect URL en Strapi Providers.");
      return;
    }

    const storageKey = `google-oauth-done:${accessToken.slice(0, 32)}`;
    storageKeyRef.current = storageKey;
    try {
      if (window.sessionStorage.getItem(storageKey) === "1") {
        router.replace(next);
        return;
      }
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Si sessionStorage no está disponible seguimos con el flujo normal.
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
        try {
          if (storageKeyRef.current) window.sessionStorage.removeItem(storageKeyRef.current);
        } catch {}
        setErr(json?.error || "No se pudo iniciar sesión.");
        return;
      }

      router.replace(next);
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
