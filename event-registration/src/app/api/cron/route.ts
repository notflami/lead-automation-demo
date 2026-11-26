import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { anonymizeRegistrations } from "@/lib/registrations";
import { retryPendingWebhooks } from "@/lib/webhook";
import { releaseHolds } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Maintenance job. Call regularly (Vercel Cron, n8n Schedule trigger, or system cron) with
 *   Authorization: Bearer $CRON_SECRET
 * - retries failed n8n webhooks
 * - anonymises personal data once the retention period after the event has passed (GDPR)
 * - purges old rate-limit entries
 */
export async function GET(req: NextRequest) {
  const secret = env.cronSecret();
  const auth = req.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const releasedHolds = await releaseHolds();
  const webhooks = await retryPendingWebhooks(50);
  const anonymised = await anonymizeRegistrations(false);
  await db()`delete from rate_limit_hits where created_at < now() - interval '1 day'`;
  return NextResponse.json({ ok: true, webhooks, anonymised, releasedHolds });
}
