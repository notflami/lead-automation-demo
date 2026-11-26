import Link from "next/link";
import { notFound } from "next/navigation";
import { EditRegistrationForm } from "@/components/admin/EditRegistrationForm";
import { StatusBadge, VipBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { refundOneAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getRegistration } from "@/lib/registrations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const euro = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

const HOOK_LABEL = { pending: "Waiting to be sent", sent: "Delivered", failed: "Failed, will retry", skipped: "Not configured" };

export default async function RegistrationDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const r = await getRegistration(id);
  if (!r) notFound();

  return (
    <div className="space-y-5">
      <Link href="/admin/registrations" className="inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-ink">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        All registrations
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl text-ink">{r.full_name}</h1>
        <StatusBadge status={r.status} />
        {r.ticket_type === "vip" && <VipBadge />}
      </div>
      <p className="font-mono text-lg text-kilim tabular-nums">{r.reference}</p>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-ink">Edit registration</h2>
          {r.anonymized_at ? (
            <p className="text-thread">Personal data was removed on {formatDateTime(r.anonymized_at)}. This record only counts towards totals.</p>
          ) : (
            <EditRegistrationForm
              key={r.status}
              id={r.id}
              initial={{
                fullName: r.full_name,
                phone: r.phone,
                email: r.email ?? "",
                guestCount: r.guest_count,
                ticketType: r.ticket_type,
                status: r.status,
                adminNote: r.admin_note,
              }}
            />
          )}
        </section>

        <aside className="h-fit rounded-xl bg-white p-5">
          <h2 className="font-semibold text-ink">History</h2>
          <dl className="mt-3 space-y-3 text-[15px]">
            <div>
              <dt className="text-sm text-muted">Registered</dt>
              <dd>{formatDateTime(r.created_at)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Last changed</dt>
              <dd>{formatDateTime(r.updated_at)}</dd>
            </div>
            {r.cancelled_at && (
              <div>
                <dt className="text-sm text-muted">Cancelled</dt>
                <dd>{formatDateTime(r.cancelled_at)}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted">Language used</dt>
              <dd>{r.locale === "de" ? "German" : "English"}</dd>
            </div>
            {r.payment_status !== "none" && (
              <div>
                <dt className="text-sm text-muted">Online payment</dt>
                <dd>
                  {r.payment_status === "paid" && (
                    <>
                      Paid {euro(r.amount_cents)}
                      {r.paid_at && <span className="text-muted"> on {formatDateTime(r.paid_at)}</span>}
                    </>
                  )}
                  {r.payment_status === "pending" && r.hold_expires_at && <>Awaiting payment until {formatDateTime(r.hold_expires_at)}</>}
                  {r.payment_status === "expired" && "Not paid (payment page closed or expired)"}
                  {r.payment_status === "failed" && "Payment failed"}
                  {r.payment_status === "refunded" && `Refunded ${euro(r.amount_cents)}`}
                  {r.payment_status === "refunded" && r.refunded_at && <span className="block text-muted">on {formatDateTime(r.refunded_at)}</span>}
                  {r.stripe_session_id && <span className="mt-1 block font-mono text-xs break-all text-muted">{r.stripe_session_id}</span>}
                  {r.refund_error && <span className="mt-1 block text-sm text-kilim-dark">Last refund attempt failed: {r.refund_error}</span>}
                  {r.payment_status === "paid" && (
                    <span className="mt-2 block">
                      <ActionButton
                        action={refundOneAction.bind(null, r.id)}
                        confirm={`Refund ${euro(r.amount_cents)} to ${r.full_name} and cancel this reservation?`}
                        className="border border-kilim/40 text-kilim-dark hover:bg-kilim/8"
                      >
                        Refund {euro(r.amount_cents)} and cancel
                      </ActionButton>
                    </span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted">Sent to n8n</dt>
              <dd>
                {HOOK_LABEL[r.webhook_status]}
                {r.webhook_attempts > 1 && <span className="text-muted"> ({r.webhook_attempts} attempts)</span>}
                {r.webhook_status === "failed" && r.webhook_last_error && (
                  <span className="mt-1 block text-sm text-kilim-dark">{r.webhook_last_error}</span>
                )}
              </dd>
            </div>
          </dl>
          {!r.anonymized_at && (
            <div className="mt-5 flex flex-col gap-2 border-t border-ink/8 pt-4">
              <a href={`tel:${r.phone}`} className="min-h-10 content-center rounded-lg border border-ink/20 px-4 text-center text-sm font-semibold hover:bg-linen">
                Call {r.phone}
              </a>
              <a
                href={`https://wa.me/${r.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-10 content-center rounded-lg border border-ink/20 px-4 text-center text-sm font-semibold hover:bg-linen"
              >
                Message on WhatsApp
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
