"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Container } from "@/components/layout/Container";

type OrderRow = {
  id: string | number;
  orderNumber?: string | null;
  orderStatus?: string | null;
  total?: number | string | null;
  createdAt?: string | null;
  shippingAddress?: any;
  items?: any;
};

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function normalizeStatus(s?: string | null) {
  const v = String(s || "").toLowerCase();
  if (v === "paid") return "paid";
  if (v === "pending") return "pending";
  if (v === "shipped") return "shipped";
  if (v === "delivered") return "delivered";
  if (v === "failed") return "failed";
  if (v === "cancelled") return "cancelled";
  return "unknown";
}

function StatusPill({ status }: { status: string }) {
  const s = normalizeStatus(status);
  const cls =
    s === "paid"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : s === "pending"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : s === "shipped"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : s === "delivered"
      ? "bg-violet-50 text-violet-700 ring-violet-200"
      : s === "failed" || s === "cancelled"
      ? "bg-red-50 text-red-700 ring-red-200"
      : "bg-neutral-50 text-neutral-700 ring-neutral-200";

  const label =
    s === "paid"
      ? "Pagado"
      : s === "pending"
      ? "Pendiente"
      : s === "shipped"
      ? "Enviado"
      : s === "delivered"
      ? "Entregado"
      : s === "failed"
      ? "Fallido"
      : s === "cancelled"
      ? "Cancelado"
      : "—";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {label}
    </span>
  );
}

export default function MisPedidosPage() {
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Cargar email guardado
  useEffect(() => {
    const v = localStorage.getItem("amg_email");
    if (v) {
      setEmail(v);
      setSavedEmail(v);
    }
  }, []);

  const canFetch = useMemo(() => email.trim().includes("@"), [email]);

  async function loadOrders(targetEmail: string) {
    const e = targetEmail.trim().toLowerCase();
    if (!e.includes("@")) return;

    setLoading(true);
    setError(null);

    try {
      const r = await fetch(`/api/orders/my?email=${encodeURIComponent(e)}`, {
        cache: "no-store",
      });
      const json = await r.json().catch(() => null);

      if (!r.ok) {
        throw new Error(json?.error || `HTTP ${r.status}`);
      }

      const list = Array.isArray(json?.orders) ? json.orders : [];
      setOrders(list);
    } catch (err: any) {
      setOrders([]);
      setError(err?.message || "No se pudieron cargar tus pedidos.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!v.includes("@")) return;

    localStorage.setItem("amg_email", v);
    setSavedEmail(v);
    loadOrders(v);
  }

  // Auto-cargar si ya había email guardado
  useEffect(() => {
    if (savedEmail) loadOrders(savedEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedEmail]);

  return (
    <main>
      <Container>
        <div className="py-10">
          <h1 className="text-3xl font-extrabold text-neutral-900">Mis pedidos</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Ingresá tu email para ver el historial.
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu-email@ejemplo.com"
              className="h-11 w-full rounded-full border border-neutral-300 bg-white px-4 text-sm outline-none focus:border-neutral-400"
              type="email"
            />
            <button
              type="submit"
              disabled={!canFetch || loading}
              className="h-11 rounded-full bg-neutral-900 px-6 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Cargando..." : "Ver pedidos"}
            </button>

            {savedEmail && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("amg_email");
                  setSavedEmail(null);
                  setEmail("");
                  setOrders([]);
                }}
                className="h-11 rounded-full border px-6 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Cambiar email
              </button>
            )}
          </form>

          {error && (
            <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && savedEmail && !loading && orders.length === 0 && (
            <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-neutral-700">
              No encontramos pedidos para <b>{savedEmail}</b>.
            </div>
          )}

          {orders.length > 0 && (
            <div className="mt-8 space-y-4">
              {orders.map((o) => {
                const totalNum =
                  typeof o.total === "number" ? o.total : Number(o.total || 0);

                const date = o.createdAt ? new Date(o.createdAt) : null;
                const dateLabel = date
                  ? date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })
                  : "";

                return (
                  <Link
                    key={String(o.id)}
                    href={`/mis-pedidos/${encodeURIComponent(String(o.id))}`}
                    className="block rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-neutral-600">Pedido</div>
                        <div className="text-base font-extrabold text-neutral-900">
                          {o.orderNumber || String(o.id)}
                        </div>
                        {dateLabel && (
                          <div className="mt-1 text-sm text-neutral-600">{dateLabel}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusPill status={String(o.orderStatus || "")} />
                        <div className="text-right">
                          <div className="text-sm text-neutral-600">Total</div>
                          <div className="text-base font-extrabold text-neutral-900">
                            {formatARS(totalNum)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-sm font-semibold text-red-700 opacity-80">
                      Ver detalle →
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="mt-10">
            <Link href="/" className="text-sm underline text-neutral-700">
              Volver a la tienda
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
