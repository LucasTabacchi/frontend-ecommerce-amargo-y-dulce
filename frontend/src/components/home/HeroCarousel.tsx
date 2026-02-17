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
    <section className="relative overflow-hidden rounded-2xl border bg-white min-h-[40dvh] md:min-h-0">
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
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-sm font-bold shadow hover:bg-white md:left-4"
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-sm font-bold shadow hover:bg-white md:right-4"
            aria-label="Siguiente"
          >
            ›
          </button>
        </>
      )}

      {/* Dots */}
      {total > 1 && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2">
          {safeSlides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              className={[
                "h-2 w-2 rounded-full transition md:h-2.5 md:w-2.5",
                i === index ? "bg-red-600 w-4 md:w-5" : "bg-white/80",
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
      <div className="relative w-full bg-neutral-100">
        <div className="relative h-[40dvh] w-full sm:h-[50dvh] md:aspect-[21/9] md:h-auto">
          {imgSrc && !imgError ? (
            <Image
              src={imgSrc}
              alt={current.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">
              No se pudo cargar la imagen
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      </div>

      {(current.title || current.subtitle || current.cta) && (
        <div className="absolute inset-0 flex items-center justify-start p-fluid-md md:p-fluid-lg">
          <div className="max-w-[85%] rounded-2xl bg-white/85 p-fluid-md backdrop-blur md:max-w-xl md:p-fluid-lg">
            {current.title && (
              <div className="text-fluid-lg font-extrabold text-neutral-900 md:text-fluid-2xl">
                {current.title}
              </div>
            )}
            {current.subtitle && (
              <div className="mt-2 text-fluid-xs text-neutral-700 md:text-fluid-sm">
                {current.subtitle}
              </div>
            )}
            {current.cta && (
              <div className="mt-4 inline-flex rounded-full bg-red-600 px-fluid-md py-2 text-fluid-xs font-bold text-white md:mt-6 md:text-fluid-sm">
                {current.cta}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
