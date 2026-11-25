export type RegistrationStatus = "confirmed" | "waitlisted" | "checked_in" | "cancelled";
export const STATUSES: RegistrationStatus[] = ["confirmed", "waitlisted", "checked_in", "cancelled"];
/** Statuses that occupy capacity. */
export const SEATED: RegistrationStatus[] = ["confirmed", "checked_in"];

/** Texts organizers edit that can be translated per language (event name and address are not). */
export const TRANSLATABLE_FIELDS = [
  "tagline",
  "about_text",
  "expectations",
  "dress_code",
  "additional_info",
  "ticket_normal_info",
  "ticket_vip_info",
] as const;
export type TranslatableField = (typeof TRANSLATABLE_FIELDS)[number];

export interface EventSettings {
  event_name: string;
  tagline: string;
  event_date: string | null; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  end_time: string | null;
  venue_name: string;
  venue_address: string;
  venue_map_url: string;
  about_text: string;
  expectations: string;
  dress_code: string;
  additional_info: string;
  max_capacity: number;
  vip_capacity: number;
  price_normal_cents: number;
  price_vip_cents: number;
  ticket_normal_info: string;
  ticket_vip_info: string;
  max_guests_per_registration: number;
  min_age: number;
  low_capacity_threshold: number;
  registration_open: boolean;
  waitlist_enabled: boolean;
  contact_email: string;
  contact_phone: string;
  whatsapp_number: string;
  organizer_name: string;
  organizer_address: string;
  privacy_notes: string;
  data_retention_days: number;
  /** Translations of the editable texts: translations[lang][field]. German is the base text. */
  translations: Partial<Record<string, Partial<Record<TranslatableField, string>>>>;
  updated_at: Date;
}

export interface Registration {
  id: string;
  reference: string;
  full_name: string;
  phone: string;
  email: string | null;
  guest_count: number;
  ticket_type: "normal" | "vip";
  status: RegistrationStatus;
  locale: string;
  admin_note: string;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
  anonymized_at: Date | null;
  webhook_status: "pending" | "sent" | "failed" | "skipped";
  webhook_attempts: number;
  webhook_last_error: string | null;
  webhook_sent_at: Date | null;
}

export interface CapacityStats {
  registrations: number; // active forms (not cancelled, not waitlisted)
  reservedPlaces: number; // guests in confirmed + checked-in
  checkedInPlaces: number;
  waitlistedRegistrations: number;
  waitlistedPlaces: number;
  cancelledRegistrations: number;
  maxCapacity: number;
  remaining: number;
  vipReservedPlaces: number;
  vipCapacity: number;
  averageGuests: number;
}
