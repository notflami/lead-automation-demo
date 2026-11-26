-- Entrance tickets and door check-in.
-- Every reservation gets a secret ticket code (shown to the guest as one QR code, valid for all its places).
-- Door staff scan it on /door; checked_in_guests counts how many of its places have entered.
alter table registrations add column if not exists ticket_token text not null
  default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
create unique index if not exists registrations_ticket_token_idx on registrations (ticket_token);
alter table registrations add column if not exists checked_in_guests integer not null default 0;
alter table registrations add column if not exists checked_in_at timestamptz;
-- Reservations already marked "checked in" by hand count as fully admitted.
update registrations set checked_in_guests = guest_count, checked_in_at = coalesce(checked_in_at, updated_at)
  where status = 'checked_in' and checked_in_guests = 0;

-- Text about tickets at the door (Abendkasse), shown when online reservations are sold out or closed.
alter table event_settings add column if not exists door_sales_info text not null
  default 'Am Veranstaltungsabend gibt es weitere Tickets direkt am Eingang, solange Plätze frei sind.';
-- Password for the door staff page (/door). Stored only as a hash; empty = door page only for admins.
alter table event_settings add column if not exists door_password_hash text not null default '';

-- Translations of the default door text (only where none exists and the German text is unchanged).
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('en', 'On the night of the event, more tickets are available at the entrance while places last.'),
      ('sq', 'Në mbrëmjen e eventit ka bileta të tjera direkt në hyrje, deri sa të ketë vende.'),
      ('bs', 'Na večer događaja dodatne ulaznice možete kupiti direktno na ulazu, dok ima mjesta.'),
      ('hr', 'Na večer događaja dodatne ulaznice možete kupiti izravno na ulazu, dok ima mjesta.'),
      ('sr', 'Na veče događaja dodatne ulaznice možete kupiti direktno na ulazu, dok ima mesta.'),
      ('tr', 'Etkinlik akşamı, yer kaldığı sürece girişte bilet satın alabilirsiniz.')
    ) as t(lang, translated)
  loop
    update event_settings
      set translations = translations || jsonb_build_object(r.lang,
            coalesce(translations -> r.lang, '{}'::jsonb) || jsonb_build_object('door_sales_info', r.translated))
      where id = 1
        and door_sales_info = 'Am Veranstaltungsabend gibt es weitere Tickets direkt am Eingang, solange Plätze frei sind.'
        and not coalesce((translations -> r.lang) ? 'door_sales_info', false);
  end loop;
end $$;
