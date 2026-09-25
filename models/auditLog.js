/**
 * Audit Log Model
 *
 * Модель для логирования критических действий в системе.
 * Особенно важно для суперадмин-действий.
 */

import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // Тип действия
    action: {
      type: String,
      required: true,
      enum: [
        "FORCE_CREATE_ORDER",
        "FORCE_UPDATE_ORDER",
        "DELETE_CONFIRMED_ORDER",
        "OVERRIDE_CONFLICT",
        "CHANGE_ORDER_STATUS",
        "ADMIN_LOGIN",
        "SUPERADMIN_ACTION",
        "TRANSFER_PRICE_OVERRIDE",
        "TRANSFER_MANUAL_ASSIGN",
        "TRANSFER_REOPEN",
        "TRANSFER_PAYOUT_OVERRIDE",
        // Legal / compliance workstream
        "LEGAL_DOCUMENT_SEEDED",
        "LEGAL_DOCUMENT_PUBLISHED",
        "LEGAL_DOCUMENT_ARCHIVED",
        "LEGAL_DOCUMENT_VERSION_CREATED",
        "LEGAL_SETTINGS_UPDATED",
        "PARTNER_PROFILE_UPDATED",
        "PARTNER_VERIFICATION_CHANGED",
        "PARTNER_DOCUMENT_UPLOADED",
        "PARTNER_DOCUMENT_DELETED",
        "PARTNER_DOCUMENT_ACCESSED",
        "PARTNER_AGREEMENT_VIEWED",
        "PARTNER_AGREEMENT_ACCEPTED",
        "PARTNER_AGREEMENT_SNAPSHOT_ACCESSED",
        "PARTNER_AGREEMENT_TERMINATED",
        "PARTNER_SUPPORT_MESSAGE_SENT",
        "BOOKING_CONFIRMATION_PAGE_VIEWED",
        "BOOKING_PARTNER_CONFIRMED",
        "BOOKING_PARTNER_DECLINED",
        "BOOKING_CONFIRMATION_TOKEN_REPLAY",
        "BOOKING_SNAPSHOT_CREATED",
        "BOOKING_OWNER_MISSING",
        "BOOKING_HOLD_CONFLICT",
        "RENTAL_PREPAYMENT_RECEIVED",
        "RENTAL_CHECKOUT_FAILED",
        "RENTAL_PAYMENT_MISMATCH",
        "RENTAL_PAYMENT_EXPIRED",
        "RENTAL_CHECKOUT_INVALIDATED",
        "RENTAL_CHECKOUT_INVALIDATE_FAILED",
        "RENTAL_ALTERNATIVE_CHECKOUT_INVALIDATED",
        "RENTAL_CHECKOUT_INVALIDATE_RETRY",
        "RENTAL_PAYMENT_FAILED",
        "RENTAL_REFUND_RECORDED",
        "RENTAL_BOOKING_FEE_REFUND_REQUESTED",
        "RENTAL_DISPUTE_CREATED",
        "RENTAL_DISPUTE_RESOLVED",
        "ALTERNATIVE_OFFER_CREATED",
        "ALTERNATIVE_OFFER_ACCEPTED",
        "ALTERNATIVE_OFFER_DECLINED",
        "ALTERNATIVE_OFFER_EXPIRED",
        "ALTERNATIVE_OFFER_WITHDRAWN",
        "ALTERNATIVE_OFFER_REJECTED",
        "ALTERNATIVE_OFFER_AVAILABILITY_FAILED",
        "ALTERNATIVE_HOLD_ACQUIRED",
        "ALTERNATIVE_HOLD_RELEASED",
        "ALTERNATIVE_TERMS_REACCEPTED",
        "ALTERNATIVE_CHECKOUT_FAILED",
        "ALTERNATIVE_STALE_STRIPE",
        "RENTAL_PAYMENT_STALE_SESSION",
        "DRIVING_LICENCE_ACCESSED",
        "DRIVING_LICENCE_DELETED",
        "DRIVING_LICENCE_DELETION_FAILED",
        "DATA_SUBJECT_REQUEST",
        "PARTNER_COMPLIANCE_BLOCKED",
        "PARTNER_COMPLIANCE_OVERRIDE",
        "RENTAL_PAYMENT_LINK_REISSUED",
        "RENTAL_PAYMENT_EMAIL_RESENT",
        "COMPANY_OFFICE_CREATED",
        "COMPANY_OFFICE_UPDATED",
        "COMPANY_OFFICE_ARCHIVED",
        "COMPANY_DELIVERY_PRICING_UPDATED",
        "MARKETPLACE_BOOKING_FEE_CHANGED",
        "MARKETPLACE_PRICE_CORRECTED_AFTER_PAYMENT",
        "ORDER_CALENDAR_RELOCATED",
        // Company admin account management (superadmin only)
        "COMPANY_ADMIN_INVITED",
        "COMPANY_ADMIN_INVITE_RESENT",
        "COMPANY_ADMIN_EMAIL_CHANGED",
        "COMPANY_ADMIN_PASSWORD_RESET_SENT",
        "COMPANY_ADMIN_ACCESS_DISABLED",
        "COMPANY_ADMIN_ACCESS_ENABLED",
        "COMPANY_ADMIN_REMOVED",
        "OTHER",
      ],
      index: true,
    },

    // Кто выполнил действие
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // Роль пользователя
    userRole: {
      type: String,
      enum: ["admin", "superadmin", "system"],
      default: "admin",
    },

    // Email пользователя (для быстрого поиска)
    userEmail: {
      type: String,
      index: true,
    },

    // Данные о заказе (если применимо)
    orderData: {
      orderId: mongoose.Schema.Types.ObjectId,
      orderNumber: String,
      carNumber: String,
      carModel: String,
      rentalStartDate: Date,
      rentalEndDate: Date,
      customerName: String,
      customerPhone: String,
      totalPrice: Number,
    },

    // Переопределённые конфликты (для FORCE_CREATE)
    overriddenConflicts: [
      {
        orderId: mongoose.Schema.Types.ObjectId,
        customerName: String,
        phone: String,
        ownership: {
          type: String,
          enum: ["business", "internal"],
        },
        confirmation: {
          type: String,
          enum: ["confirmed", "pending"],
        },
        conflictDate: String,
        rentalStartDate: Date,
        rentalEndDate: Date,
      },
    ],

    // Сводка (для FORCE_CREATE)
    summary: {
      confirmedBusinessConflicts: Number,
      confirmedInternalConflicts: Number,
      pendingBusinessConflicts: Number,
      pendingInternalConflicts: Number,
      totalConflicts: Number,
    },

    // Причина действия (опционально)
    reason: {
      type: String,
      maxlength: 1000,
    },

    // Уровень серьёзности
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },

    // IP адрес
    ipAddress: String,

    // User Agent
    userAgent: String,

    // Дополнительные данные
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Результат действия
    result: {
      type: String,
      enum: ["success", "failure", "partial"],
      default: "success",
    },

    // Сообщение об ошибке (если failure)
    errorMessage: String,
  },
  {
    timestamps: true,
    collection: "audit_logs",
  }
);

// Индексы для быстрого поиска
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

// Статический метод: Создать запись аудита для FORCE_CREATE
auditLogSchema.statics.logForceCreate = async function ({
  userId,
  userEmail,
  orderData,
  overriddenConflicts,
  summary,
  reason,
  ipAddress,
  userAgent,
}) {
  return this.create({
    action: "FORCE_CREATE_ORDER",
    userId,
    userRole: "superadmin",
    userEmail,
    orderData,
    overriddenConflicts,
    summary,
    reason,
    severity: "high",
    ipAddress,
    userAgent,
    result: "success",
  });
};

// Статический метод: Получить логи за период
auditLogSchema.statics.getLogsByPeriod = async function (
  startDate,
  endDate,
  options = {}
) {
  const query = {
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  if (options.action) {
    query.action = options.action;
  }

  if (options.severity) {
    query.severity = options.severity;
  }

  if (options.userId) {
    query.userId = options.userId;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 100);
};

// Статический метод: Получить высокоприоритетные логи
auditLogSchema.statics.getHighSeverityLogs = async function (limit = 50) {
  return this.find({ severity: { $in: ["high", "critical"] } })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Виртуальное поле: форматированное описание
auditLogSchema.virtual("description").get(function () {
  const actionDescriptions = {
    FORCE_CREATE_ORDER: "Принудительное создание заказа с конфликтами",
    FORCE_UPDATE_ORDER: "Принудительное обновление заказа",
    DELETE_CONFIRMED_ORDER: "Удаление подтверждённого заказа",
    OVERRIDE_CONFLICT: "Переопределение конфликта",
    CHANGE_ORDER_STATUS: "Изменение статуса заказа",
    ORDER_CALENDAR_RELOCATED: "Перемещение оплаченного заказа на календаре",
    ADMIN_LOGIN: "Вход администратора",
    SUPERADMIN_ACTION: "Действие суперадмина",
    OTHER: "Другое действие",
  };

  return actionDescriptions[this.action] || this.action;
});

// Метод экземпляра: форматировать для вывода
auditLogSchema.methods.toLogString = function () {
  const lines = [
    `[${this.createdAt.toISOString()}] ${this.action}`,
    `  User: ${this.userEmail || this.userId}`,
    `  Severity: ${this.severity}`,
    `  Result: ${this.result}`,
  ];

  if (this.orderData?.orderNumber) {
    lines.push(`  Order: ${this.orderData.orderNumber}`);
  }

  if (this.overriddenConflicts?.length > 0) {
    lines.push(`  Conflicts overridden: ${this.overriddenConflicts.length}`);
  }

  if (this.reason) {
    lines.push(`  Reason: ${this.reason}`);
  }

  return lines.join("\n");
};

if (mongoose.models?.AuditLog) {
  const cached = mongoose.models.AuditLog.schema.path("action");
  const values = cached?.enumValues || cached?.options?.enum || [];
  if (
    !values.includes("MARKETPLACE_BOOKING_FEE_CHANGED") ||
    !values.includes("MARKETPLACE_PRICE_CORRECTED_AFTER_PAYMENT") ||
    !values.includes("COMPANY_ADMIN_EMAIL_CHANGED")
  ) {
    delete mongoose.models.AuditLog;
    delete mongoose.connection.models.AuditLog;
  }
}

const AuditLog =
  mongoose.models?.AuditLog || mongoose.model("AuditLog", auditLogSchema);

// HMR/cache safety if the model was already compiled without new enum values.
if (AuditLog?.schema?.path("action")) {
  const path = AuditLog.schema.path("action");
  const required = [
    "MARKETPLACE_BOOKING_FEE_CHANGED",
    "MARKETPLACE_PRICE_CORRECTED_AFTER_PAYMENT",
    "COMPANY_DELIVERY_PRICING_UPDATED",
    "RENTAL_BOOKING_FEE_REFUND_REQUESTED",
    "COMPANY_ADMIN_INVITED",
    "COMPANY_ADMIN_INVITE_RESENT",
    "COMPANY_ADMIN_EMAIL_CHANGED",
    "COMPANY_ADMIN_PASSWORD_RESET_SENT",
    "COMPANY_ADMIN_ACCESS_DISABLED",
    "COMPANY_ADMIN_ACCESS_ENABLED",
    "COMPANY_ADMIN_REMOVED",
  ];
  const current = Array.isArray(path.enumValues)
    ? path.enumValues
    : Array.isArray(path.options?.enum)
      ? path.options.enum
      : [];
  for (const value of required) {
    if (!current.includes(value)) current.push(value);
  }
  path.enumValues = current;
  if (path.options) path.options.enum = current;
}

export default AuditLog;

