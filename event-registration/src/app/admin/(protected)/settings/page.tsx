import { AnonymizeForm } from "@/components/admin/AnonymizeForm";
import { RefundAllForm } from "@/components/admin/RefundAllForm";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { requireAdmin } from "@/lib/auth";
import { getStats } from "@/lib/registrations";
import { getSettings } from "@/lib/settings";
import { stripeMode } from "@/lib/stripe";

export const dynamic = "force-dynamic";
// Refunding everyone can take a while (one Stripe call per reservation).
export const maxDuration = 300;

const euro = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

export default async function SettingsPage() {
  await requireAdmin();
  const [s, stats] = await Promise.all([getSettings(), getStats()]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updated_at, ...values } = s;
  return (
    <div className="space-y-6">
      <h1 className="display text-3xl text-ink">Event settings</h1>
      <SettingsForm initial={values} reservedPlaces={stats.reservedPlaces} stripeMode={stripeMode()} />
      {(s.payments_enabled || stats.paidRegistrations > 0) && (
        <section className="rounded-xl border border-kilim/25 bg-white p-5">
          <h2 className="font-semibold text-ink">Cancel the event: refund everyone</h2>
          <p className="mt-1 max-w-2xl text-thread">
            If the event cannot take place, this closes registration and refunds every reservation paid online in full, back to the
            payment method each guest used (card refunds usually arrive within 5–10 business days). Stripe normally keeps its fees.
            Right now: <strong>{stats.paidRegistrations}</strong> paid {stats.paidRegistrations === 1 ? "reservation" : "reservations"},{" "}
            <strong>{euro(stats.paidCents)}</strong>.
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Keep Stripe payouts on &quot;Manual&quot; until your decision, so the money is still in Stripe. If something fails, run it again: already
            refunded reservations are skipped.
          </p>
          <RefundAllForm paidCount={stats.paidRegistrations} paidText={euro(stats.paidCents)} />
        </section>
      )}
      <section className="rounded-xl border border-kilim/25 bg-white p-5">
        <h2 className="font-semibold text-ink">Delete personal data</h2>
        <p className="mt-1 max-w-2xl text-thread">
          Personal data is removed automatically {s.data_retention_days} days after the event. To do it now, for example once the event is
          over, type DELETE below. Names, phone numbers and emails are erased permanently; guest totals stay.
        </p>
        <AnonymizeForm />
      </section>
    </div>
  );
}
