import { CHART } from "./CapacityMeter";

type Day = { day: string; registrations: number; guests: number };

const label = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));

/** Guests registered per day. Single series → no legend; hover/focus shows the exact values. */
export function ActivityChart({ data }: { data: Day[] }) {
  const max = Math.max(4, ...data.map((d) => d.guests));
  const nice = Math.ceil(max / 4) * 4;
  const ticks = [0, nice / 2, nice];
  const total = data.reduce((a, d) => a + d.guests, 0);

  return (
    <figure>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">Guests registered per day</span>
        <span className="text-sm text-muted">{total} guests in the last {data.length} days</span>
      </figcaption>
      <div className="relative mt-4 h-48 pl-8">
        {ticks.map((t) => (
          <div key={t} className="absolute right-0 left-8 border-t border-ink/8" style={{ bottom: `${(t / nice) * 100}%` }}>
            <span className="absolute -top-2.5 -left-8 w-6 text-right text-xs text-muted tabular-nums">{t}</span>
          </div>
        ))}
        <ol className="relative flex h-full items-end gap-[2px]">
          {data.map((d, i) => {
            const h = (d.guests / nice) * 100;
            const date = label(d.day, { weekday: "short", day: "numeric", month: "short" });
            return (
              <li key={d.day} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0} aria-label={`${date}: ${d.guests} guests, ${d.registrations} registrations`}>
                <div
                  className="w-full max-w-7 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                  style={{ height: d.guests ? `max(${h}%, 3px)` : 0, background: CHART.confirmed }}
                />
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-lg bg-ink-deep px-3 py-2 text-xs text-linen shadow-lg group-hover:block group-focus:block">
                  <div className="font-semibold">{date}</div>
                  <div className="tabular-nums">
                    {d.guests} guests, {d.registrations} registrations
                  </div>
                </div>
                {(i === 0 || i === data.length - 1 || i % 7 === 0) && (
                  <span className="absolute -bottom-6 text-xs whitespace-nowrap text-muted">{label(d.day, { day: "numeric", month: "short" })}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <details className="mt-9 text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
        <table className="mt-2 w-full max-w-sm text-left tabular-nums">
          <thead>
            <tr className="text-muted">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">Registrations</th>
              <th className="py-1 text-right font-medium">Guests</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-ink/8">
                <td className="py-1">{label(d.day, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td className="py-1 text-right">{d.registrations}</td>
                <td className="py-1 text-right">{d.guests}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
