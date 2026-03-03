"use client";

type Props = {
  className?: string;
  onStart?: () => void; // ✅ para que el modal cierre el backdrop antes de redirigir
};

export function GoogleLoginButton({ className = "", onStart }: Props) {
  const next =
    typeof window !== "undefined"
      ? (() => {
        const pathname = window.location.pathname || "/";
        const params = new URLSearchParams(window.location.search || "");
        const nextParam = String(params.get("next") || "").trim();
        if (nextParam.startsWith("/")) {
          // Si la pantalla ya define next (ej. carrito -> checkout),
          // siempre respetamos ese destino para completar el flujo.
          return nextParam;
        }

        // Si no hay next explícito, limpiamos login=1 para evitar
        // reabrir el modal al volver del OAuth.
        if (params.get("login") === "1") {
          params.delete("login");
        }

        const query = params.toString();
        return query ? `${pathname}?${query}` : pathname;
      })()
      : "/";

  // ✅ Router único: START es /api/auth/google?start=1&next=...
  const href = `/api/auth/google?start=1&next=${encodeURIComponent(next)}`;

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        // ✅ 1) Cerrá el modal/backdrop YA (evita “pantalla negra”)
        onStart?.();

        // ✅ 2) En mobile a veces el click del <a> tarda / se interrumpe.
        // Hacemos navegación explícita pero dejando que el navegador procese el gesto.
        // (No usamos preventDefault para no romper Safari/Chrome mobile).
        requestAnimationFrame(() => {
          window.location.assign(href);
        });
      }}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold">
        G
      </span>
      Continuar con Google
    </a>
  );
}
