"use client";

export function GoogleLoginButton({ className = "" }: { className?: string }) {
  const onClick = () => {
    const base = (process.env.NEXT_PUBLIC_STRAPI_URL || "").replace(/\/$/, "");
    window.location.href = `${base}/api/connect/google`;
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold">
        G
      </span>
      Continuar con Google
    </button>
  );
}
