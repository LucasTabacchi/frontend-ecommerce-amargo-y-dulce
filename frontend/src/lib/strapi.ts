import { env } from "./env";
import { fetcher } from "./fetcher";

type StrapiRequestInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

function withBase(path: string) {
  return `${env.strapiUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function strapiGet<T>(path: string, init: StrapiRequestInit = {}) {
  const headers: Record<string, string> = {};
  if (env.strapiToken) headers.Authorization = `Bearer ${env.strapiToken}`;

  return fetcher<T>(withBase(path), {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...headers,
    },
  });
}
