import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { buildIcs } from "@/lib/ics";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  if (!s.event_date || !s.start_time) return new NextResponse("Event date not set yet.", { status: 404 });
  const ics = buildIcs({
    uid: `event-${s.event_date}@${new URL(env.siteUrl()).host}`,
    title: s.event_name,
    description: [s.tagline, s.additional_info, env.siteUrl()].filter(Boolean).join("\n\n"),
    location: [s.venue_name, s.venue_address].filter(Boolean).join(", "),
    url: env.siteUrl(),
    date: s.event_date,
    start: s.start_time,
    end: s.end_time,
    timeZone: env.timeZone(),
  });
  const filename = s.event_name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "event";
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
