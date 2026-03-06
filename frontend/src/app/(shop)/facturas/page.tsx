import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { requireServerAuthUser } from "@/lib/server/auth-user";
import { getServerCustomerInvoicesPaginated } from "@/lib/server/shop-data";
import type { ServerInvoice } from "@/lib/server/shop-data";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function parsePageSize(value: string | string[] | undefined, fallback = 10) {
  const requested = parsePositiveInt(value, fallback);
  return PAGE_SIZE_OPTIONS.includes(requested as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requested
    : fallback;
}

function buildPageHref(page: number, pageSize: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (pageSize !== PAGE_SIZE_OPTIONS[0]) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query ? `/facturas?${query}` : "/facturas";
}

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function PaginationControls(props: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const { page, pageCount, total, pageSize } = props;
  const canPrev = page > 1;
  const canNext = pageCount > 0 && page < pageCount;

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-neutral-600">
        Página {pageCount > 0 ? page : 0} de {pageCount} · {total} recibos
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="page" value="1" />
          <label htmlFor="invoices-page-size" className="text-sm text-neutral-600">
            Por página
          </label>
          <select
            id="invoices-page-size"
            name="pageSize"
            defaultValue={String(pageSize)}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800"
          >
            Aplicar
          </button>
        </form>

        <div className="flex items-center gap-2">
          {canPrev ? (
            <Link
              href={buildPageHref(page - 1, pageSize)}
              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800"
            >
              Anterior
            </Link>
          ) : (
            <span className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-400">
              Anterior
            </span>
          )}

          {canNext ? (
            <Link
              href={buildPageHref(page + 1, pageSize)}
              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800"
            >
              Siguiente
            </Link>
          ) : (
            <span className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-400">
              Siguiente
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function FacturasPage({
  searchParams,
}: {
  searchParams?: { page?: string | string[]; pageSize?: string | string[] };
}) {
  const requestedPage = parsePositiveInt(searchParams?.page, 1);
  const requestedPageSize = parsePageSize(searchParams?.pageSize, 10);
  const user = await requireServerAuthUser({
    unauthenticatedRedirect: "/",
    storeAdminRedirect: "/admin/pedidos",
  });
  const pagination = await getServerCustomerInvoicesPaginated(user, {
    page: requestedPage,
    pageSize: requestedPageSize,
  });
  const invoices: ServerInvoice[] = pagination.items;

  if (pagination.total > 0 && pagination.pageCount > 0 && requestedPage > pagination.pageCount) {
    redirect(buildPageHref(pagination.pageCount, requestedPageSize));
  }

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

        {invoices.length > 0 ? (
          <PaginationControls
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            pageSize={pagination.pageSize}
          />
        ) : null}

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

        {invoices.length > 0 ? (
          <PaginationControls
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            pageSize={pagination.pageSize}
          />
        ) : null}
      </Container>
    </main>
  );
}
