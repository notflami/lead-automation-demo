import "server-only";
import type Stripe from "stripe";
import { db } from "./db";
import { siteUrl } from "./env";
import { releaseExpiredHolds } from "./registrations";
import { CHECKOUT_MINUTES, stripe, stripeLocale } from "./stripe";
import type { Registration } from "./types";

/** Creates the Stripe Checkout page for a registration that is awaiting payment. */
export async function createCheckout(
  r: Registration,
  opts: { eventName: string; ticketLabel: string; unitPriceCents: number },
): Promise<{ id: string; url: string }> {
  const site = siteUrl();
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: r.guest_count,
          price_data: { currency: "eur", unit_amount: opts.unitPriceCents, product_data: { name: `${opts.eventName} – ${opts.ticketLabel}` } },
        },
      ],
      client_reference_id: r.reference,
      metadata: { registration_id: r.id, reference: r.reference },
      payment_intent_data: { description: `${opts.eventName} ${r.reference}`, metadata: { registration_id: r.id, reference: r.reference } },
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
      locale: stripeLocale(r.locale),
      success_url: `${site}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/?checkout=cancelled`,
    },
    { idempotencyKey: `checkout-${r.id}` },
  );
  if (!session.url) throw new Error("Stripe returned no checkout URL.");
  await db()`update registrations set stripe_session_id = ${session.id}, checkout_url = ${session.url}, updated_at = now() where id = ${r.id}`;
  return { id: session.id, url: session.url };
}

/** Best effort: closes Stripe pages that can no longer be used (so nobody pays for a released hold). */
export async function expireCheckouts(sessionIds: (string | null | undefined)[]): Promise<void> {
  for (const id of sessionIds) {
    if (!id) continue;
    try {
      await stripe().checkout.sessions.expire(id);
    } catch {
      // Already completed or expired: nothing to do.
    }
  }
}

export type PaidResult = { changed: boolean; registration: Registration | null };

/**
 * Marks a reservation as paid (idempotent; called from the webhook and from the return page).
 * A payment is always honoured, even if it arrives after the hold ended.
 */
export async function markPaid(
  session: Pick<Stripe.Checkout.Session, "id" | "payment_status" | "amount_total"> & { payment_intent?: string | Stripe.PaymentIntent | null },
): Promise<PaidResult> {
  if (session.payment_status !== "paid") return { changed: false, registration: await bySession(session.id) };
  return db().begin(async (tx) => {
    await tx`select 1 from event_settings where id = 1 for update`;
    const [r] = await tx<Registration[]>`select * from registrations where stripe_session_id = ${session.id} for update`;
    if (!r) return { changed: false, registration: null };
    if (r.payment_status === "paid") return { changed: false, registration: r };
    const late = r.status !== "pending_payment";
    const [updated] = await tx<Registration[]>`
      update registrations set
        status = 'confirmed', payment_status = 'paid', paid_at = now(), cancelled_at = null,
        amount_cents = coalesce(${session.amount_total ?? null}, amount_cents),
        stripe_payment_intent = coalesce(${paymentIntentId(session.payment_intent)}, stripe_payment_intent),
        webhook_status = 'pending', updated_at = now(),
        admin_note = case when ${late} then trim(admin_note || ' Paid after the 35-minute hold had ended: check capacity.') else admin_note end
      where id = ${r.id} returning *`;
    return { changed: true, registration: updated };
  });
}

/** Payment did not happen (Stripe page expired or delayed payment failed): free the places. */
export async function markUnpaid(sessionId: string, reason: "expired" | "failed"): Promise<void> {
  await db()`
    update registrations set status = 'cancelled', payment_status = ${reason}, cancelled_at = now(), updated_at = now()
    where stripe_session_id = ${sessionId} and status = 'pending_payment'`;
}

/** Guest pressed "back" on the Stripe page: release the hold right away. */
export async function cancelPendingByKey(idempotencyKey: string): Promise<boolean> {
  const rows = await db()<{ stripe_session_id: string | null }[]>`
    update registrations set status = 'cancelled', payment_status = 'expired', cancelled_at = now(), updated_at = now()
    where idempotency_key = ${idempotencyKey} and status = 'pending_payment'
    returning stripe_session_id`;
  await expireCheckouts(rows.map((r) => r.stripe_session_id));
  return rows.length > 0;
}

export async function bySession(sessionId: string): Promise<Registration | null> {
  const [r] = await db()<Registration[]>`select * from registrations where stripe_session_id = ${sessionId}`;
  return r ?? null;
}

export async function releaseHolds(): Promise<number> {
  return db().begin(async (tx) => {
    await tx`select 1 from event_settings where id = 1 for update`;
    return releaseExpiredHolds(tx);
  });
}

function paymentIntentId(pi: string | Stripe.PaymentIntent | null | undefined): string | null {
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

export type RefundOutcome = { ok: true; amountCents: number } | { ok: false; error: string };

/**
 * Refunds one paid reservation in full (back to the guest's original payment method) and cancels it.
 * Safe to repeat: Stripe's idempotency key prevents a second refund of the same reservation.
 */
export async function refundRegistration(id: string): Promise<RefundOutcome> {
  const [r] = await db()<Registration[]>`select * from registrations where id = ${id}`;
  if (!r) return { ok: false, error: "Registration not found." };
  if (r.payment_status === "refunded") return { ok: true, amountCents: 0 };
  if (r.payment_status !== "paid") return { ok: false, error: "This reservation was not paid online." };
  try {
    let pi = r.stripe_payment_intent;
    if (!pi && r.stripe_session_id) pi = paymentIntentId((await stripe().checkout.sessions.retrieve(r.stripe_session_id)).payment_intent);
    if (!pi) throw new Error("No Stripe payment found for this reservation.");
    await stripe().refunds.create(
      { payment_intent: pi, reason: "requested_by_customer", metadata: { reference: r.reference } },
      { idempotencyKey: `refund-${r.id}` },
    );
    await db()`
      update registrations set payment_status = 'refunded', refunded_at = now(), refund_error = null,
        stripe_payment_intent = ${pi}, status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
      where id = ${r.id}`;
    return { ok: true, amountCents: r.amount_cents };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db()`update registrations set refund_error = ${message.slice(0, 500)}, updated_at = now() where id = ${r.id}`;
    return { ok: false, error: message };
  }
}

/** Refund everything that was paid online (event cancelled). Closes registration first. Can be run again to retry failures. */
export async function refundAll(): Promise<{ refunded: number; amountCents: number; failed: { reference: string; error: string }[] }> {
  await db()`update event_settings set registration_open = false, updated_at = now() where id = 1`;
  const rows = await db()<{ id: string; reference: string }[]>`
    select id, reference from registrations where payment_status = 'paid' order by created_at`;
  let refunded = 0;
  let amountCents = 0;
  const failed: { reference: string; error: string }[] = [];
  for (const row of rows) {
    const out = await refundRegistration(row.id);
    if (out.ok) {
      refunded++;
      amountCents += out.amountCents;
    } else failed.push({ reference: row.reference, error: out.error });
  }
  return { refunded, amountCents, failed };
}

/** Stripe "charge.refunded" (e.g. a refund made directly in the Stripe dashboard). */
export async function markRefundedByPaymentIntent(paymentIntent: string): Promise<void> {
  await db()`
    update registrations set payment_status = 'refunded', refunded_at = coalesce(refunded_at, now()), refund_error = null,
      status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
    where stripe_payment_intent = ${paymentIntent} and payment_status = 'paid'`;
}
