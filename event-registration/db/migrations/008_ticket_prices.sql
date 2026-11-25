-- Ticket prices in cents (0 = no price shown). Display only for now; online payment comes later.
alter table event_settings add column if not exists price_normal_cents integer not null default 0 check (price_normal_cents between 0 and 1000000);
alter table event_settings add column if not exists price_vip_cents    integer not null default 0 check (price_vip_cents between 0 and 1000000);

-- Prices agreed for the event: normal ticket 20 €, VIP place 30 € (only if no prices were set yet).
update event_settings set price_normal_cents = 2000, price_vip_cents = 3000
 where id = 1 and price_normal_cents = 0 and price_vip_cents = 0;
