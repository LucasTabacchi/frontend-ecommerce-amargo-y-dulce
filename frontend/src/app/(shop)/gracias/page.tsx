"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { useCartStore } from "@/store/cart.store";

type StatusKind = "success" | "pending" | "failure" | "unknown";

function normalizeStatus(s?: string | null): StatusKind {
  const v = String(s || "").toLowerCase();
  if (v === "success" || v === "approved") return "success";
  if (v === "pending" || v === "in_process") return "pending";
  if (v === "failure" || v === "rejected") return "failure";
  return "unknown";
}

function StatusBadge({ status }: { status: StatusKind }) {
  const cfg = useMemo(() => {
    switch (status) {
      case "success":
        return {
          title: "Compra realizada",
          subtitle: "Tu pago fue aprobado. ¡Gracias por tu compra!",
          ring: "ring-emerald-200",
          bg: "bg-emerald-50",
          iconBg: "bg-emerald-600",
          icon: "✓",
        };
      case "pending":
        return {
          title: "Pago pendiente",
          subtitle: "Estamos esperando confirmación. Podría tardar unos segundos.",
          ring: "ring-amber-200",
          bg: "bg-amber-50",
          iconBg: "bg-amber-600",
          icon: "⏳",
        };
      case "failure":
        return {
          title: "Pago rechazado",
          subtitle: "El pago no se aprobó. Podés intentar nuevamente.",
          ring: "ring-red-200",
          bg: "bg-red-50",
          iconBg: "bg-red-600",
          icon: "✕",
        };
      default:
        return {
          title: "Estado de compra",
          subtitle: "Recibimos tu retorno de pago.",
          ring: "ring-neutral-200",
          bg: "bg-neutral-50",
          iconBg: "bg-neutral-700",
          icon: "ℹ",
        };
    }
  }, [status]);

  return (
    <div className={`rounded-2xl ${cfg.bg} ring-1 ${cfg.ring} p-6`}>
      <div className="flex items-start gap-4">
        <div
          className={`grid h-12 w-12 place-items-center rounded-xl ${cfg.iconBg} text-white text-xl font-black`}
          aria-hidden
        >
          {cfg.icon}
        </div>

        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-neutral-900">{cfg.title}</h1>
          <p className="mt-1 text-sm text-neutral-700">{cfg.subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function mapOrderStatusToUi(orderStatus: string | null | undefined): StatusKind {
  const s = String(orderStatus ?? "").toLowerCase();
  if (s === "paid") return "success";
  if (s === "failed" || s === "cancelled") return "failure";
  if (s) return "pending";
  return "pending";
}

export default function GraciasPage() {
  const sp = useSearchParams();

  const clear = useCartStore((s) => s.clear);
  const hasHydrated = useCartStore((s) => s.hasHydrated);

  const orderId = sp.get("orderId") || "";
  const externalRef = sp.get("external_reference") || "";

  const initialStatus = normalizeStatus(sp.get("status"));
  const [status, setStatus] = useState<StatusKind>(initialStatus);
  const [hint, setHint] = useState<string | null>(null);

  const clearedRef = useRef(false);
  const resolvedRef = useRef<StatusKind | null>(null);
  const latestUrlStatusRef = useRef<StatusKind>(initialStatus);

  // ✅ Vaciar carrito cuando la UI esté en success (1 sola vez) y el store ya hidrató
  useEffect(() => {
    if (!hasHydrated) return;
    if (status !== "success") return;
    if (clearedRef.current) return;

    clearedRef.current = true;
    clear();
  }, [status, clear, hasHydrated]);

  // Si cambia la URL, usamos status solo como fallback si no resolvimos por Strapi
  useEffect(() => {
    const nextUrlStatus = normalizeStatus(sp.get("status"));
    latestUrlStatusRef.current = nextUrlStatus;

    if (!resolvedRef.current) {
      setStatus(nextUrlStatus);
      setHint(null);
      // ❌ NO reseteamos clearedRef acá (puede generar comportamientos raros)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  useEffect(() => {
    if (!orderId) return;

    let alive = true;
    const startedAt = Date.now();
    let timer: any = null;

    async function tick() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!alive) return;

        const orderStatus: string | null =
          json?.data?.attributes?.orderStatus ??
          json?.data?.orderStatus ??
          null;

        const nextUi = mapOrderStatusToUi(orderStatus);

        // nunca permitir downgrade success -> pending
        if (resolvedRef.current === "success") {
          setStatus("success");
          return;
        }

        if (nextUi === "success" || nextUi === "failure") {
          resolvedRef.current = nextUi;
        }

        setStatus((prev) => (prev === "success" ? "success" : nextUi));

        // backup: si llega a success por acá, intentamos vaciar (aunque igual lo hace el effect de arriba)
        if (nextUi === "success" && hasHydrated && !clearedRef.current) {
          clearedRef.current = true;
          clear();
        }

        if (Date.now() - startedAt > 30_000 && nextUi === "pending") {
          setHint(
            "Todavía no pudimos confirmar el pago. Podés refrescar la página o revisar tu email: el webhook puede tardar unos segundos."
          );
        } else {
          setHint(null);
        }
      } catch {
        if (!alive) return;
        if (Date.now() - startedAt > 30_000) {
          setHint(
            "Tuvimos un problema verificando el estado. Podés refrescar la página o revisar tu email."
          );
        }
      }
    }

    const schedule = async () => {
      await tick();

      const elapsed = Date.now() - startedAt;

      if (!alive) return;
      if (resolvedRef.current === "success" || resolvedRef.current === "failure") return;
      if (elapsed > 30_000) return;

      const delay = elapsed <= 8_000 ? 500 : 2500;
      timer = setTimeout(schedule, delay);
    };

    schedule();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, clear, hasHydrated]);

  const statusLabel =
    status === "success"
      ? "Aprobado"
      : status === "pending"
      ? "Pendiente"
      : status === "failure"
      ? "Rechazado"
      : "—";

  return (
    <main>
      <Container>
        <div className="py-10">
          <StatusBadge status={status} />

          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-neutral-900">Detalle del pedido</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-neutral-600">Pedido</span>
                <span className="font-semibold text-neutral-900 break-all">
                  {orderId || "—"}
                </span>
              </div>

              {externalRef && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-neutral-600">Referencia</span>
                  <span className="font-semibold text-neutral-900 break-all">
                    {externalRef}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-neutral-600">Estado</span>
                <span className="font-semibold text-neutral-900">{statusLabel}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Volver a la tienda
              </Link>

              <Link
                href="/productos"
                className="rounded-full border px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Ver productos
              </Link>

              <Link
                href="/promociones"
                className="rounded-full border px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Seguir comprando
              </Link>

              {status === "success" && orderId && (
                <Link
                  href={`/mis-pedidos/${encodeURIComponent(orderId)}`}
                  className="rounded-full border px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Ver mi pedido →
                </Link>
              )}
            </div>

            {status === "pending" && (
              <p className="mt-4 text-xs text-neutral-500">
                {hint ||
                  "Si el estado no cambia, refrescá la página o revisá tu email. El webhook puede tardar unos segundos."}
              </p>
            )}

            {status === "success" && (
              <p className="mt-4 text-xs text-neutral-500">
                Si no te llega el email de confirmación, revisá Spam/Promociones.
              </p>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
