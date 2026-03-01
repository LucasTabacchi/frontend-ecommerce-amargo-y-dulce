import { NextResponse } from "next/server";
import { fetcher } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await fetcher<any>("/promotions/available", {
      method: "GET",
      cache: "no-store",
    });
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "No se pudieron cargar los cupones." },
      { status: 500 }
    );
  }
}
