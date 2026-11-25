import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { formatEventDate, formatTimeRange } from "@/lib/format";
import { getSettings } from "@/lib/settings";

// Preview image shown when the link is shared on WhatsApp, Facebook, Instagram etc.
export const dynamic = "force-dynamic";
export const alt = "Event invitation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function bandSvg(): string {
  const cell = 10;
  const paths: string[] = [];
  const colors = ["#b0222e", "#eaa935", "#b0222e"];
  for (let tile = 0; tile < 8; tile++) {
    const cx = tile * 18 + 9;
    for (let x = cx - 8; x <= cx + 8; x++)
      for (let y = 0; y <= 14; y++) {
        const d = Math.abs(x - cx) + Math.abs(y - 7);
        const c = d === 7 ? colors[0] : d === 5 ? colors[1] : d === 3 ? colors[2] : d === 0 ? "#1a1d42" : null;
        if (!c) continue;
        const x0 = x * cell + 2, y0 = y * cell + 2, x1 = x0 + cell - 4, y1 = y0 + cell - 4;
        paths.push(`<path d="M${x0} ${y0}L${x1} ${y1}M${x1} ${y0}L${x0} ${y1}" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`);
      }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="150" viewBox="0 0 1440 150">${paths.join("")}</svg>`;
}

export default async function OgImage() {
  const s = await getSettings();
  const font = await readFile(path.join(process.cwd(), "node_modules/@fontsource/yeseva-one/files/yeseva-one-latin-ext-400-normal.woff")).catch(() => null);
  const fontLatin = await readFile(path.join(process.cwd(), "node_modules/@fontsource/yeseva-one/files/yeseva-one-latin-400-normal.woff")).catch(() => null);
  const date = [formatEventDate(s.event_date, "en"), formatTimeRange(s.start_time, s.end_time, "en")].filter(Boolean).join(", ");
  const band = `data:image/svg+xml;base64,${Buffer.from(bandSvg()).toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#1a1d42", color: "#f8f6f1" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: "70px 80px 0", flex: 1 }}>
          <div style={{ fontSize: 34, color: "#eaa935", fontFamily: "sans-serif" }}>{date}</div>
          <div style={{ fontSize: s.event_name.length > 22 ? 86 : 118, fontFamily: "Yeseva One", lineHeight: 1.02, marginTop: 18 }}>{s.event_name}</div>
          {s.venue_name && <div style={{ fontSize: 32, marginTop: 24, opacity: 0.8, fontFamily: "sans-serif" }}>{s.venue_name}</div>}
        </div>
        <div style={{ display: "flex", background: "#f8f6f1", height: 170, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={band} width={1440} height={150} alt="" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [fontLatin, font].filter(Boolean).map((data) => ({ name: "Yeseva One", data: data as Buffer, weight: 400 as const, style: "normal" as const })),
    },
  );
}
