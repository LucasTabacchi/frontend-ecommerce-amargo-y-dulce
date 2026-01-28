// src/lib/strapi-mappers.ts
import type { ProductCardItem } from "@/components/products/ProductCard";

const STRAPI_URL = String(
  process.env.NEXT_PUBLIC_STRAPI_URL ??
    process.env.STRAPI_URL ??
    "http://localhost:1337"
).replace(/\/$/, "");

function withBase(url?: string | null) {
  if (!url) return undefined;
  const u = String(url).trim();
  if (!u) return undefined;
  return /^https?:\/\//i.test(u)
    ? u
    : `${STRAPI_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

/* ===================== IMAGES ===================== */

function pickFirstMedia(images: any) {
  if (!images) return null;

  // v4: { data: [{ attributes: {...} }] }
  if (Array.isArray(images?.data)) return images.data[0] ?? null;

  // v5: { data: [{...}] }
  if (Array.isArray(images?.data)) return images.data[0] ?? null;

  // v5: [{...}]
  if (Array.isArray(images)) return images[0] ?? null;

  // v5 single: {...}
  return images;
}

/**
 * Soporta:
 * - Strapi v5 "plano": images: [{ url, formats... }] o images: { ... } o images: { data: [...] }
 * - Strapi v4 "media": images: { data: [{ attributes: { url, formats... } }] }
 */
export function getStrapiImageUrlFromAttributes(attributes: any): string | undefined {
  const attr = attributes ?? {};
  const first = pickFirstMedia(attr?.images);

  if (!first) return undefined;

  // puede venir con .attributes o plano
  const img = (first as any)?.attributes ?? first;
  if (!img) return undefined;

  const formats = (img as any)?.formats;
  const url =
    formats?.medium?.url ||
    formats?.small?.url ||
    formats?.thumbnail?.url ||
    (img as any)?.url ||
    "";

  return url ? withBase(url) : undefined;
}

/* ===================== PRODUCT MAPPER ===================== */

function toNum(v: any, def = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : def;
}

function toIntOrNull(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toStrOrNull(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function toOffOrUndef(v: any): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const off = Math.trunc(n);
  return off > 0 ? off : undefined;
}

/**
 * Lee stock de manera tolerante (v4/v5):
 * - product.stock (v5 plano)
 * - attr.stock (v4 o v5 con attributes)
 * Devuelve number | null (si no existe).
 */
function pickStock(product: any, attr: any): number | null {
  const raw =
    product?.stock ??
    attr?.stock ??
    product?.qty ??
    attr?.qty ??
    product?.quantity ??
    attr?.quantity ??
    null;

  if (raw === null || raw === undefined || raw === "") return null;

  const n = Number(raw);
  if (!Number.isFinite(n)) return null;

  return Math.max(0, Math.trunc(n));
}

/**
 * Mapper para cards de producto
 * Soporta Strapi v4 (data: {id, attributes}) y v5 (data: {id, documentId, ...})
 */
export function toCardItem(product: any): ProductCardItem {
  const attr = product?.attributes ?? product ?? {};

  const documentId =
    toStrOrNull(product?.documentId) ??
    toStrOrNull(attr?.documentId) ??
    toStrOrNull(attr?.document_id) ??
    null;

  const id = toIntOrNull(product?.id ?? attr?.id) ?? 0;

  const slug =
    toStrOrNull(attr?.slug) ??
    (documentId ? documentId : null) ??
    String(id);

  const title = toStrOrNull(attr?.title) ?? "Producto";
  const description = String(attr?.description ?? "");
  const price = toNum(attr?.price ?? product?.price, 0);
  const off = toOffOrUndef(attr?.off ?? product?.off);

  const stock = pickStock(product, attr);
  const imageUrl = getStrapiImageUrlFromAttributes(attr);

  return {
    id,
    documentId,
    slug,
    title,
    description,
    price,
    off,
    category: toStrOrNull(attr?.category),
    imageUrl,

    // ✅ stock para clamp en carrito / add-to-cart
    ...(stock !== null ? { stock } : {}),
  } as ProductCardItem;
}
