# Event Registration Platform

A lightweight registration site and organizer dashboard for a ~200–300 guest cultural event.
Guests reserve free places in under 30 seconds on their phone. Organizers watch the numbers,
manage the guest list and edit all event information from a private dashboard. Every new
registration is pushed to **n8n**.

- **Public site** (`/`): event page, EN/DE, reservation form, confirmation with registration number,
  calendar file and WhatsApp share. Privacy notice (`/privacy`) and Impressum (`/imprint`).
- **Dashboard** (`/admin`): overview with capacity and daily activity, searchable registration list
  with inline status changes (check-in at the door works on a phone), edit/cancel, CSV export,
  event settings, webhook health, one-click deletion of personal data.

---

## Contents

1. [How it works](#how-it-works)
2. [Run it locally](#run-it-locally)
3. [Environment variables](#environment-variables)
4. [Database](#database)
5. [Deploy (recommended: Vercel + Supabase)](#deploy-recommended-vercel--supabase)
6. [Alternative: self-host with Docker](#alternative-self-host-with-docker)
7. [Connect n8n](#connect-n8n)
8. [Using the dashboard](#using-the-dashboard)
9. [GDPR checklist](#gdpr-checklist)
10. [Tests](#tests)
11. [Project structure](#project-structure)

---

## How it works

| Concern | Approach |
|---|---|
| Stack | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, PostgreSQL via `postgres` driver. No ORM, no extra services. |
| Capacity | Counted in **people**, not forms. Each registration runs in a transaction that locks the single `event_settings` row, so simultaneous submissions are serialised and can never overbook. |
| Full event | Registration stops, or (if enabled) guests can **explicitly** join a waiting list. A group larger than the remaining places is told how many places are left. |
| Duplicates | Each form carries an idempotency key, so double taps and network retries return the same registration. One active reservation per phone number (enforced by a unique index). |
| Spam | Hidden honeypot field, signed "form issued at" token (min. 3 s to fill), per-IP rate limit (stored as salted hash only), strict validation. |
| n8n | Webhook is sent **after** the registration is committed. Failures are recorded and retried (cron + "Retry now" button) — a registration is never lost because n8n was down. |
| Admin auth | One shared organizer password (env var), timing-safe check, rate-limited, signed HttpOnly session cookie (12 h). |
| Content | Everything guests see (name, date, venue, texts, capacity, contact, legal details) is edited in **Event settings**. No code changes. |
| Privacy | Self-hosted fonts, no tracking, no cookie banner needed. Personal data is auto-anonymised N days after the event. |

Registration flow: validate → save (with capacity check under lock) → generate `REG-000123` →
totals update instantly → n8n webhook → confirmation screen (registration number, places, event details).

---

## Run it locally

Requirements: Node.js ≥ 20.9 and a PostgreSQL database (local, Docker, or a free Supabase project).

```bash
cd event-registration
npm install
cp .env.example .env          # fill in DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD
npm run db:migrate            # creates tables + default event settings
npm run dev                   # http://localhost:3000   dashboard: /admin
```

Optional: `node scripts/seed-demo.mjs --yes-wipe-database` fills a **local** database with fictional
registrations so you can see the dashboard with data.

Quick local Postgres with Docker:

```bash
docker run -d --name eventdb -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16-alpine
# DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
```

---

## Environment variables

See [`.env.example`](.env.example). Only the server reads these; nothing secret reaches the browser.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | ≥ 32 random characters (`openssl rand -base64 48`) |
| `ADMIN_PASSWORD` | yes | Dashboard password — use a long passphrase |
| `PUBLIC_SITE_URL` | yes in prod | e.g. `https://balkan-night.de` (share links, calendar, preview image) |
| `N8N_WEBHOOK_URL` | no | n8n Webhook node **production** URL; empty = disabled |
| `N8N_WEBHOOK_SECRET` | recommended | Sent as `X-Webhook-Secret` and used for the HMAC signature |
| `CRON_SECRET` | recommended | Protects `/api/cron` (Vercel sends it automatically) |
| `DEFAULT_PHONE_COUNTRY_CODE` | no | Default `49`; used for local numbers like `0176 …` |
| `EVENT_TIMEZONE` | no | Default `Europe/Berlin` |
| `DATABASE_POOL_MAX` | no | Default `5` |

---

## Database

Schema: [`db/migrations`](db/migrations). Apply with `npm run db:migrate` (idempotent; each file runs once,
tracked in `schema_migrations`).

| Table | Contents |
|---|---|
| `event_settings` | Exactly one row: all editable event information, capacity, switches, legal details, retention |
| `registrations` | `reference` (REG-000001), name, phone (E.164), optional email, `guest_count`, `status` (`confirmed` / `waitlisted` / `checked_in` / `cancelled`), idempotency key, consent timestamp, note, webhook delivery status |
| `rate_limit_hits` | Salted hashes for rate limiting, purged after 24 h |

Capacity used = sum of `guest_count` for `confirmed` + `checked_in`. Waiting-list and cancelled
registrations don't take places.

To add a change later: create `db/migrations/003_something.sql` and run `npm run db:migrate`.

---

## Deploy (recommended: Vercel + Supabase)

Fastest reliable path: about 20 minutes, free tiers are enough for 300 guests.

**1. Database (Supabase)**
1. Create a project at supabase.com. Choose region **Frankfurt (eu-central-1)** for GDPR.
2. Project → **Connect** → copy the **Transaction pooler** connection string (port `6543`) and insert your DB password.
3. From your computer: `DATABASE_URL="<that string>" npm run db:migrate`.

   (Any PostgreSQL works the same way: Neon, Railway, your own server.)

**2. App (Vercel)**
1. Push this repository to GitHub, then on vercel.com → **Add New Project** → import it.
2. **Root Directory:** `event-registration`. Framework is detected automatically.
3. Add the environment variables from the table above (Production). Generate secrets with `openssl rand -base64 48`.
4. Deploy. Under **Settings → Functions** pick the Frankfurt region (`fra1`) to keep data in the EU.
5. Add your domain under **Settings → Domains**, then set `PUBLIC_SITE_URL` to it and redeploy.

**3. After the first deploy**
1. Open `https://your-domain/admin`, sign in, fill in **Event settings** (name, date, venue, texts,
   capacity, organizer address for the Impressum, contact).
2. Make one test registration, check that it shows in the dashboard and in n8n, then cancel it.
3. Generate the QR code for flyers from the final domain (any QR generator; use high error correction).
4. Test the link preview by pasting the URL into a WhatsApp chat.

**Cron:** [`vercel.json`](vercel.json) calls `/api/cron` daily (Vercel Hobby limit). It retries failed
webhooks and runs the GDPR auto-deletion. Webhooks are also retried after every new registration and
via "Retry now" in the dashboard. For more frequent retries, add an n8n **Schedule Trigger** → HTTP
Request `GET https://your-domain/api/cron` with header `Authorization: Bearer <CRON_SECRET>`.

---

## Alternative: self-host with Docker

If you already run a server (e.g. for n8n):

```bash
cd event-registration
cp .env.example .env     # fill in; also add POSTGRES_PASSWORD=<random>
docker compose up -d --build
```

The app listens on `127.0.0.1:3000` and runs migrations on start. Put your existing reverse proxy
(Caddy / Traefik / nginx) in front for HTTPS, and make it set `X-Real-IP` / `X-Forwarded-For` (rate
limiting uses them). Schedule the maintenance job, e.g. hourly:

```cron
0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron
```

---

## Connect n8n

1. In n8n, import [`n8n/new-registration-workflow.json`](n8n/new-registration-workflow.json)
   (Workflows → Import from file). It contains:
   - **Webhook** `POST /webhook/new-registration` with *Header Auth*
   - **Telegram** message to the organizers for every registration
   - **Gmail** confirmation to the guest, only if they gave an email (EN/DE)
2. Create a **Header Auth** credential: Name `X-Webhook-Secret`, Value = your `N8N_WEBHOOK_SECRET`.
   Attach it to the Webhook node. Connect your Telegram/Gmail credentials and set the Telegram chat ID.
   Remove nodes you don't need.
3. **Activate** the workflow and copy the Webhook node's **Production URL** into `N8N_WEBHOOK_URL`
   (redeploy on Vercel after changing env vars).
4. Register once on the site → the dashboard Overview shows "1 delivered".

Request sent for each new registration:

```http
POST <N8N_WEBHOOK_URL>
Content-Type: application/json
X-Webhook-Secret: <N8N_WEBHOOK_SECRET>
X-Webhook-Timestamp: 1767225600
X-Webhook-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>">
```

```json
{
  "event": "new_registration",
  "registration_id": "REG-000001",
  "name": "John Smith",
  "phone": "+49123456789",
  "email": null,
  "guest_count": 3,
  "status": "confirmed",
  "language": "en",
  "event_name": "Balkan Night",
  "registered_at": "2026-12-01T18:30:00.000Z"
}
```

`status` is `confirmed` or `waitlisted`. In n8n the payload is under `$json.body`.
Header Auth is enough; the HMAC signature is there if you want stricter verification in a Code node.

**Failures:** if n8n is down or answers with a non-2xx status, the registration is still saved and
the guest still sees their confirmation. Delivery is marked *failed* and retried (up to 10 attempts).
The dashboard shows delivered / waiting / failed counts.

---

## Using the dashboard

- **Overview**: reserved places vs. capacity, free places, number of registrations, average group
  size, waiting list, guests per day (hover a bar or open "Show as table"), latest registrations,
  n8n delivery status.
- **Registrations**: search by name, phone (any format, partial digits work) or REG number, filter by
  status, change status directly in the list, **Export CSV** (opens correctly in German Excel).
- **At the door:** open Registrations on a phone, search the name or number, set status to
  **Checked in**. The capacity bar shows how many have arrived.
- **Edit / cancel**: changing guests or confirming someone from the waiting list re-checks capacity.
  Cancelling frees the places immediately.
- **Event settings**: all public texts, date and venue, capacity, max people per registration,
  registration open/closed, waiting list on/off, "only X places left" threshold, organizer and contact
  details, data retention.

---

## GDPR checklist

What the app does: data minimisation (name, phone, group size; email optional), privacy notice in
EN/DE, required acknowledgement checkbox with timestamp, no tracking or third-party requests, IPs only
as salted hashes for 24 h, automatic anonymisation after the retention period, manual "delete now",
HTTPS security headers, admin area not indexed.

What **you** need to do:

- [ ] Fill in organizer name, postal address and contact in Event settings (Impressum, § 5 DDG).
- [ ] Sign the data processing agreements (AVV/DPA) with your hosts (Vercel, Supabase or your server
      provider) and choose EU regions. List the providers in "Additional privacy information".
- [ ] If n8n forwards data (Telegram, Gmail…), mention those services in the privacy notice too.
- [ ] Have the privacy notice reviewed. The included text is a solid starting point, not legal advice.
- [ ] Keep the retention period short (default 30 days after the event).
- [ ] Limit who knows the admin password; change it after the event.

---

## Tests

```bash
npm test                                   # unit tests: capacity rules, phone normalisation, validation
npm run build && npm start                 # then, against a DISPOSABLE local database:
npm run test:integration -- --yes-wipe-database
```

The integration suite (29 checks) runs against the real server and database: 40 simultaneous
registrations against capacity 20 (exactly 10 accepted, no overbooking), partial availability,
waiting list consent, closed registration, double submit, duplicate phone, validation, honeypot,
fill-time check, forged token, rate limiting, webhook payload + signature, registration kept when n8n
fails and delivered by the cron retry, public pages, calendar file and admin protection.

---

## Project structure

```
event-registration/
├─ db/migrations/            SQL schema (run with npm run db:migrate)
├─ n8n/                      importable n8n workflow
├─ scripts/                  migrate, integration tests, demo data
├─ src/app/
│  ├─ page.tsx               public event page
│  ├─ privacy/, imprint/     legal pages (content from settings)
│  ├─ opengraph-image.tsx    link preview for WhatsApp / Facebook / Instagram
│  ├─ admin/                 login, dashboard, registrations, settings, server actions
│  └─ api/                   register, calendar (.ics), cron, admin CSV export
├─ src/components/           form, embroidery band, admin UI
└─ src/lib/                  capacity rule, registrations (locking), webhook, auth, validation, i18n
```
