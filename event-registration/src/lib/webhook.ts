import "server-only";
import { db } from "./db";
import { env } from "./env";
import { hmacHex } from "./crypto";
import type { Registration } from "./types";

export const MAX_WEBHOOK_ATTEMPTS = 10;

export function buildPayload(r: Pick<Registration, "reference" | "full_name" | "phone" | "email" | "guest_count" | "status" | "locale" | "created_at">, eventName: string) {
  return {
    event: "new_registration",
    registration_id: r.reference,
    name: r.full_name,
    phone: r.phone,
    email: r.email,
    guest_count: r.guest_count,
    status: r.status, // "confirmed" | "waitlisted"
    language: r.locale,
    event_name: eventName,
    registered_at: new Date(r.created_at).toISOString(),
  };
}

/** POSTs a JSON payload to the n8n webhook. Throws on network error / non-2xx. */
export async function postToWebhook(payload: object): Promise<void> {
  const url = env.webhookUrl();
  const secret = env.webhookSecret();
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "event-registration-webhook/1.0",
    "X-Webhook-Timestamp": timestamp,
  };
  if (secret) {
    headers["X-Webhook-Secret"] = secret; // simple check (n8n Webhook node → Header Auth)
    headers["X-Webhook-Signature"] = "sha256=" + hmacHex(secret, `${timestamp}.${body}`); // optional HMAC check
  }
  const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
}

/**
 * Delivers the webhook for one registration and records the outcome.
 * The registration is already committed — a failure here never loses data;
 * it is retried later by /api/cron/webhooks or from the dashboard.
 */
export async function deliverRegistrationWebhook(registrationId: string): Promise<"sent" | "failed" | "skipped" | "busy"> {
  const sql = db();
  if (!env.webhookUrl()) {
    await sql`update registrations set webhook_status = 'skipped' where id = ${registrationId} and webhook_status = 'pending'`;
    return "skipped";
  }
  return sql.begin(async (tx) => {
    // skip locked: if another worker is already delivering this row, do nothing (no double send).
    const [row] = await tx<(Registration & { event_name: string })[]>`
      select r.*, s.event_name from registrations r, event_settings s
      where r.id = ${registrationId} and s.id = 1 and r.webhook_status in ('pending', 'failed')
        and r.anonymized_at is null
      for update of r skip locked`;
    if (!row) return "busy" as const;
    try {
      await postToWebhook(buildPayload(row, row.event_name));
      await tx`update registrations set webhook_status = 'sent', webhook_sent_at = now(),
                 webhook_attempts = webhook_attempts + 1, webhook_last_error = null where id = ${registrationId}`;
      return "sent" as const;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await tx`update registrations set webhook_status = 'failed', webhook_attempts = webhook_attempts + 1,
                 webhook_last_error = ${message.slice(0, 500)} where id = ${registrationId}`;
      console.error(`[webhook] delivery failed for ${row.reference}: ${message}`);
      return "failed" as const;
    }
  });
}

/** Retries undelivered webhooks (failed, or pending for > 2 minutes). */
export async function retryPendingWebhooks(limit = 25): Promise<{ sent: number; failed: number }> {
  if (!env.webhookUrl()) return { sent: 0, failed: 0 };
  const rows = await db()<{ id: string }[]>`
    select id from registrations
    where anonymized_at is null and webhook_attempts < ${MAX_WEBHOOK_ATTEMPTS}
      and (webhook_status = 'failed' or (webhook_status = 'pending' and created_at < now() - interval '2 minutes'))
    order by created_at limit ${limit}`;
  let sent = 0;
  let failed = 0;
  for (const { id } of rows) {
    const r = await deliverRegistrationWebhook(id);
    if (r === "sent") sent++;
    else if (r === "failed") failed++;
  }
  return { sent, failed };
}

export async function webhookHealth(): Promise<{ configured: boolean; failed: number; pending: number; sent: number }> {
  const [row] = await db()<{ failed: number; pending: number; sent: number }[]>`
    select count(*) filter (where webhook_status = 'failed')::int as failed,
           count(*) filter (where webhook_status = 'pending')::int as pending,
           count(*) filter (where webhook_status = 'sent')::int as sent
    from registrations where anonymized_at is null`;
  return { configured: Boolean(env.webhookUrl()), ...row };
}
