# Go-live guide

This guide takes you from "code on GitHub" to "a link guests can open", with no programming and no
terminal. Follow the parts in order. Budget about **60 minutes** the first time, including n8n.

You will use four websites:

| Service | What it does | Cost |
|---|---|---|
| **GitHub** | Stores the code (you already have it) | free |
| **Supabase** | The database where registrations are saved | free plan is enough |
| **Vercel** | Runs the website and gives you the link | free plan is enough |
| **n8n** (your existing instance) | Sends notifications / emails for each registration | — |

> **Words used here**
> - **Setting / environment variable**: a named value (like a password) that you type into Vercel.
>   The website reads it, guests never see it.
> - **Redeploy**: tell Vercel to restart the website so it picks up changed settings.

---

## Part 0: Prepare (5 minutes)

### 0.1 Merge the code
1. Open the pull request on GitHub (github.com/notflami/lead-automation-demo → **Pull requests** → #1).
2. Click **Merge pull request** → **Confirm merge**.

### 0.2 Create your secrets
You need **four long random values**. Use a password generator (for example the one built into your
browser's password manager, Bitwarden or 1Password) with these rules: **at least 40 characters, only
letters and numbers** (no symbols, they cause trouble in links).

Write them into a private note. Never post them in chats, emails or on GitHub.

| Name | Used for |
|---|---|
| `SESSION_SECRET` | Protects organizer logins and the reservation form |
| `CRON_SECRET` | Protects the daily maintenance job |
| `N8N_WEBHOOK_SECRET` | Proves to n8n that a registration really comes from your website |
| `ADMIN_PASSWORD` | The password organizers type to open the dashboard. This one may be a passphrase you can remember, but make it at least 16 characters |

---

## Part 1: Database on Supabase (10 minutes)

1. Go to **supabase.com** → **Start your project** → sign up (you can use your GitHub account).
2. Click **New project**.
   - **Name:** for example `event-registration`
   - **Database password:** click **Generate a password** or type one with **only letters and numbers**.
     Save it in your private note. You need it in step 6.
   - **Region:** **Central EU (Frankfurt)**. This keeps guest data in the EU.
   - Click **Create new project** and wait until the dashboard is ready (1–2 minutes).
3. In the left menu click **SQL Editor** → **New query** (or the **+** button).
4. On GitHub, open `event-registration/db/supabase-setup.sql`, click the **Copy raw file** button
   (two overlapping squares, top right of the file), and paste everything into the Supabase editor.
5. Click **Run** (bottom right). You should see **"Success. No rows returned"**.
   Check: left menu **Table Editor** now lists `event_settings`, `registrations`, `rate_limit_hits`.
6. Click **Connect** (top of the page). Find the **Transaction pooler** connection string. It looks like:
   ```
   postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
   Copy it and replace `[YOUR-PASSWORD]` (including the square brackets) with your database password
   from step 2. **This complete line is your `DATABASE_URL`.** Save it in your private note.

   ⚠️ Use the **Transaction pooler** one (port **6543**), not "Direct connection". Vercel cannot use
   the direct one.

---

## Part 2: Website on Vercel (10 minutes)

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub**. Allow Vercel to access the
   `lead-automation-demo` repository when asked.
2. Click **Add New…** → **Project** → next to `lead-automation-demo` click **Import**.
3. **Root Directory:** click **Edit** → select the folder **`event-registration`** → **Continue**.
   (Framework Preset should now show **Next.js**.)
4. Open **Environment Variables** and add the settings below. For each one: type the **Key**, paste the
   **Value**, click **Add**.

   **Mandatory: the website does not work without these**

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the line from Part 1, step 6 |
   | `SESSION_SECRET` | your random value from Part 0.2 |
   | `ADMIN_PASSWORD` | your organizer password |
   | `CRON_SECRET` | your random value from Part 0.2 |

   **Needed for n8n** (you can add them now or after Part 4)

   | Key | Value |
   |---|---|
   | `N8N_WEBHOOK_URL` | the Production URL from Part 4, step 5 |
   | `N8N_WEBHOOK_SECRET` | your random value from Part 0.2 |

5. Click **Deploy**. After about a minute you see a preview of the website. Click **Continue to
   Dashboard**. Your link is shown under **Domains**, e.g. `https://lead-automation-demo.vercel.app`.
6. Keep guest data in the EU: **Settings** → **Functions** → **Function Region** → choose
   **Frankfurt, Germany (fra1)** → **Save**.
7. Redeploy so step 6 takes effect: **Deployments** → on the top entry click **⋯** → **Redeploy** →
   **Redeploy**.
8. Open your link. You should see the event page. Open `<your link>/admin` and sign in with
   `ADMIN_PASSWORD`.

> **Whenever you change a setting in Vercel later, do step 7 again.** Settings only take effect after
> a redeploy.

---

## Part 3: Enter your event details (10 minutes)

In the dashboard (`<your link>/admin`) → **Event settings**:

1. **Registration:** maximum capacity (number of **people**), **VIP places** (part of the maximum;
   0 hides the VIP option), optional short info for the normal ticket and the VIP place (e.g. price),
   maximum people per registration, whether a waiting list should open when full.
2. **Event:** name, short line under the name, date, start/end time, venue name and address, map link
   (optional: open the venue in Google Maps → **Share** → **Copy link**).
3. **Page texts:** "About the evening", "What to expect" (one item per line), dress code, "Good to know".
4. **Organizer and legal:** optional **WhatsApp number**: guests then see a "Questions? Write to us
   on WhatsApp" button that opens a chat with this number and a pre-filled German message (free
   wa.me link; leave empty to hide it). For the legal fields see the [legal checklist](#part-6-legal-details-you-must-provide) below.
5. Click **Save settings**, then open your link on your phone to check everything.

All of this can be changed at any time without touching code. The event texts are already filled in
for 19 December 2026, 22:00, Crimmitschauer Str. 77, 08058 Zwickau (in German); check and adjust them.

The website buttons and messages are available in German, English, Albanian, Bosnian, Croatian,
Serbian and Turkish (menu with flags at the top). The event texts you type (short line, "About the
evening", "What to expect", dress code, "Good to know", ticket info) can be translated in **Event
settings → Translations of your texts**: one tab per language, the German original is shown above each
field, empty fields show the German text. When you change a German text, update its translations too.
Event name and address are not translated. Privacy notice and Impressum are shown in German, or in English for the other
languages.

---

## Part 4: Connect your n8n (15 minutes)

Your n8n must be reachable from the internet over **https** (n8n Cloud always is; a self-hosted n8n
needs a public address). An n8n that only runs on your own computer cannot receive registrations.

1. **Download the workflow:** on GitHub open `event-registration/n8n/new-registration-workflow.json`
   → click **Download raw file** (arrow-down icon, top right of the file).
2. **Import it:** in n8n create a new, empty workflow → open the **⋯** menu (top right) →
   **Import from File** → choose the downloaded file. You see two boxes (nodes):
   - **New registration**: receives each registration from the website
   - **Notify organizers (Telegram)**: sends you a Telegram message
3. **Protect the webhook:** double-click **New registration** → **Authentication** shows
   **Header Auth** → **Credential for Header Auth** → **Create new credential**:
   - **Name:** `X-Webhook-Secret` (exactly like this)
   - **Value:** your `N8N_WEBHOOK_SECRET` from Part 0.2
   - **Save**.
4. **Telegram:**
   1. In Telegram open **@BotFather** → send `/newbot` → follow the questions → copy the **token**.
   2. Send any message to your new bot (or add it to your organizer group and write a message there).
   3. In a browser open `https://api.telegram.org/bot<TOKEN>/getUpdates` (replace `<TOKEN>`). Find
      `"chat":{"id": ... }`. That number (may start with `-` for groups) is your **Chat ID**.
   4. In n8n double-click **Notify organizers (Telegram)** → **Credential** → create new → paste the
      token → **Save**. Replace `REPLACE_WITH_YOUR_CHAT_ID` with your Chat ID.
5. **Copy the address:** double-click **New registration** → click **Production URL** (not "Test URL")
   → copy the address (ends in `/webhook/new-registration`). This is your **`N8N_WEBHOOK_URL`**.
6. **Save** the workflow (top right) and switch it on: click **Publish** (newer n8n) or turn the
   **Active** switch on (older n8n).
7. **In Vercel:** **Settings** → **Environment Variables** → add `N8N_WEBHOOK_URL` and
   `N8N_WEBHOOK_SECRET` (if not added in Part 2) → **Redeploy** (Part 2, step 7).
8. **Test:** make a reservation on your website. Within seconds you get the Telegram message. In the
   dashboard **Overview** → **n8n automation** shows **1 delivered**.

**If it shows "failed":** open the registration in the dashboard; under **Sent to n8n** you see the
reason:

| Message | Meaning | Fix |
|---|---|---|
| `HTTP 403` | Secret doesn't match | Same value in n8n credential (Name `X-Webhook-Secret`) and Vercel `N8N_WEBHOOK_SECRET` |
| `HTTP 404` | Workflow not switched on, or the Test URL was used | Publish / activate it; use the **Production URL** |
| `HTTP 500` | The workflow started but a node failed (e.g. Telegram chat ID) | Open **Executions** in n8n to see which node |
| `fetch failed` / timeout | n8n is not reachable from the internet | Check the address opens in a browser from your phone's mobile data |

Failed deliveries are never lost: after fixing the cause, click **Retry now** on the dashboard
Overview (they are also retried automatically).

Registrations made **before** n8n was connected are not sent afterwards, so connect n8n before you
share the link.

---

## Part 4b: Online payment with Stripe (optional)

Guests pay on Stripe's secure page. While they pay, their places are held for 35 minutes. The reservation
is confirmed (and Telegram notified) only when the payment arrives; unpaid holds are released
automatically. No monthly fee; Stripe charges per payment.

**Before you start**
- The **business name** on the Stripe account is what guests see on the payment page and their bank
  statement. Check it: Stripe → **Settings → Business → Public details**.
- Selling tickets is commercial use. Vercel's free plan is for non-commercial use: consider Vercel Pro
  or running the site on your own server (Docker setup included).
- Add your **terms and conditions (AGB)** in Event settings (see below) and have them checked.

**1. Test mode first** (Stripe shows "Sandbox" / "Test mode" at the top)
1. Stripe → **Developers → API keys** → copy the **Secret key** (`sk_test_…`).
   In Vercel add the setting `STRIPE_SECRET_KEY` with this value.
2. Stripe → **Developers → Webhooks** → **Add endpoint** (or "Add destination" → Webhook endpoint):
   - **Endpoint URL:** `https://balkan-night-zwickau.vercel.app/api/stripe/webhook` (your address + `/api/stripe/webhook`)
   - **Events:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
   - Save, then click **Reveal** next to **Signing secret** (`whsec_…`).
     In Vercel add the setting `STRIPE_WEBHOOK_SECRET` with this value.
3. Vercel → **Deployments → ⋯ → Redeploy**.
4. Stripe → **Settings → Payments → Payment methods**: keep **Cards, Apple Pay, Google Pay** on (PayPal and
   Klarna are fine too). Turn **off** slow methods such as **SEPA Direct Debit**: they take days to confirm.
5. Dashboard → **Event settings → Online payment**: it should say "Stripe is connected (TEST mode)".
   Switch on **Take payment online**, paste your **AGB** text, **Save settings**.
6. Test on your phone: reserve 2 places → you go to Stripe → pay with the test card
   **4242 4242 4242 4242**, any future date, any CVC → you come back to "Bezahlt 40 €".
   The dashboard shows "Paid online", and Stripe → **Payments** shows the test payment.
   Also try pressing **back** on the Stripe page: the site says the payment was cancelled.

**2. Go live (real money)**
1. Stripe → **Activate account / Switch to live account**: business details, ID, bank account.
2. In **live mode**, repeat steps 1.1 and 1.2: the live secret key (`sk_live_…`) and a **new** webhook
   endpoint with the same URL and events (live mode has its own webhooks and signing secret).
3. In Vercel replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with the live values → **Redeploy**.
4. Dashboard → Event settings should now say "LIVE mode". Make one real purchase yourself and refund it.

**Keep the money in Stripe until your decision:** Stripe → **Settings → Payouts → Payout schedule →
Manual**. Ticket money then stays in your Stripe balance (nothing goes to the bank) until you click
**Pay out** in Stripe. This way every refund is covered if the event is cancelled.

**Refund one guest:** dashboard → open the reservation → **Refund … and cancel**. (A refund made
directly in Stripe is also picked up automatically thanks to the `charge.refunded` event.)

**Plan B: cancel the event and refund everyone:** dashboard → **Event settings → Cancel the event:
refund everyone** → type `REFUND ALL` → **Refund all**. Registration closes, every reservation paid
online is refunded in full to the payment method the guest used (cards usually 5–10 business days),
and the summary shows how many were refunded. If any fail, click again: refunded ones are skipped.
Stripe normally keeps its processing fees on refunds. Tell guests in your AGB, e.g. *"Findet die
Veranstaltung mangels Nachfrage nicht statt (Entscheidung bis TT.MM.JJJJ), wird der volle Ticketpreis
auf das ursprüngliche Zahlungsmittel erstattet."*

**Plan A: the event happens:** after your decision date, Stripe → **Balances → Pay out** (or set
payouts back to automatic).

---

## Part 5: Final test before sharing (10 minutes)

On your **phone**, using mobile data (not Wi-Fi):

- [ ] Open the link. Event name, date, venue and texts are correct, in English and German
      (button at the top right).
- [ ] Make a reservation for 2 people. You see "You're on the list" and a number like `REG-000001`.
- [ ] Tap **Add to calendar**. The event appears with the right time.
- [ ] The Telegram message arrived (if you set up n8n).
- [ ] If you set a WhatsApp number: tap "Questions? Write to us on WhatsApp". WhatsApp opens with your number and a German message.
- [ ] Footer → **Privacy** and **Imprint** show your organizer details.
- [ ] In the dashboard: the reservation is listed, **Overview** shows 2 reserved places.
- [ ] Cancel the test reservation in the dashboard (open it → **Cancel registration**). Places go back.
- [ ] **Overview** shows no red warnings.
- [ ] Paste the link into a WhatsApp chat. A preview with the event name appears.

Then share the link, and make the QR code for flyers from the **final** link (any QR generator;
choose a high error-correction level and test-scan the printed flyer).

---

## Part 6: Legal details you must provide

The website contains a privacy notice (Datenschutzhinweise) and an Impressum, filled in from
**Event settings → Organizer and legal**. The software cannot know these facts. You must enter them,
and you are responsible for them being correct.

**Impressum (§ 5 DDG): required**
- Full legal name of the organizer (person or association, e.g. "Balkan Kultur e.V.")
- Postal address where you can be reached (no P.O. box)
- Email address, and preferably a phone number
- For a registered association (e.V.): "represented by" + names of the board members, register court
  and register number (put these lines into the **Organizer postal address** field)
- VAT ID only if you have one

**Privacy notice: please complete "Additional privacy information"** with the services you actually
use. Suggested text (edit names to match your setup):

> Hosting: Vercel Inc., USA (servers in Frankfurt). Vercel processes technical access data (e.g. IP
> address) in server logs. Database: Supabase Inc., USA (servers in Frankfurt). Notifications: our
> n8n automation forwards new registrations to the organizers via Telegram (Telegram Messenger Inc.).
> Data processing agreements under Art. 28 GDPR are in place with these providers. Transfers to the USA are based on the EU–US Data Privacy
> Framework or Standard Contractual Clauses.
>
> Hosting: Vercel Inc., USA (Server in Frankfurt). Vercel verarbeitet technische Zugriffsdaten (z. B.
> IP-Adresse) in Server-Logs. Datenbank: Supabase Inc., USA (Server in Frankfurt). Benachrichtigungen:
> Unsere n8n-Automatisierung leitet neue Reservierungen per Telegram (Telegram Messenger Inc.) an die
> Veranstalter weiter. Mit diesen Anbietern bestehen
> Auftragsverarbeitungsverträge nach Art. 28 DSGVO. Übermittlungen in die USA erfolgen auf Grundlage
> des EU-US Data Privacy Framework bzw. von Standardvertragsklauseln.

Before using this text, check each provider's current privacy/DPA page and adjust names and transfer
mechanisms to what they state. Remove services you don't use.

**Also do this:**
- [ ] Conclude the **Data Processing Agreement (DPA / AVV)** with Vercel and with Supabase (and your n8n host if they process guest data). Each provider publishes it on its legal pages; search
      "<provider> DPA". Keep a copy.
- [ ] Keep **data retention** short (Event settings, default 30 days after the event). After that,
      names, phone numbers and emails are erased automatically; only anonymous totals remain.
- [ ] Have the privacy notice and Impressum checked by someone qualified (lawyer, data-protection
      officer, or your association's adviser). The included text is a careful starting point, not
      legal advice.

---

## Reference: all settings

| Setting | Required? | What happens if it is missing |
|---|---|---|
| `DATABASE_URL` | **Mandatory** | Nothing works (pages show "This page could not load"). |
| `SESSION_SECRET` | **Mandatory**, ≥ 32 characters | Event page and dashboard cannot load. Changing it signs out all organizers. |
| `ADMIN_PASSWORD` | **Mandatory** | Nobody can sign in to the dashboard (sign-in page says it is not set up). |
| `CRON_SECRET` | **Mandatory for production** | Website works, but personal data is **not** deleted automatically after the event (GDPR) and failed n8n deliveries are only retried by hand. The dashboard shows a red warning. |
| `N8N_WEBHOOK_URL` | Needed for n8n | No n8n notifications. Registrations are still saved and visible in the dashboard. |
| `N8N_WEBHOOK_SECRET` | Needed when `N8N_WEBHOOK_URL` is set | n8n rejects every delivery (if its webhook checks the secret), or the webhook is unprotected. The dashboard shows a red warning. |
| `STRIPE_SECRET_KEY` | For online payment | Without it, reservations stay free (no payment), even if "Take payment online" is switched on. |
| `STRIPE_WEBHOOK_SECRET` | With `STRIPE_SECRET_KEY` | Payments are still confirmed when the guest returns to the site, but not if they close the browser on Stripe's page. |
| `PUBLIC_SITE_URL` | Optional | Only needed with your own domain (e.g. `https://balkan-night.de`). Without it the vercel.app address is used for share links and the calendar file. |
| `DEFAULT_PHONE_COUNTRY_CODE` | Optional (default `49`) | Numbers typed without country code (`0176…`) are treated as German. |
| `EVENT_TIMEZONE` | Optional (default `Europe/Berlin`) | Time zone for dashboard dates and the calendar file. |
| `DATABASE_POOL_MAX` | Optional (default `5`) | Leave as is. |

**Automatic jobs:** Vercel runs the maintenance job once a day (`vercel.json`). It retries failed n8n
deliveries, deletes personal data after the retention period, and keeps the free Supabase project
active (free Supabase projects pause after a week without any activity).

## Optional: your own domain

Vercel project → **Settings** → **Domains** → **Add** → type your domain → follow the instructions
shown (they tell you which DNS records to set at your domain provider). Then add the setting
`PUBLIC_SITE_URL` = `https://your-domain` and **Redeploy**. Make the QR code only after this step.

## After the event

1. Event settings → switch **Registration open** off.
2. Export the guest list if you need it (**Registrations → Export CSV**). Store the file securely and
   delete it when no longer needed.
3. Personal data is erased automatically after the retention period, or immediately via
   **Event settings → Delete personal data**.
4. Change `ADMIN_PASSWORD` (and redeploy) if many people knew it.
