"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Slide = {
  id: string;
  image: string; // URL (local /public o remota)
  alt: string;
  href?: string; // opcional: link al hacer click
  title?: string;
  subtitle?: string;
  cta?: string;
};

function normalizePublicImageSrc(src: string) {
  const s = String(src || "").trim();
  if (!s) return "";

  // Remotas: dejarlas tal cual
  if (/^https?:\/\//i.test(s)) return s;

  // Si alguien pone "public/home/xxx.webp" -> "/home/xxx.webp"
  if (s.startsWith("public/")) return `/${s.slice("public/".length)}`;

  // Si viene "home/xxx.webp" -> "/home/xxx.webp"
  if (!s.startsWith("/")) return `/${s}`;

  // Ya viene "/home/xxx.webp"
  return s;
}

export function HeroCarousel({
  slides,
  intervalMs = 4500,
}: {
  slides: Slide[];
  intervalMs?: number;
}) {
  const safeSlides = useMemo(() => (Array.isArray(slides) ? slides.filter(Boolean) : []), [slides]);
  const [index, setIndex] = useState(0);

  const total = safeSlides.length;

  // si cambia la cantidad de slides, nos aseguramos de quedar en un índice válido
  useEffect(() => {
    if (!total) return;
    setIndex((i) => (i >= total ? 0 : i));
  }, [total]);

  useEffect(() => {
    if (total <= 1) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [total, intervalMs]);

  function prev() {
    if (!total) return;
    setIndex((i) => (i - 1 + total) % total);
  }

  function next() {
    if (!total) return;
    setIndex((i) => (i + 1) % total);
  }

  if (!total) return null;

  const current = safeSlides[index];
  const imgSrc = normalizePublicImageSrc(current.image);

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-white">
      {current.href ? (
        <Link href={current.href} className="block" aria-label={`Ir a ${current.href}`}>
          <HeroSlide imgSrc={imgSrc} current={current} />
        </Link>
      ) : (
        <div className="block">
          <HeroSlide imgSrc={imgSrc} current={current} />
        </div>
      )}

      {/* Flechas */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1.5 text-sm font-bold shadow hover:bg-white md:left-3 md:px-3 md:py-2"
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1.5 text-sm font-bold shadow hover:bg-white md:right-3 md:px-3 md:py-2"
            aria-label="Siguiente"
          >
            ›
          </button>
        </>
      )}

      {/* Dots */}
      {total > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-2 md:bottom-3">
          {safeSlides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              className={[
                "h-2 w-2 rounded-full transition md:h-2.5 md:w-2.5",
                i === index ? "bg-red-600" : "bg-white/80",
              ].join(" ")}
              aria-label={`Ir a slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HeroSlide({ imgSrc, current }: { imgSrc: string; current: Slide }) {
  const [imgError, setImgError] = useState(false);

  return (
    <>
      {/* ✅ Mantiene desktop como antes (aspect ratio),
          pero controla mejor el alto en mobile */}
      <div className="relative w-full bg-neutral-100">
        <div className="relative h-[260px] w-full sm:h-[320px] md:aspect-[16/7] md:h-auto">
          {imgSrc && !imgError ? (
            <Image
              src={imgSrc}
              alt={current.alt}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1200px"
              className="object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">
              No se pudo cargar la imagen
            </div>
          )}
          {/* leve overlay para legibilidad */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0" />
        </div>
      </div>

      {(current.title || current.subtitle || current.cta) && (
        <div className="absolute inset-0 flex items-end">
          {/* ✅ Mobile compacto, Desktop igual que antes (desde md) */}
          <div
            className={[
              // mobile: más chico
              "m-3 w-[calc(100%-1.5rem)] max-w-[280px] rounded-2xl bg-white/85 p-3 backdrop-blur",
              // desktop: igual que antes
              "md:m-5 md:w-auto md:max-w-none md:bg-white/80 md:p-5",
            ].join(" ")}
          >
            {current.title && (
              <div className="text-base font-extrabold text-neutral-900 md:text-xl">
                {current.title}
              </div>
            )}
            {current.subtitle && (
              <div className="mt-1 text-xs text-neutral-700 md:text-sm">
                {current.subtitle}
              </div>
            )}
            {current.cta && (
              <div className="mt-2 inline-flex rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white md:mt-3 md:px-4 md:py-2 md:text-sm">
                {current.cta}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
