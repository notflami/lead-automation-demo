import { Embroidery, StitchDiamond } from "@/components/Embroidery";
import { KilimFrame } from "@/components/KilimFrame";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { RegistrationForm, type FormMode } from "@/components/RegistrationForm";
import { SiteFooter } from "@/components/SiteFooter";
import { env } from "@/lib/env";
import { stripeConfigured } from "@/lib/stripe";
import { formatDayMonth, formatEventDate, formatTimeRange, splitLines } from "@/lib/format";
import { issueFormToken } from "@/lib/form-token";
import { getDict } from "@/lib/locale";
import { getRemainingPlaces } from "@/lib/registrations";
import { EVENT_TZ, getSettings, localizeSettings } from "@/lib/settings";
import { LANGUAGES } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ locale, t }, base] = await Promise.all([getDict(), getSettings()]);
  const s = localizeSettings(base, locale);
  const [places, formToken] = await Promise.all([getRemainingPlaces(s.max_capacity, s.vip_capacity), issueFormToken()]);
  const remaining = places.total;

  const now = Date.now();
  const salesStart = typeof s.sales_start_ms === "number" ? s.sales_start_ms : null;
  const salesEnd = typeof s.sales_end_ms === "number" ? s.sales_end_ms : null;
  const beforeSales = salesStart !== null && now < salesStart;
  const afterSales = salesEnd !== null && now >= salesEnd;
  const mode: FormMode = !s.registration_open
    ? "closed"
    : beforeSales
      ? "upcoming"
      : afterSales
        ? "ended"
        : remaining > 0
          ? "open"
          : s.waitlist_enabled
            ? "waitlist"
            : "full";
  const salesStartText =
    beforeSales && salesStart !== null
      ? new Intl.DateTimeFormat(LANGUAGES.find((l) => l.code === locale)?.intl ?? "de-DE", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: EVENT_TZ,
        }).format(new Date(salesStart))
      : "";
  const dateText = formatEventDate(s.event_date, locale);
  const dm = formatDayMonth(s.event_date, locale);
  const timeText = formatTimeRange(s.start_time, s.end_time, locale);
  const expectations = splitLines(s.expectations);
  const aboutParagraphs = s.about_text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const showScarcity = mode === "open" && s.low_capacity_threshold > 0 && remaining <= s.low_capacity_threshold;
  const canAct = mode === "open" || mode === "waitlist";
  const year = s.event_date?.slice(0, 4);

  return (
    <>
      <a href="#reserve" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-saffron focus:px-4 focus:py-2 focus:text-ink-deep">
        {t.skipToForm}
      </a>

      {/* ------------------------------------------- hero + reservation form (first screen) */}
      <header className="relative bg-ink text-linen">
        <div className="mx-auto max-w-6xl px-5 pt-4 pb-10 sm:px-8 md:pb-16">
          <div className="flex justify-end">
            <LanguageSwitch locale={locale} label={t.language} className="text-linen/90" />
          </div>

          <div className="mt-2 grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:mt-8 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-6">
              {dm && (
                <p className="text-lg font-medium text-saffron md:hidden">
                  {dateText}
                  {s.start_time && <span className="text-linen/80">, {timeText}</span>}
                </p>
              )}
              <h1 className="display mt-2 text-[clamp(2.6rem,11vw,6.5rem)] text-balance text-linen md:mt-0">{s.event_name}</h1>
              {s.tagline && <p className="mt-3 max-w-xl text-lg leading-snug text-linen/85 sm:text-2xl md:mt-5">{s.tagline}</p>}
              {s.venue_name && (
                <p className="mt-3 flex items-start gap-2 text-base text-linen/80 md:hidden">
                  <PinIcon />
                  <span>
                    {s.venue_name}
                    {s.venue_address && <span className="text-linen/60">, {s.venue_address}</span>}
                  </span>
                </p>
              )}
              {s.min_age > 0 && <AgeNotice text={t.ageNotice(s.min_age)} age={s.min_age} className="mt-2 md:hidden" />}
              {showScarcity && <p className="mt-3 text-lg font-medium text-saffron-light">{t.placesLeft(remaining)}</p>}

              {/* Desktop date composition: the day numeral as the anchor. */}
              {dm && (
                <div className="mt-10 hidden border-t border-linen/15 pt-8 md:block">
                  <div className="flex items-end gap-5">
                    <p className="display text-[7.5rem] leading-[0.85] text-saffron tabular-nums">{dm.day}</p>
                    <div className="pb-1">
                      <p className="text-lg text-linen/70">{dm.weekday}</p>
                      <p className="display text-4xl text-linen">
                        {dm.month} <span className="text-linen/50">{year}</span>
                      </p>
                    </div>
                  </div>
                  {timeText && <p className="mt-6 text-xl text-linen/90">{timeText}</p>}
                  {s.venue_name && (
                    <p className="mt-3 flex items-start gap-2 text-lg text-linen/80">
                      <PinIcon />
                      <span>
                        {s.venue_name}
                        {s.venue_address && <span className="block text-linen/60">{s.venue_address}</span>}
                      </span>
                    </p>
                  )}
                  {s.min_age > 0 && <AgeNotice text={t.ageNotice(s.min_age)} age={s.min_age} className="mt-3" />}
                </div>
              )}
            </div>

            <KilimFrame
              id="reserve"
              aria-labelledby={canAct ? "reserve-h" : undefined}
              aria-label={canAct ? undefined : t.formHeading}
              className="scroll-mt-4 md:col-span-6"
            >
              {canAct && (
                <>
                  <h2 id="reserve-h" className="display mb-4 text-[1.65rem] leading-tight min-[380px]:mb-0 sm:text-3xl">
                    {mode === "waitlist" ? t.joinWaitlistCta : t.formHeading}
                  </h2>
                  <p className="mt-1 mb-5 hidden text-base text-muted min-[380px]:block">{mode === "waitlist" ? t.formIntroWaitlist : t.formIntro}</p>
                </>
              )}
              <RegistrationForm
                locale={locale}
                mode={mode}
                maxGuests={s.max_guests_per_registration}
                formToken={formToken}
                siteUrl={env.siteUrl()}
                whatsappNumber={s.whatsapp_number}
                doorInfo={s.door_sales_info.trim()}
                sales={beforeSales && salesStart !== null ? { startIso: new Date(salesStart).toISOString(), startText: salesStartText, serverNow: now } : undefined}
                payment={{ enabled: s.payments_enabled && stripeConfigured(), termsUrl: s.terms_text.trim() ? "/terms" : null }}
                tickets={{
                  vipEnabled: s.vip_capacity > 0,
                  vipAvailable: places.vip,
                  normalInfo: s.ticket_normal_info,
                  vipInfo: s.ticket_vip_info,
                  priceNormal: s.price_normal_cents,
                  priceVip: s.price_vip_cents,
                }}
                event={{
                  name: s.event_name,
                  dateText,
                  dateTextDe: formatEventDate(s.event_date, "de"),
                  timeText,
                  venueName: s.venue_name,
                  venueAddress: s.venue_address,
                }}
              />
            </KilimFrame>
          </div>
        </div>
      </header>

      <Embroidery animate className="bg-linen py-5" />

      <main>
        {/* ------------------------------------------------------------- about */}
        {(aboutParagraphs.length > 0 || expectations.length > 0) && (
          <section aria-labelledby="about-h" className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
            <div className="grid gap-10 md:grid-cols-12">
              <h2 id="about-h" className="display text-4xl md:col-span-4 md:text-5xl">
                {t.aboutHeading}
              </h2>
              <div className="md:col-span-7 md:col-start-6">
                <div className="prose-body max-w-[62ch] text-xl leading-relaxed text-thread">
                  {aboutParagraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {expectations.length > 0 && (
                  <>
                    <h3 className="mt-12 text-2xl font-semibold">{t.expectHeading}</h3>
                    <ul className="mt-5 space-y-4">
                      {expectations.map((item) => (
                        <li key={item} className="flex gap-4 text-lg text-thread">
                          <StitchDiamond className="mt-1 size-6 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ----------------------------------------------------------- details */}
        <section aria-labelledby="details-h" className="border-t border-ink/10 bg-linen-dim/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-12 md:py-20">
            <h2 id="details-h" className="display text-4xl md:col-span-4 md:text-5xl">
              {t.detailsHeading}
            </h2>
            <dl className="divide-y divide-ink/12 border-y border-ink/12 md:col-span-7 md:col-start-6">
              {dateText && <DetailRow label={t.date} value={dateText} />}
              {timeText && <DetailRow label={t.time} value={timeText} />}
              {s.venue_name && (
                <DetailRow
                  label={t.venue}
                  value={
                    <>
                      <span className="font-semibold">{s.venue_name}</span>
                      {s.venue_address && <span className="block">{s.venue_address}</span>}
                      {s.venue_map_url && (
                        <a
                          href={s.venue_map_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-kilim underline underline-offset-4"
                        >
                          <PinIcon /> {t.openInMaps}
                        </a>
                      )}
                    </>
                  }
                />
              )}
              {s.dress_code && <DetailRow label={t.dressCode} value={s.dress_code} />}
              {s.additional_info && <DetailRow label={t.goodToKnow} value={<span className="whitespace-pre-line">{s.additional_info}</span>} />}
            </dl>
          </div>
        </section>

      </main>

      <SiteFooter s={s} t={t} />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="text-base font-medium text-muted">{label}</dt>
      <dd className="text-xl text-ink">{value}</dd>
    </div>
  );
}

/** Quiet age notice: same muted tone as the address, small outlined "18+" mark. */
function AgeNotice({ text, age, className = "" }: { text: string; age: number; className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-base text-linen/70 ${className}`}>
      <span aria-hidden="true" className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-linen/40 px-1.5 text-[0.7rem] font-semibold leading-none tracking-tight">
        {age}+
      </span>
      {text}
    </p>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-1 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}
