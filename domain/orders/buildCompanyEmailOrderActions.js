/**
 * Build signed CTA links for company order notification emails.
 */

import { absoluteUrl } from "@config/domain";
import { signCompanyEmailActionToken } from "./companyEmailActionToken";
import { getPartnerSupportCopy, normalizeSupportLocale } from "./partnerSupportCopy";

/**
 * @param {string} orderId
 * @param {string} [locale]
 * @param {{ confirmToken?: string }} [options]
 *   confirmToken — one-time partner-confirm token. Accept/decline must use
 *   this so the link actually records availability. Without it, only the
 *   support-message action is included (never a fake accept that does nothing).
 * @returns {Array<{ label: string, href: string, variant?: string }>}
 */
export function buildCompanyEmailOrderActions(orderId, locale = "en", options = {}) {
  const id = String(orderId || "").trim();
  if (!id) return [];

  const lang = normalizeSupportLocale(locale);
  const labels = getActionLabels(lang);
  const messageUrl = () => {
    const token = signCompanyEmailActionToken({ orderId: id, action: "message" });
    return absoluteUrl(
      `/api/order/company-email-action?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`
    );
  };

  const actions = [];
  const confirmToken = String(options.confirmToken || "").trim();
  if (confirmToken) {
    const confirmHref = absoluteUrl(
      `/api/booking/partner-confirm?token=${encodeURIComponent(confirmToken)}`
    );
    actions.push({
      label: labels.confirmAvailability,
      href: confirmHref,
      variant: "primary",
    });
    actions.push({
      label: labels.cannotProvide,
      href: confirmHref,
      variant: "danger",
    });
  }

  actions.push({
    label: labels.message,
    href: messageUrl(),
    variant: "outline",
  });

  return actions;
}

function getActionLabels(locale) {
  const lang = String(locale || "en").slice(0, 2).toLowerCase();
  const support = getPartnerSupportCopy(lang);
  const map = {
    en: {
      confirmAvailability: "Confirm availability",
      cannotProvide: "Cannot provide this vehicle",
      message: support.button,
    },
    es: {
      confirmAvailability: "Confirmar disponibilidad",
      cannotProvide: "No puedo facilitar este vehículo",
      message: support.button,
    },
    ru: {
      confirmAvailability: "Подтвердить наличие",
      cannotProvide: "Не могу предоставить этот автомобиль",
      message: support.button,
    },
    uk: {
      confirmAvailability: "Підтвердити наявність",
      cannotProvide: "Не можу надати цей автомобіль",
      message: support.button,
    },
    el: {
      confirmAvailability: "Επιβεβαίωση διαθεσιμότητας",
      cannotProvide: "Δεν μπορώ να διαθέσω αυτό το όχημα",
      message: support.button,
    },
    de: {
      confirmAvailability: "Verfügbarkeit bestätigen",
      cannotProvide: "Fahrzeug kann nicht gestellt werden",
      message: support.button,
    },
  };
  return map[lang] || map.en;
}
