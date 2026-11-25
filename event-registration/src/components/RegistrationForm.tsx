"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { dictionaries, type Locale } from "@/lib/i18n";

export type FormMode = "open" | "waitlist" | "full" | "closed";

export interface EventSummary {
  name: string;
  dateText: string;
  timeText: string;
  venueName: string;
  venueAddress: string;
}

interface Confirmation {
  reference: string;
  guestCount: number;
  status: "confirmed" | "waitlisted";
  firstName: string;
  eventName: string;
}

const STORAGE_KEY = "reservation:v1";
type FieldName = "fullName" | "phone" | "email" | "guestCount" | "privacyAccepted";

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
}) {
  const t = dictionaries[props.locale];
  const id = useId();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState(1);
  const [privacy, setPrivacy] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [waitlistOffer, setWaitlistOffer] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const keyRef = useRef<string>("");
  const tokenRef = useRef(props.formToken);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    keyRef.current = newKey();
    const stored = readStored(props.event.name);
    if (stored) setConfirmation(stored);
  }, [props.event.name]);

  // Remove a field's error as soon as the visitor corrects it, so stale red text never lingers.
  const clearError = (f: FieldName) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));

  const max = Math.max(1, props.maxGuests);
  const isWaitlist = props.mode === "waitlist" || waitlistOffer;

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
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t.errors.email_invalid;
    if (!privacy) e.privacyAccepted = t.errors.privacy_required;
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
          email,
          guestCount: guests,
          privacyAccepted: privacy,
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
        if (!mapped.fullName && !mapped.phone && !mapped.email && !mapped.guestCount && !mapped.privacyAccepted) break;
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
    setEmail("");
    setGuests(1);
    setPrivacy(false);
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
        <div className="flex items-center gap-4">
          <StepButton label={t.fewer} disabled={guests <= 1} onClick={() => {
              setGuests((g) => Math.max(1, g - 1));
              clearError("guestCount");
            }}>
            <path d="M5 12h14" />
          </StepButton>
          <output
            aria-live="polite"
            aria-describedby={describedBy("guestCount", true)}
            className="min-w-[6.5rem] text-center"
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

      <div>
        <label htmlFor={`${id}-email`} className="block text-lg font-semibold">
          {t.email} <span className="font-normal text-muted">({t.optional})</span>
        </label>
        <p id={`${id}-email-hint`} className="mb-2 text-base text-muted">
          {t.emailHint}
        </p>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="done"
          maxLength={254}
          className="field-input"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError("email");
          }}
          aria-invalid={err("email") ? true : undefined}
          aria-describedby={describedBy("email", true)}
        />
        {err("email") && <FieldError id={`${id}-email-err`} text={err("email")!} />}
      </div>

      {/* Honeypot: invisible to people, tempting to bots. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
        </label>
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-4 rounded-xl p-1">
          <input
            type="checkbox"
            checked={privacy}
            onChange={(e) => {
              setPrivacy(e.target.checked);
              clearError("privacyAccepted");
            }}
            className="mt-0.5 size-7 shrink-0 cursor-pointer accent-ink"
            aria-invalid={err("privacyAccepted") ? true : undefined}
            aria-describedby={err("privacyAccepted") ? `${id}-privacyAccepted-err` : undefined}
          />
          <span className="text-base leading-relaxed text-thread">
            {t.privacyLabelBefore}
            <Link href="/privacy" target="_blank" className="font-semibold text-ink underline underline-offset-4">
              {t.privacyLink}
            </Link>
            {t.privacyLabelAfter}
          </span>
        </label>
        {err("privacyAccepted") && <FieldError id={`${id}-privacyAccepted-err`} text={err("privacyAccepted")!} />}
      </div>

      <button type="submit" className="btn-primary w-full text-xl" disabled={submitting} aria-busy={submitting}>
        {submitting ? (
          <>
            <Spinner /> {t.submitting}
          </>
        ) : isWaitlist ? (
          t.submitWaitlist
        ) : (
          t.submitPlaces(guests)
        )}
      </button>
    </form>
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
      className="grid size-16 place-items-center rounded-full border-2 border-ink text-ink transition-colors hover:bg-ink hover:text-linen active:scale-95 disabled:cursor-not-allowed disabled:border-ink/20 disabled:text-ink/25 disabled:hover:bg-transparent"
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
