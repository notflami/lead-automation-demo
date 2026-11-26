import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { TicketQr } from "@/components/TicketQr";
import { db } from "@/lib/db";
import { formatEventDate, formatTimeRange } from "@/lib/format";
import { getDict } from "@/lib/locale";
import { getSettings, localizeSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket", robots: { index: false, follow: false }, referrer: "no-referrer" };

interface TicketRow {
  reference: string;
  full_name: string;
  guest_count: number;
  ticket_type: "normal" | "vip";
  status: string;
  payment_status: string;
  checked_in_guests: number;
  anonymized_at: Date | null;
}

/** The guest's personal ticket (link inside the QR code). Anyone with the link sees it, so it shows no phone number. */
export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [{ locale, t }, base] = await Promise.all([getDict(), getSettings()]);
  const s = localizeSettings(base, locale);
  const rows = /^[a-f0-9]{64}$/.test(token)
    ? await db()<TicketRow[]>`
        select reference, full_name, guest_count, ticket_type, status, payment_status, checked_in_guests, anonymized_at
        from registrations where ticket_token = ${token}`
    : [];
  const r = rows[0];

  const valid = r && !r.anonymized_at && r.payment_status !== "refunded" && (r.status === "confirmed" || r.status === "checked_in");
  const notYet = r && !r.anonymized_at && (r.status === "waitlisted" || r.status === "pending_payment");
  const dateText = formatEventDate(s.event_date, locale);
  const timeText = formatTimeRange(s.start_time, s.end_time, locale);

  return (
    <LegalPage title={t.ticketTitle} locale={locale} t={t} s={s}>
      {!r ? (
        <p className="text-xl font-semibold text-ink">{t.ticketNotFound}</p>
      ) : !valid ? (
        <div className="rounded-xl border-l-4 border-kilim bg-kilim/8 px-5 py-4">
          <p className="text-xl font-semibold text-kilim-dark">{notYet ? t.ticketNotYet : t.ticketInvalid}</p>
          <p className="mt-1 text-base">{notYet ? t.ticketNotYetText : t.ticketInvalidText}</p>
          <p className="mt-2 text-base text-muted">{r.reference}</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-ink/25 bg-linen px-5 py-6 sm:px-7">
          <p className="text-2xl font-semibold text-ink">{s.event_name}</p>
          <p className="text-lg">
            {dateText}
            {timeText && `, ${timeText}`}
          </p>
          {s.venue_name && (
            <p className="text-base text-muted">
              {s.venue_name}
              {s.venue_address && `, ${s.venue_address}`}
            </p>
          )}
          <p className="mt-5 font-sans text-[clamp(1.9rem,9vw,3rem)] font-bold tracking-wide text-kilim tabular-nums">{r.reference}</p>
          <p className="text-xl font-semibold text-ink">{r.full_name}</p>
          <p className="text-lg">
            {r.guest_count} {t.person(r.guest_count)}
            {r.ticket_type === "vip" && <span className="font-semibold"> · ★ {t.ticketVip}</span>}
          </p>
          {r.checked_in_guests > 0 && <p className="mt-1 text-base font-semibold text-moss">{t.ticketInside(r.checked_in_guests, r.guest_count)}</p>}
          <TicketQr path={`/ticket/${token}`} label={`${t.ticketQrHeading} ${r.reference}`} className="mt-5" />
          <p className="mt-4 text-base text-thread">{t.ticketQrHint(r.guest_count)}</p>
          <p className="text-sm text-muted">{t.ticketLinkHint}</p>
        </div>
      )}
    </LegalPage>
  );
}
