import { isValidInternationalPhone } from "./internationalPhone";

/**
 * @param {unknown} raw
 * @param {{ required?: boolean, skipFormat?: boolean }} [options]
 * @returns {{ ok: true, phone: string } | { ok: false, code: "required"|"invalid", message: string, messageKey: string }}
 */
export function parseCustomerPhone(raw, { required = true, skipFormat = false } = {}) {
  const trimmed =
    typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!trimmed) {
    if (required) {
      return {
        ok: false,
        code: "required",
        message: "Invalid phone number",
        messageKey: "order.phoneInvalid",
      };
    }
    return { ok: true, phone: "" };
  }
  if (!skipFormat && !isValidInternationalPhone(trimmed)) {
    return {
      ok: false,
      code: "invalid",
      message: "Invalid phone number",
      messageKey: "order.phoneInvalid",
    };
  }
  return { ok: true, phone: trimmed };
}
