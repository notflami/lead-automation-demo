import "server-only";
import { cookies, headers } from "next/headers";
import { dictionaries, pickLocale, type Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLocale(c.get("lang")?.value, h.get("accept-language"));
}

export async function getDict() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
