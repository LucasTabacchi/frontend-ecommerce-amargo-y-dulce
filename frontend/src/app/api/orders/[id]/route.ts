import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/:id
 *
 * Soporta:
 * - documentId (Strapi v5)
 * - orderNumber (ej: "AMG-0051")
 * - id numérico (legacy)
 *
 * Modos:
 * 1) Con cookie strapi_jwt (usuario logueado):
 *    - Verifica ownership (order.user === me.id) o fallback por email.
 *    - Devuelve datos completos del pedido.
 *
 * 2) Sin cookie (guest / retorno de MP en /gracias):
 *    - Usa STRAPI_TOKEN (server) y devuelve SOLO campos mínimos (sin PII)
 *      para poder mostrar estado sin spamear 401.
 */

function isNumeric(v: string) {
  return /^\d+$/.test(v);
}

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

async function fetchStrapi(url: string, bearer: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

function flattenRow(row: any) {
  // Strapi v4: { id, attributes: {...} }
  // Strapi v5: suele venir "flat" o similar; mantenemos compat.
  return row?.attributes ? { id: row.id, ...row.attributes } : row;
}

function normalizeOrderRow(row: any) {
  const flat = flattenRow(row);
  return {
    data: {
      documentId: flat?.documentId ?? row?.documentId ?? null,
      id: flat?.id ?? row?.id ?? null,
      ...flat,
    },
    raw: row,
  };
}

function pickOwnerInfo(row: any) {
  // v4: row.attributes.user.data.id
  // v5: row.user?.id o row.user?.data?.id (depende)
  const userId =
    row?.user?.id ??
    row?.user?.data?.id ??
    row?.user?.data?.documentId ??
    row?.attributes?.user?.data?.id ??
    row?.attributes?.user?.data?.documentId ??
    null;

  const email = row?.email ?? row?.attributes?.email ?? null;

  return {
    userId: userId != null ? String(userId) : null,
    email: typeof email === "string" ? email.trim().toLowerCase() : null,
  };
}

/** Campos seguros para modo "guest" (sin PII) */
function pickSafePublicFields(row: any) {
  const flat = flattenRow(row);
  return {
    documentId: flat?.documentId ?? row?.documentId ?? null,
    id: flat?.id ?? row?.id ?? null,

    orderNumber: flat?.orderNumber ?? null,
    orderStatus: flat?.orderStatus ?? null,

    mpStatus: flat?.mpStatus ?? null,
    mpStatusDetail: flat?.mpStatusDetail ?? null,
    mpPaymentId: flat?.mpPaymentId ?? null,
    mpMerchantOrderId: flat?.mpMerchantOrderId ?? null,
    mpExternalReference: flat?.mpExternalReference ?? null,

    total: flat?.total ?? null,
    subtotal: flat?.subtotal ?? null,
    discountTotal: flat?.discountTotal ?? null,
    coupon: flat?.coupon ?? null,

    createdAt: flat?.createdAt ?? null,
    updatedAt: flat?.updatedAt ?? null,
  };
}

function buildFieldsQuerySafe() {
  // pedimos solo fields mínimos (sin populate) para guest
  const q = new URLSearchParams();
  const fields = [
    "documentId",
    "orderNumber",
    "orderStatus",
    "mpStatus",
    "mpStatusDetail",
    "mpPaymentId",
    "mpMerchantOrderId",
    "mpExternalReference",
    "total",
    "subtotal",
    "discountTotal",
    "coupon",
    "createdAt",
    "updatedAt",
  ];

  fields.forEach((f, i) => q.set(`fields[${i}]`, f));
  q.set("pagination[pageSize]", "1");
  return q;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );

  const idOrNumber = String(params.id || "").trim();
  if (!idOrNumber) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  // Tokens
  const jwt = cookies().get("strapi_jwt")?.value || null;
  const serverToken = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || null;

  // Helpers de respuesta
  const returnFull = (row: any) => {
    const normalized = normalizeOrderRow(row);
    return NextResponse.json({ data: normalized.data }, { status: 200 });
  };

  const returnSafe = (row: any) => {
    const safe = pickSafePublicFields(row);
    return NextResponse.json({ data: safe }, { status: 200 });
  };

  // =========================
  // MODO 1: LOGUEADO (JWT)
  // =========================
  if (jwt) {
    // 0) Usuario logueado
    const meRes = await fetchStrapi(`${strapiBase}/api/users/me`, jwt);
    if (!meRes.res.ok) {
      // si el jwt está roto/expirado, caemos a guest (si hay serverToken) para que /gracias no explote
      if (!serverToken) {
        return NextResponse.json(
          { error: "JWT inválido o expirado", status: meRes.res.status, details: meRes.json },
          { status: 401 }
        );
      }
    }

    const me = meRes.json;
    const meId = me?.id != null ? String(me.id) : null;
    const meEmail = typeof me?.email === "string" ? me.email.trim().toLowerCase() : null;

    async function authorizeAndReturn(row: any) {
      const { userId, email } = pickOwnerInfo(row);

      const okByUser = !!meId && !!userId && userId === meId;
      const okByEmail = !!meEmail && !!email && email === meEmail;

      if (!okByUser && !okByEmail) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return returnFull(row);
    }

    // 1) Intento directo por documentId usando JWT
    {
      const url = `${strapiBase}/api/orders/${encodeURIComponent(idOrNumber)}?populate=*`;
      const { res, json } = await fetchStrapi(url, jwt);

      if (res.ok && json?.data) return authorizeAndReturn(json.data);

      // si es 401/403 por permisos, intentamos fallback con serverToken (si existe) y seguimos chequeando ownership con me
      const canFallback = (res.status === 401 || res.status === 403) && !!serverToken;
      if (!res.ok && res.status !== 404 && !canFallback) {
        return NextResponse.json(
          { error: "Strapi error", status: res.status, details: json },
          { status: res.status }
        );
      }

      if (canFallback) {
        const fb = await fetchStrapi(url, serverToken!);
        if (fb.res.ok && fb.json?.data) return authorizeAndReturn(fb.json.data);
      }
    }

    // 2) Buscar por orderNumber usando JWT
    {
      const q = new URLSearchParams();
      q.set("filters[orderNumber][$eq]", idOrNumber);
      q.set("pagination[pageSize]", "1");
      q.set("populate", "*");

      const url = `${strapiBase}/api/orders?${q.toString()}`;
      const { res, json } = await fetchStrapi(url, jwt);

      if (res.ok) {
        const row = json?.data?.[0];
        if (row) return authorizeAndReturn(row);
      } else {
        const canFallback = (res.status === 401 || res.status === 403) && !!serverToken;
        if (!canFallback) {
          return NextResponse.json(
            { error: "Strapi error", status: res.status, details: json },
            { status: res.status }
          );
        }
        const fb = await fetchStrapi(url, serverToken!);
        if (fb.res.ok) {
          const row = fb.json?.data?.[0];
          if (row) return authorizeAndReturn(row);
        }
      }
    }

    // 3) Fallback por id numérico
    if (isNumeric(idOrNumber)) {
      const q = new URLSearchParams();
      q.set("filters[id][$eq]", idOrNumber);
      q.set("pagination[pageSize]", "1");
      q.set("populate", "*");

      const url = `${strapiBase}/api/orders?${q.toString()}`;
      const { res, json } = await fetchStrapi(url, jwt);

      if (res.ok) {
        const row = json?.data?.[0];
        if (row) return authorizeAndReturn(row);
      } else {
        const canFallback = (res.status === 401 || res.status === 403) && !!serverToken;
        if (!canFallback) {
          return NextResponse.json(
            { error: "Strapi error", status: res.status, details: json },
            { status: res.status }
          );
        }
        const fb = await fetchStrapi(url, serverToken!);
        if (fb.res.ok) {
          const row = fb.json?.data?.[0];
          if (row) return authorizeAndReturn(row);
        }
      }
    }

    return NextResponse.json({ error: "Order not found", id: idOrNumber }, { status: 404 });
  }

  // =========================
  // MODO 2: GUEST (SIN JWT)
  // =========================
  if (!serverToken) {
    // Sin jwt y sin token server: no se puede consultar nada
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const fieldsQ = buildFieldsQuerySafe();

  // 1) documentId directo
  {
    const url = `${strapiBase}/api/orders/${encodeURIComponent(idOrNumber)}?${fieldsQ.toString()}`;
    const { res, json } = await fetchStrapi(url, serverToken);

    if (res.ok && json?.data) return returnSafe(json.data);

    if (!res.ok && res.status !== 404) {
      return NextResponse.json(
        { error: "Strapi error", status: res.status, details: json },
        { status: res.status }
      );
    }
  }

  // 2) orderNumber
  {
    const q = buildFieldsQuerySafe();
    q.set("filters[orderNumber][$eq]", idOrNumber);

    const url = `${strapiBase}/api/orders?${q.toString()}`;
    const { res, json } = await fetchStrapi(url, serverToken);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Strapi error", status: res.status, details: json },
        { status: res.status }
      );
    }

    const row = json?.data?.[0];
    if (row) return returnSafe(row);
  }

  // 3) id numérico legacy
  if (isNumeric(idOrNumber)) {
    const q = buildFieldsQuerySafe();
    q.set("filters[id][$eq]", idOrNumber);

    const url = `${strapiBase}/api/orders?${q.toString()}`;
    const { res, json } = await fetchStrapi(url, serverToken);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Strapi error", status: res.status, details: json },
        { status: res.status }
      );
    }

    const row = json?.data?.[0];
    if (row) return returnSafe(row);
  }

  return NextResponse.json({ error: "Order not found", id: idOrNumber }, { status: 404 });
}
