import Image from "next/image";
import Link from "next/link";
import { Gift, HeartHandshake } from "lucide-react";

export function GiftOccasion() {
  return (
    <section className="py-fluid-lg" aria-labelledby="gift-occasion-title">
      <div className="overflow-hidden rounded-lg border border-red-100 bg-[#2a120d] shadow-sm">
        <div className="grid min-h-[360px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center px-fluid-md py-fluid-lg text-white lg:px-fluid-lg">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-red-50">
              <Gift className="h-4 w-4" />
              Ideal para regalar
            </div>

            <h2
              id="gift-occasion-title"
              className="mt-5 max-w-2xl text-fluid-3xl font-extrabold leading-tight"
            >
              Regalos que se sienten personales.
            </h2>

            <p className="mt-4 max-w-xl text-fluid-sm leading-7 text-red-50/85">
              Cajas de bombones artesanales pensadas para cumpleaños, aniversarios,
              agradecimientos y fechas especiales. Una forma simple de regalar algo
              cuidado, rico y con identidad propia.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/productos"
                className="inline-flex h-11 items-center justify-center rounded-full bg-red-600 px-5 text-sm font-extrabold text-white transition hover:bg-red-700"
              >
                Ver opciones para regalar
              </Link>
              <Link
                href="/cupones"
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/30 px-5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Ver cupones disponibles
              </Link>
            </div>

            <div className="mt-7 flex items-start gap-3 border-t border-white/15 pt-5 text-sm text-red-50/85">
              <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />
              <p>
                Presentaciones de 12 unidades con sabores clásicos y opciones
                especiales para compartir o sorprender.
              </p>
            </div>
          </div>

          <div className="relative min-h-[300px] overflow-hidden lg:min-h-full">
            <Image
              src="/home/hero-2.jpg"
              alt="Caja de bombones artesanales para regalar"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2a120d]/70 via-[#2a120d]/10 to-transparent lg:bg-gradient-to-r lg:from-[#2a120d] lg:via-[#2a120d]/25 lg:to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
