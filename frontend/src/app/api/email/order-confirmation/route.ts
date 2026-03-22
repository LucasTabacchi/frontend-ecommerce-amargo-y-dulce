import { NextResponse } from "next/server";

import { sendOrderConfirmationEmail } from "@/lib/server/order-confirmation-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const result = await sendOrderConfirmationEmail(body || {});
  return NextResponse.json(result.body, { status: result.status });
}
