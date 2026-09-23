import {
  parseOptionalCustomerEmail,
  parseRequiredCustomerEmail,
} from "./customerEmail";
import { parseCustomerPhone } from "./customerPhone";

function trimField(raw) {
  return typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
}

/**
 * Customer contact rules for creating or saving an order.
 * Offline (admin stub / not via website): name and phone are never required,
 * phone format is not checked, email may be empty but must be valid if filled.
 * Online: phone must be a valid international number; email is required.
 *
 * @param {{ offline?: boolean, email?: unknown, phone?: unknown, customerName?: unknown, requirePhone?: boolean }} input
 * @returns {{
 *   ok: true,
 *   customerName: string,
 *   phone: string,
 *   email: string,
 * } | {
 *   ok: false,
 *   field: "phone"|"email",
 *   code: string,
 *   message: string,
 *   messageKey: string,
 * }}
 */
export function parseOrderCustomerContact({
  offline = false,
  email,
  phone,
  customerName,
  requirePhone,
} = {}) {
  const isOffline = Boolean(offline);
  const phoneRequired =
    requirePhone !== undefined ? Boolean(requirePhone) : !isOffline;
  const phoneResult = parseCustomerPhone(phone, {
    required: phoneRequired,
    skipFormat: isOffline,
  });
  if (!phoneResult.ok) {
    return { ok: false, field: "phone", ...phoneResult };
  }

  const emailResult = isOffline
    ? parseOptionalCustomerEmail(email)
    : parseRequiredCustomerEmail(email);
  if (!emailResult.ok) {
    return { ok: false, field: "email", ...emailResult };
  }

  return {
    ok: true,
    customerName: trimField(customerName),
    phone: phoneResult.phone,
    email: emailResult.email,
  };
}
