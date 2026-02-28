"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";

type OrderRow = {
  id: string | number;
  orderNumber?: string | null;
  orderStatus?: string | null;
  total?: number | string | null;
  createdAt?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  shippingAddress?: { text?: string | null } | null;
  items?: any[] | null;
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

function getActionByStatus(status?: string | null) {
  const s = normalizeStatus(status);
  if (s === "paid") return { nextStatus: "shipped", label: "Marcar como enviado" };
  if (s === "shipped") return { nextStatus: "delivered", label: "Marcar como entregado" };
  return null;
}

export default function AdminPedidosPage() {
  const router = useRouter();

  const [meLoading, setMeLoading] = useState(true);
  const [me, setMe] = useState<any | null>(null);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setMeLoading(true);
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j = await r.json().catch(() => ({ user: null }));
        setMe(j?.user ?? null);
      } catch {
        setMe(null);
      } finally {
        setMeLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!meLoading && !me) router.replace("/");
  }, [meLoading, me, router]);

  const isStoreAdmin = Boolean(me?.isStoreAdmin);

  async function loadOrders(search: string) {
    setLoading(true);
    setError(null);
    try {
      const query = search.trim();
      const url = query.length >= 2
        ? `/api/admin/orders?q=${encodeURIComponent(query)}`
        : "/api/admin/orders";
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => null);

      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      const list = Array.isArray(j?.orders) ? j.orders : [];
      setOrders(list);
    } catch (e: any) {
      setOrders([]);
      setError(e?.message || "No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me || !isStoreAdmin) return;
    loadOrders(q);
  }, [me, isStoreAdmin, q]);

  async function handleAdvanceStatus(order: OrderRow) {
    const action = getActionByStatus(order.orderStatus);
    if (!action) return;

    const orderId = String(order.id || "").trim();
    if (!orderId) {
      setStatusError("No se pudo resolver el id de la orden.");
      return;
    }

    try {
      setUpdatingId(orderId);
      setStatusError(null);

      const r = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextStatus: action.nextStatus }),
      });
      const j = await r.json().catch(() => null);

      if (!r.ok) {
        throw new Error(j?.error || "No se pudo actualizar el estado.");
      }

      setOrders((prev) =>
        prev.map((row) =>
          String(row.id) === orderId
            ? { ...row, orderStatus: j?.data?.orderStatus || action.nextStatus }
            : row
        )
      );
    } catch (e: any) {
      setStatusError(e?.message || "No se pudo actualizar el estado.");
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredInfo = useMemo(() => {
    if (!q.trim()) return "Mostrando todos los pedidos.";
    return `Buscando: "${q.trim()}"`;
  }, [q]);

  if (meLoading) {
    return (
      <main>
        <Container>
          <div className="py-10">Cargando…</div>
        </Container>
      </main>
    );
  }

  if (!me) return null;

  if (!isStoreAdmin) {
    return (
      <main>
        <Container>
          <div className="py-10">
            <h1 className="text-3xl font-extrabold text-neutral-900">Panel tienda</h1>
            <div className="mt-6 rounded-2xl border bg-white p-6 text-sm text-neutral-800">
              No tenés permisos para ver este panel.
              <div className="mt-4">
                <Link href="/" className="text-sm font-semibold text-red-700 hover:underline">
                  Volver a la tienda →
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main>
      <Container>
        <div className="py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-neutral-900">Panel tienda · Pedidos</h1>
              <p className="mt-2 text-sm text-neutral-600">{filteredInfo}</p>
            </div>

            <Link
              href="/mis-pedidos"
              className="rounded-full border px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Ver mis pedidos
            </Link>
          </div>

          <form
            className="mt-6 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(qInput);
            }}
          >
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Buscar por pedido, nombre o email"
              className="h-11 min-w-[260px] flex-1 rounded-xl border border-neutral-300 px-4 text-sm text-neutral-900 placeholder:text-neutral-400"
            />
            <button
              type="submit"
              className="h-11 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                setQInput("");
                setQ("");
              }}
              className="h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Limpiar
            </button>
          </form>

          {loading && (
            <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-neutral-700">
              Cargando pedidos…
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-red-700">
              {error}
            </div>
          )}

          {statusError && (
            <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-red-700">
              {statusError}
            </div>
          )}

          {!error && !loading && orders.length === 0 && (
            <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-neutral-700">
              No se encontraron pedidos.
            </div>
          )}

          {orders.length > 0 && (
            <div className="mt-8 space-y-4">
              {orders.map((o) => {
                const totalNum = typeof o.total === "number" ? o.total : Number(o.total || 0);
                const date = o.createdAt ? new Date(o.createdAt) : null;
                const dateLabel = date
                  ? date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })
                  : "";
                const action = getActionByStatus(o.orderStatus);
                const rowId = String(o.id);
                const isUpdatingThis = updatingId === rowId;

                return (
                  <div key={rowId} className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-neutral-600">Pedido</div>
                        <div className="text-base font-extrabold text-neutral-900 break-words">
                          {o.orderNumber || rowId}
                        </div>
                        {dateLabel && <div className="mt-1 text-sm text-neutral-600">{dateLabel}</div>}
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusPill status={String(o.orderStatus || "")} />
                        <div className="text-right">
                          <div className="text-sm text-neutral-600">Total</div>
                          <div className="text-base font-extrabold text-neutral-900 whitespace-nowrap">
                            {formatARS(totalNum)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
                      <div>
                        <span className="font-semibold text-neutral-900">Cliente:</span>{" "}
                        {[o.name, o.email].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-neutral-900">Teléfono:</span>{" "}
                        {o.phone || "—"}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-neutral-900">Dirección:</span>{" "}
                        {o.shippingAddress?.text || "—"}
                      </div>
                    </div>

                    {action ? (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(o)}
                          disabled={isUpdatingThis}
                          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
                        >
                          {isUpdatingThis ? "Actualizando..." : action.label}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
