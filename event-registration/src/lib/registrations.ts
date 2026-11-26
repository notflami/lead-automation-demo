import "server-only";
import { db } from "./db";
import { decideCapacity } from "./capacity";
import { HOLD_MINUTES } from "./stripe";
import type { CapacityStats, Registration, RegistrationStatus } from "./types";
import type { RegistrationInput } from "./validation";

import type { Sql, TransactionSql } from "postgres";

export type CreateResult =
  | { ok: true; registration: Registration; duplicate: boolean; replacedSessions: string[] }
  | { ok: false; reason: "closed" | "full" | "not_enough" | "vip_full" | "vip_not_enough"; remaining: number; waitlistAvailable: boolean }
  | { ok: false; reason: "phone_taken" };

const REG_COLUMNS = `id, reference, full_name, phone, email, guest_count, ticket_type, status, locale, admin_note,
  created_at, updated_at, cancelled_at, anonymized_at, webhook_status, webhook_attempts,
  webhook_last_error, webhook_sent_at, payment_status, amount_cents, stripe_session_id, checkout_url,
  hold_expires_at, paid_at`;

/** Places taken: confirmed, checked in, and still-valid payment holds. */
const SEATED = `(status in ('confirmed', 'checked_in') or (status = 'pending_payment' and hold_expires_at > now()))`;

/** Ends payment holds whose time ran out (frees their places and the phone number). Call under the settings lock. */
export async function releaseExpiredHolds(tx: Sql | TransactionSql): Promise<number> {
  const rows = await tx`
    update registrations set status = 'cancelled', payment_status = 'expired', cancelled_at = now(), updated_at = now()
    where status = 'pending_payment' and hold_expires_at <= now()
    returning id`;
  return rows.count;
}

async function reservedPlaces(tx: Sql | TransactionSql, excludeId?: string): Promise<number> {
  return (await reservedSplit(tx, excludeId)).total;
}

/** Taken places in total and in VIP (confirmed, checked in, and places held for a payment in progress). */
async function reservedSplit(tx: Sql | TransactionSql, excludeId?: string): Promise<{ total: number; vip: number }> {
  const [row] = await tx<{ total: number; vip: number }[]>`
    select coalesce(sum(guest_count), 0)::int as total,
           coalesce(sum(guest_count) filter (where ticket_type = 'vip'), 0)::int as vip
    from registrations
    where ${tx.unsafe(SEATED)}
      ${excludeId ? tx`and id <> ${excludeId}` : tx``}`;
  return row;
}

/**
 * Creates a registration atomically.
 * The `for update` lock on the single event_settings row serialises concurrent
 * registrations, so the capacity check and the insert can never race (no overbooking).
 */
export async function createRegistration(
  input: RegistrationInput,
  payment: { required: boolean; unitPriceCents: number } = { required: false, unitPriceCents: 0 },
): Promise<CreateResult> {
  const sql = db();
  return sql.begin(async (tx) => {
    const [settings] = await tx<{ max_capacity: number; vip_capacity: number; registration_open: boolean; waitlist_enabled: boolean }[]>`
      select max_capacity, vip_capacity, registration_open, waitlist_enabled from event_settings where id = 1 for update`;

    // Checked AFTER taking the lock, so two simultaneous identical submissions can't both pass.
    // Same idempotency key = same form submission (double tap, retry on flaky mobile network).
    const existing = await tx.unsafe<Registration[]>(
      `select ${REG_COLUMNS} from registrations where idempotency_key = $1`,
      [input.idempotencyKey],
    );
    if (existing[0]) return { ok: true, registration: existing[0], duplicate: true, replacedSessions: [] } as const;

    await releaseExpiredHolds(tx);

    // The same guest trying again before finishing an earlier payment replaces that unpaid attempt.
    const replaced = await tx<{ stripe_session_id: string | null }[]>`
      update registrations set status = 'cancelled', payment_status = 'expired', cancelled_at = now(), updated_at = now()
      where phone = ${input.phone} and status = 'pending_payment' and anonymized_at is null
      returning stripe_session_id`;
    const replacedSessions = replaced.map((r) => r.stripe_session_id).filter((x): x is string => Boolean(x));

    const [phoneTaken] = await tx`
      select 1 from registrations
      where phone = ${input.phone} and status <> 'cancelled' and anonymized_at is null limit 1`;
    if (phoneTaken) return { ok: false, reason: "phone_taken" } as const;

    const seated = await reservedSplit(tx);
    const decision = decideCapacity({
      guests: input.guestCount,
      reservedPlaces: seated.total,
      ticketType: input.ticketType,
      vipReserved: seated.vip,
      vipCapacity: settings.vip_capacity,
      maxCapacity: settings.max_capacity,
      registrationOpen: settings.registration_open,
      waitlistEnabled: settings.waitlist_enabled,
      acceptWaitlist: input.acceptWaitlist,
    });
    if (!decision.ok) return decision;

    // Paid ticket: hold the places until the payment is done (no payment for the waiting list).
    const pay = payment.required && decision.status === "confirmed";
    const [registration] = await tx.unsafe<Registration[]>(
      // privacy_accepted_at = when the guest submitted the form with the privacy notice shown above the button.
      `insert into registrations
         (full_name, phone, guest_count, ticket_type, status, locale, idempotency_key, privacy_accepted_at,
          payment_status, amount_cents, hold_expires_at, webhook_status)
       values ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9,
               case when $10::boolean then now() + make_interval(mins => $11::int) end, $12)
       returning ${REG_COLUMNS}`,
      [
        input.fullName,
        input.phone,
        input.guestCount,
        input.ticketType,
        pay ? "pending_payment" : decision.status,
        input.locale,
        input.idempotencyKey,
        pay ? "pending" : "none",
        payment.unitPriceCents * input.guestCount,
        pay,
        HOLD_MINUTES,
        pay ? "skipped" : "pending", // n8n is notified only once the payment arrives
      ],
    );
    return { ok: true, registration, duplicate: false, replacedSessions } as const;
  });
}

export async function getStats(): Promise<CapacityStats> {
  const sql = db();
  const [[row], [settings]] = await Promise.all([
    sql<
      {
        registrations: number;
        reserved: number;
        checked_in: number;
        wl_regs: number;
        wl_places: number;
        cancelled: number;
        vip: number;
        held: number;
        paid_cents: number;
        paid_regs: number;
        pending_cents: number;
        pending_regs: number;
      }[]
    >`
      select
        count(*) filter (where status in ('confirmed', 'checked_in'))::int                         as registrations,
        coalesce(sum(guest_count) filter (where status in ('confirmed', 'checked_in')), 0)::int     as reserved,
        coalesce(sum(guest_count) filter (where status = 'checked_in'), 0)::int                     as checked_in,
        count(*) filter (where status = 'waitlisted')::int                                         as wl_regs,
        coalesce(sum(guest_count) filter (where status = 'waitlisted'), 0)::int                     as wl_places,
        count(*) filter (where status = 'cancelled')::int                                          as cancelled,
        coalesce(sum(guest_count) filter (where status in ('confirmed', 'checked_in') and ticket_type = 'vip'), 0)::int as vip,
        coalesce(sum(guest_count) filter (where status = 'pending_payment' and hold_expires_at > now()), 0)::int as held,
        coalesce(sum(amount_cents) filter (where payment_status = 'paid'), 0)::int                  as paid_cents,
        count(*) filter (where payment_status = 'paid')::int                                       as paid_regs,
        coalesce(sum(amount_cents) filter (where status = 'pending_payment' and hold_expires_at > now()), 0)::int as pending_cents,
        count(*) filter (where status = 'pending_payment' and hold_expires_at > now())::int        as pending_regs
      from registrations`,
    sql<{ max_capacity: number; vip_capacity: number }[]>`select max_capacity, vip_capacity from event_settings where id = 1`,
  ]);
  return {
    registrations: row.registrations,
    reservedPlaces: row.reserved,
    checkedInPlaces: row.checked_in,
    waitlistedRegistrations: row.wl_regs,
    waitlistedPlaces: row.wl_places,
    cancelledRegistrations: row.cancelled,
    maxCapacity: settings.max_capacity,
    remaining: Math.max(0, settings.max_capacity - row.reserved - row.held),
    paidCents: row.paid_cents,
    paidRegistrations: row.paid_regs,
    pendingPaymentCents: row.pending_cents,
    pendingPaymentRegistrations: row.pending_regs,
    vipReservedPlaces: row.vip,
    vipCapacity: settings.vip_capacity,
    averageGuests: row.registrations ? Math.round((row.reserved / row.registrations) * 10) / 10 : 0,
  };
}

/** Public, non-personal availability figures for the landing page. */
export async function getRemainingPlaces(maxCapacity: number, vipCapacity = 0): Promise<{ total: number; vip: number }> {
  const seated = await reservedSplit(db());
  return { total: Math.max(0, maxCapacity - seated.total), vip: Math.max(0, vipCapacity - seated.vip) };
}

export async function listRegistrations(opts: { q?: string; status?: string; limit?: number }): Promise<Registration[]> {
  const sql = db();
  const q = (opts.q || "").trim();
  // Phone search: digits without the leading 0/00 prefix ("0176 123" → "176123").
  // A registration number ("REG-000042") must not be treated as phone digits.
  const isReference = /^reg[-\s]?\d*$/i.test(q);
  const phoneDigits = isReference ? "" : q.replace(/\D/g, "").replace(/^0+/, "");
  const status = opts.status && opts.status !== "all" ? opts.status : null;
  return sql.unsafe<Registration[]>(
    `select ${REG_COLUMNS} from registrations
     where anonymized_at is null
       and ($1::text is null or status = $1)
       and ($2::text = '' or full_name ilike '%' || $2 || '%' or reference ilike '%' || $2 || '%'
            or ($3::text <> '' and regexp_replace(phone, '\\D', '', 'g') like '%' || $3 || '%'))
     order by created_at desc
     limit $4`,
    [status, q.replace(/[%_\\]/g, "\\$&"), phoneDigits.length >= 4 ? phoneDigits : "", opts.limit ?? 2000],
  );
}

export async function getRegistration(id: string): Promise<Registration | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db().unsafe<Registration[]>(`select ${REG_COLUMNS} from registrations where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function recentRegistrations(limit = 8): Promise<Registration[]> {
  return db().unsafe<Registration[]>(
    `select ${REG_COLUMNS} from registrations where anonymized_at is null order by created_at desc limit $1`,
    [limit],
  );
}

export type UpdateResult = { ok: true } | { ok: false; error: string };

/** Admin edit. Re-checks capacity under the same lock when places would increase. */
export async function updateRegistration(
  id: string,
  patch: {
    fullName: string;
    phone: string;
    email: string | null;
    guestCount: number;
    ticketType: "normal" | "vip";
    status: RegistrationStatus;
    adminNote: string;
  },
): Promise<UpdateResult> {
  return db().begin(async (tx) => {
    const [settings] = await tx<{ max_capacity: number; vip_capacity: number }[]>`
      select max_capacity, vip_capacity from event_settings where id = 1 for update`;
    const [current] = await tx<{ status: RegistrationStatus; guest_count: number; anonymized_at: Date | null }[]>`
      select status, guest_count, anonymized_at from registrations where id = ${id} for update`;
    if (!current) return { ok: false, error: "Registration not found." };
    if (current.anonymized_at) return { ok: false, error: "This registration was anonymised and can no longer be edited." };
    if (patch.status === "pending_payment" && current.status !== "pending_payment") {
      return { ok: false, error: '"Awaiting payment" is set only by the online payment. Choose another status.' };
    }

    const seated = patch.status === "confirmed" || patch.status === "checked_in" || patch.status === "pending_payment";
    if (seated) {
      const split = await reservedSplit(tx, id);
      if (patch.ticketType === "vip" && split.vip + patch.guestCount > settings.vip_capacity) {
        const free = Math.max(0, settings.vip_capacity - split.vip);
        return {
          ok: false,
          error: `Not enough VIP places: only ${free} VIP place(s) available. Raise the VIP capacity in Event settings, reduce the guests, or use a normal ticket.`,
        };
      }
      const others = split.total;
      if (others + patch.guestCount > settings.max_capacity) {
        const free = Math.max(0, settings.max_capacity - others);
        return {
          ok: false,
          error: `Not enough capacity: only ${free} place(s) available for this registration. Raise the maximum capacity in Event settings or reduce the number of guests.`,
        };
      }
    }
    if (patch.status !== "cancelled") {
      const [taken] = await tx`
        select reference from registrations
        where phone = ${patch.phone} and id <> ${id} and status <> 'cancelled' and anonymized_at is null`;
      if (taken) return { ok: false, error: `Another active registration (${taken.reference}) already uses this phone number.` };
    }
    await tx`
      update registrations set
        full_name = ${patch.fullName}, phone = ${patch.phone}, email = ${patch.email},
        guest_count = ${patch.guestCount}, ticket_type = ${patch.ticketType}, status = ${patch.status}, admin_note = ${patch.adminNote},
        cancelled_at = case when ${patch.status} = 'cancelled' then coalesce(cancelled_at, now()) else null end,
        updated_at = now()
      where id = ${id}`;
    return { ok: true };
  });
}

export async function setStatus(id: string, status: RegistrationStatus): Promise<UpdateResult> {
  const reg = await getRegistration(id);
  if (!reg) return { ok: false, error: "Registration not found." };
  return updateRegistration(id, {
    fullName: reg.full_name,
    phone: reg.phone,
    email: reg.email,
    guestCount: reg.guest_count,
    ticketType: reg.ticket_type,
    status,
    adminNote: reg.admin_note,
  });
}

/** Daily activity for the dashboard chart. */
export async function dailyActivity(days = 21): Promise<{ day: string; registrations: number; guests: number }[]> {
  const sql = db();
  return sql<{ day: string; registrations: number; guests: number }[]>`
    with d as (
      select generate_series(
        (now() at time zone ${process.env.EVENT_TIMEZONE || "Europe/Berlin"})::date - (${days}::int - 1),
        (now() at time zone ${process.env.EVENT_TIMEZONE || "Europe/Berlin"})::date,
        interval '1 day')::date as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day,
           count(r.id)::int as registrations,
           coalesce(sum(r.guest_count), 0)::int as guests
    from d
    left join registrations r
      on (r.created_at at time zone ${process.env.EVENT_TIMEZONE || "Europe/Berlin"})::date = d.day
     and r.status <> 'cancelled'
    group by d.day order by d.day`;
}

/**
 * GDPR retention: removes personal data while keeping anonymous counts.
 * `all = true` anonymises everything immediately (admin action).
 * Otherwise anonymises when event_date + data_retention_days has passed.
 */
export async function anonymizeRegistrations(all = false): Promise<number> {
  const sql = db();
  const rows = all
    ? await sql`
        update registrations set full_name = 'Anonymised', phone = '+' || reference,
          email = null, admin_note = '', idempotency_key = null, anonymized_at = now(), updated_at = now()
        where anonymized_at is null returning id`
    : await sql`
        update registrations r set full_name = 'Anonymised', phone = '+' || r.reference,
          email = null, admin_note = '', idempotency_key = null, anonymized_at = now(), updated_at = now()
        from event_settings s
        where s.id = 1 and r.anonymized_at is null and s.event_date is not null
          and now() > (s.event_date + make_interval(days => s.data_retention_days + 1))
        returning r.id`;
  return rows.count;
}
