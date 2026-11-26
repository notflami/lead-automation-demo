import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";
import { getDict } from "@/lib/locale";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AGB / Terms" };

/** Terms and conditions (AGB) as entered by the organizer in Event settings. */
export default async function TermsPage() {
  const [{ locale, t }, s] = await Promise.all([getDict(), getSettings()]);
  if (!s.terms_text.trim()) notFound();
  return (
    <LegalPage title={locale === "de" ? "Allgemeine Geschäftsbedingungen (AGB)" : "Terms and conditions (AGB)"} locale={locale} t={t} s={s}>
      <div className="whitespace-pre-line">{s.terms_text}</div>
    </LegalPage>
  );
}
