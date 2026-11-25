import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { listRegistrations } from "@/lib/registrations";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Neutralises spreadsheet formula injection and quotes the cell. */
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^\+\d{6,15}$/.test(s)) s = "'" + s; // E.164 phones are safe
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const s = await getSettings();
  const amount = (r: { guest_count: number; ticket_type: string }) =>
    ((r.guest_count * (r.ticket_type === "vip" ? s.price_vip_cents : s.price_normal_cents)) / 100).toFixed(2).replace(".", ",");
  const rows = await listRegistrations({ q: url.searchParams.get("q") || "", status: url.searchParams.get("status") || "all" });
  const tz = process.env.EVENT_TIMEZONE || "Europe/Berlin";
  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: tz, dateStyle: "short", timeStyle: "medium" });
  const header = ["Registration ID", "Full name", "Phone", "Guests", "Ticket", "Amount (EUR)", "Status", "Registered at", "Note"];
  const lines = rows.map((r) =>
    [r.reference, r.full_name, r.phone, r.guest_count, r.ticket_type === "vip" ? "VIP" : "Normal", amount(r), r.status, fmt.format(new Date(r.created_at)), r.admin_note]
      .map(cell)
      .join(";"),
  );
  // Semicolon + BOM: opens correctly in German Excel and keeps č/ć/š/ž/đ intact.
  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registrations-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
