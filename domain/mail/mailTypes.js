export const MAIL_STATUS = {
  SENT: "sent",
  FAILED: "failed",
  /** EMAIL_TESTING dry-run: rendered + logged, no SMTP */
  SKIPPED: "skipped",
};

export const MAIL_TYPE = {
  ORDER_CUSTOMER: "order.customer",
  ORDER_COMPANY: "order.company",
  ORDER_SUPERADMIN: "order.superadmin",
  ORDER_OFFICIAL: "order.official_confirmation",
  ORDER_PAYMENT: "order.payment_link",
  ORDER_PAYMENT_EXPIRED: "order.payment_link_expired",
  ORDER_PAYMENT_LINK_UNAVAILABLE: "order.payment_link_unavailable",
  ORDER_PAYMENT_REISSUED: "order.payment_link_reissued",
  ORDER_DECLINED: "order.declined",
  ORDER_PAID_CUSTOMER: "order.paid_customer",
  ORDER_PAID_PARTNER: "order.paid_partner",
  ORDER_BOOKING_FEE_REFUNDED: "order.booking_fee_refunded",
  ORDER_PRICE_CORRECTED_CUSTOMER: "order.price_corrected_customer",
  ORDER_PRICE_CORRECTED_PARTNER: "order.price_corrected_partner",
  ORDER_COMPANY_ACTION: "order.company_action",
  ORDER_PARTNER_SUPPORT: "order.partner_support",
  ORDER_ALTERNATIVE_OFFERED: "order.alternative_offered",
  ORDER_ALTERNATIVE_ACCEPTED: "order.alternative_accepted",
  ORDER_ALTERNATIVE_DECLINED: "order.alternative_declined",
  ORDER_ALTERNATIVE_EXPIRED: "order.alternative_expired",
  ORDER_ALTERNATIVE_WITHDRAWN: "order.alternative_withdrawn",
  TRANSFER: "transfer",
  TRANSFER_PAYMENT: "transfer.payment_link",
  VOUCHER: "voucher",
  CONTACT: "contact",
  PASSWORD_RESET: "password_reset",
  ADMIN_INVITE: "admin_invite",
  TEST: "test",
  RELAY: "relay",
  GENERIC: "generic",
  /** Platform notification matrix (company/superadmin ops). */
  PLATFORM_NOTIFICATION: "platform.notification",
};

export const MAIL_RENDER_KEY = {
  CUSTOMER_ORDER_CONFIRMATION: "customerOrderConfirmation",
  CUSTOMER_OFFICIAL_CONFIRMATION: "customerOfficialConfirmation",
  ADMIN_ORDER_NOTIFICATION: "adminOrderNotification",
  CUSTOMER_PAYMENT_REQUEST: "customerPaymentRequest",
  CUSTOMER_PAYMENT_EXPIRED: "customerPaymentExpired",
  CUSTOMER_PAYMENT_LINK_UNAVAILABLE: "customerPaymentLinkUnavailable",
  CUSTOMER_PAYMENT_REISSUED: "customerPaymentReissued",
  CUSTOMER_BOOKING_DECLINED: "customerBookingDeclined",
  CUSTOMER_PAYMENT_RECEIVED: "customerPaymentReceived",
  PARTNER_PAYMENT_RECEIVED: "partnerPaymentReceived",
  CUSTOMER_BOOKING_FEE_REFUNDED: "customerBookingFeeRefunded",
  CUSTOMER_PRICE_CORRECTED: "customerPriceCorrected",
  PARTNER_PRICE_CORRECTED: "partnerPriceCorrected",
  ALTERNATIVE_OFFERED: "alternativeOffered",
  ALTERNATIVE_ACCEPTED: "alternativeAccepted",
  ALTERNATIVE_DECLINED: "alternativeDeclined",
  ALTERNATIVE_EXPIRED: "alternativeExpired",
  ALTERNATIVE_WITHDRAWN: "alternativeWithdrawn",
  ALTERNATIVE_PAYMENT_LINK: "alternativePaymentLink",
};

export const MAIL_TYPES = Object.values(MAIL_TYPE);
export const MAIL_STATUSES = Object.values(MAIL_STATUS);
export const MAIL_RENDER_KEYS = Object.values(MAIL_RENDER_KEY);
