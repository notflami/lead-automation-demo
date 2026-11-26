import { after, NextResponse, type NextRequest } from "next/server";
import { bySession, markPaid } from "@/lib/payments";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { deliverRegistrationWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

/**
 * Called by the page when the guest returns from Stripe. Asks Stripe directly (does not trust the URL),
 * marks the reservation as paid if needed, and returns what the confirmation screen shows.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("session_id") || "";
  if (!stripeConfigured() || !/^cs_[A-Za-z0-9_]+$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(id);
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const { changed, registration } = session.payment_status === "paid" ? await markPaid(session) : { changed: false, registration: await bySession(id) };
  if (!registration) return NextResponse.json({ ok: false }, { status: 404 });
  if (changed) after(() => deliverRegistrationWebhook(registration.id));

  const paid = registration.payment_status === "paid";
  return NextResponse.json(
    {
      ok: true,
      state: paid ? "paid" : session.status === "complete" ? "processing" : "unpaid",
      registration: {
        reference: registration.reference,
        guestCount: registration.guest_count,
        ticketType: registration.ticket_type,
        status: paid ? "confirmed" : registration.status,
        firstName: registration.full_name.split(" ")[0],
        paidCents: paid ? registration.amount_cents : 0,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
