"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  function handleRetry() {
    if (busy) return;
    setBusy(true);

    try {
      reset();
    } catch {}

    window.location.reload();
  }

  function handleGoHome() {
    if (busy) return;
    setBusy(true);

    try {
      router.replace("/");
      setTimeout(() => {
        window.location.assign("/");
      }, 80);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container>
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-neutral-900">Algo salió mal</h2>
          <p className="text-neutral-600">
            No pudimos cargar la página en este momento. Por favor, intentá de nuevo.
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            type="button"
            onClick={handleRetry}
            disabled={busy}
            className="bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {busy ? "Reintentando..." : "Reintentar"}
          </Button>
          <Button
            type="button"
            onClick={handleGoHome}
            disabled={busy}
            className="bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    </Container>
  );
}
