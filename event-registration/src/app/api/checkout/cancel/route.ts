import { NextResponse, type NextRequest } from "next/server";
import { cancelPendingByKey } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Guest came back from Stripe without paying: release the held places now (only the form's own secret key works). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const key = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!/^[0-9a-f-]{36}$/i.test(key)) return NextResponse.json({ ok: false }, { status: 400 });
  const cancelled = await cancelPendingByKey(key);
  return NextResponse.json({ ok: true, cancelled });
}
