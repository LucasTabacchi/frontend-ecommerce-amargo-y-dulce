import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { requireServerAuthUser } from "@/lib/server/auth-user";
import { getServerCustomerOrdersPaginated } from "@/lib/server/shop-data";
import type { ServerOrder } from "@/lib/server/shop-data";

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
  return query ? `/mis-pedidos?${query}` : "/mis-pedidos";
}

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function normalizeStatus(s?: string | null) {
  const v = String(s || "").toLowerCase();
  if (v === "paid") return "paid";
  if (v === "pending") return "pending";
  if (v === "shipped") return "shipped";
  if (v === "delivered") return "delivered";
  if (v === "failed") return "failed";
  if (v === "cancelled") return "cancelled";
  return "unknown";
}

function StatusPill({ status }: { status: string }) {
  const s = normalizeStatus(status);
  const cls =
    s === "paid"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : s === "pending"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : s === "shipped"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : s === "delivered"
      ? "bg-violet-50 text-violet-700 ring-violet-200"
      : s === "failed" || s === "cancelled"
      ? "bg-red-50 text-red-700 ring-red-200"
      : "bg-neutral-50 text-neutral-700 ring-neutral-200";

  const label =
    s === "paid"
      ? "Pagado"
      : s === "pending"
      ? "Pendiente"
      : s === "shipped"
      ? "Enviado"
      : s === "delivered"
      ? "Entregado"
      : s === "failed"
      ? "Fallido"
      : s === "cancelled"
      ? "Cancelado"
      : "—";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {label}
    </span>
  );
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
    <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border bg-white p-4 text-center shadow-sm md:flex-row md:items-center md:justify-between md:text-left">
      <div className="text-sm text-neutral-600">
        Página {pageCount > 0 ? page : 0} de {pageCount} · {total} pedidos
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:items-center">
        <form method="get" className="flex flex-wrap items-center justify-center gap-2">
          <input type="hidden" name="page" value="1" />
          <label htmlFor="orders-page-size" className="text-sm text-neutral-600">
            Por página
          </label>
          <select
            id="orders-page-size"
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

        <div className="flex items-center justify-center gap-2">
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

export default async function MisPedidosPage({
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
  const pagination = await getServerCustomerOrdersPaginated(user, {
    page: requestedPage,
    pageSize: requestedPageSize,
  });
  const orders: ServerOrder[] = pagination.items;

  if (pagination.total > 0 && pagination.pageCount > 0 && requestedPage > pagination.pageCount) {
    redirect(buildPageHref(pagination.pageCount, requestedPageSize));
  }

  return (
    <main>
      <Container>
        <div className="py-10">
          <h1 className="text-3xl font-extrabold text-neutral-900">Mis pedidos</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Estos son tus pedidos asociados a tu cuenta.
          </p>

          {orders.length === 0 ? (
            <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-neutral-700">
              Todavía no tenés pedidos.
            </div>
          ) : (
            <>
              <div className="mt-8 space-y-4">
                {orders.map((order) => {
                  const totalNum =
                    typeof order.total === "number" ? order.total : Number(order.total || 0);

                  const date = order.createdAt ? new Date(order.createdAt) : null;
                  const dateLabel = date
                    ? date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })
                    : "";

                  return (
                    <Link
                      key={String(order.id)}
                      href={`/mis-pedidos/${encodeURIComponent(String(order.id))}`}
                      className="block rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm text-neutral-600">Pedido</div>
                          <div className="text-base font-extrabold text-neutral-900 break-words">
                            {order.orderNumber || String(order.id)}
                          </div>
                          {dateLabel ? (
                            <div className="mt-1 text-sm text-neutral-600">{dateLabel}</div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3">
                          <StatusPill status={String(order.orderStatus || "")} />
                          <div className="text-right">
                            <div className="text-sm text-neutral-600">Total</div>
                            <div className="text-base font-extrabold text-neutral-900 whitespace-nowrap">
                              {formatARS(totalNum)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 text-sm font-semibold text-red-700 opacity-80">
                        Ver detalle →
                      </div>
                    </Link>
                  );
                })}
              </div>

              <PaginationControls
                page={pagination.page}
                pageCount={pagination.pageCount}
                total={pagination.total}
                pageSize={pagination.pageSize}
              />
            </>
          )}

          <div className="mt-10">
            <Link href="/" className="text-sm underline text-neutral-700">
              Volver a la tienda
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
