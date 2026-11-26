"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";

export type FormMode = "open" | "waitlist" | "full" | "closed";

export interface EventSummary {
  name: string;
  dateText: string;
  /** German date for the pre-filled WhatsApp message. */
  dateTextDe: string;
  timeText: string;
  venueName: string;
  venueAddress: string;
}

interface Confirmation {
  reference: string;
  guestCount: number;
  ticketType?: "normal" | "vip";
  status: "confirmed" | "waitlisted";
  firstName: string;
  eventName: string;
  paidCents?: number;
}

const STORAGE_KEY = "reservation:v1";
/** Form key of a reservation waiting for payment on Stripe (to release it if the guest comes back without paying). */
const PENDING_KEY = "reservation:pending";
type FieldName = "fullName" | "phone" | "guestCount" | "ticketType";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16),
      );
}

function readStored(eventName: string): Confirmation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Confirmation;
    return c.eventName === eventName && typeof c.reference === "string" ? c : null;
  } catch {
    return null;
  }
}

export function RegistrationForm(props: {
  locale: Locale;
  mode: FormMode;
  maxGuests: number;
  formToken: string;
  event: EventSummary;
  siteUrl: string;
  /** Event WhatsApp number (E.164) or "" when not set. */
  whatsappNumber: string;
  tickets: { vipEnabled: boolean; vipAvailable: number; normalInfo: string; vipInfo: string; priceNormal: number; priceVip: number };
  /** Online payment active (Stripe configured and switched on in Event settings). */
  payment: { enabled: boolean; termsUrl: string | null };
}) {
  const t = dictionaries[props.locale];
  const id = useId();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(1);
  const [ticket, setTicket] = useState<"normal" | "vip">("normal");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [waitlistOffer, setWaitlistOffer] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const keyRef = useRef<string>("");
  const tokenRef = useRef(props.formToken);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    keyRef.current = newKey();
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sessionId = params.get("session_id");
    if (checkout) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    const forgetPending = () => {
      try {
        localStorage.removeItem(PENDING_KEY);
      } catch {}
    };

    if (checkout === "success" && sessionId) {
      // Back from Stripe: ask the server (which asks Stripe) whether the payment went through.
      fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.state === "paid") {
            const c: Confirmation = { ...d.registration, status: "confirmed", eventName: props.event.name };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
            } catch {}
            forgetPending();
            setConfirmation(c);
          } else if (d.ok && d.state === "processing") {
            setInfo(dictionaries[props.locale].paymentProcessing);
          } else {
            setFormError(dictionaries[props.locale].paymentCancelled);
          }
        })
        .catch(() => setFormError(dictionaries[props.locale].errors.network));
      return;
    }
    if (checkout === "cancelled") {
      // Back from Stripe without paying: release the held places right away.
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
        if (pending?.key)
          fetch("/api/checkout/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idempotencyKey: pending.key }),
          }).catch(() => {});
      } catch {}
      forgetPending();
      setFormError(dictionaries[props.locale].paymentCancelled);
      return;
    }
    const stored = readStored(props.event.name);
    if (stored) setConfirmation(stored);
  }, [props.event.name, props.locale]);

  // Remove a field's error as soon as the visitor corrects it, so stale red text never lingers.
  const clearError = (f: FieldName) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));

  const max = Math.max(1, props.maxGuests);
  const priceOf = (type: "normal" | "vip") => (type === "vip" ? props.tickets.priceVip : props.tickets.priceNormal);
  const price = (cents: number) => formatPrice(cents, props.locale);
  const isWaitlist = props.mode === "waitlist" || waitlistOffer;
  const payNow = props.payment.enabled && priceOf(ticket) > 0 && !isWaitlist;

  function fieldMessage(code: string): string {
    const e = t.errors as Record<string, unknown>;
    if (code === "guests_too_many") return t.errors.guests_too_many(max);
    const v = e[code];
    return typeof v === "string" ? v : t.errors.server;
  }

  function clientValidate(): Partial<Record<FieldName, string>> {
    const e: Partial<Record<FieldName, string>> = {};
    if (!fullName.trim()) e.fullName = t.errors.name_required;
    if (phone.replace(/\D/g, "").length < 6) e.phone = t.errors.phone_invalid;
    return e;
  }

  async function send(acceptWaitlist: boolean, attempt = 0): Promise<void> {
    let res: Response;
    try {
      res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          guestCount: guests,
          ticketType: ticket,
          idempotencyKey: keyRef.current,
          locale: props.locale,
          acceptWaitlist,
          formToken: tokenRef.current,
          website,
        }),
      });
    } catch {
      setFormError(t.errors.network);
      return;
    }
    const data = await res.json().catch(() => ({}) as Record<string, never>);

    if (res.ok && data.ok && data.payment?.url) {
      // Paid ticket: places are held; continue on Stripe's secure payment page.
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify({ key: keyRef.current }));
      } catch {}
      setRedirecting(true);
      window.location.assign(data.payment.url);
      return;
    }

    if (res.ok && data.ok) {
      const c: Confirmation = { ...data.registration, eventName: props.event.name };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
      } catch {
        /* private mode — confirmation still shown */
      }
      setConfirmation(c);
      setWaitlistOffer(false);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        resultRef.current?.focus({ preventScroll: true });
      });
      return;
    }

    // Transparent retries the visitor never sees.
    if ((data.error === "too_fast" || data.error === "form_expired") && attempt < 2) {
      if (data.formToken) tokenRef.current = data.formToken;
      await new Promise((r) => setTimeout(r, Math.min(Number(data.retryAfterMs) || 0, 4000)));
      return send(acceptWaitlist, attempt + 1);
    }

    switch (data.error) {
      case "validation": {
        const mapped: Partial<Record<FieldName, string>> = {};
        for (const [k, code] of Object.entries((data.fields || {}) as Record<string, string>)) {
          if (k === "form") setFormError(fieldMessage(code));
          else mapped[k as FieldName] = fieldMessage(code);
        }
        setErrors(mapped);
        if (!mapped.fullName && !mapped.phone && !mapped.guestCount) break;
        setFormError(t.errorSummary);
        break;
      }
      case "phone_taken":
        setErrors({ phone: t.errors.phone_taken });
        setFormError(t.errors.phone_taken);
        break;
      case "not_enough":
        setErrors({ guestCount: data.waitlistAvailable ? t.errors.not_enough_waitlist(data.remaining) : t.errors.not_enough(data.remaining) });
        setFormError(data.waitlistAvailable ? t.errors.not_enough_waitlist(data.remaining) : t.errors.not_enough(data.remaining));
        if (data.waitlistAvailable) setWaitlistOffer(true);
        break;
      case "full":
        setFormError(data.waitlistAvailable ? t.errors.full_waitlist : t.errors.full);
        if (data.waitlistAvailable) setWaitlistOffer(true);
        break;
      case "closed":
        setFormError(t.errors.closed);
        break;
      case "payment_unavailable":
        setFormError(t.errors.payment_unavailable);
        break;
      case "vip_full":
        setErrors({ ticketType: t.errors.vip_full });
        setFormError(t.errors.vip_full);
        break;
      case "vip_not_enough":
        setErrors({ ticketType: t.errors.vip_not_enough(data.remaining) });
        setFormError(t.errors.vip_not_enough(data.remaining));
        break;
      case "rate_limited":
        setFormError(t.errors.rate_limited);
        break;
      default:
        setFormError(t.errors.server);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // guards double taps
    setFormError(null);
    const v = clientValidate();
    setErrors(v);
    if (Object.keys(v).length) {
      setFormError(t.errorSummary);
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>("[aria-invalid='true']");
        first?.focus();
      });
      return;
    }
    setSubmitting(true);
    try {
      await send(isWaitlist);
    } finally {
      setSubmitting(false);
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    keyRef.current = newKey();
    setConfirmation(null);
    setFullName("");
    setPhone("");
    setGuests(1);
    setTicket("normal");
    setInfo(null);
    setErrors({});
    setFormError(null);
  }

  // ---------------------------------------------------------------- confirmation
  if (confirmation) {
    const waitlisted = confirmation.status === "waitlisted";
    const share = `https://wa.me/?text=${encodeURIComponent(`${props.event.name} — ${props.event.dateText}\n${props.siteUrl}`)}`;
    return (
      <div className="confirm-in" aria-live="polite">
        <h3
          ref={resultRef}
          tabIndex={-1}
          className="display scroll-mt-24 text-[2.25rem] text-ink outline-none sm:text-5xl"
        >
          {waitlisted ? t.waitlistedHeading : t.confirmedHeading}
        </h3>
        <p className="mt-3 text-lg text-thread">
          {waitlisted ? t.waitlistedText(confirmation.firstName) : t.confirmedText(confirmation.firstName)}
        </p>

        <div className="mt-7 rounded-2xl border-2 border-dashed border-ink/25 bg-linen px-5 py-6 sm:px-7">
          <p className="text-base text-muted">{t.yourNumber}</p>
          <p className="mt-1 whitespace-nowrap font-sans text-[clamp(1.9rem,9vw,3rem)] font-bold tracking-wide text-kilim tabular-nums">
            {confirmation.reference}
          </p>
          <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-ink/15 pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-base text-muted">{waitlisted ? t.waitlistPlaces : t.reservedPlaces}</dt>
              <dd className="text-xl font-semibold">
                {confirmation.guestCount} {t.person(confirmation.guestCount)}
              </dd>
            </div>
            {confirmation.ticketType === "vip" && (
              <div>
                <dt className="text-base text-muted">{t.ticketLabel}</dt>
                <dd className="flex items-center gap-2 text-xl font-semibold">
                  <svg viewBox="0 0 24 24" className="size-5 text-saffron" fill="currentColor" aria-hidden="true">
                    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
                  </svg>
                  {t.ticketVip}
                </dd>
              </div>
            )}
            {(confirmation.paidCents ?? 0) > 0 ? (
              <div>
                <dt className="text-base text-muted">{t.paid}</dt>
                <dd className="flex items-center gap-2 text-xl font-semibold tabular-nums text-moss">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M5 12.5l4 4 10-10" />
                  </svg>
                  {price(confirmation.paidCents ?? 0)}
                </dd>
              </div>
            ) : !waitlisted && priceOf(confirmation.ticketType ?? "normal") > 0 && (
              <div>
                <dt className="text-base text-muted">{t.total}</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {price(priceOf(confirmation.ticketType ?? "normal") * confirmation.guestCount)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-base text-muted">{t.date}</dt>
              <dd className="text-xl font-semibold">
                {props.event.dateText}
                {props.event.timeText && <span className="block text-lg font-normal">{props.event.timeText}</span>}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-base text-muted">{t.venue}</dt>
              <dd className="text-lg">
                <span className="font-semibold">{props.event.venueName}</span>
                {props.event.venueAddress && <span className="block">{props.event.venueAddress}</span>}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-base text-thread">{t.saveHint}</p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {!waitlisted && (
            <a href={`/api/calendar?lang=${props.locale}`} className="btn-primary">
              {t.addToCalendar}
            </a>
          )}
          <a
            href={share}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-ink px-6 font-semibold hover:bg-ink hover:text-linen"
          >
            {t.shareWhatsApp}
          </a>
        </div>
        <div className="mt-4">
          <WhatsAppLink
            number={props.whatsappNumber}
            label={t.whatsappReservation}
            message={`Hallo! Meine Reservierungsnummer ist ${confirmation.reference}. Ich habe eine Frage zur Veranstaltung „${props.event.name}“.`}
          />
        </div>
        <button type="button" onClick={reset} className="mt-4 inline-flex min-h-11 items-center text-base font-medium text-muted underline underline-offset-4 hover:text-ink">
          {t.newReservation}
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------- closed / full
  if (props.mode === "closed" || props.mode === "full") {
    return (
      <div>
        <h3 className="display text-4xl text-ink">{props.mode === "closed" ? t.closedHeading : t.fullHeading}</h3>
        <p className="mt-3 text-lg text-thread">{props.mode === "closed" ? t.closedText : t.fullText}</p>
      </div>
    );
  }

  // ---------------------------------------------------------------- form
  const err = (f: FieldName) => errors[f];
  const describedBy = (f: FieldName, hint?: boolean) =>
    [hint ? `${id}-${f}-hint` : "", err(f) ? `${id}-${f}-err` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border-l-4 border-kilim bg-kilim/8 px-4 py-3 text-base font-medium text-kilim-dark outline-none"
        >
          {formError}
        </div>
      )}

      {info && (
        <div role="status" className="rounded-xl border-l-4 border-saffron bg-saffron/10 px-4 py-3 text-base font-medium text-ink">
          {info}
        </div>
      )}

      <div>
        <label htmlFor={`${id}-name`} className="block text-lg font-semibold">
          {t.fullName}
        </label>
        <p id={`${id}-fullName-hint`} className="mb-2 text-base text-muted">
          {t.fullNameHint}
        </p>
        <input
          id={`${id}-name`}
          name="name"
          className="field-input"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={120}
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            clearError("fullName");
          }}
          aria-invalid={err("fullName") ? true : undefined}
          aria-describedby={describedBy("fullName", true)}
          required
        />
        {err("fullName") && <FieldError id={`${id}-fullName-err`} text={err("fullName")!} />}
      </div>

      <div>
        <label htmlFor={`${id}-phone`} className="block text-lg font-semibold">
          {t.phone}
        </label>
        <p id={`${id}-phone-hint`} className="mb-2 text-base text-muted">
          {t.phoneHint}
        </p>
        <input
          id={`${id}-phone`}
          name="tel"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="next"
          maxLength={40}
          className="field-input"
          placeholder="0176 1234567"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            clearError("phone");
          }}
          aria-invalid={err("phone") ? true : undefined}
          aria-describedby={describedBy("phone", true)}
          required
        />
        {err("phone") && <FieldError id={`${id}-phone-err`} text={err("phone")!} />}
      </div>

      <fieldset>
        <legend className="block text-lg font-semibold">{t.guests}</legend>
        <p id={`${id}-guestCount-hint`} className="mb-3 text-base text-muted">
          {t.guestsHint}
        </p>
        <div className="flex items-center gap-2 min-[380px]:gap-4">
          <StepButton label={t.fewer} disabled={guests <= 1} onClick={() => {
              setGuests((g) => Math.max(1, g - 1));
              clearError("guestCount");
            }}>
            <path d="M5 12h14" />
          </StepButton>
          <output
            aria-live="polite"
            aria-describedby={describedBy("guestCount", true)}
            className="min-w-[5rem] text-center min-[380px]:min-w-[6.5rem]"
          >
            <span className="display block text-5xl leading-none tabular-nums text-ink">{guests}</span>
            <span className="text-base text-muted">{t.person(guests)}</span>
          </output>
          <StepButton label={t.more} disabled={guests >= max} onClick={() => setGuests((g) => Math.min(max, g + 1))}>
            <path d="M12 5v14M5 12h14" />
          </StepButton>
        </div>
        {err("guestCount") ? (
          <FieldError id={`${id}-guestCount-err`} text={err("guestCount")!} />
        ) : (
          guests >= max &&
          max > 1 && <p className="mt-2 text-base text-muted">{t.errors.guests_too_many(max)}</p>
        )}
      </fieldset>

      {props.tickets.vipEnabled && (
        <fieldset>
          <legend className="mb-3 block text-lg font-semibold">{t.ticketHeading}</legend>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
            {(["normal", "vip"] as const).map((type) => {
              const soldOut = type === "vip" && props.tickets.vipAvailable <= 0;
              const info = type === "vip" ? props.tickets.vipInfo : props.tickets.normalInfo;
              const checked = ticket === type;
              return (
                <label
                  key={type}
                  className={`relative flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-colors ${
                    soldOut
                      ? "cursor-not-allowed border-ink/10 bg-linen/60 text-muted"
                      : checked
                        ? "border-ink bg-linen shadow-[inset_0_0_0_1px_var(--color-ink)]"
                        : "border-[#c9c5ba] hover:border-ink/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="ticketType"
                    value={type}
                    checked={checked}
                    disabled={soldOut}
                    onChange={() => {
                      setTicket(type);
                      clearError("ticketType");
                    }}
                    className="mt-1 size-5 shrink-0 accent-ink"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-lg font-semibold">
                      {type === "vip" && (
                        <svg viewBox="0 0 24 24" className="size-5 text-saffron" fill="currentColor" aria-hidden="true">
                          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
                        </svg>
                      )}
                      {type === "vip" ? t.ticketVip : t.ticketNormal}
                    </span>
                    {priceOf(type) > 0 && (
                      <span className="block text-base">
                        <span className="font-semibold text-ink">{price(priceOf(type))}</span>{" "}
                        <span className="text-muted">{t.perPerson}</span>
                      </span>
                    )}
                    {soldOut ? (
                      <span className="block text-base">{t.vipSoldOut}</span>
                    ) : (
                      info && <span className="block text-base text-muted">{info}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {err("ticketType") && <FieldError id={`${id}-ticketType-err`} text={err("ticketType")!} />}
        </fieldset>
      )}

      {/* Honeypot: invisible to people, tempting to bots. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
        </label>
      </div>

      {!props.tickets.vipEnabled && props.tickets.priceNormal > 0 && (
        <p className="text-lg">
          <span className="font-semibold">{t.ticketHeading}:</span> {price(props.tickets.priceNormal)}{" "}
          <span className="text-muted">{t.perPerson}</span>
        </p>
      )}

      <p className="text-base leading-relaxed text-muted">
        {t.privacyBefore}
        <Link href="/privacy" target="_blank" className="font-semibold text-ink underline underline-offset-4">
          {t.privacyLink}
        </Link>
      </p>

      <button type="submit" className="btn-primary w-full text-xl" disabled={submitting || redirecting} aria-busy={submitting || redirecting}>
        {redirecting ? (
          <>
            <Spinner /> {t.redirecting}
          </>
        ) : submitting ? (
          <>
            <Spinner /> {t.submitting}
          </>
        ) : isWaitlist ? (
          t.submitWaitlist
        ) : payNow ? (
          <span className="text-center">{t.buyNow(price(priceOf(ticket) * guests))}</span>
        ) : (
          <span className="text-center">
            {ticket === "vip" ? t.submitVipPlaces(guests) : t.submitPlaces(guests)}
            {!isWaitlist && priceOf(ticket) > 0 && (
              <span className="font-medium whitespace-nowrap"> ({price(priceOf(ticket) * guests)})</span>
            )}
          </span>
        )}
      </button>
      {payNow && (
        <p className="-mt-2 flex gap-2 text-sm leading-relaxed text-muted">
          <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span>
            {t.paymentNotice}
            {props.payment.termsUrl && (
              <>
                {" "}
                <Link href={props.payment.termsUrl} target="_blank" className="font-semibold text-ink underline underline-offset-4">
                  {t.termsLink}
                </Link>
              </>
            )}
          </span>
        </p>
      )}
      <WhatsAppLink number={props.whatsappNumber} label={t.whatsappQuestion} message={`Hallo! Ich habe eine Frage zur Veranstaltung „${props.event.name}“${props.event.dateTextDe ? ` am ${props.event.dateTextDe}` : ""}.`} />
    </form>
  );
}

/** Free WhatsApp click-to-chat link (wa.me) with a pre-filled German message. Hidden when no number is set. */
function WhatsAppLink({ number, label, message }: { number: string; label: string; message: string }) {
  if (!number) return null;
  return (
    <a
      href={`https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center justify-center gap-2 text-base font-semibold text-moss underline-offset-4 hover:underline"
    >
      <WhatsAppIcon />
      {label}
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-.9-1-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.6.6-.9 1.3-.9 2.1.1.9.4 1.8 1 2.6 1 1.5 2.3 2.7 3.9 3.5 1.4.6 2 .7 2.7.6.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1l-.6-.3z" />
    </svg>
  );
}

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="mt-2 flex gap-2 text-base font-medium text-kilim-dark">
      <svg viewBox="0 0 20 20" className="mt-1 size-4 shrink-0" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="currentColor" />
        <path d="M10 5.5v5.5M10 13.8v.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {text}
    </p>
  );
}

function StepButton(props: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-ink text-ink transition-colors hover:bg-ink hover:text-linen active:scale-95 disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-ink/25 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        {props.children}
      </svg>
    </button>
  );
}

function Spinner() {
  return (
    <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
