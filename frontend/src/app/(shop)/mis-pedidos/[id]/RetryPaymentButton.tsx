"use client";

import { useState } from "react";

export function RetryPaymentButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetryPayment() {
    if (!orderId) return;

    try {
      setError(null);
      setLoading(true);

      const response = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error || "No se pudo generar el link de pago.");
      }

      const checkoutUrl = String(
        json?.sandbox_init_point || json?.init_point || ""
      ).trim();

      if (!checkoutUrl) {
        throw new Error("MercadoPago no devolvió un link de pago.");
      }

      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err?.message || "Error reintentando el pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={handleRetryPayment}
        disabled={loading}
        className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {loading ? "Generando link..." : "Reintentar pago"}
      </button>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
