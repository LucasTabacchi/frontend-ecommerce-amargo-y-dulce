import { Container } from "@/components/layout/Container";

export const metadata = {
  title: "Envíos | Amargo y Dulce",
};

export default function EnviosPage() {
  return (
    <Container className="py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-wide text-neutral-900">
          Envíos
        </h1>

        <p className="mt-4 text-sm leading-6 text-neutral-700">
          Acá vas a encontrar información sobre zonas de entrega, tiempos estimados
          y costos de envío. Los plazos pueden variar según disponibilidad y demanda.
        </p>

        <div className="mt-8 space-y-6 text-neutral-800">
          <section className="space-y-2">
            <h2 className="text-lg font-bold">Zonas de entrega</h2>
            <p className="text-sm leading-6">
              Realizamos envíos a domicilio y/o puntos de retiro según disponibilidad.
              Durante el checkout vas a ver las opciones habilitadas para tu dirección.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">Tiempos de entrega</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
              <li>AMBA: 24 a 72 hs hábiles (estimado).</li>
              <li>Interior: 3 a 7 días hábiles (estimado).</li>
            </ul>
            <p className="text-sm leading-6 text-neutral-700">
              Los tiempos son estimativos y pueden variar en fechas especiales.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">Costo de envío</h2>
            <p className="text-sm leading-6">
              El costo se calcula en el checkout según tu ubicación y el total del pedido.
              Podés tener envío bonificado en promociones puntuales.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">Seguimiento</h2>
            <p className="text-sm leading-6">
              Si tu pedido tiene seguimiento, vas a poder verlo en
              “Mis pedidos” cuando esté disponible.
            </p>
          </section>
        </div>
      </div>
    </Container>
  );
}
