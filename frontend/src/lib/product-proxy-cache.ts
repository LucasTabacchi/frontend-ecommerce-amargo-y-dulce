const DEFAULT_PRODUCT_PROXY_REVALIDATE_SECONDS = 30;

type ProductProxyRequestOptions = RequestInit & {
  next?: {
    revalidate: number;
  };
};

export function isFreshProductProxyRequest(searchParams: URLSearchParams) {
  const raw = String(searchParams.get("fresh") ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function buildProductProxySearch(searchParams: URLSearchParams) {
  const forwarded = new URLSearchParams(searchParams);
  forwarded.delete("fresh");
  return forwarded.toString();
}

export function buildProductProxyRequestOptions({
  fresh,
  token,
  revalidateSeconds = DEFAULT_PRODUCT_PROXY_REVALIDATE_SECONDS,
}: {
  fresh: boolean;
  token?: string | null;
  revalidateSeconds?: number;
}): ProductProxyRequestOptions {
  if (fresh) {
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store" as const,
    };
  }

  return {
    headers: {},
    next: { revalidate: revalidateSeconds },
  };
}
