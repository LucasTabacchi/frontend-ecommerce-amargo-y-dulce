import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { requireServerAuthUser } from "@/lib/server/auth-user";
import { getServerCustomerInvoices } from "@/lib/server/shop-data";
import type { ServerInvoice } from "@/lib/server/shop-data";

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export default async function FacturasPage() {
  const user = await requireServerAuthUser({
    unauthenticatedRedirect: "/",
    storeAdminRedirect: "/admin/pedidos",
  });
  const invoices: ServerInvoice[] = await getServerCustomerInvoices(user);

  return (
    <main>
      <Container className="py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900">
              Mis recibos
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Acá podés descargar tus comprobantes en PDF.
            </p>
          </div>

          <Link href="/mi-perfil" prefetch={false} className="text-sm font-semibold underline">
            Volver a mi perfil
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          {invoices.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Todavía no tenés facturas. Cuando una compra quede como <b>pagada</b>, vas a ver el comprobante acá.
            </p>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice, idx) => {
                const downloadHref =
                  invoice.id != null
                    ? `/api/invoices/download/${encodeURIComponent(String(invoice.id))}`
                    : null;

                return (
                  <div
                    key={String(invoice.id ?? invoice.number ?? idx)}
                    className="rounded-xl border border-neutral-200 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-extrabold text-neutral-900">
                          {invoice.number ? `Recibo ${invoice.number}` : "Factura"}
                        </div>
                        <div className="mt-1 text-sm text-neutral-600">
                          {invoice.orderNumber ? `Pedido ${invoice.orderNumber}` : ""}
                          {invoice.issuedAt
                            ? ` • ${new Date(invoice.issuedAt).toLocaleString("es-AR")}`
                            : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-neutral-900">
                          {typeof invoice.total === "number"
                            ? formatARS(invoice.total)
                            : invoice.total != null
                            ? String(invoice.total)
                            : ""}
                        </div>

                        {downloadHref ? (
                          <a
                            href={downloadHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
                          >
                            Descargar PDF
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-500">PDF pendiente</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
