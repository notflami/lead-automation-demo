export type RegistrationStatus = "confirmed" | "waitlisted" | "checked_in" | "cancelled";
export const STATUSES: RegistrationStatus[] = ["confirmed", "waitlisted", "checked_in", "cancelled"];
/** Statuses that occupy capacity. */
export const SEATED: RegistrationStatus[] = ["confirmed", "checked_in"];

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
  max_guests_per_registration: number;
  low_capacity_threshold: number;
  registration_open: boolean;
  waitlist_enabled: boolean;
  contact_email: string;
  contact_phone: string;
  organizer_name: string;
  organizer_address: string;
  privacy_notes: string;
  data_retention_days: number;
  updated_at: Date;
}

export interface Registration {
  id: string;
  reference: string;
  full_name: string;
  phone: string;
  email: string | null;
  guest_count: number;
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
  averageGuests: number;
}
