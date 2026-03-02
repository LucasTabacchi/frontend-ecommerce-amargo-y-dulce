"use client";

import { useEffect } from "react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
          <Button onClick={() => reset()} className="bg-orange-600 text-white hover:bg-orange-700">
            Reintentar
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    </Container>
  );
}
