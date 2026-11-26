"use client";

import { useActionState } from "react";
import { doorLoginAction } from "@/app/door/actions";

export function DoorLogin({ eventName, passwordSet }: { eventName: string; passwordSet: boolean }) {
  const [state, action, pending] = useActionState(doorLoginAction, null);
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-5 text-linen">
      <div className="w-full max-w-sm">
        <p className="text-base text-linen/70">{eventName}</p>
        <h1 className="display mt-1 text-4xl">Einlass</h1>
        {passwordSet ? (
          <form action={action} className="mt-8 space-y-4">
            <label className="block">
              <span className="block text-lg font-semibold">Passwort</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-2 min-h-14 w-full rounded-xl border-2 border-linen/30 bg-white px-4 text-xl text-ink outline-none focus:border-saffron"
              />
            </label>
            {state?.error && (
              <p role="alert" className="rounded-lg bg-kilim px-4 py-3 text-lg font-semibold text-white">
                {state.error}
              </p>
            )}
            <button disabled={pending} className="btn-primary w-full text-xl">
              {pending ? "…" : "Anmelden"}
            </button>
          </form>
        ) : (
          <p className="mt-8 rounded-xl bg-linen/10 px-4 py-4 text-lg">
            Noch kein Einlass-Passwort gesetzt. Der Veranstalter setzt es im Dashboard unter <strong>Event settings → Door check-in</strong>.
          </p>
        )}
      </div>
    </main>
  );
}
