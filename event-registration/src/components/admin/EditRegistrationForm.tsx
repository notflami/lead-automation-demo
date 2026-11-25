"use client";

import { startTransition, useActionState } from "react";
import { setStatusAction, updateRegistrationAction } from "@/app/admin/actions";
import { STATUSES, type RegistrationStatus } from "@/lib/types";
import { ActionButton } from "./ActionButton";
import { STATUS_LABEL } from "./StatusBadge";

export function EditRegistrationForm(props: {
  id: string;
  initial: { fullName: string; phone: string; email: string; guestCount: number; status: RegistrationStatus; adminNote: string };
}) {
  const [state, action, pending] = useActionState(updateRegistrationAction.bind(null, props.id), null);
  const i = props.initial;
  const input = "field-input min-h-11 text-base";
  return (
    <form
      onSubmit={(e) => {
        // Submit via transition: avoids React resetting the fields when validation fails.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Full name</span>
        <input name="fullName" defaultValue={i.fullName} required minLength={2} maxLength={120} className={input} />
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium">Phone</span>
        <input name="phone" type="tel" defaultValue={i.phone} required className={input} />
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium">Number of guests</span>
        <input name="guestCount" type="number" min={1} max={50} defaultValue={i.guestCount} required className={input} />
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium">Status</span>
        <select name="status" defaultValue={i.status} className={input}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Internal note</span>
        <textarea name="adminNote" defaultValue={i.adminNote} rows={3} maxLength={2000} className={`${input} min-h-24`} placeholder="Only visible to organizers" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="min-h-11 rounded-lg bg-saffron px-5 font-semibold text-ink-deep hover:bg-saffron-light disabled:opacity-60">
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state?.error && <p role="alert" className="text-sm font-medium text-kilim-dark">{state.error}</p>}
        {state?.message && <p role="status" className="text-sm text-moss">{state.message}</p>}
        {i.status !== "cancelled" && (
          <span className="ml-auto">
            <ActionButton
              action={() => setStatusAction(props.id, "cancelled")}
              confirm="Cancel this registration? Their places become free again."
              className="border border-kilim/40 text-kilim-dark hover:bg-kilim/8"
            >
              Cancel registration
            </ActionButton>
          </span>
        )}
      </div>
    </form>
  );
}
