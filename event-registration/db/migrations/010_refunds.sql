-- Refunds: the Stripe PaymentIntent is needed to refund a paid reservation.
alter table registrations add column if not exists stripe_payment_intent text;
alter table registrations add column if not exists refunded_at timestamptz;
alter table registrations add column if not exists refund_error text;
