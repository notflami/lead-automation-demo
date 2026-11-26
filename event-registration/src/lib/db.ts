import "server-only";
import postgres from "postgres";
import type { TransactionSql } from "postgres";
import { after } from "next/server";
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

/**
 * Serverless hosts (Vercel) pause the function between requests. A database connection left open
 * during a pause can silently die, and the next request then waits on it instead of failing:
 * the site seems to "stop responding". So idle connections are closed after IDLE_SECONDS, and each
 * request keeps the function alive slightly longer than that (via `after`), so nothing stale survives
 * a pause. Same idea as Vercel's attachDatabasePool, which does not support this driver.
 */
const IDLE_SECONDS = 2;

function keepAliveUntilIdle() {
  try {
    after(() => new Promise((resolve) => setTimeout(resolve, IDLE_SECONDS * 1000 + 500)));
  } catch {
    // Outside a request (e.g. scripts): nothing to keep alive.
  }
}

/** Shared connection pool (reused across hot reloads in development). */
export function db(): Sql {
  keepAliveUntilIdle();
  if (!g.__sql) {
    g.__sql = postgres(env.databaseUrl, {
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      prepare: false, // compatible with transaction poolers (Supabase :6543, PgBouncer)
      idle_timeout: IDLE_SECONDS,
      connect_timeout: 10,
      onnotice: () => {},
      ssl: sslFor(env.databaseUrl),
    });
  }
  return g.__sql;
}

/**
 * A transaction that can never block the database for long: waiting for a lock gives up after 15 s,
 * and if the server process freezes mid-transaction (serverless), Postgres ends it after 20 s and
 * releases its locks instead of keeping them until the connection dies.
 */
export function transaction<T>(fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return db().begin(async (tx) => {
    await tx`set local lock_timeout = '15s'`;
    await tx`set local idle_in_transaction_session_timeout = '20s'`;
    return fn(tx);
  }) as Promise<T>;
}
