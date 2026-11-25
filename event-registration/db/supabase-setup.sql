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

-- ===== 006_text_translations.sql =====
-- Translations of the texts organizers edit in "Event settings".
-- German (the normal columns) is the base; translations[lang][field] override it per language.
-- An empty or missing translation falls back to the German text.
alter table event_settings add column if not exists translations jsonb not null default '{}'::jsonb;

-- Pre-fill translations of the current event texts. Only when no translations exist yet, and only for
-- fields whose German text still matches the text that was translated (ignoring spaces and case).
do $$
declare
  r record;
  current_text text;
begin
  if (select translations from event_settings where id = 1) <> '{}'::jsonb then
    return;
  end if;
  for r in
    select * from (values
    (E'tagline', E'en', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Music, drinks and Balkan culture – an evening for everyone.'),
    (E'about_text', E'en', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'A cultural evening with music from the Balkans, a well-stocked bar and guests from many countries.\n\nWhether you grew up with these songs or are hearing them for the first time: come along, celebrate with us and meet new people.'),
    (E'expectations', E'en', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Live music and a DJ until late at night\nBar with drinks and specialities from the Balkans\nCultural programme and kolo dancing to join in\nGuests from many countries and generations'),
    (E'dress_code', E'en', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Smart casual. Traditional dress is welcome.'),
    (E'additional_info', E'en', E'Bitte bringt eure Reservierungsnummer mit.', E'Please bring your reservation number.'),
    (E'ticket_normal_info', E'en', E'Stehplatz, Selbstbedienung', E'Standing place, self-service'),
    (E'ticket_vip_info', E'en', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Incl. parking space, seat and table service'),
    (E'tagline', E'sq', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Muzikë, pije dhe kulturë ballkanike – një mbrëmje për të gjithë.'),
    (E'about_text', E'sq', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Një mbrëmje kulturore me muzikë nga Ballkani, një bar të pasur dhe mysafirë nga shumë vende.\n\nNëse jeni rritur me këto këngë apo i dëgjoni për herë të parë: ejani, festoni me ne dhe njihuni me njerëz të rinj.'),
    (E'expectations', E'sq', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Muzikë live dhe DJ deri natën vonë\nBar me pije dhe specialitete nga Ballkani\nProgram kulturor dhe valle kolo për të gjithë\nMysafirë nga shumë vende dhe breza'),
    (E'dress_code', E'sq', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Elegant dhe i rehatshëm. Veshja tradicionale është e mirëpritur.'),
    (E'additional_info', E'sq', E'Bitte bringt eure Reservierungsnummer mit.', E'Ju lutemi sillni numrin e rezervimit.'),
    (E'ticket_normal_info', E'sq', E'Stehplatz, Selbstbedienung', E'Vend në këmbë, vetëshërbim'),
    (E'ticket_vip_info', E'sq', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Përfshin parkim, vend për t\'u ulur dhe shërbim në tavolinë'),
    (E'tagline', E'bs', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Muzika, piće i balkanska kultura – večer za sve.'),
    (E'about_text', E'bs', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Kulturna večer uz muziku s Balkana, dobro opremljen bar i goste iz mnogih zemalja.\n\nBez obzira jeste li odrasli uz ove pjesme ili ih slušate prvi put: dođite, slavite s nama i upoznajte nove ljude.'),
    (E'expectations', E'bs', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Muzika uživo i DJ do kasno u noć\nBar s pićem i specijalitetima s Balkana\nKulturni program i kolo za sve\nGosti iz mnogih zemalja i generacija'),
    (E'dress_code', E'bs', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Elegantno-ležerno. Tradicionalna odjeća je dobrodošla.'),
    (E'additional_info', E'bs', E'Bitte bringt eure Reservierungsnummer mit.', E'Molimo ponesite svoj broj rezervacije.'),
    (E'ticket_normal_info', E'bs', E'Stehplatz, Selbstbedienung', E'Mjesto za stajanje, samoposluživanje'),
    (E'ticket_vip_info', E'bs', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Uključuje parking, mjesto za sjedenje i posluživanje za stolom'),
    (E'tagline', E'hr', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Glazba, piće i balkanska kultura – večer za sve.'),
    (E'about_text', E'hr', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Kulturna večer uz glazbu s Balkana, dobro opskrbljen bar i goste iz mnogih zemalja.\n\nBez obzira jeste li odrasli uz ove pjesme ili ih slušate prvi put: dođite, slavite s nama i upoznajte nove ljude.'),
    (E'expectations', E'hr', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Glazba uživo i DJ do kasno u noć\nBar s pićem i specijalitetima s Balkana\nKulturni program i kolo za sve\nGosti iz mnogih zemalja i generacija'),
    (E'dress_code', E'hr', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Elegantno-ležerno. Tradicionalna odjeća je dobrodošla.'),
    (E'additional_info', E'hr', E'Bitte bringt eure Reservierungsnummer mit.', E'Molimo ponesite svoj broj rezervacije.'),
    (E'ticket_normal_info', E'hr', E'Stehplatz, Selbstbedienung', E'Mjesto za stajanje, samoposluživanje'),
    (E'ticket_vip_info', E'hr', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Uključuje parkirno mjesto, mjesto za sjedenje i posluživanje za stolom'),
    (E'tagline', E'sr', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Muzika, piće i balkanska kultura – veče za sve.'),
    (E'about_text', E'sr', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Kulturno veče uz muziku sa Balkana, dobro snabdeven bar i goste iz mnogih zemalja.\n\nBez obzira na to da li ste odrasli uz ove pesme ili ih slušate prvi put: dođite, slavite sa nama i upoznajte nove ljude.'),
    (E'expectations', E'sr', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Muzika uživo i DJ do kasno u noć\nBar sa pićem i specijalitetima sa Balkana\nKulturni program i kolo za sve\nGosti iz mnogih zemalja i generacija'),
    (E'dress_code', E'sr', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Elegantno-ležerno. Tradicionalna odeća je dobrodošla.'),
    (E'additional_info', E'sr', E'Bitte bringt eure Reservierungsnummer mit.', E'Molimo ponesite svoj broj rezervacije.'),
    (E'ticket_normal_info', E'sr', E'Stehplatz, Selbstbedienung', E'Mesto za stajanje, samoposluživanje'),
    (E'ticket_vip_info', E'sr', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Uključuje parking, mesto za sedenje i posluživanje za stolom'),
    (E'tagline', E'tr', E'Musik, Drinks und Balkan-Kultur – ein Abend für alle.', E'Müzik, içecekler ve Balkan kültürü – herkes için bir gece.'),
    (E'about_text', E'tr', E'Ein kultureller Abend mit Musik vom Balkan, einer gut sortierten Bar und Gästen aus vielen Ländern.\n\nOb ihr mit diesen Liedern aufgewachsen seid oder sie zum ersten Mal hört: Kommt vorbei, feiert mit und lernt neue Menschen kennen.', E'Balkan müziği, zengin bir bar ve birçok ülkeden misafirlerle kültürel bir gece.\n\nBu şarkılarla büyüdünüz ya da onları ilk kez duyuyorsunuz: gelin, bizimle kutlayın ve yeni insanlarla tanışın.'),
    (E'expectations', E'tr', E'Live-Musik und DJ bis spät in die Nacht\nBar mit Drinks und Spezialitäten vom Balkan\nKulturprogramm und Kolo zum Mittanzen\nGäste aus vielen Ländern und Generationen', E'Gece geç saatlere kadar canlı müzik ve DJ\nİçecekler ve Balkan lezzetleriyle bar\nKültür programı ve herkesin katılabileceği kolo dansı\nBirçok ülkeden ve kuşaktan misafirler'),
    (E'dress_code', E'tr', E'Schick-leger. Traditionelle Kleidung ist willkommen.', E'Şık ve rahat. Geleneksel kıyafetler memnuniyetle karşılanır.'),
    (E'additional_info', E'tr', E'Bitte bringt eure Reservierungsnummer mit.', E'Lütfen rezervasyon numaranızı yanınızda getirin.'),
    (E'ticket_normal_info', E'tr', E'Stehplatz, Selbstbedienung', E'Ayakta yer, self servis'),
    (E'ticket_vip_info', E'tr', E'inkl. Parkplatz, Sitzplatz, Service Bedienung', E'Otopark, oturma yeri ve masaya servis dahil')
    ) as t(field, lang, source_de, translated)
  loop
    execute format('select %I from event_settings where id = 1', r.field) into current_text;
    if lower(regexp_replace(coalesce(current_text, ''), '\s+', '', 'g')) = lower(regexp_replace(r.source_de, '\s+', '', 'g')) then
      update event_settings
         set translations = jsonb_set(translations, array[r.lang],
                                      coalesce(translations -> r.lang, '{}'::jsonb) || jsonb_build_object(r.field, r.translated))
       where id = 1;
    end if;
  end loop;
end $$;
insert into schema_migrations (name) values ('006_text_translations.sql') on conflict do nothing;

-- ===== 007_min_age.sql =====
-- Minimum age shown as a small notice at the top of the event page (0 = no notice).
alter table event_settings add column if not exists min_age integer not null default 18 check (min_age between 0 and 99);
insert into schema_migrations (name) values ('007_min_age.sql') on conflict do nothing;

-- ===== 008_ticket_prices.sql =====
-- Ticket prices in cents (0 = no price shown). Display only for now; online payment comes later.
alter table event_settings add column if not exists price_normal_cents integer not null default 0 check (price_normal_cents between 0 and 1000000);
alter table event_settings add column if not exists price_vip_cents    integer not null default 0 check (price_vip_cents between 0 and 1000000);

-- Prices agreed for the event: normal ticket 20 €, VIP place 30 € (only if no prices were set yet).
update event_settings set price_normal_cents = 2000, price_vip_cents = 3000
 where id = 1 and price_normal_cents = 0 and price_vip_cents = 0;
insert into schema_migrations (name) values ('008_ticket_prices.sql') on conflict do nothing;
