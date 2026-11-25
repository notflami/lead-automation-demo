-- Supabase exposes tables in the public schema through its REST/GraphQL API.
-- Enabling row level security with NO policies blocks that API entirely; the app
-- connects as the table owner, which RLS does not restrict. Harmless on plain PostgreSQL.
alter table event_settings  enable row level security;
alter table registrations   enable row level security;
alter table rate_limit_hits enable row level security;
