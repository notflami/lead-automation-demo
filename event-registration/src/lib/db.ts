import "server-only";
import postgres from "postgres";
import { env } from "./env";

type Sql = ReturnType<typeof postgres>;

/**
 * Personal data must be encrypted in transit: require TLS for every remote database
 * unless the connection string says otherwise (?sslmode=...). Local/Docker hosts stay plain.
 */
export function sslFor(url: string): "require" | false | undefined {
  if (/[?&]sslmode=/i.test(url)) return undefined; // respect the explicit setting
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return "require";
  }
  return ["localhost", "127.0.0.1", "::1", "db", "postgres"].includes(host) ? false : "require";
}
const g = globalThis as unknown as { __sql?: Sql };

/** Shared connection pool (reused across hot reloads in development). */
export function db(): Sql {
  if (!g.__sql) {
    g.__sql = postgres(env.databaseUrl, {
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      prepare: false, // compatible with transaction poolers (Supabase :6543, PgBouncer)
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
      ssl: sslFor(env.databaseUrl),
    });
  }
  return g.__sql;
}
