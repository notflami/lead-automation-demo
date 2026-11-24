import Link from "next/link";
import { retryWebhooksAction } from "@/app/admin/actions";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActivityChart } from "@/components/admin/ActivityChart";
import { CapacityMeter } from "@/components/admin/CapacityMeter";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { dailyActivity, getStats, recentRegistrations } from "@/lib/registrations";
import { getSettings } from "@/lib/settings";
import { webhookHealth } from "@/lib/webhook";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  await requireAdmin();
  const [stats, activity, recent, hooks, s] = await Promise.all([
    getStats(),
    dailyActivity(21),
    recentRegistrations(8),
    webhookHealth(),
    getSettings(),
  ]);

  const tiles = [
    { label: "Reserved places", value: stats.reservedPlaces, note: `of ${stats.maxCapacity}` },
    { label: "Places free", value: stats.remaining, note: stats.remaining === 0 ? "Fully booked" : "" },
    { label: "Registrations", value: stats.registrations, note: "forms, excluding cancelled and waiting list" },
    { label: "Guests per registration", value: stats.averageGuests.toLocaleString("en-GB"), note: "on average" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display mr-auto text-3xl text-ink">Overview</h1>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
            s.registration_open ? "bg-[#dcf1e8] text-[#155c41]" : "bg-[#ecebe8] text-muted"
          }`}
        >
          <span className={`size-2 rounded-full ${s.registration_open ? "bg-[#1f9a6e]" : "bg-muted"}`} aria-hidden="true" />
          {s.registration_open ? "Registration open" : "Registration closed"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-white p-4 sm:p-5">
            <dt className="text-sm text-muted">{t.label}</dt>
            <dd className="mt-1">
              <span className="text-4xl font-semibold tabular-nums text-ink">{t.value}</span>
              {t.note && <span className="mt-1 block text-sm text-muted">{t.note}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl bg-white p-5">
        <CapacityMeter stats={stats} />
        {(stats.waitlistedRegistrations > 0 || stats.cancelledRegistrations > 0) && (
          <p className="mt-4 border-t border-ink/8 pt-3 text-sm text-thread">
            {stats.waitlistedRegistrations > 0 && (
              <Link href="/admin/registrations?status=waitlisted" className="underline underline-offset-4">
                {stats.waitlistedPlaces} people ({stats.waitlistedRegistrations} registrations) on the waiting list
              </Link>
            )}
            {stats.waitlistedRegistrations > 0 && stats.cancelledRegistrations > 0 && ". "}
            {stats.cancelledRegistrations > 0 && `${stats.cancelledRegistrations} cancelled registrations.`}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl bg-white p-5 lg:col-span-3">
          <ActivityChart data={activity} />
        </section>

        <section className="rounded-xl bg-white p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-ink">Latest registrations</h2>
            <Link href="/admin/registrations" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
              See all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-muted">No registrations yet. Share the public page to start collecting them.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink/8">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/registrations/${r.id}`} className="flex items-center gap-3 py-2.5 hover:bg-linen/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{r.full_name}</span>
                      <span className="text-sm text-muted tabular-nums">
                        {r.reference}, {formatDateTime(r.created_at)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold tabular-nums">{r.guest_count}</span>
                      <span className="text-xs text-muted">{r.guest_count === 1 ? "guest" : "guests"}</span>
                    </span>
                    <span className="hidden sm:block">
                      <StatusBadge status={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl bg-white p-5">
        <h2 className="font-semibold text-ink">n8n automation</h2>
        {!hooks.configured ? (
          <p className="mt-2 text-thread">
            No webhook is configured. Set <code className="rounded bg-linen px-1">N8N_WEBHOOK_URL</code> on the server to send each new
            registration to n8n.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 text-thread">
            <span>
              <span className="font-semibold text-ink tabular-nums">{hooks.sent}</span> delivered
            </span>
            <span>
              <span className="font-semibold text-ink tabular-nums">{hooks.pending}</span> waiting
            </span>
            <span className={hooks.failed ? "font-medium text-kilim-dark" : ""}>
              <span className="font-semibold tabular-nums">{hooks.failed}</span> failed
            </span>
            {(hooks.failed > 0 || hooks.pending > 0) && (
              <ActionButton action={retryWebhooksAction} className="bg-ink text-linen hover:bg-ink-soft">
                Retry now
              </ActionButton>
            )}
          </div>
        )}
        <p className="mt-2 text-sm text-muted">Failed deliveries never lose a registration. They are retried automatically.</p>
      </section>
    </div>
  );
}
