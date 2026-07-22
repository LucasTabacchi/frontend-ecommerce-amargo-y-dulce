export type ProductGalleryImage = {
  url: string;
  thumbUrl: string;
  alternativeText: string | null;
};

function getBaseUrl(base?: string) {
  return String(
    base ??
      process.env.NEXT_PUBLIC_STRAPI_URL ??
      process.env.STRAPI_URL ??
      "http://localhost:1337"
  ).replace(/\/$/, "");
}

function withBase(url: unknown, base?: string) {
  const value = String(url ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const root = getBaseUrl(base);
  return `${root}${value.startsWith("/") ? "" : "/"}${value}`;
}

function pickAttr(row: any) {
  return row?.attributes ?? row ?? {};
}

function pickImageNodes(rowOrAttr: any) {
  const attr = pickAttr(rowOrAttr);
  const images = attr?.images;

  if (!images) return [];
  if (Array.isArray(images)) return images;
  if (Array.isArray(images?.data)) return images.data;
  if (images?.data) return [images.data];
  return [images];
}

function normalizeImage(node: any, base?: string): ProductGalleryImage | null {
  const img = node?.attributes ?? node ?? {};
  const formats = img?.formats ?? {};
  const main =
    formats?.large?.url ||
    formats?.medium?.url ||
    formats?.small?.url ||
    img?.url ||
    "";
  const thumb = formats?.thumbnail?.url || img?.url || main;
  const url = withBase(main, base);

  if (!url) return null;

  return {
    url,
    thumbUrl: withBase(thumb, base) || url,
    alternativeText: String(img?.alternativeText ?? "").trim() || null,
  };
}

export function getProductGalleryImages(rowOrAttr: any, base?: string): ProductGalleryImage[] {
  const seen = new Set<string>();
  const out: ProductGalleryImage[] = [];

  for (const node of pickImageNodes(rowOrAttr)) {
    const image = normalizeImage(node, base);
    if (!image || seen.has(image.url)) continue;
    seen.add(image.url);
    out.push(image);
  }

  return out;
}

export function getFirstProductImageUrl(rowOrAttr: any, base?: string) {
  return getProductGalleryImages(rowOrAttr, base)[0]?.url ?? "";
}
