"use client";

import { useState, useTransition } from "react";
import { setStatusAction } from "@/app/admin/actions";
import { STATUSES, type RegistrationStatus } from "@/lib/types";
import { STATUS_LABEL } from "./StatusBadge";

/** Inline status change in the table, e.g. checking guests in at the door. */
export function StatusSelect({ id, status, label }: { id: string; status: RegistrationStatus; label: string }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <select
        aria-label={`Status of ${label}`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as RegistrationStatus;
          if (next === "cancelled" && !window.confirm(`Cancel the registration of ${label}? Their places become free.`)) return;
          const prev = value;
          setValue(next);
          setError(null);
          start(async () => {
            const r = await setStatusAction(id, next);
            if (r?.error) {
              setValue(prev);
              setError(r.error);
            }
          });
        }}
        className="min-h-10 rounded-lg border border-ink/20 bg-white px-2 text-sm disabled:opacity-60"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {error && <span role="alert" className="mt-1 max-w-56 text-xs text-kilim-dark">{error}</span>}
    </span>
  );
}
