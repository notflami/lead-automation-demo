"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-8 space-y-4">
      <label htmlFor="password" className="block font-semibold">
        Password
      </label>
      <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="field-input" />
      {state?.error && (
        <p role="alert" className="rounded-lg bg-kilim/20 px-3 py-2 text-base text-linen">
          {state.error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
