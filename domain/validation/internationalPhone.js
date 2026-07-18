import { INTERNATIONAL_CALLING_CODES_SORTED } from "./internationalCallingCodes.js";

/**
 * Strip to digits; supports leading + and 00 international prefix.
 * Does not accept national trunk "0" after country code (invalid in E.164).
 */
export function normalizeInternationalPhoneDigits(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s) return "";
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  let digits = s.replace(/\D/g, "");
  while (digits.startsWith("0") && digits.length > 1) {
    digits = digits.slice(1);
  }
  return digits;
}

function matchLongestCallingCode(digits) {
  for (const code of INTERNATIONAL_CALLING_CODES_SORTED) {
    if (digits.startsWith(code)) {
      return { code, national: digits.slice(code.length) };
    }
  }
  return null;
}

function validateNational(code, national) {
  if (!national || national[0] === "0") return false;
  const maxNational = 15 - code.length;
  if (national.length > maxNational) return false;
  if (code === "1") return national.length === 10;
  if (code === "7") return national.length === 10;
  if (code.length > 1 && code[0] === "1" && code !== "1") {
    return national.length >= 4 && national.length <= 10;
  }
  return national.length >= 4 && national.length <= maxNational;
}

/**
 * E.164-style check: 10–15 digits total, optional ITU prefix from the shared list,
 * plus a length fallback when the prefix is not in the list (future / rare codes).
 */
export function isValidInternationalPhone(raw) {
  const digits = normalizeInternationalPhoneDigits(raw);
  if (!digits || !/^[1-9]\d{9,14}$/.test(digits)) return false;
  const matched = matchLongestCallingCode(digits);
  if (matched) return validateNational(matched.code, matched.national);
  return true;
}
