import "server-only";
import { db } from "./db";
import { hashKey } from "./crypto";

/**
 * Sliding-window rate limit stored in Postgres (works on serverless hosts where
 * in-memory counters don't survive). Returns true when the request is allowed.
 */
export async function rateLimit(bucket: string, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const sql = db();
  const keyHash = hashKey(key);
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from rate_limit_hits
    where bucket = ${bucket} and key_hash = ${keyHash}
      and created_at > now() - make_interval(secs => ${windowSeconds})`;
  if (count >= limit) return false;
  await sql`insert into rate_limit_hits (bucket, key_hash) values (${bucket}, ${keyHash})`;
  // Opportunistic cleanup (~2% of calls).
  if (Math.random() < 0.02) await sql`delete from rate_limit_hits where created_at < now() - interval '1 day'`;
  return true;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
