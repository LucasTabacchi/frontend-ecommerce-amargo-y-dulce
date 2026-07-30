export const PUBLIC_STOREFRONT_REVALIDATE_SECONDS = 0;

export const publicStorefrontNext = {
  revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
};

export const publicStorefrontFetchOptions = {
  cache: "no-store" as const,
};
