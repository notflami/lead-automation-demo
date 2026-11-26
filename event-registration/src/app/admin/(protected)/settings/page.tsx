import { AnonymizeForm } from "@/components/admin/AnonymizeForm";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { requireAdmin } from "@/lib/auth";
import { getStats } from "@/lib/registrations";
import { getSettings } from "@/lib/settings";
import { stripeMode } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const [s, stats] = await Promise.all([getSettings(), getStats()]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updated_at, ...values } = s;
  return (
    <div className="space-y-6">
      <h1 className="display text-3xl text-ink">Event settings</h1>
      <SettingsForm initial={values} reservedPlaces={stats.reservedPlaces} stripeMode={stripeMode()} />
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
