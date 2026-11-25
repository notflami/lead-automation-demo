import "server-only";
import { cache } from "react";
import { db } from "./db";
import { TRANSLATABLE_FIELDS, type EventSettings } from "./types";

const COLUMNS = `event_name, tagline, to_char(event_date, 'YYYY-MM-DD') as event_date,
  to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time,
  venue_name, venue_address, venue_map_url, about_text, expectations, dress_code, additional_info,
  max_capacity, vip_capacity, price_normal_cents, price_vip_cents, ticket_normal_info, ticket_vip_info, max_guests_per_registration, min_age, low_capacity_threshold, registration_open, waitlist_enabled,
  contact_email, contact_phone, whatsapp_number, organizer_name, organizer_address, privacy_notes, data_retention_days, translations, updated_at`;

/** Loaded once per request, even when the layout, metadata and page all need it. */
export const getSettings = cache(async (): Promise<EventSettings> => {
  const rows = await db().unsafe<EventSettings[]>(`select ${COLUMNS} from event_settings where id = 1`);
  if (!rows[0]) throw new Error("event_settings row missing — run `npm run db:migrate`.");
  return rows[0];
});

export const SETTINGS_SELECT = COLUMNS;

/** Event settings with the editable texts in the visitor's language (falls back to German when empty). */
export function localizeSettings(s: EventSettings, locale: string): EventSettings {
  const tr = locale === "de" ? undefined : s.translations?.[locale];
  if (!tr) return s;
  const out = { ...s };
  for (const f of TRANSLATABLE_FIELDS) {
    const v = tr[f]?.trim();
    if (v) out[f] = v;
  }
  return out;
}
