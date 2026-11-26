import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import type { EventSettings } from "@/lib/types";

export function SiteFooter({ s, t }: { s: EventSettings; t: Dict }) {
  return (
    <footer className="bg-ink-deep text-linen/85">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
        <div>
          <p className="display text-3xl text-linen">{s.event_name}</p>
          {s.organizer_name && (
            <p className="mt-3 text-base">
              {t.organizer}: {s.organizer_name}
            </p>
          )}
        </div>
        {(s.contact_email || s.contact_phone || s.whatsapp_number) && (
          <div>
            <h2 className="text-base font-semibold text-saffron">{t.contact}</h2>
            <ul className="mt-3 space-y-2 text-base">
              {s.contact_phone && (
                <li>
                  <a className="underline-offset-4 hover:underline" href={`tel:${s.contact_phone.replace(/[^\d+]/g, "")}`}>
                    {s.contact_phone}
                  </a>
                </li>
              )}
              {s.whatsapp_number && (
                <li>
                  <a
                    className="underline-offset-4 hover:underline"
                    href={`https://wa.me/${s.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hallo! Ich habe eine Frage zur Veranstaltung „${s.event_name}“.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
              {s.contact_email && (
                <li>
                  <a className="break-all underline-offset-4 hover:underline" href={`mailto:${s.contact_email}`}>
                    {s.contact_email}
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}
        <nav aria-label="Legal" className="md:justify-self-end">
          <ul className="space-y-2 text-base">
            <li>
              <Link className="underline-offset-4 hover:underline" href="/privacy">
                {t.privacy}
              </Link>
            </li>
            <li>
              <Link className="underline-offset-4 hover:underline" href="/imprint">
                {t.imprint}
              </Link>
            </li>
            {s.terms_text.trim() && (
              <li>
                <Link className="underline-offset-4 hover:underline" href="/terms">
                  {t.termsLink}
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
