import type { CapacityStats } from "@/lib/types";

// Chart colours validated for CVD separation and contrast on white (dataviz validator).
export const CHART = { confirmed: "#3d4bb8", checkedIn: "#1f9a6e", track: "#e9e7e1" };

/** One stacked bar: checked in + confirmed (not yet arrived) + free places, out of max capacity. */
export function CapacityMeter({ stats }: { stats: CapacityStats }) {
  const max = Math.max(stats.maxCapacity, stats.reservedPlaces, 1);
  const checkedIn = stats.checkedInPlaces;
  const confirmed = stats.reservedPlaces - checkedIn;
  const pct = (n: number) => `${(n / max) * 100}%`;
  const over = stats.reservedPlaces > stats.maxCapacity;
  const segments = [
    { key: "checkedIn", n: checkedIn, color: CHART.checkedIn, label: "Checked in" },
    { key: "confirmed", n: confirmed, color: CHART.confirmed, label: "Reserved, not yet arrived" },
  ].filter((s) => s.n > 0);

  return (
    <figure>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">Capacity</span>
        <span className="text-muted tabular-nums">
          <span className="font-semibold text-ink">{stats.reservedPlaces}</span> of {stats.maxCapacity} places reserved (
          {Math.round((stats.reservedPlaces / Math.max(1, stats.maxCapacity)) * 100)}%)
        </span>
      </figcaption>
      <div
        className="mt-3 flex h-6 w-full gap-[2px] overflow-hidden rounded-[4px]"
        style={{ background: CHART.track }}
        role="img"
        aria-label={`${checkedIn} checked in, ${confirmed} reserved and not yet arrived, ${stats.remaining} places free, out of ${stats.maxCapacity}.`}
      >
        {segments.map((s) => (
          <div key={s.key} title={`${s.label}: ${s.n}`} className="h-full" style={{ width: pct(s.n), background: s.color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-thread">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-[3px]" style={{ background: CHART.checkedIn }} aria-hidden="true" />
          Checked in <span className="font-semibold tabular-nums text-ink">{checkedIn}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-[3px]" style={{ background: CHART.confirmed }} aria-hidden="true" />
          Reserved, not yet arrived <span className="font-semibold tabular-nums text-ink">{confirmed}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-[3px] border border-ink/20" style={{ background: CHART.track }} aria-hidden="true" />
          Free <span className="font-semibold tabular-nums text-ink">{stats.remaining}</span>
        </li>
      </ul>
      {over && (
        <p className="mt-2 text-sm font-medium text-kilim-dark">
          Reservations exceed the maximum capacity (the capacity was lowered after people registered).
        </p>
      )}
    </figure>
  );
}
