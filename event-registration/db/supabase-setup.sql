-- One-time database setup for Supabase (or any PostgreSQL).
-- Supabase: open your project → SQL Editor → New query → paste this whole file → Run.
-- Safe to run more than once. Generated from db/migrations/*.sql.

create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now());

-- ===== 001_initial_schema.sql =====
-- Event Registration Platform — initial schema
-- Works on any PostgreSQL 13+ (Supabase, Neon, self-hosted).

-- ---------------------------------------------------------------------------
-- Event settings: exactly one row (id = 1), edited from the admin dashboard.
-- ---------------------------------------------------------------------------
create table if not exists event_settings (
  id                          smallint primary key default 1 check (id = 1),
  event_name                  text        not null,
  tagline                     text        not null default '',
  event_date                  date,
  start_time                  time,
  end_time                    time,
  venue_name                  text        not null default '',
  venue_address               text        not null default '',
  venue_map_url               text        not null default '',
  about_text                  text        not null default '',
  expectations                text        not null default '',   -- one item per line
  dress_code                  text        not null default '',
  additional_info             text        not null default '',
  max_capacity                integer     not null default 250 check (max_capacity between 1 and 100000),
  max_guests_per_registration integer     not null default 8   check (max_guests_per_registration between 1 and 50),
  low_capacity_threshold      integer     not null default 30  check (low_capacity_threshold >= 0),
  registration_open           boolean     not null default true,
  waitlist_enabled            boolean     not null default true,
  contact_email               text        not null default '',
  contact_phone               text        not null default '',
  organizer_name              text        not null default '',
  organizer_address           text        not null default '',
  data_retention_days         integer     not null default 30 check (data_retention_days between 0 and 3650),
  updated_at                  timestamptz not null default now()
);

insert into event_settings (
  id, event_name, tagline, event_date, start_time, end_time,
  venue_name, venue_address, about_text, expectations, dress_code, additional_info,
  max_capacity, organizer_name
) values (
  1,
  'Balkan Night',
  'One long table. Many languages. Music until late.',
  current_date + 21,
  '19:00',
  '02:00',
  'Venue name (edit in admin)',
  'Street 1, 10115 Berlin',
  'An evening of Balkan music, food and dance, open to everyone. Bring your family, your friends and your appetite. Whether you grew up with these songs or are hearing them for the first time, you will feel at home.',
  E'Live music and a DJ until late\nTraditional dishes and drinks from across the region\nKolo dancing: no experience needed\nA mix of generations, languages and backgrounds',
  'Smart casual. Traditional dress is welcome.',
  'Entry is free with a reservation. Please bring your registration number.',
  250,
  'Organizer name (edit in admin)'
) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Registrations
-- ---------------------------------------------------------------------------
create sequence if not exists registration_number_seq start 1;

create table if not exists registrations (
  id                   uuid        primary key default gen_random_uuid(),
  reference            text        not null unique
                         default ('REG-' || lpad(nextval('registration_number_seq')::text, 6, '0')),
  full_name            text        not null check (char_length(full_name) between 2 and 120),
  phone                text        not null check (char_length(phone) between 6 and 20),  -- normalised E.164
  email                text        check (email is null or char_length(email) <= 254),
  guest_count          integer     not null check (guest_count between 1 and 50),
  status               text        not null default 'confirmed'
                         check (status in ('confirmed', 'waitlisted', 'checked_in', 'cancelled')),
  locale               text        not null default 'en',
  idempotency_key      uuid        unique,
  privacy_accepted_at  timestamptz not null,
  admin_note           text        not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  cancelled_at         timestamptz,
  anonymized_at        timestamptz,
  webhook_status       text        not null default 'pending'
                         check (webhook_status in ('pending', 'sent', 'failed', 'skipped')),
  webhook_attempts     integer     not null default 0,
  webhook_last_error   text,
  webhook_sent_at      timestamptz
);

-- One active reservation per phone number (cancelled / anonymised rows don't count).
create unique index if not exists registrations_active_phone_uniq
  on registrations (phone)
  where status <> 'cancelled' and anonymized_at is null;

create index if not exists registrations_created_at_idx on registrations (created_at desc);
create index if not exists registrations_status_idx     on registrations (status);
create index if not exists registrations_webhook_idx    on registrations (webhook_status)
  where webhook_status in ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- Rate limiting (stores only salted hashes of IP addresses; purged regularly)
-- ---------------------------------------------------------------------------
create table if not exists rate_limit_hits (
  bucket     text        not null,
  key_hash   text        not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup_idx on rate_limit_hits (bucket, key_hash, created_at);
insert into schema_migrations (name) values ('001_initial_schema.sql') on conflict do nothing;

-- ===== 002_privacy_notes.sql =====
-- Free-text addition to the privacy notice (e.g. hosting / database providers),
-- editable in the admin settings so legal wording can change without a deploy.
alter table event_settings add column if not exists privacy_notes text not null default '';
insert into schema_migrations (name) values ('002_privacy_notes.sql') on conflict do nothing;

-- ===== 003_enable_rls.sql =====
-- Supabase exposes tables in the public schema through its REST/GraphQL API.
-- Enabling row level security with NO policies blocks that API entirely; the app
-- connects as the table owner, which RLS does not restrict. Harmless on plain PostgreSQL.
alter table event_settings  enable row level security;
alter table registrations   enable row level security;
alter table rate_limit_hits enable row level security;
insert into schema_migrations (name) values ('003_enable_rls.sql') on conflict do nothing;

-- ===== 004_whatsapp_number.sql =====
-- Event contact number for the WhatsApp click-to-chat button (empty = button hidden).
alter table event_settings add column if not exists whatsapp_number text not null default '';
insert into schema_migrations (name) values ('004_whatsapp_number.sql') on conflict do nothing;

-- ===== 005_tickets_and_event_content.sql =====
-- Ticket types: "normal" and "vip". VIP places are part of the total capacity
-- and additionally limited by vip_capacity (0 = VIP option hidden).
alter table registrations add column if not exists ticket_type text not null default 'normal';
do $$ begin
  alter table registrations add constraint registrations_ticket_type_check check (ticket_type in ('normal', 'vip'));
exception when duplicate_object then null; end $$;

alter table event_settings add column if not exists vip_capacity    integer not null default 20 check (vip_capacity between 0 and 100000);
alter table event_settings add column if not exists ticket_normal_info text not null default '';
alter table event_settings add column if not exists ticket_vip_info    text not null default '';

-- Event content for 19 December 2026 in Zwickau. Only replaces the original
-- placeholder content, never text an organizer has already edited.
update event_settings set
  tagline         = 'Musik, Drinks und Balkan-Kultur – ein Abend für alle.',
  event_date      = '2026-12-19',
  start_time      = '22:00',
  end_time        = null,
  venue_name      = 'Crimmitschauer Str. 77',
  venue_address   = '08058 Zwickau',
  about_text      = E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.',
  expectations    = E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen',
  dress_code      = 'Schick-leger. Traditionelle Kleidung ist willkommen.',
  additional_info = 'Bitte bringt eure Reservierungsnummer mit.',
  updated_at      = now()
where id = 1 and venue_name = 'Venue name (edit in admin)';
insert into schema_migrations (name) values ('005_tickets_and_event_content.sql') on conflict do nothing;
