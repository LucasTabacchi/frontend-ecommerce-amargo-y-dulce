type FetcherOptions = RequestInit & {
  headers?: Record<string, string>;
  auth?: boolean; // ✅ si true, agrega Bearer token (server-only)
};

// Normaliza base: sin trailing "/" y sin "/api" al final (para evitar /api/api)
function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  if (!u) return "http://localhost:1337";
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

// Normaliza path: siempre con "/api/..." (si ya viene con /api, no duplica)
function normalizeApiPath(path: string) {
  const p = String(path ?? "").trim();
  if (!p) return "/api";
  if (/^https?:\/\//i.test(p)) return p; // url completa
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return withSlash.startsWith("/api/") || withSlash === "/api"
    ? withSlash
    : `/api${withSlash}`;
}

export async function fetcher<T>(url: string, options: FetcherOptions = {}): Promise<T> {
  const baseRaw =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";

  const base = normalizeStrapiBase(baseRaw);

  const fullUrl = /^https?:\/\//i.test(url)
    ? url
    : `${base}${normalizeApiPath(url)}`;

  // ⚠️ Token solo en server. En el browser no debe existir.
  const token = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || "";

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  // ✅ Solo agregamos Authorization si options.auth === true
  if (options.auth === true) {
    // Seguridad: nunca permitir auth en el browser
    if (typeof window !== "undefined") {
      throw new Error("fetcher(auth:true) solo puede ejecutarse en el servidor");
    }
    if (!token || token.length < 10) {
      throw new Error("Falta STRAPI_API_TOKEN/STRAPI_TOKEN para request con auth:true");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers,
    // ✅ No forzamos cache:no-store.
    // En Server Components, Next decide cache/revalidate según `next`/`cache` del caller.
    // En Route Handlers/mutations, el caller debería pasar `cache: 'no-store'`.
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} - ${res.statusText} - ${text}`);
  }

  return (await res.json()) as T;
}
