import Image from "next/image";
import Link from "next/link";
import { Gift, HeartHandshake } from "lucide-react";

export function GiftOccasion() {
  return (
    <section className="pb-fluid-lg pt-fluid-sm" aria-labelledby="gift-occasion-title">
      <div className="overflow-hidden rounded-2xl border border-red-100 bg-[#2a120d] shadow-sm">
        <div className="grid min-h-[240px] lg:grid-cols-[1.35fr_0.65fr]">
          <div className="flex flex-col justify-center px-fluid-md py-fluid-md text-white lg:px-fluid-lg">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-red-50">
              <Gift className="h-4 w-4" />
              Ideal para regalar
            </div>

            <h2
              id="gift-occasion-title"
              className="mt-4 max-w-xl text-fluid-2xl font-extrabold leading-tight"
            >
              Regalos que se sienten personales.
            </h2>

            <p className="mt-3 max-w-2xl text-fluid-sm leading-6 text-red-50/85">
              Cajas de bombones artesanales pensadas para cumpleaños, aniversarios,
              agradecimientos y fechas especiales. Una forma simple de regalar algo
              cuidado, rico y con identidad propia.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/productos"
                className="inline-flex h-11 items-center justify-center rounded-full bg-red-600 px-5 text-sm font-extrabold text-white transition hover:bg-red-700"
              >
                Ver opciones para regalar
              </Link>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-red-50/80">
              <HeartHandshake className="h-4 w-4 shrink-0 text-red-200" />
              <p>
                Presentaciones de 12 unidades listas para compartir o sorprender.
              </p>
            </div>
          </div>

          <div className="relative min-h-[190px] overflow-hidden md:min-h-[220px] lg:min-h-full">
            <Image
              src="/home/gift-occasion.png"
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
