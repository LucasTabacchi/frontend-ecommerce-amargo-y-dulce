"use client";

import { useEffect, useState } from "react";

type MeResponse = { user: any | null };

function safeName(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function displayName(user: any) {
  if (safeName(user?.firstName)) {
    return `${safeName(user.firstName)}${safeName(user?.lastName) ? " " + safeName(user.lastName) : ""}`;
  }
  return (
    safeName(user?.name) ||
    safeName(user?.username) ||
    (typeof user?.email === "string" ? safeName(user.email.split("@")[0]) : null) ||
    "Cuenta"
  );
}

export function AuthStatus({ onOpenLogin }: { onOpenLogin: () => void }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const j: MeResponse = await r.json().catch(() => ({ user: null }));
    setUser(j.user ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();

    // 👇 cuando volvés del login, recarga el estado sin refrescar toda la página
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  if (loading) {
    return <button className="flex items-center gap-2 text-sm opacity-70">Cargando…</button>;
  }

  if (!user) {
    return (
      <button onClick={onOpenLogin} className="flex items-center gap-2 text-sm">
        Iniciar sesión
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden sm:inline">
        Hola, <b>{displayName(user)}</b>
      </span>
      <button onClick={logout} className="text-sm underline">
        Cerrar sesión
      </button>
    </div>
  );
}
