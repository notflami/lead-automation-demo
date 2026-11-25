import "server-only";
import { db } from "./db";
import type { EventSettings } from "./types";

const COLUMNS = `event_name, tagline, to_char(event_date, 'YYYY-MM-DD') as event_date,
  to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time,
  venue_name, venue_address, venue_map_url, about_text, expectations, dress_code, additional_info,
  max_capacity, vip_capacity, ticket_normal_info, ticket_vip_info, max_guests_per_registration, low_capacity_threshold, registration_open, waitlist_enabled,
  contact_email, contact_phone, whatsapp_number, organizer_name, organizer_address, privacy_notes, data_retention_days, updated_at`;

export async function getSettings(): Promise<EventSettings> {
  const rows = await db().unsafe<EventSettings[]>(`select ${COLUMNS} from event_settings where id = 1`);
  if (!rows[0]) throw new Error("event_settings row missing — run `npm run db:migrate`.");
  return rows[0];
}

export const SETTINGS_SELECT = COLUMNS;
