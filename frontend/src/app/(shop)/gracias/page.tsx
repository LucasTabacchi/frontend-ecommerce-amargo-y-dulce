import { getServerAuthUser } from "@/lib/server/auth-user";
import { getServerCustomerOrderById } from "@/lib/server/shop-data";
import GraciasPageClient from "./page.client";

type StatusKind = "success" | "pending" | "failure" | "unknown";

function normalizeStatus(s?: string | null): StatusKind {
  const v = String(s || "").toLowerCase();
  if (v === "success" || v === "approved") return "success";
  if (v === "pending" || v === "in_process") return "pending";
  if (v === "failure" || v === "rejected") return "failure";
  return "unknown";
}

function mapOrderStatusToUi(orderStatus: string | null | undefined): StatusKind {
  const s = String(orderStatus ?? "").toLowerCase();
  if (s === "paid") return "success";
  if (s === "failed" || s === "cancelled") return "failure";
  if (s) return "pending";
  return "pending";
}

export default async function GraciasPage({
  searchParams,
}: {
  searchParams?: {
    orderId?: string;
    external_reference?: string;
    status?: string;
  };
}) {
  const orderId = String(searchParams?.orderId || "").trim();
  const externalRef = String(searchParams?.external_reference || "").trim();
  const fallbackStatus = normalizeStatus(searchParams?.status);

  const user = await getServerAuthUser();
  const order =
    orderId && user && !user.isStoreAdmin
      ? await getServerCustomerOrderById(orderId, user)
      : null;

  const initialStatus = order
    ? mapOrderStatusToUi(order.orderStatus)
    : fallbackStatus;
  const initialOrderNumber =
    typeof order?.orderNumber === "string" ? order.orderNumber : "";

  return (
    <GraciasPageClient
      initialOrderId={orderId}
      initialExternalRef={externalRef}
      initialStatus={initialStatus}
      initialOrderNumber={initialOrderNumber}
    />
  );
}
