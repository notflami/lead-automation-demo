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
