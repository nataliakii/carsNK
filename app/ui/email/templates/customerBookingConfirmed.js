/**
 * CUSTOMER_BOOKING_CONFIRMED
 * Customer-facing paid booking email. No admin URLs, Stripe ids, or internal enums.
 */

import { absoluteUrl } from "@config/domain";
import {
  escapeHtml,
  getEmailStyle,
  renderEmailButton,
} from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { renderRovaroBrandedEmail } from "@/app/ui/email/templates/rovaroBrandedEmail";

export const CUSTOMER_BOOKING_CONFIRMED = "CUSTOMER_BOOKING_CONFIRMED";

function row(label, value) {
  if (value == null || String(value).trim() === "") return null;
  return [label, String(value)];
}

/**
 * @param {{
 *   vehicleName: string,
 *   shortDateRange: string,
 *   pickupWhen: string,
 *   returnWhen: string,
 *   pickupLocation: string,
 *   returnLocation: string,
 *   total: string,
 *   bookingFee: string,
 *   supplierBalance: string,
 *   supplierName: string,
 *   supplierPhone: string,
 *   supplierEmail: string,
 *   collectionInstructions: string,
 *   publicReference: string,
 *   detailsUrl: string,
 * }} data
 */
export function renderCustomerBookingConfirmedEmail(data) {
  const s = getEmailStyle("rovaro");
  const subject = `Booking confirmed — ${data.vehicleName}, ${data.shortDateRange}`;
  const heading = "Your booking is confirmed";
  const intro = `We have received your ${data.bookingFee} Rovaro Booking Fee.`;
  const rows = [
    row("Vehicle", data.vehicleName),
    row("Pickup", data.pickupWhen),
    row("Return", data.returnWhen),
    row("Pickup location", data.pickupLocation),
    row("Return location", data.returnLocation),
    row("Total rental price", data.total),
    row("Paid to Rovaro", data.bookingFee),
    row("Pay to the rental company", data.supplierBalance),
    row("Rental company", data.supplierName),
    row("Phone", data.supplierPhone),
    row("Email", data.supplierEmail),
    row("Collection", data.collectionInstructions),
  ].filter(Boolean);

  const extraHtml = `<p style="margin:24px 0 0 0;color:${s.text};font-size:15px;line-height:1.6;font-family:${s.fontSans};">The rental company can now review your driving documents and contact you regarding collection.</p>
<p style="margin:28px 0 0 0;color:${s.muted};font-size:13px;font-family:${s.fontSans};">Booking reference: ${escapeHtml(data.publicReference)}</p>`;

  const html = renderRovaroBrandedEmail({
    title: heading,
    introHtml: `<p style="margin:0 0 16px 0;">${escapeHtml(intro)}</p>`,
    rows,
    cta: { href: data.detailsUrl, label: "View booking details" },
    extraHtml,
  });

  const text = [
    subject,
    "",
    heading,
    intro,
    `Vehicle: ${data.vehicleName}`,
    `Pickup: ${data.pickupWhen}`,
    `Return: ${data.returnWhen}`,
    `Pickup location: ${data.pickupLocation}`,
    `Return location: ${data.returnLocation}`,
    `Total rental price: ${data.total}`,
    `Paid to Rovaro: ${data.bookingFee}`,
    `Pay to the rental company: ${data.supplierBalance}`,
    `Rental company: ${data.supplierName}`,
    data.supplierPhone ? `Phone: ${data.supplierPhone}` : null,
    data.supplierEmail ? `Email: ${data.supplierEmail}` : null,
    data.collectionInstructions ? `Collection: ${data.collectionInstructions}` : null,
    "",
    "The rental company can now review your driving documents and contact you regarding collection.",
    "",
    "View booking details",
    data.detailsUrl,
    "",
    `Booking reference: ${data.publicReference}`,
  ]
    .filter((line) => line != null)
    .join("\n");

  return {
    template: CUSTOMER_BOOKING_CONFIRMED,
    subject,
    heading,
    html,
    text,
    buttonLabel: "View booking details",
  };
}

export function customerBookingDetailsUrl({ locale, publicReference, accessToken }) {
  const lang = String(locale || "en").split("-")[0] || "en";
  const params = new URLSearchParams();
  params.set("access", String(accessToken || ""));
  return absoluteUrl(
    `/${lang}/booking/${encodeURIComponent(String(publicReference || ""))}?${params.toString()}`
  );
}

export { renderEmailButton };
