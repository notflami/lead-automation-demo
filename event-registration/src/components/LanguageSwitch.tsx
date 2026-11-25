"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { LANGUAGES, type Locale } from "@/lib/i18n";

function Flag({ code, className = "" }: { code: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/flags/${code}.svg`} alt="" width={24} height={18} loading="lazy" className={`h-[18px] w-6 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.15)] ${className}`} />;
}

/** Globe button with the current flag; opens a list of the seven languages with flags. */
export function LanguageSwitch({ locale, label, className = "" }: { locale: Locale; label: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function choose(code: Locale) {
    setOpen(false);
    if (code === locale) return;
    document.cookie = `lang=${code}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${label}: ${current.name}`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-current/40 px-3.5 text-base font-medium transition-colors hover:border-current ${pending ? "opacity-60" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <Flag code={current.flag} />
        <span>{current.name}</span>
        <svg viewBox="0 0 24 24" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul id={menuId} className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl bg-white py-1.5 text-ink shadow-[0_18px_50px_-12px_rgba(0,0,0,0.5)]">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                lang={l.code}
                onClick={() => choose(l.code)}
                aria-current={l.code === locale ? "true" : undefined}
                className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-base hover:bg-linen ${l.code === locale ? "font-semibold" : ""}`}
              >
                <Flag code={l.flag} />
                <span className="flex-1">{l.name}</span>
                {l.code === locale && (
                  <svg viewBox="0 0 24 24" className="size-5 text-moss" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M5 12.5l4 4 10-10" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
