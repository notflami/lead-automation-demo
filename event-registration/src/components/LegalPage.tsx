import Link from "next/link";
import { Embroidery } from "./Embroidery";
import { LanguageSwitch } from "./LanguageSwitch";
import { SiteFooter } from "./SiteFooter";
import type { Dict, Locale } from "@/lib/i18n";
import type { EventSettings } from "@/lib/types";

export function LegalPage(props: { title: string; locale: Locale; t: Dict; s: EventSettings; children: React.ReactNode }) {
  return (
    <>
      <header className="bg-ink text-linen">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-base font-medium underline-offset-4 hover:underline">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {props.t.backHome}
          </Link>
          <LanguageSwitch locale={props.locale} label={props.t.language} />
        </div>
      </header>
      <Embroidery tiles={14} cell={3} className="bg-linen py-3" />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 md:py-16">
        <h1 className="display text-4xl md:text-5xl">{props.title}</h1>
        <div className="legal mt-8 space-y-4 text-lg leading-relaxed text-thread [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_a]:underline [&_a]:underline-offset-4">
          {props.children}
        </div>
      </main>
      <SiteFooter s={props.s} t={props.t} />
    </>
  );
}
