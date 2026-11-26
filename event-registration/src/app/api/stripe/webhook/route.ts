import { after, NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { markPaid, markRefundedByPaymentIntent, markUnpaid } from "@/lib/payments";
import { stripe } from "@/lib/stripe";
import { deliverRegistrationWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

/**
 * Stripe → website notifications (configure in Stripe: Developers → Webhooks).
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 *         checkout.session.async_payment_failed, checkout.session.expired, charge.refunded
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, req.headers.get("stripe-signature") || "", secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const { changed, registration } = await markPaid(session);
      if (changed && registration) after(() => deliverRegistrationWebhook(registration.id));
      break;
    }
    case "checkout.session.async_payment_failed":
      await markUnpaid(session.id, "failed");
      break;
    case "checkout.session.expired":
      await markUnpaid(session.id, "expired");
      break;
    case "charge.refunded": {
      // Refund made directly in the Stripe dashboard: mark the reservation (only when fully refunded).
      const charge = event.data.object as Stripe.Charge;
      const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (pi && charge.refunded) await markRefundedByPaymentIntent(pi);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
