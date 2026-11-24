import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

/**
 * Signed "form issued at" token. A registration submitted faster than
 * MIN_FILL_SECONDS after the page loaded is almost certainly a bot.
 */
export const MIN_FILL_SECONDS = 3;

const key = () => new TextEncoder().encode(env.sessionSecret);

export async function issueFormToken(): Promise<string> {
  return new SignJWT({ k: "form" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2d").sign(key());
}

export async function checkFormToken(token: unknown): Promise<"ok" | "too_fast" | "invalid"> {
  if (typeof token !== "string") return "invalid";
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.k !== "form" || typeof payload.iat !== "number") return "invalid";
    return Date.now() / 1000 - payload.iat < MIN_FILL_SECONDS ? "too_fast" : "ok";
  } catch {
    return "invalid";
  }
}
