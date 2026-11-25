import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getDict } from "@/lib/locale";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Impressum" };

export default async function ImprintPage() {
  const [{ locale, t }, s] = await Promise.all([getDict(), getSettings()]);
  return (
    <LegalPage title={locale === "de" ? "Impressum" : "Imprint (Impressum)"} locale={locale} t={t} s={s}>
      <p>{locale === "de" ? "Angaben gemäß § 5 DDG" : "Information according to § 5 DDG (German Digital Services Act)"}</p>
      <p className="whitespace-pre-line">{[s.organizer_name, s.organizer_address].filter(Boolean).join("\n")}</p>
      <h2>{t.contact}</h2>
      <p className="whitespace-pre-line">
        {[s.contact_phone && `${locale === "de" ? "Telefon" : "Phone"}: ${s.contact_phone}`, s.contact_email && `E-Mail: ${s.contact_email}`]
          .filter(Boolean)
          .join("\n")}
      </p>
    </LegalPage>
  );
}
