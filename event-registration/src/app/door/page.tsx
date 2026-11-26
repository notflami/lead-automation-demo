import type { Metadata, Viewport } from "next";
import { DoorApp } from "@/components/door/DoorApp";
import { DoorLogin } from "@/components/door/DoorLogin";
import { isAdmin } from "@/lib/auth";
import { canUseDoor, doorCounts, doorPasswordHash } from "@/lib/door";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Einlass", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#141a33" };

/** Private page for security at the entrance: scan QR codes and admit guests. */
export default async function DoorPage() {
  const s = await getSettings();
  if (!(await canUseDoor())) {
    const passwordSet = (await doorPasswordHash()) !== "";
    return <DoorLogin eventName={s.event_name} passwordSet={passwordSet} />;
  }
  return <DoorApp eventName={s.event_name} minAge={s.min_age} initialCounts={await doorCounts()} isAdmin={await isAdmin()} />;
}
