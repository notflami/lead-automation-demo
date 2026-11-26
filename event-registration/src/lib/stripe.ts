import "server-only";
import Stripe from "stripe";

/** Places stay held this long while the guest pays (Stripe Checkout sessions expire after 30 minutes). */
export const CHECKOUT_MINUTES = 30;
export const HOLD_MINUTES = CHECKOUT_MINUTES + 5;

const g = globalThis as unknown as { __stripe?: Stripe };

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** "test" / "live" from the key prefix (the key itself is never shown). */
export function stripeMode(): "test" | "live" | null {
  const k = process.env.STRIPE_SECRET_KEY || "";
  if (!k) return null;
  return /^(sk|rk)_live_/.test(k) ? "live" : "test";
}

export function stripe(): Stripe {
  if (!g.__stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    const config: Stripe.StripeConfig = { maxNetworkRetries: 2, timeout: 15_000 };
    // Only for automated tests against a local mock of the Stripe API.
    if (process.env.STRIPE_API_URL) {
      const u = new URL(process.env.STRIPE_API_URL);
      config.host = u.hostname;
      config.port = Number(u.port) || undefined;
      config.protocol = u.protocol.replace(":", "") as "http" | "https";
    }
    g.__stripe = new Stripe(key, config);
  }
  return g.__stripe;
}

/** Checkout page language; Stripe has no Albanian/Bosnian/Serbian, so those follow the browser. */
export function stripeLocale(locale: string): Stripe.Checkout.SessionCreateParams.Locale {
  return (["de", "en", "hr", "tr"].includes(locale) ? locale : "auto") as Stripe.Checkout.SessionCreateParams.Locale;
}
