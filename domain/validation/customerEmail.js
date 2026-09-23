import { normalizeEmailAddress } from "@config/email";

/**
 * Required customer-facing email. Empty and invalid both fail.
 * @param {unknown} raw
 * @returns {{ ok: true, email: string } | { ok: false, code: "required"|"invalid", message: string, messageKey: string }}
 */
export function parseRequiredCustomerEmail(raw) {
  const trimmed =
    typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "required",
      message: "Customer email is required",
      messageKey: "order.emailRequired",
    };
  }
  const email = normalizeEmailAddress(trimmed);
  if (!email) {
    return {
      ok: false,
      code: "invalid",
      message: "Invalid customer email",
      messageKey: "order.emailInvalid",
    };
  }
  return { ok: true, email };
}

/**
 * Optional email: empty is allowed; if present it must be valid.
 * @param {unknown} raw
 * @returns {{ ok: true, email: string } | { ok: false, code: "invalid", message: string, messageKey: string }}
 */
export function parseOptionalCustomerEmail(raw) {
  const trimmed =
    typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!trimmed) return { ok: true, email: "" };
  const email = normalizeEmailAddress(trimmed);
  if (!email) {
    return {
      ok: false,
      code: "invalid",
      message: "Invalid customer email",
      messageKey: "order.emailInvalid",
    };
  }
  return { ok: true, email };
}
