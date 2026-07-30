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
  revalidateSeconds: _revalidateSeconds = 0,
}: {
  fresh: boolean;
  token?: string | null;
  revalidateSeconds?: number;
}): ProductProxyRequestOptions {
  void _revalidateSeconds;

  if (fresh) {
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store" as const,
    };
  }

  return {
    headers: {},
    cache: "no-store" as const,
  };
}

export function buildProductProxyResponseCacheControl() {
  return "no-store";
}
