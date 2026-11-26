-- Online sales window: before sales_start the page shows a countdown instead of the form,
-- from sales_end on it shows "online sales have ended". Empty = no limit.
alter table event_settings add column if not exists sales_start timestamptz;
alter table event_settings add column if not exists sales_end   timestamptz;
