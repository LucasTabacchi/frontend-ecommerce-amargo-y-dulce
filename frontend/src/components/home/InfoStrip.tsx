import { CreditCard, Truck, BadgeDollarSign, UserRound } from "lucide-react";

/**
 * Item de info/beneficio.
 * - Utiliza tipografía fluida para mejor legibilidad en diferentes tamaños.
 */
function InfoItem({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-fluid-xs px-fluid-sm py-fluid-xs">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white">
        <Icon className="h-5 w-5 text-neutral-700" />
      </div>

      <div className="leading-tight">
        <div className="text-fluid-xs font-semibold uppercase tracking-wide text-neutral-800">
          {title}
        </div>
        <div className="text-fluid-xs text-neutral-500">{subtitle}</div>
      </div>
    </div>
  );
}

/**
 * Banda de información debajo del carrusel:
 * - Utiliza un grid adaptable con auto-fit para mejor distribución.
 */
export function InfoStrip() {
  return (
    <section aria-label="Información de compra" className="bg-white">
      <div className="rounded-xl border border-neutral-200 bg-white shadow-md overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-neutral-200 sm:grid-cols-2 md:grid-cols-4 md:divide-x md:divide-y-0">
          <InfoItem
            icon={UserRound}
            title="Cómo comprar"
            subtitle="Es necesario iniciar sesión"
          />
          <InfoItem
            icon={CreditCard}
            title="Método de pago"
            subtitle="Solo mercado pago"
          />
          <InfoItem
            icon={Truck}
            title="Método de envío"
            subtitle="A domicilio o punto de retiro"
          />
          <InfoItem
            icon={BadgeDollarSign}
            title="Envío gratis"
            subtitle="En compras mayores a $65.000"
          />
        </div>
      </div>
    </section>
  );
}
