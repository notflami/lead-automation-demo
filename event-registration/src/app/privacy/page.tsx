import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getDict } from "@/lib/locale";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy / Datenschutz" };

export default async function PrivacyPage() {
  const [{ locale, t }, s] = await Promise.all([getDict(), getSettings()]);
  const controller = (
    <p className="whitespace-pre-line">
      {[s.organizer_name, s.organizer_address, s.contact_email, s.contact_phone].filter(Boolean).join("\n")}
    </p>
  );
  const days = s.data_retention_days;

  return (
    <LegalPage title={locale === "de" ? "Datenschutzhinweise" : "Privacy notice"} locale={locale} t={t} s={s}>
      {locale === "de" ? (
        <>
          <p>Wir erheben nur die Daten, die wir für Ihre Reservierung brauchen, und geben sie nicht zu Werbezwecken weiter.</p>
          <h2>Verantwortlicher</h2>
          {controller}
          <h2>Welche Daten wir verarbeiten</h2>
          <ul>
            <li>Vor- und Nachname, Handynummer, Anzahl der Personen</li>
            <li>Zeitpunkt der Reservierung und gewählte Sprache</li>
          </ul>
          <p>
            Zum Schutz vor Missbrauch speichern wir kurzzeitig einen nicht umkehrbaren Hashwert Ihrer IP-Adresse (höchstens 24 Stunden).
            Ihre IP-Adresse selbst wird nicht gespeichert.
          </p>
          <h2>Zweck und Rechtsgrundlage</h2>
          <p>
            Wir verwenden die Daten, um Ihre Reservierung zu verwalten, die Gästezahl zu planen, Sie am Eingang auf der Gästeliste zu finden
            und Sie bei Änderungen zur Veranstaltung zu kontaktieren (Art. 6 Abs. 1 lit. b DSGVO). Der Missbrauchsschutz beruht auf unserem
            berechtigten Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
          </p>
          <h2>Speicherdauer</h2>
          <p>
            Ihre personenbezogenen Daten werden {days === 0 ? "direkt nach der Veranstaltung" : `${days} Tage nach der Veranstaltung`}{" "}
            automatisch anonymisiert. Übrig bleiben nur anonyme Zahlen (z. B. Anzahl der Gäste).
          </p>
          <h2>Empfänger</h2>
          <p>
            Zugriff haben nur die Organisatoren. Technische Dienstleister (Hosting, Datenbank, Automatisierung) verarbeiten die Daten in
            unserem Auftrag gemäß Art. 28 DSGVO.
          </p>
          {s.privacy_notes && <p className="whitespace-pre-line">{s.privacy_notes}</p>}
          {s.payments_enabled && (
            <>
              <h2>Online-Zahlung</h2>
              <p>
                Wenn Sie online bezahlen, werden Sie zu Stripe weitergeleitet (Stripe Payments Europe, Ltd., Irland). Ihre Zahlungsdaten
                gibt Stripe nicht an uns weiter; wir erhalten nur die Bestätigung der Zahlung und den Betrag. Rechtsgrundlage ist die
                Vertragsabwicklung (Art. 6 Abs. 1 lit. b DSGVO). Es gilt zusätzlich die Datenschutzerklärung von Stripe.
              </p>
            </>
          )}
          <h2>Cookies und externe Inhalte</h2>
          <p>
            Diese Website setzt keine Tracking- oder Werbe-Cookies. Es wird höchstens ein Cookie für die gewählte Sprache gespeichert. Schriftarten
            werden von unserem eigenen Server geladen. Kartendienste werden erst geöffnet, wenn Sie auf „In Karten öffnen“ tippen. WhatsApp
            (Meta) wird erst geöffnet, wenn Sie auf einen WhatsApp-Button tippen; was Sie uns dort schreiben, unterliegt den Bedingungen von
            WhatsApp.
          </p>
          <h2>Ihre Rechte</h2>
          <p>
            Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch
            (Art. 15–21 DSGVO). Schreiben Sie uns dazu einfach über die oben genannten Kontaktdaten. Sie können Ihre Reservierung jederzeit
            stornieren lassen. Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren.
          </p>
        </>
      ) : (
        <>
          <p>We only collect what we need for your reservation, and we never share it for advertising.</p>
          <h2>Who is responsible</h2>
          {controller}
          <h2>What we store</h2>
          <ul>
            <li>First and last name, mobile number, number of people</li>
            <li>The time of your reservation and the language you used</li>
          </ul>
          <p>
            To prevent abuse, we briefly keep a one-way hash of your IP address (24 hours at most). Your IP address itself is not stored.
          </p>
          <h2>Why, and on what legal basis</h2>
          <p>
            We use your details to manage your reservation, plan the number of guests, find you on the guest list at the door, and contact
            you about changes to the event (Art. 6(1)(b) GDPR). Abuse prevention is based on our legitimate interest in running the site
            securely (Art. 6(1)(f) GDPR).
          </p>
          <h2>How long we keep it</h2>
          <p>
            Your personal data is automatically anonymised {days === 0 ? "right after the event" : `${days} days after the event`}. Only
            anonymous totals (such as the number of guests) remain.
          </p>
          <h2>Who can see it</h2>
          <p>
            Only the organizers. Technical service providers (hosting, database, automation) process the data on our behalf under
            Art. 28 GDPR.
          </p>
          {s.privacy_notes && <p className="whitespace-pre-line">{s.privacy_notes}</p>}
          {s.payments_enabled && (
            <>
              <h2>Online payment</h2>
              <p>
                If you pay online, you are taken to Stripe (Stripe Payments Europe, Ltd., Ireland). Stripe does not share your payment
                details with us; we only receive the confirmation and the amount. Legal basis: performance of the contract
                (Art. 6(1)(b) GDPR). Stripe&apos;s own privacy policy also applies.
              </p>
            </>
          )}
          <h2>Cookies and external content</h2>
          <p>
            This website uses no tracking or advertising cookies. At most, one cookie remembers your language. Fonts are served from our own
            server. Map services open only when you tap “Open in maps”. WhatsApp (Meta) opens only when you tap a WhatsApp button; what
            you write to us there is subject to WhatsApp’s terms.
          </p>
          <h2>Your rights</h2>
          <p>
            You can ask for access to, correction or deletion of your data, restriction of processing, data portability, and you can object
            (Art. 15–21 GDPR). Just contact us using the details above. You can cancel your reservation at any time. You also have the right
            to complain to a data protection supervisory authority.
          </p>
        </>
      )}
    </LegalPage>
  );
}
