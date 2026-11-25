import { normalizePhone } from "./phone";

/** Official WhatsApp click-to-chat link (free, no API). Returns null when no valid number is set. */
export function whatsappLink(number: string, message: string, defaultCountryCode = "49"): string | null {
  const e164 = normalizePhone(number, defaultCountryCode);
  if (!e164) return null;
  return `https://wa.me/${e164.slice(1)}?text=${encodeURIComponent(message)}`;
}
