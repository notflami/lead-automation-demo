-- Event contact number for the WhatsApp click-to-chat button (empty = button hidden).
alter table event_settings add column if not exists whatsapp_number text not null default '';
