import { after, NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { checkFormToken, issueFormToken, MIN_FILL_SECONDS } from "@/lib/form-token";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createRegistration } from "@/lib/registrations";
import { getSettings } from "@/lib/settings";
import { validateRegistration } from "@/lib/validation";
import { deliverRegistrationWebhook, retryPendingWebhooks } from "@/lib/webhook";

export const dynamic = "force-dynamic";

const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("content-type")?.includes("application/json")) return json({ ok: false, error: "server" }, 415);
    const raw = await req.text();
    if (raw.length > 8_000) return json({ ok: false, error: "server" }, 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch {
      return json({ ok: false, error: "server" }, 400);
    }

    // 1. Spam protection: honeypot, minimum fill time, rate limit.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return json({ ok: false, error: "validation", fields: { form: "form_invalid" } }, 400);
    }
    const token = await checkFormToken(body.formToken);
    if (token === "invalid") return json({ ok: false, error: "form_expired", formToken: await issueFormToken() }, 401);
    if (token === "too_fast") return json({ ok: false, error: "too_fast", retryAfterMs: MIN_FILL_SECONDS * 1000 }, 425);

    if (!(await rateLimit("register", clientIp(req.headers), 10, 10 * 60))) {
      return json({ ok: false, error: "rate_limited" }, 429);
    }

    // 2. Validate.
    const settings = await getSettings();
    const v = validateRegistration(body, {
      maxGuests: settings.max_guests_per_registration,
      defaultCountryCode: env.defaultCountryCode(),
    });
    if (!v.ok) return json({ ok: false, error: "validation", fields: v.errors }, 400);

    // 3–4. Save atomically (capacity + duplicate checks under lock) and get the REG id.
    const result = await createRegistration(v.data);
    if (!result.ok) {
      if (result.reason === "phone_taken") return json({ ok: false, error: "phone_taken" }, 409);
      return json(
        { ok: false, error: result.reason, remaining: result.remaining, waitlistAvailable: result.waitlistAvailable },
        409,
      );
    }

    const r = result.registration;
    // 5. n8n webhook — runs after the response is sent; failures are recorded and retried.
    if (!result.duplicate) {
      after(async () => {
        await deliverRegistrationWebhook(r.id);
        await retryPendingWebhooks(5);
      });
    }

    // 6. Confirmation data.
    return json(
      {
        ok: true,
        registration: {
          reference: r.reference,
          guestCount: r.guest_count,
          status: r.status,
          firstName: r.full_name.split(" ")[0],
        },
      },
      result.duplicate ? 200 : 201,
    );
  } catch (err) {
    console.error("[register] unexpected error", err);
    return json({ ok: false, error: "server" }, 500);
  }
}
