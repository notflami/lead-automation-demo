import { describe, expect, it } from "vitest";
import { decideCapacity } from "./capacity";
import { normalizePhone } from "./phone";
import { validateRegistration } from "./validation";

describe("decideCapacity (counts people, not forms)", () => {
  const base = { reservedPlaces: 0, maxCapacity: 10, registrationOpen: true, waitlistEnabled: false };
  it("accepts when enough places", () => {
    expect(decideCapacity({ ...base, guests: 3 })).toEqual({ ok: true, status: "confirmed" });
  });
  it("matches the brief's example: 3 + 2 + 5 = 10 places → full", () => {
    expect(decideCapacity({ ...base, reservedPlaces: 10, guests: 1 })).toMatchObject({ ok: false, reason: "full" });
  });
  it("accepts exactly the remaining places", () => {
    expect(decideCapacity({ ...base, reservedPlaces: 7, guests: 3 })).toMatchObject({ ok: true });
  });
  it("rejects a group larger than remaining places", () => {
    expect(decideCapacity({ ...base, reservedPlaces: 8, guests: 3 })).toMatchObject({ ok: false, reason: "not_enough", remaining: 2 });
  });
  it("waitlists only with explicit consent", () => {
    const wl = { ...base, waitlistEnabled: true, reservedPlaces: 10, guests: 2 };
    expect(decideCapacity(wl)).toMatchObject({ ok: false, reason: "full", waitlistAvailable: true });
    expect(decideCapacity({ ...wl, acceptWaitlist: true })).toEqual({ ok: true, status: "waitlisted" });
  });
  it("blocks everything when registration is closed", () => {
    expect(decideCapacity({ ...base, registrationOpen: false, guests: 1, acceptWaitlist: true })).toMatchObject({ ok: false, reason: "closed" });
  });
  it("never reports negative remaining after capacity was lowered", () => {
    expect(decideCapacity({ ...base, reservedPlaces: 15, guests: 1 })).toMatchObject({ remaining: 0 });
  });
});

describe("normalizePhone", () => {
  it.each([
    ["0176 1234567", "+491761234567"],
    ["+49 (176) 123-4567", "+491761234567"],
    ["0049 176 1234567", "+491761234567"],
    ["+387 61 123 456", "+38761123456"],
    ["00381 64 1234567", "+381641234567"],
    ["176 1234567", "+491761234567"],
  ])("%s → %s", (input, out) => expect(normalizePhone(input)).toBe(out));
  it.each(["", "abc", "123", "+49 176 12 34 56 78 90 12 34", "+49+176"])("rejects %s", (input) =>
    expect(normalizePhone(input)).toBeNull(),
  );
});

describe("validateRegistration", () => {
  const opts = { maxGuests: 8, defaultCountryCode: "49" };
  const good = {
    fullName: "  Ana   Petrović ",
    phone: "0176 1234567",
    guestCount: 3,
    idempotencyKey: "6f1c1a8e-7f0e-4b8e-9a4f-2d1c3b4a5e6f",
    locale: "de",
  };
  it("accepts and normalises valid input", () => {
    const r = validateRegistration(good, opts);
    expect(r.ok && r.data).toMatchObject({ fullName: "Ana Petrović", phone: "+491761234567", guestCount: 3, locale: "de" });
  });
  it("needs only name, phone and guest count", () => {
    const { fullName, phone, guestCount, idempotencyKey } = good;
    expect(validateRegistration({ fullName, phone, guestCount, idempotencyKey }, opts).ok).toBe(true);
  });
  it("enforces max guests per registration", () => {
    const r = validateRegistration({ ...good, guestCount: 9 }, opts);
    expect(!r.ok && r.errors.guestCount).toBe("guests_too_many");
  });
  it("rejects links in the name field (spam)", () => {
    const r = validateRegistration({ ...good, fullName: "Buy now http://spam.example" }, opts);
    expect(!r.ok && r.errors.fullName).toBe("name_invalid");
  });
  it("rejects fractional / string guest counts", () => {
    expect(validateRegistration({ ...good, guestCount: 2.5 }, opts).ok).toBe(false);
    expect(validateRegistration({ ...good, guestCount: "x" }, opts).ok).toBe(false);
  });
});
