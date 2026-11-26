"use client";

import { useActionState } from "react";
import { refundAllAction } from "@/app/admin/actions";

export function RefundAllForm({ paidCount, paidText }: { paidCount: number; paidText: string }) {
  const [state, action, pending] = useActionState(refundAllAction, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Refund ${paidCount} paid reservation(s), ${paidText} in total, and close registration? This cannot be undone.`)) e.preventDefault();
      }}
      className="mt-4 flex flex-wrap items-end gap-3"
    >
      <label>
        <span className="mb-1 block text-sm font-medium">Type REFUND ALL to confirm</span>
        <input name="confirm" autoComplete="off" className="field-input min-h-11 w-56 text-base" />
      </label>
      <button disabled={pending || paidCount === 0} className="min-h-11 rounded-lg bg-kilim px-5 font-semibold text-white hover:bg-kilim-dark disabled:opacity-50">
        {pending ? "Refunding… keep this page open" : `Refund all (${paidText})`}
      </button>
      {state?.error && <p role="alert" className="basis-full text-sm font-medium text-kilim-dark">{state.error}</p>}
      {state?.message && <p role="status" className="basis-full text-sm text-moss">{state.message}</p>}
    </form>
  );
}
