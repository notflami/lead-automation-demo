import { intlTag, type Locale } from "./i18n";

const tag = (l: Locale) => intlTag(l);

/** "Saturday, 12 December 2026" — date-only values are formatted in UTC to avoid day shifts. */
export function formatEventDate(date: string | null, locale: Locale): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(tag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
}

export function formatDayMonth(date: string | null, locale: Locale): { day: string; month: string; weekday: string } | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00Z");
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag(locale), { ...o, timeZone: "UTC" }).format(d);
  return { day: f({ day: "numeric" }), month: f({ month: "long" }), weekday: f({ weekday: "long" }) };
}

export function formatTimeRange(start: string | null, end: string | null, locale: Locale): string {
  if (!start) return "";
  const suffix = locale === "de" ? " Uhr" : "";
  return end ? `${start}–${end}${suffix}` : `${start}${suffix}`;
}

export function formatDateTime(d: Date | string, timeZone = "Europe/Berlin"): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(d));
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}
