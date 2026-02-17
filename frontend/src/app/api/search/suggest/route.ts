// src/app/api/search/suggest/route.ts
import { NextResponse } from "next/server";
import { fetcher } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StrapiListResponse<T> = {
  data: Array<{ id: number; attributes: T }>;
  meta?: any;
};

type ProductAttributes = any;

function pickTitle(item: any) {
  return item?.attributes?.title ?? item?.title ?? "";
}
function pickPrice(item: any) {
  return item?.attributes?.price ?? item?.price ?? null;
}
function pickSlug(item: any) {
  return item?.attributes?.slug ?? item?.slug ?? null;
}
function pickId(item: any) {
  return item?.attributes?.documentId ?? item?.documentId ?? item?.id ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  const sp = new URLSearchParams();
  sp.set("pagination[pageSize]", "5");
  sp.set("sort[0]", "title:asc");
  sp.set("fields[0]", "title");
  sp.set("fields[1]", "price");
  sp.set("fields[2]", "slug");

  // ✅ Búsqueda por varios campos (igual que en /productos)
  sp.set("filters[$or][0][title][$containsi]", q);
  sp.set("filters[$or][1][slug][$containsi]", q);
  sp.set("filters[$or][2][description][$containsi]", q);

  // ✅ Strapi v5: status=published
  sp.set("status", "published");

  try {
    const res = await fetcher<StrapiListResponse<ProductAttributes>>(
      `/products?${sp.toString()}`,
      { cache: "no-store" }
    );

    const data = Array.isArray(res?.data) ? res.data : [];

    const results = data
      .map((item: any) => ({
        id: pickId(item),
        title: pickTitle(item),
        price: pickPrice(item),
        slug: pickSlug(item),
      }))
      .filter((x: any) => x.title)
      .slice(0, 5);

    return NextResponse.json({ results }, { status: 200 });
  } catch {
    // si falla, devolvemos vacío para no romper UX
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
