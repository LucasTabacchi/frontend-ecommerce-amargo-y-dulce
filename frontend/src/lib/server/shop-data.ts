import "server-only";

import {
  getServerAuthUser,
  getServerUserJwt,
  getStrapiBase,
  type ServerAuthUser,
} from "@/lib/server/auth-user";

export type ServerAddress = {
  id: string | number | null;
  documentId: string | null;
  numericId: number | null;
  label?: string | null;
  fullName?: string | null;
  phone?: string | null;
  street?: string | null;
  number?: string | null;
  floor?: string | null;
  apartment?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  notes?: string | null;
  isDefault?: boolean | null;
};

export type ServerOrder = {
  id: string | number | null;
  documentId?: string | null;
  orderNumber?: string | null;
  orderStatus?: string | null;
  total?: number | string | null;
  createdAt?: string | null;
  shippingMethod?: string | null;
  shippingCost?: number | string | null;
  pickupPoint?: string | null;
  shippingAddress?: any;
  items?: any[] | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ServerInvoice = {
  id: string | number | null;
  number: string | null;
  total: number | string | null;
  issuedAt: string | null;
  pdfUrl: string | null;
  orderNumber?: string | null;
};

export type ServerReview = {
  id: number | string;
  rating: number;
  title?: string;
  text?: string;
  name?: string;
  createdAt?: string;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

function getServerToken() {
  return process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || null;
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text().catch(() => "");

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text || null };
  }

  return { response, json };
}

function flattenAny(row: any) {
  if (!row) return null;
  if (row?.attributes) {
    return { id: row.id ?? null, documentId: row.documentId ?? null, ...row.attributes };
  }
  return row;
}

function pickField(row: any, key: string) {
  return row?.[key] ?? row?.attributes?.[key] ?? null;
}

function pickIdForOps(row: any) {
  return (
    row?.documentId ??
    row?.attributes?.documentId ??
    row?.id ??
    row?.attributes?.id ??
    null
  );
}

function normalizeAddress(row: any): ServerAddress {
  const flat = flattenAny(row);
  const documentId =
    typeof flat?.documentId === "string" ? flat.documentId : null;
  const numericId = Number(flat?.id);

  return {
    ...flat,
    id: documentId ?? (Number.isFinite(numericId) ? numericId : flat?.id ?? null),
    documentId,
    numericId: Number.isFinite(numericId) && numericId > 0 ? numericId : null,
  };
}

function toAbsStrapiUrl(strapiBase: string, maybeUrl: any) {
  const url = typeof maybeUrl === "string" ? maybeUrl.trim() : "";
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${strapiBase}${url.startsWith("/") ? "" : "/"}${url}`;
}

function pickPdfUrl(strapiBase: string, pdfField: any) {
  const node = pdfField?.data ?? pdfField;
  const row = Array.isArray(node) ? node[0] : node;
  const flat = flattenAny(row);
  return toAbsStrapiUrl(strapiBase, flat?.url);
}

function extractOrderNumberFromInvoiceNumber(invoiceNumber: any): string | null {
  const raw = String(invoiceNumber ?? "").trim();
  if (!raw) return null;
  const match = /(AMG-\d{4,})/i.exec(raw);
  return match?.[1] ? match[1].toUpperCase() : null;
}

function normalizePage(value: number | string | null | undefined, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function normalizePageSize(value: number | string | null | undefined, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(50, Math.max(5, Math.floor(parsed)));
}

function buildPaginationMeta(meta: any, page: number, pageSize: number, totalFallback: number) {
  const safePage = normalizePage(meta?.page, page);
  const safePageSize = normalizePageSize(meta?.pageSize, pageSize);
  const safeTotal = Math.max(0, Number(meta?.total ?? totalFallback) || 0);
  const safePageCount =
    Math.max(0, Number(meta?.pageCount) || 0) ||
    (safeTotal > 0 ? Math.ceil(safeTotal / safePageSize) : 0);

  return {
    page: safePage,
    pageSize: safePageSize,
    total: safeTotal,
    pageCount: safePageCount,
  };
}

async function fetchUserScopedJson(path: string, init: RequestInit = {}) {
  const jwt = getServerUserJwt();
  const strapiBase = getStrapiBase();
  if (!jwt || !strapiBase) return { ok: false, status: 401, json: null };

  const { response, json } = await fetchJson(`${strapiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(init.headers ?? {}),
    },
  });

  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

async function fetchServerScopedJson(path: string, init: RequestInit = {}) {
  const token = getServerToken();
  const strapiBase = getStrapiBase();
  if (!token || !strapiBase) return { ok: false, status: 500, json: null };

  const { response, json } = await fetchJson(`${strapiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

async function resolveCustomer(user?: ServerAuthUser | null) {
  const viewer = user ?? (await getServerAuthUser());
  if (!viewer || viewer.isStoreAdmin) return null;
  return viewer;
}

export async function getServerAddresses(user?: ServerAuthUser | null) {
  const viewer = await resolveCustomer(user);
  if (!viewer) return [] as ServerAddress[];

  const params = new URLSearchParams();
  params.set("pagination[pageSize]", "100");
  params.set("sort[0]", "isDefault:desc");
  params.append("sort[1]", "createdAt:desc");

  const result = await fetchUserScopedJson(`/api/addresses?${params.toString()}`);
  if (!result.ok) return [] as ServerAddress[];

  const list = Array.isArray(result.json?.data) ? result.json.data : [];
  return list.map(normalizeAddress);
}

export async function getServerCustomerOrders(user?: ServerAuthUser | null) {
  const result = await getServerCustomerOrdersPaginated(user, { page: 1, pageSize: 50 });
  return result.items;
}

export async function getServerCustomerOrdersPaginated(
  user?: ServerAuthUser | null,
  options?: { page?: number; pageSize?: number }
): Promise<PaginatedResult<ServerOrder>> {
  const viewer = await resolveCustomer(user);
  const page = normalizePage(options?.page, 1);
  const pageSize = normalizePageSize(options?.pageSize, 10);
  if (!viewer) {
    return { items: [], page, pageSize, total: 0, pageCount: 0 };
  }

  const params = new URLSearchParams();
  params.set("pagination[page]", String(page));
  params.set("pagination[pageSize]", String(pageSize));
  params.set("sort[0]", "createdAt:desc");
  params.set("populate", "*");

  if (viewer.documentId) {
    params.set("filters[user][documentId][$eq]", viewer.documentId);
  } else {
    params.set("filters[user][id][$eq]", String(viewer.id));
  }

  const result = await fetchUserScopedJson(`/api/orders?${params.toString()}`);
  if (!result.ok) {
    return { items: [], page, pageSize, total: 0, pageCount: 0 };
  }

  const rows = Array.isArray(result.json?.data) ? result.json.data : [];
  const items = rows.map((row: any) => ({
    id: pickIdForOps(row),
    documentId:
      typeof row?.documentId === "string"
        ? row.documentId
        : typeof row?.attributes?.documentId === "string"
        ? row.attributes.documentId
        : null,
    orderNumber: pickField(row, "orderNumber"),
    orderStatus: pickField(row, "orderStatus"),
    total: pickField(row, "total"),
    createdAt: pickField(row, "createdAt"),
    shippingMethod: pickField(row, "shippingMethod"),
    shippingCost: pickField(row, "shippingCost"),
    pickupPoint: pickField(row, "pickupPoint"),
    shippingAddress: pickField(row, "shippingAddress"),
    items: pickField(row, "items"),
    name: pickField(row, "name"),
    email: pickField(row, "email"),
    phone: pickField(row, "phone"),
  }));

  return {
    items,
    ...buildPaginationMeta(result.json?.meta?.pagination, page, pageSize, items.length),
  };
}

export async function getServerCustomerOrderById(
  idOrNumber: string,
  user?: ServerAuthUser | null
): Promise<ServerOrder | null> {
  const wanted = String(idOrNumber || "").trim();
  if (!wanted) return null;

  const orders = await getServerCustomerOrders(user);
  const wantedLower = wanted.toLowerCase();

  return (
    orders.find((order: ServerOrder) => {
      const orderNumber = String(order.orderNumber ?? "").trim().toLowerCase();
      const documentId = String(order.documentId ?? "").trim();
      const id = String(order.id ?? "").trim();

      return orderNumber === wantedLower || documentId === wanted || id === wanted;
    }) ?? null
  );
}

async function getMyOrderNumbers(user: ServerAuthUser) {
  const token = getServerToken();
  if (!token) return new Set<string>();

  const byDocumentId = user.documentId
    ? await fetchServerScopedJson(
        `/api/orders?pagination[pageSize]=200&fields[0]=orderNumber&filters[user][documentId][$eq]=${encodeURIComponent(
          user.documentId
        )}`
      )
    : null;

  const byId =
    !byDocumentId?.ok
      ? await fetchServerScopedJson(
          `/api/orders?pagination[pageSize]=200&fields[0]=orderNumber&filters[user][id][$eq]=${encodeURIComponent(
            String(user.id)
          )}`
        )
      : null;

  const source = byDocumentId?.ok ? byDocumentId : byId;
  const rows = Array.isArray(source?.json?.data) ? source?.json?.data : [];
  const out = new Set<string>();

  for (const row of rows) {
    const flat = flattenAny(row);
    const orderNumber =
      typeof flat?.orderNumber === "string" ? flat.orderNumber.trim() : "";
    if (orderNumber) out.add(orderNumber.toUpperCase());
  }

  if (out.size || !user.email) return out;

  const byEmail = await fetchServerScopedJson(
    `/api/orders?pagination[pageSize]=200&fields[0]=orderNumber&filters[email][$eq]=${encodeURIComponent(
      user.email
    )}`
  );
  const emailRows = Array.isArray(byEmail.json?.data) ? byEmail.json.data : [];
  for (const row of emailRows) {
    const flat = flattenAny(row);
    const orderNumber =
      typeof flat?.orderNumber === "string" ? flat.orderNumber.trim() : "";
    if (orderNumber) out.add(orderNumber.toUpperCase());
  }

  return out;
}

export async function getServerCustomerInvoices(user?: ServerAuthUser | null) {
  const result = await getServerCustomerInvoicesPaginated(user, { page: 1, pageSize: 20 });
  return result.items;
}

function mapServerInvoice(strapiBase: string, row: any): ServerInvoice {
  const flat = flattenAny(row);
  const rawOrder = flat?.order?.data ?? flat?.order ?? null;
  const order = Array.isArray(rawOrder) ? flattenAny(rawOrder[0]) : flattenAny(rawOrder);
  const invoiceNumber =
    typeof flat?.number === "string" ? flat.number.trim() : null;
  const orderNumber =
    typeof order?.orderNumber === "string" && order.orderNumber.trim()
      ? order.orderNumber.trim()
      : extractOrderNumberFromInvoiceNumber(invoiceNumber);

  return {
    id: flat?.documentId ?? flat?.id ?? null,
    number: invoiceNumber,
    total: flat?.total ?? null,
    issuedAt: flat?.issuedAt ?? flat?.createdAt ?? null,
    pdfUrl: pickPdfUrl(strapiBase, flat?.pdf),
    orderNumber,
  };
}

async function getServerCustomerInvoicesLegacyPaginated(
  viewer: ServerAuthUser,
  page: number,
  pageSize: number
): Promise<PaginatedResult<ServerInvoice>> {
  const strapiBase = getStrapiBase();
  const myOrderNumbers = await getMyOrderNumbers(viewer);
  if (!strapiBase || myOrderNumbers.size === 0) {
    return { items: [], page, pageSize, total: 0, pageCount: 0 };
  }

  const params = new URLSearchParams();
  params.set("pagination[pageSize]", "200");
  params.set("sort[0]", "issuedAt:desc");
  params.set("populate[0]", "pdf");

  let list = await fetchServerScopedJson(`/api/invoices?${params.toString()}`);
  if (!list.ok) {
    const fallback = new URLSearchParams();
    fallback.set("pagination[pageSize]", "200");
    fallback.set("sort[0]", "createdAt:desc");
    list = await fetchServerScopedJson(`/api/invoices?${fallback.toString()}`);
  }

  if (!list.ok) return { items: [], page, pageSize, total: 0, pageCount: 0 };

  const rows = Array.isArray(list.json?.data) ? list.json.data : [];
  const ownedRows = rows
    .filter((row: any) => {
      const flat = flattenAny(row);
      const invoiceNumber =
        typeof flat?.number === "string" ? flat.number.trim() : "";
      const orderNumber = extractOrderNumberFromInvoiceNumber(invoiceNumber);
      return Boolean(orderNumber && myOrderNumbers.has(orderNumber));
    })
    .map((row: any) => {
      return mapServerInvoice(strapiBase, row);
    });

  const total = ownedRows.length;
  const pageCount = total > 0 ? Math.ceil(total / pageSize) : 0;
  const start = (page - 1) * pageSize;
  const items = ownedRows.slice(start, start + pageSize);

  return {
    items,
    page,
    pageSize,
    total,
    pageCount,
  };
}

export async function getServerCustomerInvoicesPaginated(
  user?: ServerAuthUser | null,
  options?: { page?: number; pageSize?: number }
): Promise<PaginatedResult<ServerInvoice>> {
  const viewer = await resolveCustomer(user);
  const page = normalizePage(options?.page, 1);
  const pageSize = normalizePageSize(options?.pageSize, 10);
  if (!viewer) {
    return { items: [], page, pageSize, total: 0, pageCount: 0 };
  }

  const strapiBase = getStrapiBase();
  if (!strapiBase) {
    return { items: [], page, pageSize, total: 0, pageCount: 0 };
  }

  const filterAttempts =
    viewer.documentId && viewer.documentId.trim().length > 0
      ? [
          { key: "filters[order][user][documentId][$eq]", value: viewer.documentId.trim() },
          { key: "filters[order][user][id][$eq]", value: String(viewer.id) },
        ]
      : [{ key: "filters[order][user][id][$eq]", value: String(viewer.id) }];

  let list: { ok: boolean; status: number; json: any } | null = null;

  for (const filter of filterAttempts) {
    for (const sortField of ["issuedAt:desc", "createdAt:desc"]) {
      const params = new URLSearchParams();
      params.set("pagination[page]", String(page));
      params.set("pagination[pageSize]", String(pageSize));
      params.set("sort[0]", sortField);
      params.set("populate", "*");
      params.set(filter.key, filter.value);

      list = await fetchServerScopedJson(`/api/invoices?${params.toString()}`);
      if (list.ok) {
        const rows = Array.isArray(list.json?.data) ? list.json.data : [];
        const items = rows.map((row: any) => mapServerInvoice(strapiBase, row));
        const meta = buildPaginationMeta(list.json?.meta?.pagination, page, pageSize, items.length);

        if (meta.total > 0) {
          return { items, ...meta };
        }
      }
    }
  }

  return getServerCustomerInvoicesLegacyPaginated(viewer, page, pageSize);
}

export async function getServerMyCoupons(user?: ServerAuthUser | null) {
  const viewer = await resolveCustomer(user);
  if (!viewer) return [];

  const result = await fetchUserScopedJson("/api/promotions/my-coupons");
  if (result.ok && Array.isArray(result.json?.data)) {
    return result.json.data;
  }

  return [];
}

export async function getServerProductReviews(params: {
  productDocumentId?: string;
  productId?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? 20)));
  const hasProductDocumentId = typeof params.productDocumentId === "string" && params.productDocumentId.trim().length > 0;
  const hasProductId = Number.isFinite(params.productId) && Number(params.productId) > 0;

  if (!hasProductDocumentId && !hasProductId) {
    return [] as ServerReview[];
  }

  const query = new URLSearchParams();
  query.set("sort[0]", "createdAt:desc");
  query.set("pagination[pageSize]", String(pageSize));
  query.set("populate", "product");

  let orIndex = 0;
  if (hasProductDocumentId) {
    query.set(`filters[$or][${orIndex}][product][documentId][$eq]`, String(params.productDocumentId).trim());
    orIndex += 1;
  }
  if (hasProductId) {
    query.set(`filters[$or][${orIndex}][product][id][$eq]`, String(Number(params.productId)));
  }

  const result = await fetchServerScopedJson(`/api/reviews?${query.toString()}`);
  if (!result.ok) return [] as ServerReview[];

  const rows = Array.isArray(result.json?.data) ? result.json.data : [];
  return rows.map((row: any) => {
    const flat = flattenAny(row);
    const rating = Number(flat?.rating ?? 0);
    const text = String(flat?.comment ?? flat?.text ?? flat?.body ?? "").trim();
    const title = String(flat?.title ?? "").trim();
    const name = String(flat?.name ?? "").trim();

    return {
      id: flat?.id ?? flat?.documentId ?? flat?.createdAt ?? "review",
      rating: Number.isFinite(rating) ? rating : 0,
      title: title || undefined,
      text: text || undefined,
      name: name || undefined,
      createdAt: String(flat?.createdAt ?? "").trim() || undefined,
    };
  });
}
