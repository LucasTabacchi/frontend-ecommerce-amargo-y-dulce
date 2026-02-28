import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_NEXT_STATUSES = new Set(["shipped", "delivered"]);
const STATUS_TRANSITIONS: Record<string, string[]> = {
  paid: ["shipped"],
  shipped: ["delivered"],
};

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function readUserJwtFromCookies() {
  const jar = cookies();
  return (
    jar.get("strapi_jwt")?.value ||
    jar.get("jwt")?.value ||
    jar.get("token")?.value ||
    jar.get("access_token")?.value ||
    null
  );
}

function isOrderNumber(v: string) {
  return /^AMG-\d{1,}$/i.test(v.trim());
}

function isNumeric(v: string) {
  return /^\d+$/.test(v.trim());
}

function flattenStrapiRow(row: any) {
  if (!row) return null;
  if (row?.attributes) {
    return {
      id: row?.id ?? null,
      documentId:
        row?.documentId ??
        row?.attributes?.documentId ??
        row?.attributes?.document_id ??
        null,
      ...row.attributes,
    };
  }
  return row;
}

function normalizeOrderStatus(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function isStoreAdmin(user: any) {
  return (
    user?.isStoreAdmin === true ||
    user?.isStoreAdmin === 1 ||
    user?.isStoreAdmin === "true"
  );
}

async function fetchJson(url: string, init: RequestInit) {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const json = await r.json().catch(() => null);
  return { r, json };
}

async function findOrderByIdentifier(params: {
  strapiBase: string;
  token: string;
  idOrNumber: string;
}) {
  const { strapiBase, token, idOrNumber } = params;

  const wanted = String(idOrNumber ?? "").trim();
  if (!wanted) return { ok: false as const, status: 400, json: { error: "Falta id" } };

  const sp = new URLSearchParams();
  sp.set("populate", "*");
  sp.set("pagination[pageSize]", "1");

  if (isOrderNumber(wanted)) {
    sp.set("filters[orderNumber][$eq]", wanted);
  } else if (isNumeric(wanted)) {
    sp.set("filters[$or][0][documentId][$eq]", wanted);
    sp.set("filters[$or][1][id][$eq]", wanted);
  } else {
    sp.set("filters[documentId][$eq]", wanted);
  }

  const { r, json } = await fetchJson(`${strapiBase}/api/orders?${sp.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) return { ok: false as const, status: r.status, json };

  const row = Array.isArray(json?.data) ? json.data[0] : null;
  if (!row) return { ok: false as const, status: 404, json: { error: "Order not found" } };

  return { ok: true as const, data: flattenStrapiRow(row) };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const jwt = readUserJwtFromCookies();
  if (!jwt) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );

  const body = await req.json().catch(() => null);
  const requestedNextStatus = normalizeOrderStatus(body?.nextStatus ?? body?.orderStatus);

  if (!VALID_NEXT_STATUSES.has(requestedNextStatus)) {
    return NextResponse.json(
      { error: "Estado objetivo inválido", allowed: Array.from(VALID_NEXT_STATUSES) },
      { status: 400 }
    );
  }

  const meRes = await fetchJson(`${strapiBase}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!meRes.r.ok || !meRes.json) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isStoreAdmin(meRes.json)) {
    return NextResponse.json({ error: "Forbidden: requiere isStoreAdmin" }, { status: 403 });
  }

  const serverToken = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN;
  if (!serverToken) {
    return NextResponse.json({ error: "Falta STRAPI_TOKEN/STRAPI_API_TOKEN" }, { status: 500 });
  }

  const orderRes = await findOrderByIdentifier({
    strapiBase,
    token: serverToken,
    idOrNumber: String(params.id ?? "").trim(),
  });

  if (!orderRes.ok) {
    return NextResponse.json(
      { error: orderRes.json?.error || "No se pudo leer la orden", details: orderRes.json },
      { status: orderRes.status || 500 }
    );
  }

  const order = orderRes.data;
  const currentStatus = normalizeOrderStatus(order?.orderStatus);
  const allowedNext = STATUS_TRANSITIONS[currentStatus] ?? [];

  if (!allowedNext.includes(requestedNextStatus)) {
    return NextResponse.json(
      {
        error: "Transición de estado no permitida",
        currentStatus,
        requestedNextStatus,
        allowedNext,
      },
      { status: 409 }
    );
  }

  const targetId = String(order?.documentId ?? order?.id ?? "").trim();
  if (!targetId) {
    return NextResponse.json({ error: "La orden no tiene identificador actualizable" }, { status: 500 });
  }

  const upd = await fetchJson(`${strapiBase}/api/orders/${encodeURIComponent(targetId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${serverToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: { orderStatus: requestedNextStatus },
    }),
  });

  if (!upd.r.ok) {
    return NextResponse.json(
      { error: "No se pudo actualizar la orden", details: upd.json },
      { status: upd.r.status || 500 }
    );
  }

  return NextResponse.json({ ok: true, data: flattenStrapiRow(upd.json?.data) }, { status: 200 });
}
