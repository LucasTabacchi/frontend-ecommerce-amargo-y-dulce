import { Container } from "@/components/layout/Container";

export const metadata = {
  title: "Política de privacidad | Amargo y Dulce",
};

export default function PrivacidadPage() {
  return (
    <Container className="py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-wide text-neutral-900">
          Política de privacidad
        </h1>

        <p className="mt-3 text-sm text-neutral-600">
          Última actualización: {new Date().toLocaleDateString("es-AR")}
        </p>

        <div className="mt-8 space-y-6 text-neutral-800">
          <section className="space-y-2">
            <h2 className="text-lg font-bold">1. Datos que recopilamos</h2>
            <p className="text-sm leading-6">
              Podemos recopilar información como nombre, email, teléfono, DNI (si corresponde),
              direcciones de entrega y datos de compra para gestionar pedidos y atención al cliente.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">2. Uso de la información</h2>
            <p className="text-sm leading-6">
              Usamos los datos para procesar compras, coordinar envíos, emitir comprobantes,
              enviar notificaciones sobre tu pedido y mejorar la experiencia del sitio.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">3. Servicios de terceros</h2>
            <p className="text-sm leading-6">
              Algunos servicios (por ejemplo, pasarelas de pago) pueden procesar datos según sus
              propias políticas. No almacenamos datos sensibles de tarjeta.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">4. Cookies</h2>
            <p className="text-sm leading-6">
              Podemos utilizar cookies para mejorar la navegación y analizar el uso del sitio.
              Podés gestionar cookies desde tu navegador.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">5. Derechos del usuario</h2>
            <p className="text-sm leading-6">
              Podés solicitar acceso, actualización o eliminación de tus datos personales según
              la normativa aplicable.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">6. Contacto</h2>
            <p className="text-sm leading-6">
              Para consultas sobre privacidad escribinos a{" "}
              <span className="font-semibold">contacto@amargoydulce.com</span>.
            </p>
          </section>
        </div>
      </div>
    </Container>
  );
}
