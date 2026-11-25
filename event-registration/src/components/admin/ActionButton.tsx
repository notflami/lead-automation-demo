"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/app/admin/actions";

/** Button that runs a server action and shows its result inline. */
export function ActionButton({
  action,
  children,
  className = "",
  confirm,
}: {
  action: () => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={`min-h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-60 ${className}`}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setResult(await action()));
        }}
      >
        {pending ? "Working…" : children}
      </button>
      {result?.error && <span role="alert" className="text-sm font-medium text-kilim-dark">{result.error}</span>}
      {result?.message && <span role="status" className="text-sm text-moss">{result.message}</span>}
    </span>
  );
}
