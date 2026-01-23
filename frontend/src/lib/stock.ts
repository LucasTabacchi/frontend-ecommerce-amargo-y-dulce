// src/lib/stock.ts
import { fetcher } from "@/lib/fetcher";

type CartItem = {
  qty: number;
  title?: string;
  productDocumentId?: string | null;
};

type ProductRow = {
  id: number;
  documentId?: string;
  title?: string;
  stock?: number | null;
};

export type StockProblem = {
  documentId: string;
  title: string;
  requested: number;
  available: number; // 0 si no hay / no existe
};

export async function validateStockOrThrow(items: CartItem[]) {
  const need = new Map<string, { requested: number; title?: string }>();

  for (const it of items || []) {
    const doc = String(it?.productDocumentId || "").trim();
    const qty = Number(it?.qty ?? 0);
    if (!doc || !Number.isFinite(qty) || qty <= 0) continue;

    const prev = need.get(doc);
    need.set(doc, {
      requested: (prev?.requested ?? 0) + qty,
      title: it?.title ?? prev?.title,
    });
  }

  const docIds = Array.from(need.keys());
  if (!docIds.length) return; // nada para validar (o carrito viejo)

  // Pedimos solo lo necesario
  const sp = new URLSearchParams();
  sp.set("pagination[pageSize]", String(docIds.length));
  sp.set("filters[documentId][$in]", docIds.join(","));
  // si tu Strapi exige populate para stock, poné populate=*; si stock es campo simple no hace falta
  // sp.set("populate", "*");

  const res = await fetcher<{ data: ProductRow[] }>(`/api/products?${sp.toString()}`, { auth: true });
  const rows = Array.isArray(res?.data) ? res.data : [];

  const byDoc = new Map<string, ProductRow>();
  for (const r of rows) {
    const doc = String((r as any)?.documentId ?? "").trim();
    if (doc) byDoc.set(doc, r);
  }

  const problems: StockProblem[] = [];

  for (const doc of docIds) {
    const requested = need.get(doc)!.requested;
    const row = byDoc.get(doc);

    // Si no existe el producto -> disponible 0
    if (!row) {
      problems.push({
        documentId: doc,
        title: need.get(doc)?.title ?? "Producto",
        requested,
        available: 0,
      });
      continue;
    }

    const stockRaw = (row as any)?.stock;
    // stock null => “sin control” (ilimitado)
    if (stockRaw === null || stockRaw === undefined) continue;

    const available = Number(stockRaw);
    if (!Number.isFinite(available) || available < requested) {
      problems.push({
        documentId: doc,
        title: (row as any)?.title ?? need.get(doc)?.title ?? "Producto",
        requested,
        available: Number.isFinite(available) ? available : 0,
      });
    }
  }

  if (problems.length) {
    const err: any = new Error("OUT_OF_STOCK");
    err.code = "OUT_OF_STOCK";
    err.problems = problems;
    throw err;
  }
}
