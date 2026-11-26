"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canUseDoor, doorCheckIn, doorCounts, doorGuest, doorLookup, doorSignIn, doorSignOut, doorUndo, type DoorGuest, type LookupResult } from "@/lib/door";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type DoorLoginState = { error?: string } | null;

export async function doorLoginAction(_: DoorLoginState, form: FormData): Promise<DoorLoginState> {
  if (!(await rateLimit("door-login", clientIp(await headers()), 10, 15 * 60))) {
    return { error: "Zu viele Versuche. Bitte 15 Minuten warten." };
  }
  const ok = await doorSignIn(String(form.get("password") || ""));
  if (!ok) return { error: "Passwort falsch." };
  redirect("/door");
}

export async function doorLogoutAction(): Promise<void> {
  await doorSignOut();
  redirect("/door");
}

type Signed<T> = { signedOut: true } | ({ signedOut?: false } & T);

export async function lookupAction(code: string): Promise<Signed<{ result: LookupResult; counts: { inside: number; expected: number } }>> {
  if (!(await canUseDoor())) return { signedOut: true };
  const [result, counts] = await Promise.all([doorLookup(String(code)), doorCounts()]);
  return { result, counts };
}

export async function guestAction(id: string): Promise<Signed<{ guest: DoorGuest | null }>> {
  if (!(await canUseDoor())) return { signedOut: true };
  return { guest: await doorGuest(String(id)) };
}

export async function checkInAction(id: string, count: number): Promise<Signed<{ ok: boolean; guest: DoorGuest | null; counts: { inside: number; expected: number } }>> {
  if (!(await canUseDoor())) return { signedOut: true };
  const res = await doorCheckIn(String(id), Number(count));
  return { ...res, counts: await doorCounts() };
}

export async function undoAction(id: string, count: number): Promise<Signed<{ guest: DoorGuest | null; counts: { inside: number; expected: number } }>> {
  if (!(await canUseDoor())) return { signedOut: true };
  const guest = await doorUndo(String(id), Number(count));
  return { guest, counts: await doorCounts() };
}

export async function countsAction(): Promise<Signed<{ counts: { inside: number; expected: number } }>> {
  if (!(await canUseDoor())) return { signedOut: true };
  return { counts: await doorCounts() };
}
