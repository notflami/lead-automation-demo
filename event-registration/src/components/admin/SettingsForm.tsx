"use client";

import { startTransition, useActionState } from "react";
import { saveSettingsAction } from "@/app/admin/actions";
import type { EventSettings } from "@/lib/types";
import { TranslationsEditor } from "./TranslationsEditor";

type Values = Omit<EventSettings, "updated_at">;
const input = "field-input min-h-11 text-base";

function Field(props: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={props.wide ? "sm:col-span-2" : ""}>
      <span className="block text-sm font-medium text-ink">{props.label}</span>
      {props.hint && <span className="block text-sm text-muted">{props.hint}</span>}
      <span className="mt-1 block">{props.children}</span>
    </label>
  );
}

function Group(props: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl bg-white p-5">
      <legend className="sr-only">{props.title}</legend>
      <h2 className="font-semibold text-ink" aria-hidden="true">{props.title}</h2>
      {props.description && <p className="mt-1 text-sm text-muted">{props.description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{props.children}</div>
    </fieldset>
  );
}

function Toggle(props: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink/12 p-3 sm:col-span-1">
      <input type="checkbox" name={props.name} defaultChecked={props.defaultChecked} className="mt-0.5 size-5 accent-ink" />
      <span>
        <span className="block font-medium">{props.label}</span>
        <span className="block text-sm text-muted">{props.hint}</span>
      </span>
    </label>
  );
}

export function SettingsForm({
  initial: v,
  reservedPlaces,
  stripeMode,
  doorPasswordSet,
}: {
  initial: Values;
  reservedPlaces: number;
  stripeMode: "test" | "live" | null;
  doorPasswordSet: boolean;
}) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  return (
    <form
      onSubmit={(e) => {
        // Submit via transition: avoids React resetting the fields when validation fails.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-5">
      <Group title="Registration" description="Capacity is counted in people, not in registration forms.">
        <Toggle name="registration_open" label="Registration open" hint="Turn off to stop all new reservations." defaultChecked={v.registration_open} />
        <Toggle
          name="waitlist_enabled"
          label="Waiting list when full"
          hint="When all places are taken, guests can join a waiting list instead."
          defaultChecked={v.waitlist_enabled}
        />
        <Field label="Online sales start" hint="German time. Before this, the page shows a countdown instead of the form. Empty = open now.">
          <input name="sales_start_local" type="datetime-local" defaultValue={v.sales_start_local} className={input} />
        </Field>
        <Field label="Online sales end" hint="German time. From then on: “Online-Verkauf beendet” and the Abendkasse text. Empty = no end.">
          <input name="sales_end_local" type="datetime-local" defaultValue={v.sales_end_local} className={input} />
        </Field>
        <Field label="Maximum capacity (people)" hint={`${reservedPlaces} places are reserved right now.`}>
          <input name="max_capacity" type="number" min={1} max={100000} defaultValue={v.max_capacity} required className={input} />
        </Field>
        <Field label="VIP places (people)" hint="Part of the maximum capacity. 0 hides the VIP option.">
          <input name="vip_capacity" type="number" min={0} max={100000} defaultValue={v.vip_capacity} required className={input} />
        </Field>
        <Field label="Normal ticket price (€)" hint="Per person. 0 hides the price.">
          <input name="price_normal_eur" type="number" min={0} step="0.01" defaultValue={(v.price_normal_cents / 100).toString()} required className={input} />
        </Field>
        <Field label="VIP place price (€)" hint="Per person. 0 hides the price.">
          <input name="price_vip_eur" type="number" min={0} step="0.01" defaultValue={(v.price_vip_cents / 100).toString()} required className={input} />
        </Field>
        <Field label="Normal ticket: short info" hint="Optional, shown under the option (e.g. price or what is included).">
          <input name="ticket_normal_info" defaultValue={v.ticket_normal_info} maxLength={200} className={input} />
        </Field>
        <Field label="VIP place: short info" hint="Optional, shown under the option.">
          <input name="ticket_vip_info" defaultValue={v.ticket_vip_info} maxLength={200} className={input} />
        </Field>
        <Field label="Minimum age" hint="Shown as a small notice at the top of the page (e.g. 18). 0 hides it.">
          <input name="min_age" type="number" min={0} max={99} defaultValue={v.min_age} required className={input} />
        </Field>
        <Field label="Maximum people per registration" hint="Larger groups must contact you.">
          <input name="max_guests_per_registration" type="number" min={1} max={50} defaultValue={v.max_guests_per_registration} required className={input} />
        </Field>
        <Field label="Show “only X places left” below" hint="0 never shows it.">
          <input name="low_capacity_threshold" type="number" min={0} defaultValue={v.low_capacity_threshold} required className={input} />
        </Field>
        <Field
          label="Tickets at the door (Abendkasse)"
          hint="Shown when online reservations are sold out or closed, e.g. opening time, price, cash only. Empty hides it."
          wide>
          <textarea name="door_sales_info" defaultValue={v.door_sales_info} maxLength={1000} rows={3} className={input} />
        </Field>
      </Group>

      <Group
        title="Door check-in"
        description="Security opens /door on their phone, signs in with this password and scans the guests' QR codes. They see only name, places and ticket type.">
        <Field
          label={doorPasswordSet ? "New door password" : "Door password"}
          hint={
            doorPasswordSet
              ? "A password is set. Leave empty to keep it. Setting a new one signs out all door phones."
              : "Not set yet: only you (signed in here) can use /door. At least 8 characters."
          }>
          <input name="door_password" type="text" autoComplete="off" minLength={8} maxLength={100} className={input} />
        </Field>
        <div className="text-sm text-thread sm:self-end">
          Door page: <a href="/door" target="_blank" className="font-semibold underline underline-offset-4">/door</a>
        </div>
      </Group>

      <Group title="Online payment" description="Guests pay on Stripe's secure page; a reservation is confirmed only when the payment arrives.">
        <Toggle
          name="payments_enabled"
          label="Take payment online (Stripe)"
          hint={
            stripeMode
              ? `Stripe is connected (${stripeMode === "test" ? "TEST mode: no real money" : "LIVE mode: real payments"}).`
              : "Stripe is not connected yet: add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel. Until then reservations stay free."
          }
          defaultChecked={v.payments_enabled}
        />
        <Field label="Terms and conditions (AGB)" hint="Shown on the page /terms and linked next to the payment button. Have them checked by an adviser." wide>
          <textarea name="terms_text" defaultValue={v.terms_text} rows={6} maxLength={20000} className={`${input} min-h-36`} />
        </Field>
      </Group>

      <Group title="Event">
        <Field label="Event name" wide>
          <input name="event_name" defaultValue={v.event_name} required maxLength={120} className={input} />
        </Field>
        <Field label="Short line under the name" wide>
          <input name="tagline" defaultValue={v.tagline} maxLength={200} className={input} />
        </Field>
        <Field label="Date">
          <input name="event_date" type="date" defaultValue={v.event_date ?? ""} className={input} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time">
            <input name="start_time" type="time" defaultValue={v.start_time ?? ""} className={input} />
          </Field>
          <Field label="End time" hint="optional">
            <input name="end_time" type="time" defaultValue={v.end_time ?? ""} className={input} />
          </Field>
        </div>
        <Field label="Venue name">
          <input name="venue_name" defaultValue={v.venue_name} maxLength={160} className={input} />
        </Field>
        <Field label="Venue address">
          <input name="venue_address" defaultValue={v.venue_address} maxLength={300} className={input} />
        </Field>
        <Field label="Map link" hint="Optional. A Google Maps or Apple Maps link (https://…)" wide>
          <input name="venue_map_url" type="url" defaultValue={v.venue_map_url} className={input} />
        </Field>
      </Group>

      <Group title="Page texts">
        <Field label="About the evening" hint="Leave an empty line between paragraphs." wide>
          <textarea name="about_text" defaultValue={v.about_text} rows={6} maxLength={3000} className={`${input} min-h-36`} />
        </Field>
        <Field label="What to expect" hint="One item per line." wide>
          <textarea name="expectations" defaultValue={v.expectations} rows={5} maxLength={2000} className={`${input} min-h-28`} />
        </Field>
        <Field label="Dress code" hint="Optional.">
          <input name="dress_code" defaultValue={v.dress_code} maxLength={300} className={input} />
        </Field>
        <Field label="Good to know" hint="Optional. Parking, entry, children, food…">
          <textarea name="additional_info" defaultValue={v.additional_info} rows={3} maxLength={2000} className={`${input} min-h-20`} />
        </Field>
      </Group>

      <Group title="Organizer and legal" description="Shown in the footer, the privacy notice and the Impressum (required in Germany).">
        <Field label="Organizer name">
          <input name="organizer_name" defaultValue={v.organizer_name} maxLength={200} className={input} />
        </Field>
        <Field label="Organizer postal address" hint="Required for the Impressum. No P.O. box. For a registered association (e.V.) add: represented by (board members), register court and number.">
          <textarea name="organizer_address" defaultValue={v.organizer_address} rows={4} maxLength={500} className={`${input} min-h-16`} />
        </Field>
        <Field label="Contact email">
          <input name="contact_email" type="email" defaultValue={v.contact_email} className={input} />
        </Field>
        <Field label="Contact phone">
          <input name="contact_phone" defaultValue={v.contact_phone} maxLength={40} className={input} />
        </Field>
        <Field label="WhatsApp number" hint="Optional. Guests can tap a button to message this number. Empty hides the button.">
          <input name="whatsapp_number" type="tel" defaultValue={v.whatsapp_number} maxLength={40} className={input} placeholder="+49 176 1234567" />
        </Field>
        <Field label="Keep personal data for (days after the event)" hint="Then names and phone numbers are erased automatically.">
          <input name="data_retention_days" type="number" min={0} max={3650} defaultValue={v.data_retention_days} required className={input} />
        </Field>
        <Field label="Additional privacy information" hint="E.g. names of your hosting and database providers." wide>
          <textarea name="privacy_notes" defaultValue={v.privacy_notes} rows={3} maxLength={4000} className={`${input} min-h-20`} />
        </Field>
      </Group>

      <TranslationsEditor v={v} />

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t border-ink/10 bg-[#f3f2ee]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
        <button disabled={pending} className="min-h-11 rounded-lg bg-saffron px-6 font-semibold text-ink-deep hover:bg-saffron-light disabled:opacity-60">
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state?.error && <p role="alert" className="text-sm font-medium text-kilim-dark">{state.error}</p>}
        {state?.message && <p role="status" className="text-sm text-moss">{state.message}</p>}
      </div>
    </form>
  );
}
