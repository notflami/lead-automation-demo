-- Online payment with Stripe Checkout.
-- A paid reservation starts as 'pending_payment' (places held until hold_expires_at),
-- becomes 'confirmed' when Stripe reports the payment, or 'cancelled' when the hold ends unpaid.

alter table registrations drop constraint if exists registrations_status_check;
alter table registrations add constraint registrations_status_check
  check (status in ('confirmed', 'waitlisted', 'checked_in', 'cancelled', 'pending_payment'));

alter table registrations add column if not exists payment_status    text not null default 'none';
do $$ begin
  alter table registrations add constraint registrations_payment_status_check
    check (payment_status in ('none', 'pending', 'paid', 'failed', 'expired', 'refunded'));
exception when duplicate_object then null; end $$;
alter table registrations add column if not exists amount_cents      integer not null default 0;
alter table registrations add column if not exists stripe_session_id text unique;
alter table registrations add column if not exists checkout_url      text;
alter table registrations add column if not exists hold_expires_at   timestamptz;
alter table registrations add column if not exists paid_at           timestamptz;

create index if not exists registrations_pending_payment_idx on registrations (hold_expires_at) where status = 'pending_payment';

-- Switch in Event settings (off by default) and optional terms (AGB) shown before paying.
alter table event_settings add column if not exists payments_enabled boolean not null default false;
alter table event_settings add column if not exists terms_text       text    not null default '';
