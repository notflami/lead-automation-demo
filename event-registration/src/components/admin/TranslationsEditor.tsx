"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/i18n";
import { TRANSLATABLE_FIELDS, type EventSettings, type TranslatableField } from "@/lib/types";

const LABELS: Record<TranslatableField, string> = {
  tagline: "Short line under the name",
  about_text: "About the evening",
  expectations: "What to expect (one item per line)",
  dress_code: "Dress code",
  additional_info: "Good to know",
  ticket_normal_info: "Normal ticket: short info",
  ticket_vip_info: "VIP place: short info",
};
const MULTILINE: TranslatableField[] = ["about_text", "expectations", "additional_info"];

/** One tab per language. All tabs stay in the form (hidden ones too), so one Save stores everything. */
export function TranslationsEditor({ v }: { v: Omit<EventSettings, "updated_at"> }) {
  const langs = LANGUAGES.filter((l) => l.code !== "de");
  const [active, setActive] = useState(langs[0].code);
  const input = "field-input min-h-11 text-base";

  return (
    <fieldset className="rounded-xl bg-white p-5">
      <legend className="sr-only">Translations</legend>
      <h2 className="font-semibold text-ink" aria-hidden="true">
        Translations of your texts
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Visitors who choose another language see these texts. Empty fields show the German text. When you change a German text above,
        update its translations here too.
      </p>
      <div role="tablist" className="mt-4 flex flex-wrap gap-2">
        {langs.map((l) => {
          const filled = TRANSLATABLE_FIELDS.filter((f) => v.translations?.[l.code]?.[f]?.trim() || !v[f]).length;
          return (
            <button
              key={l.code}
              type="button"
              role="tab"
              aria-selected={active === l.code}
              onClick={() => setActive(l.code)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                active === l.code ? "border-ink bg-ink text-linen" : "border-ink/20 hover:border-ink/50"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/flags/${l.flag}.svg`} alt="" width={20} height={15} className="h-[15px] w-5 rounded-[2px] object-cover" />
              {l.name}
              <span className={`text-xs ${active === l.code ? "text-linen/70" : "text-muted"}`}>
                {filled}/{TRANSLATABLE_FIELDS.length}
              </span>
            </button>
          );
        })}
      </div>
      {langs.map((l) => (
        <div key={l.code} role="tabpanel" hidden={active !== l.code} className="mt-5 grid gap-4 sm:grid-cols-2">
          {TRANSLATABLE_FIELDS.map((f) => (
            <label key={f} className={MULTILINE.includes(f) ? "sm:col-span-2" : ""}>
              <span className="block text-sm font-medium text-ink">
                {LABELS[f]} <span className="font-normal text-muted">({l.name})</span>
              </span>
              <span className="block text-sm whitespace-pre-line text-muted">German: {v[f] || "—"}</span>
              {MULTILINE.includes(f) ? (
                <textarea
                  name={`tr.${l.code}.${f}`}
                  lang={l.code}
                  defaultValue={v.translations?.[l.code]?.[f] ?? ""}
                  rows={f === "about_text" ? 5 : 4}
                  maxLength={3000}
                  className={`${input} mt-1 min-h-24`}
                />
              ) : (
                <input
                  name={`tr.${l.code}.${f}`}
                  lang={l.code}
                  defaultValue={v.translations?.[l.code]?.[f] ?? ""}
                  maxLength={300}
                  className={`${input} mt-1`}
                />
              )}
            </label>
          ))}
        </div>
      ))}
    </fieldset>
  );
}
