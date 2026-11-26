import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { isAdmin } from "./auth";
import { db } from "./db";
import { env } from "./env";

/**
 * Door check-in: security staff open /door, sign in with the door password (set in Event settings),
 * scan the guest's QR code and admit the group. One QR code is valid for all places of a reservation;
 * checked_in_guests counts how many of them have entered.
 */

export const DOOR_COOKIE = "door_session";
const DOOR_HOURS = 16;

// ------------------------------------------------------------------ password
export function hashDoorPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function checkDoorPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function doorPasswordHash(): Promise<string> {
  const [row] = await db()<{ door_password_hash: string }[]>`select door_password_hash from event_settings where id = 1`;
  return row?.door_password_hash ?? "";
}

/** Changes whenever the password changes, so a new password signs out every door phone. */
const passwordVersion = (hash: string) => createHash("sha256").update(hash).digest("hex").slice(0, 16);
const key = () => new TextEncoder().encode(env.sessionSecret);

export async function doorSignIn(password: string): Promise<boolean> {
  const hash = await doorPasswordHash();
  if (!hash || !checkDoorPassword(password, hash)) return false;
  const token = await new SignJWT({ role: "door", pv: passwordVersion(hash) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DOOR_HOURS}h`)
    .setAudience("event-door")
    .sign(key());
  (await cookies()).set(DOOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DOOR_HOURS * 3600,
  });
  return true;
}

export async function doorSignOut(): Promise<void> {
  (await cookies()).delete(DOOR_COOKIE);
}

/** Door staff with a valid session, or a signed-in admin. */
export async function canUseDoor(): Promise<boolean> {
  if (await isAdmin()) return true;
  const token = (await cookies()).get(DOOR_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: "event-door", algorithms: ["HS256"] });
    const hash = await doorPasswordHash();
    return payload.role === "door" && hash !== "" && payload.pv === passwordVersion(hash);
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ guests
/** What the door screen shows. "ok" = may enter; everything else = stop. */
export type DoorVerdict = "ok" | "all_in" | "cancelled" | "refunded" | "waitlisted" | "unpaid" | "anonymised";

export interface DoorGuest {
  id: string;
  reference: string;
  fullName: string;
  guestCount: number;
  checkedIn: number;
  ticketType: "normal" | "vip";
  paid: boolean;
  checkedInAt: string | null;
  verdict: DoorVerdict;
}

interface Row {
  id: string;
  reference: string;
  full_name: string;
  guest_count: number;
  checked_in_guests: number;
  ticket_type: "normal" | "vip";
  status: string;
  payment_status: string;
  checked_in_at: Date | null;
  anonymized_at: Date | null;
}

const COLUMNS = `id, reference, full_name, guest_count, checked_in_guests, ticket_type, status, payment_status, checked_in_at, anonymized_at`;

function verdictOf(r: Row): DoorVerdict {
  if (r.anonymized_at) return "anonymised";
  if (r.payment_status === "refunded") return "refunded";
  if (r.status === "cancelled") return "cancelled";
  if (r.status === "waitlisted") return "waitlisted";
  if (r.status === "pending_payment") return "unpaid";
  if (r.checked_in_guests >= r.guest_count) return "all_in";
  return "ok";
}

function toGuest(r: Row): DoorGuest {
  return {
    id: r.id,
    reference: r.reference,
    fullName: r.full_name,
    guestCount: r.guest_count,
    checkedIn: r.checked_in_guests,
    ticketType: r.ticket_type,
    paid: r.payment_status === "paid",
    checkedInAt: r.checked_in_at ? r.checked_in_at.toISOString() : null,
    verdict: verdictOf(r),
  };
}

/** Ticket code from a scanned QR (the ticket link) or a pasted link/code. */
export function ticketTokenFrom(input: string): string | null {
  const m = /(?:^|\/ticket\/)([a-f0-9]{64})(?:[/?#]|$)/i.exec(input.trim());
  return m ? m[1].toLowerCase() : null;
}

/** "REG-000042", "reg 42", "42" → "REG-000042". */
export function referenceFrom(input: string): string | null {
  const m = /^(?:reg[-\s]?)?(\d{1,9})$/i.exec(input.trim());
  return m ? `REG-${m[1].padStart(6, "0")}` : null;
}

export type LookupResult = { kind: "guest"; guest: DoorGuest } | { kind: "list"; guests: DoorGuest[] } | { kind: "not_found" };

/** Finds a reservation by scanned QR code, registration number, or (for guests without phone) by name. */
export async function doorLookup(input: string): Promise<LookupResult> {
  const sql = db();
  const text = input.trim().slice(0, 500);
  const token = ticketTokenFrom(text);
  if (token) {
    const rows = await sql.unsafe<Row[]>(`select ${COLUMNS} from registrations where ticket_token = $1`, [token]);
    return rows[0] ? { kind: "guest", guest: toGuest(rows[0]) } : { kind: "not_found" };
  }
  const reference = referenceFrom(text);
  if (reference) {
    const rows = await sql.unsafe<Row[]>(`select ${COLUMNS} from registrations where reference = $1`, [reference]);
    return rows[0] ? { kind: "guest", guest: toGuest(rows[0]) } : { kind: "not_found" };
  }
  if (text.length < 2) return { kind: "not_found" };
  const rows = await sql.unsafe<Row[]>(
    `select ${COLUMNS} from registrations
     where anonymized_at is null and status <> 'pending_payment' and full_name ilike '%' || $1 || '%'
     order by (status in ('confirmed', 'checked_in')) desc, full_name limit 12`,
    [text.replace(/[%_\\]/g, "\\$&")],
  );
  if (rows.length === 0) return { kind: "not_found" };
  return { kind: "list", guests: rows.map(toGuest) };
}

export async function doorGuest(id: string): Promise<DoorGuest | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db().unsafe<Row[]>(`select ${COLUMNS} from registrations where id = $1`, [id]);
  return rows[0] ? toGuest(rows[0]) : null;
}

/**
 * Admits `count` people of a reservation. Atomic: two door phones scanning the same QR code at the
 * same moment can never admit more people than the reservation has.
 */
export async function doorCheckIn(id: string, count: number): Promise<{ ok: boolean; guest: DoorGuest | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(count) || count < 1) return { ok: false, guest: await doorGuest(id) };
  const rows = await db().unsafe<Row[]>(
    `update registrations set
       checked_in_guests = checked_in_guests + $2, status = 'checked_in',
       checked_in_at = coalesce(checked_in_at, now()), updated_at = now()
     where id = $1 and status in ('confirmed', 'checked_in') and anonymized_at is null
       and payment_status <> 'refunded' and checked_in_guests + $2 <= guest_count
     returning ${COLUMNS}`,
    [id, count],
  );
  if (rows[0]) return { ok: true, guest: toGuest(rows[0]) };
  return { ok: false, guest: await doorGuest(id) };
}

/** Takes back a check-in made by mistake. */
export async function doorUndo(id: string, count: number): Promise<DoorGuest | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(count) || count < 1) return null;
  const rows = await db().unsafe<Row[]>(
    `update registrations set
       checked_in_guests = greatest(0, checked_in_guests - $2),
       status = case when checked_in_guests - $2 <= 0 then 'confirmed' else status end,
       checked_in_at = case when checked_in_guests - $2 <= 0 then null else checked_in_at end,
       updated_at = now()
     where id = $1 and status = 'checked_in'
     returning ${COLUMNS}`,
    [id, count],
  );
  return rows[0] ? toGuest(rows[0]) : doorGuest(id);
}

/** People inside / people expected (online reservations only). */
export async function doorCounts(): Promise<{ inside: number; expected: number }> {
  const [row] = await db()<{ inside: number; expected: number }[]>`
    select coalesce(sum(checked_in_guests), 0)::int as inside,
           coalesce(sum(guest_count) filter (where status in ('confirmed', 'checked_in')), 0)::int as expected
    from registrations`;
  return row;
}
