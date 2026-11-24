// Fills a LOCAL database with fictional registrations to try the dashboard.
// Usage: node scripts/seed-demo.mjs --yes-wipe-database
import fs from "node:fs";
import postgres from "postgres";
for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) process.loadEnvFile(f);
if (!process.argv.includes("--yes-wipe-database")) {
  console.error("Refusing to run: this deletes all registrations. Pass --yes-wipe-database (local DB only).");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
const first = ["Ana", "Marko", "Jelena", "Emir", "Ivana", "Dragan", "Selma", "Nikola", "Mirela", "Luka", "Amra", "Stefan", "Teodora", "Arben", "Katarina", "Jonas", "Lea", "Milan", "Elif", "Goran"];
const last = ["Petrović", "Hodžić", "Kovačević", "Novak", "Begić", "Jovanović", "Müller", "Krasniqi", "Marić", "Schneider", "Popović", "Yılmaz", "Babić", "Dimitrov"];
await sql`truncate registrations, rate_limit_hits`;
await sql`alter sequence registration_number_seq restart 1`;
let n = 0;
for (let day = 20; day >= 0; day--) {
  const perDay = Math.max(0, Math.round(2 + (20 - day) * 0.5 + (Math.random() * 4 - 2)));
  for (let i = 0; i < perDay; i++) {
    n++;
    const guests = [1, 2, 2, 2, 3, 3, 4, 5, 6][Math.floor(Math.random() * 9)];
    const r = Math.random();
    const status = r < 0.06 ? "cancelled" : r < 0.1 ? "waitlisted" : "confirmed";
    await sql`insert into registrations (full_name, phone, guest_count, status, privacy_accepted_at, created_at, webhook_status, locale)
      values (${first[n % first.length] + " " + last[(n * 7) % last.length]}, ${"+49176" + String(5000000 + n)}, ${guests}, ${status},
              now(), now() - make_interval(days => ${day}, hours => ${Math.floor(Math.random() * 12)}), 'sent', ${n % 3 ? "en" : "de"})`;
  }
}
await sql`update registrations set webhook_status = 'failed', webhook_attempts = 2, webhook_last_error = 'HTTP 502 Bad Gateway'
          where reference in (select reference from registrations order by created_at desc limit 1)`;
const [{ seated }] = await sql`select coalesce(sum(guest_count),0)::int as seated from registrations where status = 'confirmed'`;
await sql`update event_settings set max_capacity = ${Math.max(250, Math.ceil((seated * 1.25) / 10) * 10)} where id = 1`;
console.log(`Inserted ${n} demo registrations (${seated} places).`);
await sql.end();
