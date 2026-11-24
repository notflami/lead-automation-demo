import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/** Salted, non-reversible hash used for rate limiting (never store raw IPs). */
export function hashKey(value: string): string {
  return createHash("sha256").update(env.sessionSecret + "|" + value).digest("hex").slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
