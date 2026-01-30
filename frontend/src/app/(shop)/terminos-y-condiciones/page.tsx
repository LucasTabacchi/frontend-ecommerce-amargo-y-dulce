import { Container } from "@/components/layout/Container";

export const metadata = {
  title: "Términos y condiciones | Amargo y Dulce",
};

export default function TerminosPage() {
  return (
    <Container className="py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-wide text-neutral-900">
          Términos y condiciones
        </h1>

        <p className="mt-3 text-sm text-neutral-600">
          Última actualización: {new Date().toLocaleDateString("es-AR")}
        </p>

        <div className="mt-8 space-y-6 text-neutral-800">
          <section className="space-y-2">
            <h2 className="text-lg font-bold">1. Introducción</h2>
            <p className="text-sm leading-6">
              Estos términos y condiciones regulan el uso del sitio web y la compra de productos
              ofrecidos por Amargo y Dulce. Al navegar o realizar una compra, aceptás estas condiciones.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">2. Compras y disponibilidad</h2>
            <p className="text-sm leading-6">
              Los productos están sujetos a disponibilidad de stock. Nos reservamos el derecho de
              limitar cantidades y/o cancelar pedidos ante errores de precio o disponibilidad.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">3. Precios y pagos</h2>
            <p className="text-sm leading-6">
              Los precios se muestran en ARS e incluyen impuestos salvo que se indique lo contrario.
              Los pagos se procesan a través de plataformas de terceros (por ejemplo, Mercado Pago).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">4. Envíos y entregas</h2>
            <p className="text-sm leading-6">
              Los plazos de entrega pueden variar según la ubicación y disponibilidad logística.
              La información de envío se mostrará durante el checkout.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">5. Cambios, devoluciones y arrepentimiento</h2>
            <p className="text-sm leading-6">
              Podés solicitar cambios o devoluciones según las políticas vigentes y la normativa aplicable.
              Para ejercer el derecho de arrepentimiento, visitá la sección correspondiente o contactanos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">6. Contacto</h2>
            <p className="text-sm leading-6">
              Si tenés consultas, escribinos a{" "}
              <span className="font-semibold">contacto@amargoydulce.com</span>.
            </p>
          </section>
        </div>
      </div>
    </Container>
  );
}
