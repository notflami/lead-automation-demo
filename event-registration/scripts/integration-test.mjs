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
    email: "",
    guestCount: 2,
    privacyAccepted: true,
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
            max_guests_per_registration = 8 where id = 1`;
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
  check("missing privacy consent rejected", (await register({ privacyAccepted: false })).data.fields?.privacyAccepted === "privacy_required");
  check("honeypot rejected", (await register({ website: "http://spam" })).status === 400);
  check("submitted too fast → 425", (await register({ formToken: await token(0) })).status === 425);
  const forged = await register({ formToken: "forged.token.value" });
  check("forged form token → 401 with fresh token", forged.status === 401 && typeof forged.data.formToken === "string");
  await reset({ max_capacity: 1000 });
  const rl = [];
  for (let i = 0; i < 12; i++) rl.push((await register({}, { ip: "203.0.113.7" })).status);
  check("rate limit after 10 attempts per IP", rl.slice(0, 10).every((s) => s === 201) && rl.slice(10).every((s) => s === 429), rl.join(","));

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

  console.log("Public pages");
  for (const p of ["/", "/privacy", "/imprint", "/api/calendar"]) check(`GET ${p} → 200`, (await fetch(BASE + p)).status === 200);
  const ics = await fetch(BASE + "/api/calendar").then((r) => r.text());
  check("calendar file is valid iCalendar", ics.startsWith("BEGIN:VCALENDAR") && ics.includes("DTSTART:"));
  check("admin redirects to login when signed out", (await fetch(BASE + "/admin", { redirect: "manual" })).status === 307);
} finally {
  await reset();
  await sql`update event_settings set max_capacity = 250, waitlist_enabled = true where id = 1`;
  await sql.end();
  mock.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
