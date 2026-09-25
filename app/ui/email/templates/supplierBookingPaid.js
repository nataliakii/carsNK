/**
 * SUPPLIER_BOOKING_PAID
 * Tells the rental company the Booking Fee is paid. One admin-order button.
 * Never includes the customer's public access token.
 */

import { escapeHtml, getEmailStyle } from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { renderRovaroBrandedEmail } from "@/app/ui/email/templates/rovaroBrandedEmail";
import { bookingAdminUrl } from "@/domain/mail/notificationCopy";

export const SUPPLIER_BOOKING_PAID = "SUPPLIER_BOOKING_PAID";

function row(label, value) {
  if (value == null || String(value).trim() === "") return null;
  return [label, String(value)];
}

export function supplierOrderUrl(orderId) {
  return bookingAdminUrl(orderId);
}

/**
 * @param {{
 *   publicReference: string,
 *   vehicleName: string,
 *   when: string,
 *   customerName: string,
 *   customerPhone: string,
 *   customerEmail: string,
 *   supplierBalance: string,
 *   orderId: string,
 * }} data
 */
export function renderSupplierBookingPaidEmail(data) {
  const s = getEmailStyle("rovaro");
  const subject = "Booking confirmed — customer payment received";
  const href = supplierOrderUrl(data.orderId);
  const intro =
    "The customer has paid the Rovaro Booking Fee. This booking is confirmed. Full customer contacts and driving documents are now available. Collect the remaining amount from the customer.";
  const rows = [
    row("Booking reference", data.publicReference),
    row("Vehicle", data.vehicleName),
    row("Dates", data.when),
    row("Total rental price", data.total),
    row("Customer", data.customerName),
    row("Phone", data.customerPhone),
    row("Email", data.customerEmail),
    row("Collect from the customer", data.supplierBalance),
  ].filter(Boolean);

  const html = renderRovaroBrandedEmail({
    title: subject,
    introHtml: `<p style="margin:0 0 16px 0;color:${s.text};font-family:${s.fontSans};">${escapeHtml(intro)}</p>`,
    rows,
    cta: { href, label: "Open confirmed booking" },
  });

  const text = [
    subject,
    "",
    intro,
    `Booking reference: ${data.publicReference}`,
    `Vehicle: ${data.vehicleName}`,
    `Dates: ${data.when}`,
    data.total ? `Total rental price: ${data.total}` : null,
    `Customer: ${data.customerName}`,
    `Phone: ${data.customerPhone}`,
    `Email: ${data.customerEmail}`,
    `Collect from the customer: ${data.supplierBalance}`,
    "",
    "Open confirmed booking",
    href,
  ]
    .filter((line) => line != null)
    .join("\n");

  return {
    template: SUPPLIER_BOOKING_PAID,
    subject,
    html,
    text,
    href,
    buttonLabel: "Open confirmed booking",
  };
}
