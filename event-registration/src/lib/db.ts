import "server-only";
import postgres from "postgres";
import { env } from "./env";

type Sql = ReturnType<typeof postgres>;
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
    });
  }
  return g.__sql;
}
