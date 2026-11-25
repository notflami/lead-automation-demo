-- Minimum age shown as a small notice at the top of the event page (0 = no notice).
alter table event_settings add column if not exists min_age integer not null default 18 check (min_age between 0 and 99);
