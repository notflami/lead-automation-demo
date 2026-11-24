"use client";

import { useActionState } from "react";
import { anonymizeAllAction } from "@/app/admin/actions";

export function AnonymizeForm() {
  const [state, action, pending] = useActionState(anonymizeAllAction, null);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <label>
        <span className="mb-1 block text-sm font-medium">Type DELETE to confirm</span>
        <input name="confirm" autoComplete="off" className="field-input min-h-11 w-48 text-base" />
      </label>
      <button disabled={pending} className="min-h-11 rounded-lg bg-kilim px-5 font-semibold text-white hover:bg-kilim-dark disabled:opacity-60">
        {pending ? "Deleting…" : "Delete personal data now"}
      </button>
      {state?.error && <p role="alert" className="text-sm font-medium text-kilim-dark">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-moss">{state.message}</p>}
    </form>
  );
}
