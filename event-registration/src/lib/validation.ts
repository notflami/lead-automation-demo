import { z } from "zod";
import { normalizePhone } from "./phone";
import { STATUSES } from "./types";

export const MAX_GUESTS_HARD_LIMIT = 50;

export type FieldErrorCode =
  | "name_required"
  | "name_invalid"
  | "phone_invalid"
  | "guests_invalid"
  | "guests_too_many"
  | "form_invalid";

export interface RegistrationInput {
  fullName: string;
  phone: string; // normalised
  guestCount: number;
  locale: "en" | "de";
  idempotencyKey: string;
  acceptWaitlist: boolean;
}

const uuid = z.string().uuid();

/** Collapses whitespace and strips control characters. */
export function cleanText(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateRegistration(
  body: Record<string, unknown>,
  opts: { maxGuests: number; defaultCountryCode: string },
): { ok: true; data: RegistrationInput } | { ok: false; errors: Partial<Record<string, FieldErrorCode>> } {
  const errors: Partial<Record<string, FieldErrorCode>> = {};

  const fullName = cleanText(body.fullName, 120);
  if (!fullName) errors.fullName = "name_required";
  else if (fullName.length < 2 || !/\p{L}/u.test(fullName) || /[<>{}\\]|https?:|www\./i.test(fullName))
    errors.fullName = "name_invalid";

  const phone = normalizePhone(cleanText(body.phone, 40), opts.defaultCountryCode);
  if (!phone) errors.phone = "phone_invalid";

  const guestCount = Number(body.guestCount);
  if (!Number.isInteger(guestCount) || guestCount < 1) errors.guestCount = "guests_invalid";
  else if (guestCount > Math.min(opts.maxGuests, MAX_GUESTS_HARD_LIMIT)) errors.guestCount = "guests_too_many";

  const idem = uuid.safeParse(body.idempotencyKey);

  if (Object.keys(errors).length || !idem.success) {
    if (!idem.success && !Object.keys(errors).length) errors.form = "form_invalid";
    return { ok: false, errors };
  }
  return {
    ok: true,
    data: {
      fullName,
      phone: phone!,
      guestCount,
      locale: body.locale === "de" ? "de" : "en",
      idempotencyKey: idem.data!,
      acceptWaitlist: body.acceptWaitlist === true,
    },
  };
}

/** Admin edit form. */
export const adminRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(4).max(40),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(254)]),
  guestCount: z.coerce.number().int().min(1).max(MAX_GUESTS_HARD_LIMIT),
  status: z.enum(STATUSES as [string, ...string[]]),
  adminNote: z.string().max(2000),
});

const optionalText = (max: number) => z.string().trim().max(max);
const timeOrEmpty = z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]);

export const settingsSchema = z.object({
  event_name: z.string().trim().min(2).max(120),
  tagline: optionalText(200),
  event_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  start_time: timeOrEmpty,
  end_time: timeOrEmpty,
  venue_name: optionalText(160),
  venue_address: optionalText(300),
  venue_map_url: z.union([z.literal(""), z.string().trim().url().max(1000).refine((u) => /^https:\/\//.test(u), "https only")]),
  about_text: optionalText(3000),
  expectations: optionalText(2000),
  dress_code: optionalText(300),
  additional_info: optionalText(2000),
  max_capacity: z.coerce.number().int().min(1).max(100000),
  max_guests_per_registration: z.coerce.number().int().min(1).max(MAX_GUESTS_HARD_LIMIT),
  low_capacity_threshold: z.coerce.number().int().min(0).max(100000),
  registration_open: z.boolean(),
  waitlist_enabled: z.boolean(),
  contact_email: z.union([z.literal(""), z.string().trim().email().max(254)]),
  contact_phone: optionalText(40),
  whatsapp_number: optionalText(40),
  organizer_name: optionalText(200),
  organizer_address: optionalText(500),
  privacy_notes: optionalText(4000),
  data_retention_days: z.coerce.number().int().min(0).max(3650),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
