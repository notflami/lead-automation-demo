"use client";

/** Shown instead of a blank crash page if the server can't load (e.g. database briefly unreachable). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-5 text-linen">
      <div className="max-w-md">
        <h1 className="display text-4xl">This page could not load</h1>
        <p className="mt-4 text-lg text-linen/80">Please try again in a moment. Diese Seite konnte nicht geladen werden – bitte gleich erneut versuchen.</p>
        <button type="button" onClick={() => reset()} className="btn-primary mt-8">
          Try again / Erneut versuchen
        </button>
      </div>
    </main>
  );
}
