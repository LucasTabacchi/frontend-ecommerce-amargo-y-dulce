import { BadgeCheck, Heart, PackageCheck, Sparkles } from "lucide-react";

const items = [
  {
    icon: Sparkles,
    kicker: "01",
    title: "Cacao seleccionado",
    text: "Chocolate con carácter, pensado para lograr equilibrio entre intensidad, dulzor y textura.",
  },
  {
    icon: Heart,
    kicker: "02",
    title: "Rellenos de autor",
    text: "Sabores clásicos y combinaciones especiales creadas para que cada pieza tenga identidad propia.",
  },
  {
    icon: BadgeCheck,
    kicker: "03",
    title: "Elaboración cuidada",
    text: "Partidas artesanales con terminaciones prolijas, brillo y presentación pensada al detalle.",
  },
  {
    icon: PackageCheck,
    kicker: "04",
    title: "Listos para regalar",
    text: "Cajas de 12 unidades con presencia elegante para cumpleaños, agradecimientos y ocasiones especiales.",
  },
];

export function BrandDifferentials() {
  return (
    <section className="pb-fluid-xl pt-fluid-sm" aria-labelledby="brand-differentials-title">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-red-700">
          Amargo y Dulce
        </p>
        <h2
          id="brand-differentials-title"
          className="mt-2 text-fluid-2xl font-extrabold text-neutral-950"
        >
          Detalles que hacen mejor cada compra
        </h2>
      </div>

      <div className="mt-fluid-md grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, kicker, title, text }) => (
          <article
            key={title}
            className="group relative overflow-hidden rounded-lg border border-red-100 bg-gradient-to-br from-white via-[#fff8f3] to-[#f3e5da] p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-red-200 hover:shadow-lg"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-700 via-red-500 to-[#7a2e18]" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-red-100 bg-red-50 text-red-700 shadow-sm transition group-hover:bg-red-600 group-hover:text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-serif text-3xl font-bold leading-none text-red-100">
                {kicker}
              </div>
            </div>
            <h3 className="mt-5 text-base font-extrabold text-neutral-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
