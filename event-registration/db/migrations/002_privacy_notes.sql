-- Free-text addition to the privacy notice (e.g. hosting / database providers),
-- editable in the admin settings so legal wording can change without a deploy.
alter table event_settings add column if not exists privacy_notes text not null default '';
