// End-to-end API tests against a RUNNING server and a DISPOSABLE database.
//
//   npm run build && npm start            (in one terminal, N8N_WEBHOOK_URL=http://localhost:5678/webhook/test)
//   npm run test:integration -- --yes-wipe-database
//
// Starts a mock n8n webhook on :5678. WIPES all registrations — never run against production.
import fs from "node:fs";
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { SignJWT } from "jose";
import Stripe from "stripe";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) if (fs.existsSync(path.join(root, f))) process.loadEnvFile(path.join(root, f));
if (!process.argv.includes("--yes-wipe-database")) {
  console.error("Refusing to run: this deletes all registrations. Pass --yes-wipe-database (local/test DB only).");
  process.exit(1);
}
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL, { max: 2, prepare: false, onnotice: () => {} });

// ---- mock n8n ------------------------------------------------------------
const hooks = [];
let failHooks = false;
const mock = http
  .createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      const expected = "sha256=" + crypto.createHmac("sha256", process.env.N8N_WEBHOOK_SECRET || "").update(`${req.headers["x-webhook-timestamp"]}.${b}`).digest("hex");
      hooks.push({ body: JSON.parse(b || "{}"), signatureOk: expected === req.headers["x-webhook-signature"], failed: failHooks });
      res.statusCode = failHooks ? 503 : 200;
      res.end("{}");
    });
  })
  .listen(5678);

// ---- mock Stripe API (STRIPE_API_URL=http://localhost:12111 in the server's env) --
const sessions = new Map();
const refunds = [];
let stripeDown = false;
const stripeMock = http
  .createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (stripeDown) return send(500, { error: { type: "api_error", message: "mock outage" } });
      const f = new URLSearchParams(b);
      if (req.method === "POST" && req.url.startsWith("/v1/refunds")) {
        const pi = f.get("payment_intent");
        if (pi === "pi_fail") return send(400, { error: { type: "invalid_request_error", message: "mock refund failure" } });
        refunds.push(pi);
        return send(200, { id: "re_" + crypto.randomBytes(6).toString("hex"), object: "refund", status: "succeeded", payment_intent: pi });
      }
      const m = req.url.match(/^\/v1\/checkout\/sessions(?:\/([^/?]+))?(\/expire)?/);
      if (!m) return send(404, { error: { message: "not mocked" } });
      if (req.method === "POST" && !m[1]) {
        const id = "cs_test_" + crypto.randomBytes(8).toString("hex");
        const s = {
          id, object: "checkout.session", status: "open", payment_status: "unpaid", url: `https://checkout.example/${id}`,
          amount_total: Number(f.get("line_items[0][price_data][unit_amount]")) * Number(f.get("line_items[0][quantity]")),
          client_reference_id: f.get("client_reference_id"), metadata: { registration_id: f.get("metadata[registration_id]") },
          expires_at: Number(f.get("expires_at")), success_url: f.get("success_url"), locale: f.get("locale"),
        };
        sessions.set(id, s);
        return send(200, s);
      }
      const s = sessions.get(m[1]);
      if (!s) return send(404, { error: { message: "No such session" } });
      if (m[2]) {
        if (s.status === "open") s.status = "expired";
        return send(200, s);
      }
      return send(200, s);
    });
  })
  .listen(12111);
const paySession = (id) => Object.assign(sessions.get(id), { status: "complete", payment_status: "paid", payment_intent: "pi_" + id.slice(8) });
const stripeSdk = new Stripe("sk_test_local_mock");
async function stripeEvent(type, session, secret = process.env.STRIPE_WEBHOOK_SECRET) {
  const payload = JSON.stringify({ id: "evt_" + crypto.randomBytes(6).toString("hex"), object: "event", type, data: { object: session } });
  const header = stripeSdk.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(BASE + "/api/stripe/webhook", { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": header }, body: payload });
}

// ---- helpers ---------------------------------------------------------------
let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
  if (cond) passed++, console.log(`  ✓ ${name}`);
  else failed++, console.log(`  ✗ ${name} ${extra}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = new TextEncoder().encode(process.env.SESSION_SECRET);
const token = (ageSeconds = 10) =>
  new SignJWT({ k: "form" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(Math.floor(Date.now() / 1000) - ageSeconds).setExpirationTime("1d").sign(key);
let ipCounter = 1;
let phoneCounter = 1000000;
async function register(overrides = {}, { ip } = {}) {
  const body = {
    fullName: "Test Guest",
    phone: `+49176${phoneCounter++}`,
    guestCount: 2,
    idempotencyKey: crypto.randomUUID(),
    locale: "en",
    acceptWaitlist: false,
    website: "",
    formToken: await token(),
    ...overrides,
  };
  const res = await fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip || `10.0.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}
async function reset(settings) {
  await sql`truncate registrations, rate_limit_hits`;
  await sql`alter sequence registration_number_seq restart 1`;
  await sql`update event_settings set registration_open = true, waitlist_enabled = false, max_capacity = 20,
            vip_capacity = 20, max_guests_per_registration = 8, payments_enabled = false where id = 1`;
  if (settings) await sql`update event_settings set ${sql(settings)} where id = 1`;
}
const reserved = async () =>
  (await sql`select coalesce(sum(guest_count),0)::int as n from registrations where status in ('confirmed','checked_in')`)[0].n;

try {
  console.log("Capacity under concurrency (40 simultaneous groups of 2, capacity 20)");
  await reset();
  const results = await Promise.all(Array.from({ length: 40 }, () => register()));
  const ok = results.filter((r) => r.status === 201).length;
  check("exactly 10 registrations accepted", ok === 10, `got ${ok}`);
  check("reserved places = 20 (no overbooking)", (await reserved()) === 20);
  check("the rest are told it is full", results.filter((r) => r.data.error === "full").length === 30);
  const refs = results.filter((r) => r.status === 201).map((r) => r.data.registration.reference);
  check("unique REG ids", new Set(refs).size === 10 && refs.every((r) => /^REG-\d{6}$/.test(r)));

  console.log("Partial availability");
  await reset({ max_capacity: 5 });
  await register({ guestCount: 3 });
  const tooMany = await register({ guestCount: 3 });
  check("group larger than remaining places is rejected", tooMany.status === 409 && tooMany.data.error === "not_enough" && tooMany.data.remaining === 2);

  console.log("Waiting list");
  await reset({ max_capacity: 2, waitlist_enabled: true });
  await register({ guestCount: 2 });
  const noConsent = await register({ guestCount: 1 });
  check("full → offers waiting list, does not auto-enrol", noConsent.status === 409 && noConsent.data.waitlistAvailable === true);
  const wl = await register({ guestCount: 3, acceptWaitlist: true });
  check("explicit consent → waitlisted", wl.status === 201 && wl.data.registration.status === "waitlisted");
  check("waitlisted guests don't consume capacity", (await reserved()) === 2);
  await sql`update event_settings set registration_open = false where id = 1`;
  check("closed registration rejected", (await register({ acceptWaitlist: true })).data.error === "closed");

  console.log("Duplicates");
  await reset();
  const idem = crypto.randomUUID();
  const [a, b] = await Promise.all([register({ idempotencyKey: idem, phone: "0176 9990001" }), register({ idempotencyKey: idem, phone: "0176 9990001" })]);
  const count = (await sql`select count(*)::int as n from registrations`)[0].n;
  check("double submit creates one registration", count === 1 && a.data.registration?.reference === b.data.registration?.reference, JSON.stringify([a, b]));
  const samePhone = await register({ phone: "+49 176 9990001" });
  check("same phone (other format) rejected", samePhone.status === 409 && samePhone.data.error === "phone_taken");

  console.log("Validation & spam protection");
  check("too many guests rejected", (await register({ guestCount: 99 })).data.fields?.guestCount === "guests_too_many");
  check("invalid phone rejected", (await register({ phone: "12" })).data.fields?.phone === "phone_invalid");
  check("no email or checkbox needed (name, phone, guests only)", (await register({ privacyAccepted: undefined, email: undefined })).status === 201);
  check("honeypot rejected", (await register({ website: "http://spam" })).status === 400);
  check("submitted too fast → 425", (await register({ formToken: await token(0) })).status === 425);
  const forged = await register({ formToken: "forged.token.value" });
  check("forged form token → 401 with fresh token", forged.status === 401 && typeof forged.data.formToken === "string");
  await reset({ max_capacity: 1000 });
  const rl = [];
  for (let i = 0; i < 32; i++) rl.push((await register({}, { ip: "203.0.113.7" })).status);
  check("rate limit after 30 attempts per IP", rl.slice(0, 30).every((s) => s === 201) && rl.slice(30).every((s) => s === 429), rl.join(","));

  console.log("n8n webhook");
  await reset();
  hooks.length = 0;
  const reg = await register({ fullName: "Marko Jovanović", phone: "+38761123456", guestCount: 3 });
  await sleep(800);
  const h = hooks.find((x) => x.body.registration_id === reg.data.registration.reference);
  check("webhook delivered with expected payload", h && h.body.event === "new_registration" && h.body.name === "Marko Jovanović" && h.body.guest_count === 3 && h.body.phone === "+38761123456" && !isNaN(Date.parse(h.body.registered_at)));
  check("HMAC signature valid", h?.signatureOk === true);
  failHooks = true;
  const reg2 = await register();
  await sleep(800);
  const [row] = await sql`select webhook_status, webhook_attempts from registrations where reference = ${reg2.data.registration.reference}`;
  check("registration kept when n8n is down", reg2.status === 201 && row.webhook_status === "failed");
  failHooks = false;
  const unauth = await fetch(`${BASE}/api/cron`);
  check("cron endpoint requires secret", unauth.status === 401);
  const cron = await fetch(`${BASE}/api/cron`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }).then((r) => r.json());
  const [row2] = await sql`select webhook_status from registrations where reference = ${reg2.data.registration.reference}`;
  check("cron retry delivers the failed webhook", cron.webhooks?.sent >= 1 && row2.webhook_status === "sent", JSON.stringify(cron));

  console.log("VIP places");
  await reset({ max_capacity: 50, vip_capacity: 6 });
  const vipRuns = await Promise.all(Array.from({ length: 10 }, () => register({ guestCount: 2, ticketType: "vip" })));
  const [vipRow] = await sql`select coalesce(sum(guest_count),0)::int as n from registrations where ticket_type = 'vip' and status = 'confirmed'`;
  check("10 simultaneous VIP pairs for 6 VIP places: exactly 3 accepted", vipRuns.filter((r) => r.status === 201).length === 3 && vipRow.n === 6);
  check("the rest are told VIP is full", vipRuns.filter((r) => r.data.error === "vip_full").length === 7);
  check("normal tickets still available", (await register({ guestCount: 2 })).status === 201);
  check("unknown ticket type rejected", (await register({ ticketType: "gold" })).status === 400);

  console.log("Cancellation frees places");
  await reset({ max_capacity: 4 });
  const c1 = await register({ guestCount: 4, phone: "0176 1112223" });
  check("event full after 4 places", (await register({ guestCount: 1 })).data.error === "full");
  await sql`update registrations set status = 'cancelled', cancelled_at = now() where reference = ${c1.data.registration.reference}`;
  const again = await register({ guestCount: 2, phone: "0176 1112223" });
  check("same phone can register again after cancellation, freed places reusable", again.status === 201);

  console.log("Admin protection");
  const adminKey = new TextEncoder().encode(process.env.SESSION_SECRET);
  const wrongKey = new TextEncoder().encode("x".repeat(48));
  const forgedSession = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setAudience("event-admin").setExpirationTime("1h").sign(wrongKey);
  const expired = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setAudience("event-admin").setIssuedAt(Math.floor(Date.now() / 1000) - 7200).setExpirationTime(Math.floor(Date.now() / 1000) - 3600).sign(adminKey);
  const unsigned = Buffer.from('{"alg":"none"}').toString("base64url") + "." + Buffer.from('{"role":"admin","aud":"event-admin"}').toString("base64url") + ".";
  const valid = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setAudience("event-admin").setExpirationTime("1h").sign(adminKey);
  const asCookie = (t) => ({ headers: { Cookie: `admin_session=${t}` }, redirect: "manual" });
  for (const [name, t] of [["forged signature", forgedSession], ["expired session", expired], ["unsigned token", unsigned]]) {
    const pageRes = await fetch(BASE + "/admin/registrations", asCookie(t));
    const csvRes = await fetch(BASE + "/api/admin/export", asCookie(t));
    check(`${name}: dashboard redirects to login, CSV refused`, pageRes.status === 307 && csvRes.status === 401);
  }
  check("valid session can open dashboard", (await fetch(BASE + "/admin/registrations", asCookie(valid))).status === 200);
  const csvBytes = Buffer.from(await fetch(BASE + "/api/admin/export", asCookie(valid)).then((r) => r.arrayBuffer()));
  const csv = csvBytes.toString("utf8");
  check("CSV has Excel BOM and contains the registration with phone unchanged", csvBytes.subarray(0, 3).toString("hex") === "efbbbf" && csv.includes('"+491761112223"'));
  const home = await fetch(BASE + "/").then((r) => r.text());
  check("public page shows no guest names or phone numbers", !home.includes("1761112223") && !home.includes("Test Guest"));

  console.log("GDPR: automatic anonymisation");
  await sql`update event_settings set event_date = current_date - 40, data_retention_days = 30 where id = 1`;
  const before = await reserved();
  const cronRes = await fetch(`${BASE}/api/cron`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }).then((r) => r.json());
  const [left] = await sql`select count(*) filter (where anonymized_at is null)::int as personal,
                                  count(*) filter (where full_name <> 'Anonymised' or email is not null)::int as named
                           from registrations`;
  check("cron anonymises all personal data after the retention period", cronRes.anonymised >= 1 && left.personal === 0 && left.named === 0, JSON.stringify(cronRes));
  check("guest totals are kept after anonymisation", (await reserved()) === before);
  await sql`update event_settings set event_date = current_date + 21 where id = 1`;

  console.log("Legal pages");
  await sql`update event_settings set organizer_name = 'Test Verein e.V.', organizer_address = 'Teststraße 1, 10115 Berlin', contact_email = 'kontakt@example.org' where id = 1`;
  const [priv, imp] = await Promise.all([fetch(BASE + "/privacy").then((r) => r.text()), fetch(BASE + "/imprint").then((r) => r.text())]);
  check("privacy notice names the organizer and retention period", priv.includes("Test Verein e.V.") && priv.includes("30"));
  check("Impressum shows organizer, address and contact", imp.includes("Test Verein e.V.") && imp.includes("Teststraße 1") && imp.includes("kontakt@example.org"));

  console.log("Translated event texts");
  await sql`update event_settings set tagline = 'Deutscher Untertitel', dress_code = 'Deutscher Dresscode',
            translations = ${sql.json({ en: { tagline: "English subtitle", dress_code: "" } })} where id = 1`;
  const page = (lang) => fetch(BASE + "/", { headers: { Cookie: `lang=${lang}` } }).then((r) => r.text());
  const [enPage, dePage, trPage] = await Promise.all([page("en"), page("de"), page("tr")]);
  check("English visitor sees the English text", enPage.includes("English subtitle") && !enPage.includes("Deutscher Untertitel"));
  check("empty translation falls back to German", enPage.includes("Deutscher Dresscode"));
  check("German page and untranslated language show German", dePage.includes("Deutscher Untertitel") && trPage.includes("Deutscher Untertitel"));
  await sql`update event_settings set translations = '{}'::jsonb where id = 1`;

  console.log("Ticket prices");
  await reset({ max_capacity: 100, vip_capacity: 20, price_normal_cents: 2000, price_vip_cents: 3000 });
  const priced = await fetch(BASE + "/").then((r) => r.text());
  check("prices shown on the ticket options (20 € / 30 €)", priced.includes("20\u00a0€") && priced.includes("30\u00a0€"));
  hooks.length = 0;
  const vipReg = await register({ guestCount: 3, ticketType: "vip" });
  await sleep(800);
  const vipHook = hooks.find((x) => x.body.registration_id === vipReg.data.registration?.reference);
  check("webhook carries ticket value (3 × 30 € = 90)", vipHook?.body.amount_eur === 90 && vipHook?.body.ticket_type === "vip", JSON.stringify(vipHook?.body));

  console.log("Online payment (Stripe mock)");
  await reset({ max_capacity: 4, payments_enabled: true, price_normal_cents: 2000, price_vip_cents: 3000, vip_capacity: 4 });
  hooks.length = 0;
  const key1 = crypto.randomUUID();
  const p1 = await register({ guestCount: 2, phone: "0176 7000001", idempotencyKey: key1 });
  const [r1] = await sql`select * from registrations where idempotency_key = ${key1}`;
  const s1 = sessions.get(r1?.stripe_session_id);
  check("paid ticket: guest gets a Stripe checkout link, places held", p1.status === 200 && p1.data.payment?.url === s1?.url && r1.status === "pending_payment" && r1.payment_status === "pending");
  check("checkout amount = 2 × 20 € and checkout page in the guest's language (en)", s1?.amount_total === 4000 && s1?.locale === "en" && /checkout=success&session_id=\{CHECKOUT_SESSION_ID\}/.test(s1?.success_url));
  check("same form sent twice → same checkout link", (await register({ guestCount: 2, phone: "0176 7000001", idempotencyKey: key1 })).data.payment?.url === s1?.url);
  check("held places count: 3 more on capacity 4 → not enough", (await register({ guestCount: 3, phone: "0176 7000002" })).data.error === "not_enough");
  await sleep(500);
  check("no n8n notification before payment", !hooks.some((h) => h.body.phone === "+491767000001"));
  const st1 = await fetch(`${BASE}/api/checkout/status?session_id=${s1.id}`).then((r) => r.json());
  check("status before paying: unpaid, no entry QR code yet", st1.state === "unpaid" && !st1.registration.ticketToken);
  paySession(s1.id);
  const st2 = await fetch(`${BASE}/api/checkout/status?session_id=${s1.id}`).then((r) => r.json());
  const [r1b] = await sql`select status, payment_status, amount_cents from registrations where id = ${r1.id}`;
  check("after paying: confirmed, paid 40 €", st2.state === "paid" && st2.registration.paidCents === 4000 && r1b.status === "confirmed" && r1b.payment_status === "paid");
  check("after paying: entry QR code (64-char ticket code)", /^[a-f0-9]{64}$/.test(st2.registration.ticketToken || ""));
  await sleep(800);
  const paidHook = hooks.find((h) => h.body.phone === "+491767000001");
  check("n8n notified once paid (paid: true, 40 €)", paidHook?.body.paid === true && paidHook?.body.amount_paid_eur === 40, JSON.stringify(paidHook?.body));

  // Stripe webhook path
  const key2 = crypto.randomUUID();
  await register({ guestCount: 1, phone: "0176 7000003", idempotencyKey: key2, ticketType: "vip" });
  const [r2] = await sql`select * from registrations where idempotency_key = ${key2}`;
  check("VIP checkout amount 30 €", sessions.get(r2.stripe_session_id)?.amount_total === 3000);
  check("webhook with wrong signature rejected", (await stripeEvent("checkout.session.completed", paySession(r2.stripe_session_id), "whsec_wrong")).status === 400);
  const wh = await stripeEvent("checkout.session.completed", sessions.get(r2.stripe_session_id));
  const [r2b] = await sql`select status, payment_status from registrations where id = ${r2.id}`;
  check("signed webhook confirms the payment", wh.status === 200 && r2b.status === "confirmed" && r2b.payment_status === "paid");
  check("webhook repeated → no change, no error", (await stripeEvent("checkout.session.completed", sessions.get(r2.stripe_session_id))).status === 200);

  // Refund made in the Stripe dashboard → reservation marked refunded
  const [paidRow] = await sql`select id, stripe_payment_intent from registrations where id = ${r2.id}`;
  check("payment ID stored for refunds", paidRow.stripe_payment_intent === "pi_" + r2.stripe_session_id.slice(8));
  await stripeEvent("charge.refunded", { id: "ch_1", object: "charge", refunded: true, payment_intent: paidRow.stripe_payment_intent });
  const [refRow] = await sql`select status, payment_status from registrations where id = ${r2.id}`;
  check("Stripe 'charge.refunded' → reservation refunded and cancelled", refRow.payment_status === "refunded" && refRow.status === "cancelled");

  // Cancel on Stripe → hold released
  await reset({ max_capacity: 4, payments_enabled: true, price_normal_cents: 2000 });
  const key3 = crypto.randomUUID();
  await register({ guestCount: 4, phone: "0176 7000004", idempotencyKey: key3 });
  check("event held full while paying", (await register({ guestCount: 1, phone: "0176 7000005" })).data.error === "full");
  await fetch(BASE + "/api/checkout/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: key3 }) });
  const [r3] = await sql`select status, payment_status, stripe_session_id from registrations where idempotency_key = ${key3}`;
  check("guest pressed back: hold released, Stripe page closed", r3.status === "cancelled" && r3.payment_status === "expired" && sessions.get(r3.stripe_session_id)?.status === "expired");
  check("places free again", (await register({ guestCount: 4, phone: "0176 7000006" })).status === 200);

  // Hold runs out
  await sql`update registrations set hold_expires_at = now() - interval '1 minute' where status = 'pending_payment'`;
  const after = await register({ guestCount: 4, phone: "0176 7000007" });
  check("expired hold is released automatically", after.status === 200 && (await sql`select count(*)::int as n from registrations where payment_status = 'expired' and phone = '+491767000006'`)[0].n === 1);

  // Late payment after the hold ended is still honoured
  const [late] = await sql`select id, stripe_session_id from registrations where phone = '+491767000006'`;
  await stripeEvent("checkout.session.completed", paySession(late.stripe_session_id));
  const [lateRow] = await sql`select status, payment_status, admin_note from registrations where id = ${late.id}`;
  check("late payment honoured and flagged for the organizer", lateRow.status === "confirmed" && lateRow.payment_status === "paid" && lateRow.admin_note.includes("check capacity"));

  // Expired webhook
  await reset({ max_capacity: 10, payments_enabled: true, price_normal_cents: 2000 });
  const key4 = crypto.randomUUID();
  await register({ guestCount: 2, phone: "0176 7000008", idempotencyKey: key4 });
  const [r4] = await sql`select * from registrations where idempotency_key = ${key4}`;
  await stripeEvent("checkout.session.expired", { ...sessions.get(r4.stripe_session_id), status: "expired" });
  check("Stripe 'expired' event cancels the hold", (await sql`select status from registrations where id = ${r4.id}`)[0].status === "cancelled");

  // Same phone tries again while an earlier payment is open
  const key5 = crypto.randomUUID();
  await register({ guestCount: 2, phone: "0176 7000009", idempotencyKey: key5 });
  const [r5] = await sql`select * from registrations where idempotency_key = ${key5}`;
  const retry = await register({ guestCount: 3, phone: "0176 7000009" });
  await sleep(500);
  check("same guest retries: earlier unpaid attempt replaced, its Stripe page closed", retry.status === 200 && (await sql`select status from registrations where id = ${r5.id}`)[0].status === "cancelled" && sessions.get(r5.stripe_session_id)?.status === "expired");

  // Waiting list never pays; Stripe outage handled
  await reset({ max_capacity: 1, payments_enabled: true, price_normal_cents: 2000, waitlist_enabled: true });
  await register({ guestCount: 1, phone: "0176 7000010" });
  const wlPay = await register({ guestCount: 2, phone: "0176 7000011", acceptWaitlist: true });
  check("waiting list: no payment", wlPay.status === 201 && wlPay.data.registration?.status === "waitlisted" && !wlPay.data.payment);
  await reset({ max_capacity: 10, payments_enabled: true, price_normal_cents: 2000 });
  stripeDown = true;
  const down = await register({ guestCount: 2, phone: "0176 7000012" });
  stripeDown = false;
  check("Stripe unavailable → clear error, places not kept", down.status === 503 && down.data.error === "payment_unavailable" && (await sql`select status from registrations where phone = '+491767000012'`)[0]?.status === "cancelled");
  await reset({ payments_enabled: false });
  check("payment switched off → free reservation as before", (await register({ guestCount: 2 })).status === 201);

  console.log("Age notice");
  await sql`update event_settings set min_age = 18 where id = 1`;
  check("18+ notice shown (German default)", (await fetch(BASE + "/").then((r) => r.text())).includes("Einlass ab 18 Jahren"));
  check("18+ notice translated", (await fetch(BASE + "/", { headers: { Cookie: "lang=tr" } }).then((r) => r.text())).includes("18 yaş ve üzeri katılabilir"));
  await sql`update event_settings set min_age = 0 where id = 1`;
  check("min age 0 hides the notice", !(await fetch(BASE + "/").then((r) => r.text())).includes("Einlass ab"));
  await sql`update event_settings set min_age = 18 where id = 1`;

  console.log("Entry tickets (QR) and door");
  await reset({ max_capacity: 6, waitlist_enabled: true });
  const t1 = await register({ guestCount: 3 });
  const tok = t1.data.registration?.ticketToken;
  check("free reservation → entry QR code returned", t1.status === 201 && /^[a-f0-9]{64}$/.test(tok || ""));
  const [t1row] = await sql`select ticket_token from registrations where reference = ${t1.data.registration?.reference}`;
  check("ticket code stored, unique per reservation", t1row?.ticket_token === tok && tok !== (await register({ guestCount: 1 })).data.registration?.ticketToken);
  const ticketHtml = await fetch(`${BASE}/ticket/${tok}`, { headers: { Cookie: "lang=de" } }).then((r) => r.text());
  check("ticket page shows the ticket (name, places, QR hint)", ticketHtml.includes("Test Guest") && ticketHtml.includes("3 Personen") && ticketHtml.includes("Er gilt für alle 3 Personen"));
  check("ticket page is not indexed and shows no phone number", ticketHtml.includes("noindex") && !ticketHtml.includes("+49176"));
  check("unknown ticket → not found message", (await fetch(`${BASE}/ticket/${"0".repeat(64)}`).then((r) => r.text())).includes("Ticket nicht gefunden"));
  await sql`update registrations set status = 'cancelled' where ticket_token = ${tok}`;
  check("cancelled reservation → ticket page says not valid", (await fetch(`${BASE}/ticket/${tok}`).then((r) => r.text())).includes("Dieses Ticket ist nicht gültig"));
  const wlT = await register({ guestCount: 6, acceptWaitlist: true });
  check("waiting list → no entry QR code", wlT.data.registration?.status === "waitlisted" && !wlT.data.registration?.ticketToken, JSON.stringify(wlT.data));
  check("door page asks for sign-in when signed out", (await fetch(`${BASE}/door`).then((r) => r.text())).includes("Einlass"));
  check("door page does not show guests when signed out", !(await fetch(`${BASE}/door`).then((r) => r.text())).includes("Test Guest"));

  console.log("Tickets at the door (Abendkasse) info");
  await reset({ max_capacity: 2, waitlist_enabled: false });
  const homeOpen = await fetch(BASE + "/", { headers: { Cookie: "lang=de" } }).then((r) => r.text());
  check("not shown while places are free", !homeOpen.includes("Abendkasse"));
  await register({ guestCount: 2 });
  const homeFull = await fetch(BASE + "/", { headers: { Cookie: "lang=de" } }).then((r) => r.text());
  check("sold out → 'ausgebucht' plus Abendkasse info", homeFull.includes("Der Abend ist ausgebucht") && homeFull.includes("Abendkasse") && homeFull.includes("weitere Tickets direkt am Eingang"));
  await sql`update event_settings set translations = ${sql.json({ en: { door_sales_info: "On the night of the event, more tickets are available at the entrance while places last." } })} where id = 1`;
  check("Abendkasse info translated (en)", (await fetch(BASE + "/", { headers: { Cookie: "lang=en" } }).then((r) => r.text())).includes("more tickets are available at the entrance"));
  await sql`update event_settings set waitlist_enabled = true where id = 1`;
  check("shown with the waiting list too", (await fetch(BASE + "/", { headers: { Cookie: "lang=de" } }).then((r) => r.text())).includes("Abendkasse"));
  await sql`update event_settings set registration_open = false, waitlist_enabled = false where id = 1`;
  check("shown when registration is closed", (await fetch(BASE + "/", { headers: { Cookie: "lang=de" } }).then((r) => r.text())).includes("Abendkasse"));
  const savedDoorText = (await sql`select door_sales_info from event_settings where id = 1`)[0].door_sales_info;
  await sql`update event_settings set door_sales_info = '' where id = 1`;
  check("empty text hides it", !(await fetch(BASE + "/", { headers: { Cookie: "lang=de" } }).then((r) => r.text())).includes("Abendkasse"));
  await sql`update event_settings set door_sales_info = ${savedDoorText}, translations = '{}'::jsonb where id = 1`;

  console.log("Public pages");
  for (const p of ["/", "/privacy", "/imprint", "/api/calendar"]) check(`GET ${p} → 200`, (await fetch(BASE + p)).status === 200);
  const ics = await fetch(BASE + "/api/calendar").then((r) => r.text());
  check("calendar file is valid iCalendar", ics.startsWith("BEGIN:VCALENDAR") && ics.includes("DTSTART:"));
  check("admin redirects to login when signed out", (await fetch(BASE + "/admin", { redirect: "manual" })).status === 307);
} finally {
  await reset();
  await sql`update event_settings set max_capacity = 250, waitlist_enabled = true, data_retention_days = 30,
            event_date = current_date + 21 where id = 1`;
  await sql.end();
  mock.close();
  stripeMock.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
