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

const AuditLog =
  mongoose.models?.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;

