"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/layout/Container";
import { useRouter } from "next/navigation";

const MOTIVOS = [
  "Agradecimiento",
  "Queja",
  "Reclamo",
  "Sugerencia",
  "Arrepentimiento de compra",
];

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500";

export default function LibroDeQuejasPage() {
  const router = useRouter();

  const [meLoading, setMeLoading] = useState(true);
  const [me, setMe] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setMeLoading(true);
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j = await r.json().catch(() => ({ user: null }));
        if (!alive) return;
        setMe(j?.user ?? null);
      } catch {
        if (!alive) return;
        setMe(null);
      } finally {
        if (alive) setMeLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!meLoading && me?.isStoreAdmin) {
      router.replace("/admin/pedidos");
    }
  }, [meLoading, me, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const payload = {
      motivo: formData.get("motivo"),
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      dni: formData.get("dni"),
      email: formData.get("email"),
      telefono: formData.get("telefono"),
      mensaje: formData.get("mensaje"),
    };

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Error al enviar el formulario");

      setOk(true);
      e.currentTarget.reset();
    } catch (err: any) {
      setError(err.message ?? "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="py-14">
      <h1 className="mb-8 text-center text-3xl font-extrabold tracking-wide">
        LIBRO DE QUEJAS ONLINE
      </h1>

      <div className="mx-auto w-full max-w-md">
        {/* Card vertical */}
        <div className="rounded-lg bg-neutral-50 p-6 shadow-sm ring-1 ring-neutral-200">
          {meLoading ? null : me?.isStoreAdmin ? (
            <p className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
              La cuenta tienda no puede enviar reclamos desde esta sección.
            </p>
          ) : ok ? (
            <p className="rounded-md bg-green-100 p-4 text-sm text-green-700">
              Gracias por contactarnos. Tu mensaje fue enviado correctamente.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Motivo */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-900">
                  Motivo <span className="text-red-600">*</span>
                </label>
                <select name="motivo" required className={inputClass}>
                  {MOTIVOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nombre */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-900">
                  Nombre <span className="text-red-600">*</span>
                </label>
                <input
                  name="nombre"
                  required
                  placeholder="Ej: Fernando"
                  className={inputClass}
                />
              </div>

              {/* Apellido */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-900">
                  Apellido <span className="text-red-600">*</span>
                </label>
                <input
                  name="apellido"
                  required
                  placeholder="Ej: Gomez"
                  className={inputClass}
                />
              </div>

              {/* DNI */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-900">
                  Ingresa tu dni <span className="text-red-600">*</span>
                </label>
                <input
                  name="dni"
                  required
                  placeholder="Ingresa tu dni"
                  className={inputClass}
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-900">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="tuemail@gmail.com"
                  className={inputClass}
                />
              </div>

              {/* Teléfono */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-900">
                  N° de Teléfono <span className="text-red-600">*</span>
                </label>
                <input
                  name="telefono"
                  required
                  placeholder="Ingresa tu teléfono"
                  className={inputClass}
                />
              </div>

              {/* Mensaje */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-900">
                  Mensaje <span className="text-red-600">*</span>
                </label>
                <textarea
                  name="mensaje"
                  required
                  placeholder="Tu comentario"
                  rows={5}
                  className={inputClass}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                disabled={loading}
                className="w-full rounded-md bg-neutral-800 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60"
              >
                {loading ? "Enviando..." : "Enviar"}
              </button>
            </form>
          )}
        </div>
      </div>
    </Container>
  );
}
