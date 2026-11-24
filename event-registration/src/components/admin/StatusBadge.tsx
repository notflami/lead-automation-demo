import type { RegistrationStatus } from "@/lib/types";

export const STATUS_LABEL: Record<RegistrationStatus, string> = {
  confirmed: "Confirmed",
  waitlisted: "Waiting list",
  checked_in: "Checked in",
  cancelled: "Cancelled",
};

const STYLE: Record<RegistrationStatus, string> = {
  confirmed: "bg-[#e7e9f8] text-[#2c3690]",
  waitlisted: "bg-[#fbefd6] text-[#7a4d00]",
  checked_in: "bg-[#dcf1e8] text-[#155c41]",
  cancelled: "bg-[#ecebe8] text-[#5d5f73] line-through decoration-1",
};

const ICON: Record<RegistrationStatus, string> = {
  confirmed: "M5 12.5l4 4 10-10",
  waitlisted: "M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  checked_in: "M4 12.5l4 4 8-8M11 16.5l1 0 8-8",
  cancelled: "M6 6l12 12M18 6L6 18",
};

export function StatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium whitespace-nowrap ${STYLE[status]}`}>
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d={ICON[status]} />
      </svg>
      {STATUS_LABEL[status]}
    </span>
  );
}
