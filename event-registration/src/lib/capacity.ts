export type CapacityDecision =
  | { ok: true; status: "confirmed" | "waitlisted" }
  | { ok: false; reason: "closed" | "full" | "not_enough"; remaining: number; waitlistAvailable: boolean };

/**
 * Pure capacity rule — capacity is counted in PEOPLE, not registration forms.
 * Must be evaluated while holding the event_settings row lock (see registrations.ts)
 * so that simultaneous submissions cannot overbook.
 *
 * Nobody is put on the waiting list without explicitly agreeing (`acceptWaitlist`).
 */
export function decideCapacity(input: {
  guests: number;
  reservedPlaces: number;
  maxCapacity: number;
  registrationOpen: boolean;
  waitlistEnabled: boolean;
  acceptWaitlist?: boolean;
}): CapacityDecision {
  const remaining = Math.max(0, input.maxCapacity - input.reservedPlaces);
  const waitlistAvailable = input.registrationOpen && input.waitlistEnabled;
  if (!input.registrationOpen) return { ok: false, reason: "closed", remaining, waitlistAvailable };
  if (input.guests <= remaining) return { ok: true, status: "confirmed" };
  if (waitlistAvailable && input.acceptWaitlist) return { ok: true, status: "waitlisted" };
  return { ok: false, reason: remaining > 0 ? "not_enough" : "full", remaining, waitlistAvailable };
}
