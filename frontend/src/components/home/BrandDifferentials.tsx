import { CreditCard, PackageCheck, Sparkles, Truck } from "lucide-react";

const items = [
  {
    icon: Sparkles,
    title: "Producción artesanal",
    text: "Bombones elaborados con cuidado, partidas seleccionadas y rellenos de autor.",
  },
  {
    icon: PackageCheck,
    title: "Cajas de 12 unidades",
    text: "Presentaciones listas para regalar, compartir o llevar a una ocasión especial.",
  },
  {
    icon: CreditCard,
    title: "Pagos seguros",
    text: "Checkout integrado con Mercado Pago para una compra simple y protegida.",
  },
  {
    icon: Truck,
    title: "Envíos disponibles",
    text: "Opciones de entrega para recibir tus bombones donde los necesites.",
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
        {items.map(({ icon: Icon, title, text }) => (
          <article
            key={title}
            className="rounded-lg border border-red-100 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-red-50 text-red-700">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-neutral-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
