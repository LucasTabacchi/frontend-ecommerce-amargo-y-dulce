import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { requireServerAuthUser } from "@/lib/server/auth-user";
import { getServerCustomerOrderById } from "@/lib/server/shop-data";
import { RetryPaymentButton } from "./RetryPaymentButton";

type TrackingStep = {
  key: "pending" | "paid" | "shipped" | "delivered";
  label: string;
};

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

function canRetryPaymentByStatus(status?: string | null) {
  const s = normalizeStatus(status);
  return s === "pending" || s === "failed" || s === "cancelled" || s === "unknown";
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

function Tracking({ status }: { status: string }) {
  const normalizedStatus = normalizeStatus(status);
  const steps: TrackingStep[] = [
    { key: "pending", label: "Pendiente" },
    { key: "paid", label: "Pagado" },
    { key: "shipped", label: "Enviado" },
    { key: "delivered", label: "Entregado" },
  ];

  const activeIndex = steps.findIndex((step) => step.key === normalizedStatus);
  const isBad = normalizedStatus === "failed" || normalizedStatus === "cancelled";

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-neutral-900">Tracking</div>
          <div className="mt-1 text-sm text-neutral-600">
            {isBad ? "Este pedido no pudo completarse." : "Seguimiento simple del estado del pedido."}
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const done = !isBad && index <= Math.max(activeIndex, 0);
          const ring = done ? "ring-neutral-900" : "ring-neutral-200";
          const bg = done ? "bg-neutral-900 text-white" : "bg-white text-neutral-700";

          return (
            <div key={step.key} className="text-center">
              <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full ring-2 ${ring} ${bg}`}>
                {index + 1}
              </div>
              <div className="mt-2 text-xs font-semibold text-neutral-700">{step.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getProductHrefFromItem(item: any) {
  const documentId =
    item?.productDocumentId ?? item?.product_documentId ?? item?.documentId ?? null;
  const cleanDocumentId = String(documentId ?? "").trim();
  if (cleanDocumentId && cleanDocumentId !== "null" && cleanDocumentId !== "undefined") {
    return `/productos/${encodeURIComponent(cleanDocumentId)}`;
  }

  const numericId = Number(item?.productId ?? item?.product_id ?? item?.id ?? null);
  if (Number.isFinite(numericId) && numericId > 0) {
    return `/productos/${numericId}`;
  }

  const title = String(item?.title ?? "").trim();
  if (title) {
    return `/productos?q=${encodeURIComponent(title)}`;
  }

  return "/productos";
}

export default async function PedidoDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireServerAuthUser({
    unauthenticatedRedirect: "/",
    storeAdminRedirect: "/admin/pedidos",
  });
  const order = await getServerCustomerOrderById(params.id, user);

  if (!order) {
    notFound();
  }

  const totalNum =
    typeof order.total === "number" ? order.total : Number(order.total || 0);
  const createdLabel = order.createdAt
    ? new Date(order.createdAt).toLocaleString("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
  const retryOrderId = String(order.documentId || order.id || "").trim();

  return (
    <main>
      <Container>
        <div className="py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-neutral-900">Detalle de pedido</h1>
              <p className="mt-2 text-sm text-neutral-600">Información del pedido.</p>
            </div>

            <Link
              href="/mis-pedidos"
              className="rounded-full border px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              ← Volver a Mis pedidos
            </Link>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Tracking status={String(order.orderStatus || "")} />

            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-600">Pedido</div>
                  <div className="text-xl font-extrabold text-neutral-900 break-words">
                    {order.orderNumber || String(order.documentId || order.id || params.id)}
                  </div>
                  {createdLabel ? <div className="mt-1 text-sm text-neutral-600">{createdLabel}</div> : null}
                </div>
                <StatusPill status={String(order.orderStatus || "")} />
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-600">Total</span>
                  <span className="font-extrabold text-neutral-900 whitespace-nowrap">{formatARS(totalNum)}</span>
                </div>

                {order.shippingAddress?.text ? (
                  <div>
                    <div className="text-neutral-600">Dirección</div>
                    <div className="mt-1 font-semibold text-neutral-900">
                      {String(order.shippingAddress.text)}
                    </div>
                  </div>
                ) : null}

                {order.name || order.email ? (
                  <div>
                    <div className="text-neutral-600">Cliente</div>
                    <div className="mt-1 font-semibold text-neutral-900">
                      {[order.name, order.email].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                ) : null}

                {canRetryPaymentByStatus(order.orderStatus) && retryOrderId ? (
                  <RetryPaymentButton orderId={retryOrderId} />
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 lg:col-span-2">
              <h2 className="text-lg font-extrabold text-neutral-900">Items</h2>

              <div className="mt-4 divide-y">
                {(order.items || []).map((item: any, index: number) => {
                  const title = String(item?.title ?? "Producto");
                  const qty = Number(item?.qty ?? 1);
                  const unit = Number(item?.unit_price ?? item?.unitPrice ?? item?.price ?? 0);
                  const line = qty * unit;
                  const href = getProductHrefFromItem(item);

                  return (
                    <div key={`${title}-${index}`} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <Link
                          href={href}
                          className="font-semibold text-neutral-900 truncate hover:underline"
                          title="Ver producto"
                        >
                          {title}
                        </Link>

                        <div className="mt-1 text-sm text-neutral-600">
                          {qty} × {formatARS(unit)}
                          <span className="mx-2 text-neutral-300">•</span>
                          <Link href={href} className="text-sm font-semibold text-red-700 hover:underline">
                            Ver producto →
                          </Link>
                        </div>
                      </div>

                      <div className="shrink-0 text-sm font-extrabold text-neutral-900">
                        {formatARS(line)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between rounded-xl bg-neutral-50 p-4">
                <span className="text-sm font-semibold text-neutral-700">Total</span>
                <span className="text-base font-extrabold text-neutral-900 whitespace-nowrap">{formatARS(totalNum)}</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
