"use client";

import { useEffect, useRef } from "react";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export function LoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      const panel = panelRef.current;
      if (!panel) return;
      if (!panel.contains(e.target as Node)) onClose();
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* ✅ Backdrop para capturar clicks afuera + asegurar z-index */}
      <div className="fixed inset-0 z-[90]" onClick={onClose} />

      <div
        ref={panelRef}
        className="fixed z-[100] w-[340px] rounded-xl border border-neutral-200 bg-white p-5 shadow-xl
                   right-4 top-20 md:right-10 md:top-20"
        role="dialog"
        aria-modal="true"
        aria-label="Iniciar sesión"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Iniciar sesión</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Accedé con tu cuenta de Google para continuar.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>

        {/* ✅ Importante: si el botón de Google NO hacía nada,
            suele ser porque el click se perdía por z-index/overlay/posición absolute.
            Ahora el modal es fixed con z alto y backdrop separado. */}
        <GoogleLoginButton
          className="mt-4 flex h-10 w-full items-center justify-center gap-3 rounded-full border border-neutral-300 bg-white text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          onStart={() => {
            // ✅ saca el overlay antes de ir a Google
            onClose();
          }}
        />
        <p className="mt-3 text-xs text-neutral-500">
          Usamos Google solo para autenticarte.
        </p>
      </div>
    </>
  );
}
