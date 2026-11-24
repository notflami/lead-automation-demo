import { Embroidery, StitchDiamond } from "@/components/Embroidery";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { RegistrationForm, type FormMode } from "@/components/RegistrationForm";
import { SiteFooter } from "@/components/SiteFooter";
import { StickyCta } from "@/components/StickyCta";
import { env } from "@/lib/env";
import { formatDayMonth, formatEventDate, formatTimeRange, splitLines } from "@/lib/format";
import { issueFormToken } from "@/lib/form-token";
import { getDict } from "@/lib/locale";
import { getRemainingPlaces } from "@/lib/registrations";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ locale, t }, s] = await Promise.all([getDict(), getSettings()]);
  const [remaining, formToken] = await Promise.all([getRemainingPlaces(s.max_capacity), issueFormToken()]);

  const mode: FormMode = !s.registration_open ? "closed" : remaining > 0 ? "open" : s.waitlist_enabled ? "waitlist" : "full";
  const dateText = formatEventDate(s.event_date, locale);
  const dm = formatDayMonth(s.event_date, locale);
  const timeText = formatTimeRange(s.start_time, s.end_time, locale);
  const expectations = splitLines(s.expectations);
  const aboutParagraphs = s.about_text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const showScarcity = mode === "open" && s.low_capacity_threshold > 0 && remaining <= s.low_capacity_threshold;
  const ctaLabel = mode === "waitlist" ? t.joinWaitlistCta : t.reserveCta;
  const canAct = mode === "open" || mode === "waitlist";
  const year = s.event_date?.slice(0, 4);

  return (
    <>
      <a href="#reserve" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-saffron focus:px-4 focus:py-2 focus:text-ink-deep">
        {t.skipToForm}
      </a>

      {/* ------------------------------------------------------------------ hero */}
      <header className="relative bg-ink text-linen">
        <div className="mx-auto max-w-6xl px-5 pt-5 pb-14 sm:px-8 md:pb-20">
          <div className="flex justify-end">
            <LanguageSwitch locale={locale} label={t.switchTo} className="text-linen/90" />
          </div>

          <div className="mt-8 grid gap-10 md:mt-14 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-8">
              {dm && (
                <p className="text-lg font-medium text-saffron md:hidden">
                  {dateText}
                  {s.start_time && <span className="text-linen/80">, {timeText}</span>}
                </p>
              )}
              <h1 className="display mt-3 text-[clamp(3.2rem,13vw,7.5rem)] text-balance text-linen md:mt-0">{s.event_name}</h1>
              {s.tagline && <p className="mt-5 max-w-xl text-xl leading-snug text-linen/85 sm:text-2xl">{s.tagline}</p>}
              {s.venue_name && (
                <p className="mt-5 flex items-start gap-2 text-lg text-linen/80 md:hidden">
                  <PinIcon />
                  <span>
                    {s.venue_name}
                    {s.venue_address && <span className="block text-linen/60">{s.venue_address}</span>}
                  </span>
                </p>
              )}
              <div id="hero-cta" className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
                {canAct ? (
                  <a href="#reserve" className="btn-primary w-full px-9 text-xl sm:w-auto">
                    {ctaLabel}
                  </a>
                ) : (
                  <p className="rounded-full border border-linen/30 px-6 py-3 text-lg">
                    {mode === "closed" ? t.closedHeading : t.fullBanner}
                  </p>
                )}
                {showScarcity && <p className="text-lg font-medium text-saffron-light">{t.placesLeft(remaining)}</p>}
              </div>
            </div>

            {/* Desktop date composition: the day numeral as the anchor. */}
            {dm && (
              <div className="hidden md:col-span-4 md:block md:border-l md:border-linen/15 md:pl-8">
                <p className="text-lg text-linen/70">{dm.weekday}</p>
                <p className="display text-[9.5rem] leading-[0.85] text-saffron tabular-nums">{dm.day}</p>
                <p className="display mt-2 text-4xl text-linen">
                  {dm.month} <span className="text-linen/50">{year}</span>
                </p>
                {timeText && <p className="mt-6 text-xl text-linen/90">{timeText}</p>}
                {s.venue_name && (
                  <p className="mt-4 flex items-start gap-2 text-lg text-linen/80">
                    <PinIcon />
                    <span>
                      {s.venue_name}
                      {s.venue_address && <span className="block text-linen/60">{s.venue_address}</span>}
                    </span>
                  </p>
                )}
              </div>
            )}
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

        {/* ------------------------------------------------------ registration */}
        <section id="reserve" aria-labelledby="reserve-h" className="scroll-mt-4 bg-ink text-linen">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-12 md:py-20">
            <div className="md:col-span-5">
              <h2 id="reserve-h" className="display text-4xl text-balance md:text-6xl">
                {mode === "waitlist" ? t.joinWaitlistCta : t.formHeading}
              </h2>
              {canAct && (
                <p className="mt-4 max-w-md text-xl text-linen/80">{mode === "waitlist" ? t.formIntroWaitlist : t.formIntro}</p>
              )}
              {showScarcity && <p className="mt-4 text-lg font-medium text-saffron-light">{t.placesLeft(remaining)}</p>}
            </div>
            <div className="rounded-3xl bg-white p-6 text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] sm:p-9 md:col-span-7">
              <RegistrationForm
                locale={locale}
                mode={mode}
                maxGuests={s.max_guests_per_registration}
                formToken={formToken}
                siteUrl={env.siteUrl()}
                event={{
                  name: s.event_name,
                  dateText,
                  timeText,
                  venueName: s.venue_name,
                  venueAddress: s.venue_address,
                }}
              />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter s={s} t={t} />
      {canAct && <StickyCta label={ctaLabel} />}
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

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-1 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}
