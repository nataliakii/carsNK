/**
 * Build signed CTA links for company order notification emails.
 */

import { absoluteUrl } from "@config/domain";
import { signCompanyEmailActionToken } from "./companyEmailActionToken";

/**
 * @param {string} orderId
 * @param {string} [locale]
 * @returns {Array<{ label: string, href: string, variant?: string }>}
 */
export function buildCompanyEmailOrderActions(orderId, locale = "en") {
  const id = String(orderId || "").trim();
  if (!id) return [];

  const labels = getActionLabels(locale);
  const actionUrl = (action) => {
    const token = signCompanyEmailActionToken({ orderId: id, action });
    return absoluteUrl(
      `/api/order/company-email-action?token=${encodeURIComponent(token)}`
    );
  };

  return [
    { label: labels.accept, href: actionUrl("accept"), variant: "primary" },
    { label: labels.reject, href: actionUrl("reject"), variant: "danger" },
    {
      label: labels.calendar,
      href: absoluteUrl("/admin"),
      variant: "secondary",
    },
    {
      label: labels.message,
      href: actionUrl("message"),
      variant: "outline",
    },
  ];
}

function getActionLabels(locale) {
  const lang = String(locale || "en").slice(0, 2).toLowerCase();
  const map = {
    en: {
      accept: "Accept",
      reject: "Reject",
      calendar: "View calendar",
      message: "Message superadmins",
    },
    ru: {
      accept: "Принять",
      reject: "Отклонить",
      calendar: "Календарь",
      message: "Написать суперадминам",
    },
    uk: {
      accept: "Прийняти",
      reject: "Відхилити",
      calendar: "Календар",
      message: "Написати суперадмінам",
    },
    el: {
      accept: "Αποδοχή",
      reject: "Απόρριψη",
      calendar: "Ημερολόγιο",
      message: "Μήνυμα σε superadmin",
    },
    de: {
      accept: "Annehmen",
      reject: "Ablehnen",
      calendar: "Kalender",
      message: "Superadmins schreiben",
    },
  };
  return map[lang] || map.en;
}
