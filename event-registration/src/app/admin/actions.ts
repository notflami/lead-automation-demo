"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSessionCookie, destroySession, requireAdmin } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizePhone } from "@/lib/phone";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { anonymizeRegistrations, setStatus, updateRegistration } from "@/lib/registrations";
import { STATUSES, type RegistrationStatus } from "@/lib/types";
import { adminRegistrationSchema, settingsSchema } from "@/lib/validation";
import { retryPendingWebhooks } from "@/lib/webhook";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

// ------------------------------------------------------------------- auth
export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ip = clientIp(await headers());
  if (!(await rateLimit("login", ip, 8, 15 * 60))) {
    return { error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  }
  if (!process.env.ADMIN_PASSWORD) {
    return { error: "Sign-in is not set up: the ADMIN_PASSWORD setting is missing on the server." };
  }
  const password = String(form.get("password") || "");
  if (!password || !safeEqual(password, env.adminPassword)) {
    return { error: "That password is not correct." };
  }
  await createSessionCookie();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

// ------------------------------------------------------------ registrations
export async function updateRegistrationAction(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = adminRegistrationSchema.safeParse({
    fullName: form.get("fullName"),
    phone: form.get("phone"),
    email: form.get("email") ?? "",
    guestCount: form.get("guestCount"),
    status: form.get("status"),
    ticketType: form.get("ticketType") ?? "normal",
    adminNote: form.get("adminNote") ?? "",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: `Check the field "${String(field)}": ${parsed.error.issues[0]?.message}` };
  }
  const phone = normalizePhone(parsed.data.phone, env.defaultCountryCode());
  if (!phone) return { error: "The phone number is not valid." };
  const res = await updateRegistration(id, {
    ...parsed.data,
    phone,
    email: parsed.data.email || null,
    status: parsed.data.status as RegistrationStatus,
    ticketType: parsed.data.ticketType,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Changes saved." };
}

export async function setStatusAction(id: string, status: string): Promise<ActionState> {
  await requireAdmin();
  if (!STATUSES.includes(status as RegistrationStatus)) return { error: "Unknown status." };
  const res = await setStatus(id, status as RegistrationStatus);
  revalidatePath("/admin", "layout");
  return res.ok ? { ok: true } : { error: res.error };
}

export async function retryWebhooksAction(): Promise<ActionState> {
  await requireAdmin();
  const r = await retryPendingWebhooks(100);
  revalidatePath("/admin", "layout");
  return { ok: true, message: `${r.sent} sent, ${r.failed} still failing.` };
}

// ----------------------------------------------------------------- settings
export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const raw: Record<string, unknown> = Object.fromEntries(form.entries());
  raw.registration_open = form.get("registration_open") === "on";
  raw.waitlist_enabled = form.get("waitlist_enabled") === "on";
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `Check the field "${String(i?.path[0]).replace(/_/g, " ")}": ${i?.message}` };
  }
  const s = parsed.data;
  let whatsapp = "";
  if (s.whatsapp_number) {
    const n = normalizePhone(s.whatsapp_number, env.defaultCountryCode());
    if (!n) return { error: 'Check the field "WhatsApp number": use a mobile number like +49 176 1234567.' };
    whatsapp = n;
  }
  const values = {
    ...s,
    whatsapp_number: whatsapp,
    event_date: s.event_date || null,
    start_time: s.start_time || null,
    end_time: s.end_time || null,
    updated_at: new Date(),
  };
  const sql = db();
  await sql`update event_settings set ${sql(values)} where id = 1`;
  revalidatePath("/", "layout");
  return { ok: true, message: "Event settings saved. The public page shows them now." };
}

export async function anonymizeAllAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  if (String(form.get("confirm") || "").trim().toUpperCase() !== "DELETE") {
    return { error: 'Type DELETE to confirm.' };
  }
  const n = await anonymizeRegistrations(true);
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Personal data removed from ${n} registration(s). Guest totals are kept.` };
}
