import Link from "next/link";
import { STATUS_LABEL } from "@/components/admin/StatusBadge";
import { StatusSelect } from "@/components/admin/StatusSelect";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listRegistrations } from "@/lib/registrations";
import { STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin();
  const { q = "", status = "all" } = await searchParams;
  const rows = await listRegistrations({ q, status });
  const guests = rows.reduce((a, r) => a + (r.status === "cancelled" ? 0 : r.guest_count), 0);
  const exportQs = new URLSearchParams({ q, status }).toString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display mr-auto text-3xl text-ink">Registrations</h1>
        <a href={`/api/admin/export?${exportQs}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-linen hover:bg-ink-soft">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />
          </svg>
          Export CSV
        </a>
      </div>

      <form className="flex flex-col gap-3 rounded-xl bg-white p-4 sm:flex-row sm:items-end" role="search">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-thread">Search by name, phone or registration ID</span>
          <input name="q" defaultValue={q} type="search" placeholder="e.g. Petrović, 0176…, REG-000042" className="field-input min-h-11 text-base" />
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium text-thread">Status</span>
          <select name="status" defaultValue={status} className="field-input min-h-11 text-base sm:w-44">
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-lg bg-saffron px-5 font-semibold text-ink-deep hover:bg-saffron-light">Search</button>
        {(q || status !== "all") && (
          <Link href="/admin/registrations" className="min-h-11 content-center px-2 text-sm text-muted underline underline-offset-4">
            Clear
          </Link>
        )}
      </form>

      <p className="text-sm text-muted" role="status">
        {rows.length} {rows.length === 1 ? "registration" : "registrations"}, {guests} {guests === 1 ? "guest" : "guests"} (excluding cancelled)
      </p>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-thread">
          {q || status !== "all" ? "Nothing matches this search. Try part of the name or the last digits of the phone number." : "No registrations yet."}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl bg-white md:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-ink/10 text-sm text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 text-right font-medium">Guests</th>
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/6">
                {rows.map((r) => (
                  <tr key={r.id} className={r.status === "cancelled" ? "text-muted" : ""}>
                    <td className="px-4 py-2.5 font-mono text-sm tabular-nums">{r.reference}</td>
                    <td className="px-4 py-2.5 font-medium">{r.full_name}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      <a href={`tel:${r.phone}`} className="hover:underline">{r.phone}</a>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.guest_count}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <StatusSelect id={r.id} status={r.status} label={`${r.full_name} (${r.reference})`} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/registrations/${r.id}`} className="text-sm font-semibold text-[#3d4bb8] underline-offset-4 hover:underline">
                        View / edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards (organizers on their phone at the door) */}
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4">
                <div className="flex items-start gap-3">
                  <Link href={`/admin/registrations/${r.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{r.full_name}</span>
                    <span className="block text-sm text-muted tabular-nums">
                      {r.reference}, {r.phone}
                    </span>
                  </Link>
                  <span className="text-right">
                    <span className="block text-2xl font-semibold tabular-nums">{r.guest_count}</span>
                    <span className="text-xs text-muted">{r.guest_count === 1 ? "guest" : "guests"}</span>
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">{formatDateTime(r.created_at)}</span>
                  <StatusSelect id={r.id} status={r.status} label={`${r.full_name} (${r.reference})`} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
