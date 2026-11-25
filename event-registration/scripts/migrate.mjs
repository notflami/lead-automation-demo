// Minimal migration runner: applies db/migrations/*.sql in order, once each.
// Usage: npm run db:migrate   (reads DATABASE_URL from the environment or .env)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// Same rule as src/lib/db.ts: TLS for remote databases unless ?sslmode= is given.
const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
const ssl = /[?&]sslmode=/i.test(url) ? undefined : ["localhost", "127.0.0.1", "::1", "db", "postgres"].includes(host) ? false : "require";
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, ssl });
const dir = path.join(root, "db", "migrations");

try {
  await sql`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = fs.readFileSync(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`applied ${file}`);
    count++;
  }
  console.log(count ? `${count} migration(s) applied.` : "Database is up to date.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
