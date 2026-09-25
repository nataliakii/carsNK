/**
 * Compact supplier new-booking email. The CTA is a button; the admin URL
 * is not printed as visible text.
 */

import { renderRovaroBrandedEmail } from "@/app/ui/email/templates/rovaroBrandedEmail";
import {
  escapeHtml,
  getEmailStyle,
} from "@/app/ui/email/theme/nataliCarsEmailTheme";

export function renderSupplierNewBookingEmailHtml({
  heading,
  intro,
  rows = [],
  notice,
  ctaLabel,
  ctaHref,
  prompt,
  orderNumber,
}) {
  const s = getEmailStyle("rovaro");
  const paragraph = (text, margin) =>
    `<p style="margin:${margin};color:${s.text};font-size:15px;line-height:1.55;font-family:${s.fontSans};">${escapeHtml(text)}</p>`;
  const beforeCtaHtml = notice
    ? `<p style="margin:20px 0 0;color:${s.text};font-size:14px;line-height:1.55;font-family:${s.fontSans};">${escapeHtml(notice)}</p>`
    : "";
  const extraHtml = [
    prompt
      ? `<p style="margin:16px 0 0;color:${s.muted};font-size:14px;line-height:1.5;font-family:${s.fontSans};">${escapeHtml(prompt)}</p>`
      : "",
    orderNumber
      ? `<p style="margin:20px 0 0;color:${s.muted};font-size:13px;line-height:1.5;font-family:${s.fontSans};">Booking #${escapeHtml(orderNumber)}</p>`
      : "",
  ].join("");

  return renderRovaroBrandedEmail({
    title: heading,
    introHtml: paragraph(intro, "0"),
    rows,
    beforeCtaHtml,
    cta: ctaHref && ctaLabel ? { href: ctaHref, label: ctaLabel } : null,
    extraHtml,
  });
}
