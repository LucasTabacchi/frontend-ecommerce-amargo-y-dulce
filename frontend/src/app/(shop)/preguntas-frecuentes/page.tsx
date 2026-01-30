import { Container } from "@/components/layout/Container";

export const metadata = {
  title: "Preguntas frecuentes | Amargo y Dulce",
};

const FAQS = [
  {
    q: "¿Cuánto tarda en llegar mi pedido?",
    a: "Depende de tu ubicación y la disponibilidad. En general AMBA 24 a 72 hs hábiles e interior 3 a 7 días hábiles.",
  },
  {
    q: "¿Puedo retirar en persona?",
    a: "Si hay puntos de retiro habilitados, te aparecerán como opción durante el checkout.",
  },
  {
    q: "¿Qué medios de pago aceptan?",
    a: "Podés pagar con únicamente con Mercado Pago.",
  },
  {
    q: "¿Puedo cancelar una compra?",
    a: "Si el pedido no fue despachado, podés contactarnos para gestionarlo. También podés ejercer el derecho de arrepentimiento según corresponda.",
  },
  {
    q: "¿Cómo hago un reclamo o sugerencia?",
    a: "Podés usar el Libro de Quejas Online desde el footer o escribirnos a contacto@amargoydulce.com.",
  },
];

export default function PreguntasFrecuentesPage() {
  return (
    <Container className="py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-wide text-neutral-900">
          Preguntas frecuentes
        </h1>

        <div className="mt-8 space-y-4">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="rounded-lg bg-neutral-50 p-4 ring-1 ring-neutral-200"
            >
              <summary className="cursor-pointer select-none text-sm font-semibold text-neutral-900">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Container>
  );
}
