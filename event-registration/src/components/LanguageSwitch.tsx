"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitch({ locale, label, className = "" }: { locale: Locale; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: Locale = locale === "en" ? "de" : "en";
  return (
    <button
      type="button"
      lang={next}
      onClick={() => {
        document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
        start(() => router.refresh());
      }}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-current/40 px-4 text-base font-medium transition-colors hover:border-current ${pending ? "opacity-60" : ""} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
      {label}
    </button>
  );
}
