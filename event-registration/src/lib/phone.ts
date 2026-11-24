/**
 * Normalises a phone number to E.164 ("+491761234567").
 * Accepts "+49 176 1234567", "0049 176…", "0176 1234567" (local → default country code).
 * Returns null when the result is not a plausible international number.
 */
export function normalizePhone(input: string, defaultCountryCode = "49"): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/[^\d\s+()./-]/.test(raw)) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.indexOf("+") > 0 || (digits.match(/\+/g)?.length ?? 0) > 1) return null;

  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = defaultCountryCode + digits.slice(1);
  else if (digits.length <= 11) digits = defaultCountryCode + digits; // bare local number without trunk 0
  // longer numbers without prefix are assumed to already include a country code

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return "+" + digits;
}
