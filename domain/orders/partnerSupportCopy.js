/**
 * Partner-facing copy for Contact Rovaro support.
 * Always "Rovaro support" — never "superadmins". Always Rovaro — never CarsNK.
 */

export const SUPPORT_REASON_CODES = [
  "booking_question",
  "vehicle_unavailable",
  "customer_details",
  "payment_issue",
  "pickup_return_issue",
  "other",
];

const COPY = {
  en: {
    button: "Contact Rovaro support",
    title: "Contact Rovaro support",
    intro:
      "Send a message about this booking. The booking details will be attached automatically.",
    reasonLabel: "Reason (optional)",
    reasons: {
      booking_question: "Question about booking",
      vehicle_unavailable: "Vehicle unavailable",
      customer_details: "Customer details",
      payment_issue: "Payment issue",
      pickup_return_issue: "Pickup or return issue",
      other: "Other",
    },
    messagePlaceholder: "Your message…",
    send: "Send message",
    cancel: "Cancel",
    success: "Your message has been sent to Rovaro support.",
    backToBookings: "Back to bookings",
    brand: "Rovaro",
    pageTitle: "Contact Rovaro support",
    invalidLink: "Link invalid",
    notSent: "Message not sent",
  },
  es: {
    button: "Contactar con soporte de Rovaro",
    title: "Contactar con soporte de Rovaro",
    intro:
      "Envía un mensaje sobre esta reserva. Los datos de la reserva se adjuntarán automáticamente.",
    reasonLabel: "Motivo (opcional)",
    reasons: {
      booking_question: "Pregunta sobre la reserva",
      vehicle_unavailable: "Vehículo no disponible",
      customer_details: "Datos del cliente",
      payment_issue: "Problema de pago",
      pickup_return_issue: "Problema de recogida o devolución",
      other: "Otro",
    },
    messagePlaceholder: "Tu mensaje…",
    send: "Enviar mensaje",
    cancel: "Cancelar",
    success: "Tu mensaje se ha enviado a soporte de Rovaro.",
    backToBookings: "Volver a las reservas",
    brand: "Rovaro",
    pageTitle: "Contactar con soporte de Rovaro",
    invalidLink: "Enlace no válido",
    notSent: "Mensaje no enviado",
  },
};

export function normalizeSupportLocale(locale) {
  const lang = String(locale || "en").slice(0, 2).toLowerCase();
  return COPY[lang] ? lang : "en";
}

export function getPartnerSupportCopy(locale) {
  return COPY[normalizeSupportLocale(locale)];
}

export function supportReasonLabel(reason, locale) {
  const copy = getPartnerSupportCopy(locale);
  return copy.reasons[reason] || copy.reasons.other;
}
