/**
 * SUPERADMIN_BOOKING_PAYMENT_RECEIVED
 * Technical payment record for platform operators. One admin button.
 * The admin URL is not printed as visible text.
 */

import { escapeHtml, getEmailStyle } from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { renderRovaroBrandedEmail } from "@/app/ui/email/templates/rovaroBrandedEmail";
import { bookingAdminUrl } from "@/domain/mail/notificationCopy";

export const SUPERADMIN_BOOKING_PAYMENT_RECEIVED =
  "SUPERADMIN_BOOKING_PAYMENT_RECEIVED";

function row(label, value) {
  if (value == null || String(value).trim() === "") return null;
  return [label, String(value)];
}

export function renderSuperadminBookingPaymentReceivedEmail(data) {
  const s = getEmailStyle("rovaro");
  const subject = `Booking payment received — ${data.publicReference}`;
  const href = bookingAdminUrl(data.orderId);
  const feeRate =
    data.feePercent == null || data.feePercent === ""
      ? "—"
      : `${data.feePercent}%`;
  const rows = [
    row("Booking reference", data.publicReference),
    row("Internal order ID", data.orderId),
    row("Company", data.companyName),
    row("Total rental price", data.total),
    row("Booking Fee", data.bookingFee),
    row("Booking Fee rate", feeRate),
    row("Remaining supplier balance", data.supplierBalance),
    row("Stripe reference", data.stripeRef),
    row("Status", data.status),
  ].filter(Boolean);

  const html = renderRovaroBrandedEmail({
    title: "Booking payment received",
    introHtml: `<p style="margin:0 0 16px 0;color:${s.text};font-family:${s.fontSans};">${escapeHtml(
      "A Rovaro Booking Fee has been received."
    )}</p>`,
    rows,
    cta: { href, label: "Open booking" },
  });

  const text = [
    subject,
    "",
    "A Rovaro Booking Fee has been received.",
    `Booking reference: ${data.publicReference}`,
    `Internal order ID: ${data.orderId}`,
    `Company: ${data.companyName}`,
    `Total rental price: ${data.total}`,
    `Booking Fee: ${data.bookingFee}`,
    `Booking Fee rate: ${feeRate}`,
    `Remaining supplier balance: ${data.supplierBalance}`,
    `Stripe reference: ${data.stripeRef || "—"}`,
    `Status: ${data.status || ""}`,
    "",
    "Open booking",
    href,
  ].join("\n");

  return {
    template: SUPERADMIN_BOOKING_PAYMENT_RECEIVED,
    subject,
    html,
    text,
    href,
    buttonLabel: "Open booking",
  };
}
