/**
 * orderNotificationDispatcher.js
 * 
 * ════════════════════════════════════════════════════════════════
 * ЕДИНАЯ ТОЧКА ОТПРАВКИ УВЕДОМЛЕНИЙ
 * ════════════════════════════════════════════════════════════════
 * 
 * 🔑 КЛЮЧЕВОЙ ПРИНЦИП:
 * UI и backend НЕ отправляют уведомления напрямую.
 * Они вызывают notifyOrderAction() — и всё.
 * 
 * 🧭 Схема:
 * notifyOrderAction()
 *     ↓
 * getOrderAccess()        ← ЕДИНАЯ логика прав
 *     ↓
 * isActionAllowedByAccess() ← 🛑 SAFETY CHECK
 *     ↓
 * getOrderNotifications() ← декларативно
 *     ↓
 * sanitizePayload()       ← PII firewall
 *     ↓
 * auditLog()              ← compliance
 *     ↓
 * dispatchOrderNotifications()
 */

import { 
  getOrderNotifications, 
  getActionIntent, 
  isActionAllowedByAccess,
  getPriorityByIntent,
} from "./orderNotificationPolicy";
import { getOrderAccess } from "./orderAccessPolicy";
import { getTimeBucket } from "@/domain/time/athensTime";
import { ROLE } from "./admin-rbac";
import { DEVELOPER_EMAIL } from "@config/email";
import { COMPANY_ID } from "@config/company";
import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { renderCustomerOrderConfirmationEmail, renderAdminOrderNotificationEmail } from "@/app/ui/email/renderEmail";
import { pickCustomerEmailLocale, normalizeEmailLocale } from "@locales/customerEmail";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import {
  normalizeNotifyLocale,
  resolveNotifyLanguagesFromCompanyDoc,
  translateAdminReason,
  formatAdminNotificationBody,
  formatSuperadminClientContextFooter,
  formatCompanyEmailClientLocaleFooter,
} from "./adminNotifyLocales";
import {
  withTestOrderEmailSubject,
  withTestOrderTelegramMessage,
} from "./testOrderMarkers";

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

/**
 * @typedef {"UI" | "BACKEND" | "CRON" | "SYSTEM"} NotificationSource
 */

/**
 * @typedef {Object} NotificationPayload
 * @property {string} orderId - Order ID
 * @property {string} [orderNumber] - Order number for display
 * @property {string} [regNumber] - Car registration number (preferred)
 * @property {string} [carNumber] - Legacy internal car number (fallback)
 * @property {string} [carModel] - Car model name
 * @property {Date|string} [rentalStartDate] - Rental start
 * @property {Date|string} [rentalEndDate] - Rental end
 * @property {Date|string} [timeIn] - Время выдачи (ISO); в теле нового заказа показывается в скобках после даты «С / From»
 * @property {Date|string} [timeOut] - Время возврата (ISO); в скобках после даты «По / To»
 * @property {number} [totalPrice] - Total price
 * @property {string} [customerName] - Customer name (if PII allowed)
 * @property {string} [phone] - Customer phone (if PII allowed)
 * @property {string} [email] - Customer email (if PII allowed)
 * @property {boolean} [secondDriver] - Second driver selected
 * @property {boolean} [Viber] - Prefer Viber contact
 * @property {boolean} [Whatsapp] - Prefer Whatsapp contact
 * @property {boolean} [Telegram] - Prefer Telegram contact
 * @property {number | null} [oldPrice] - Effective price before update
 * @property {number | null} [newPrice] - Effective price after update
 * @property {string} [insurance] - TPL | CDW; при CDW в теле уведомления о новом заказе добавляется строка про КАСКО/CDW
 * @property {string} action - Action performed
 * @property {string} intent - Action intent (from ACTION_INTENT)
 * @property {string} [actorName] - Who performed the action
 * @property {NotificationSource} source - Where the action originated
 * @property {Date} timestamp - When the action was performed
 * @property {string} [clientLang] - Client UI locale (stored on order)
 * @property {string} [clientIP] - Client IP (только футер SUPERADMIN)
 * @property {string} [clientCountry] - Geo from IP (company email: страна; superadmin: полный футер)
 * @property {string} [clientRegion] - Geo from IP (только футер SUPERADMIN)
 * @property {string} [clientCity] - Geo from IP (только футер SUPERADMIN)
 * @property {boolean} [fromLocalhost] - заказ с localhost → [TEST] в письмах и Telegram
 * @property {string[]} [drivingLicenceUrls] - ссылки Cloudinary на фото прав (если есть)
 * @property {boolean} [hasDrivingLicenceUpload] - есть ли хотя бы одно валидное фото прав
 */

// ════════════════════════════════════════════════════════════════
// PII SANITIZER (ОБЯЗАТЕЛЬНЫЙ)
// ════════════════════════════════════════════════════════════════

/**
 * Список PII полей, которые могут быть в payload.
 */
const PII_FIELDS = ["customerName", "phone", "email", "Viber", "Whatsapp", "Telegram"];
const SENSITIVE_BOOKING_FIELDS = ["drivingLicenceUrls", "hasDrivingLicenceUpload"];

/**
 * Санитайзер payload — гарантирует что PII не утечёт.
 * - SUPERADMIN: всегда с контактами клиента (девелоперу).
 * - CUSTOMER: всегда с контактами (клиент получает свои данные).
 * - COMPANY_EMAIL: никогда не включаем контакты клиента (политика задаёт includePII: false, здесь явно стрипим).
 * - Остальные: по флагу includePII и access.canSeeClientPII.
 *
 * @param {NotificationPayload} payload
 * @param {import("./orderAccessPolicy").OrderAccess} access
 * @param {boolean} includePII - Флаг из notification
 * @param {string} [target] - SUPERADMIN | CUSTOMER | COMPANY_EMAIL | ...
 * @returns {NotificationPayload}
 */
function sanitizePayload(payload, access, includePII, target) {
  if (target === "COMPANY_EMAIL") {
    const sanitized = { ...payload };
    for (const field of [...PII_FIELDS, ...SENSITIVE_BOOKING_FIELDS]) {
      delete sanitized[field];
    }
    return sanitized;
  }

  const allowPII =
    target === "SUPERADMIN" ||
    target === "CUSTOMER" ||
    (includePII && access?.canSeeClientPII);
  if (allowPII) {
    return payload;
  }

  const sanitized = { ...payload };
  for (const field of PII_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

// ════════════════════════════════════════════════════════════════
// AUDIT LOG (compliance-ready)
// ════════════════════════════════════════════════════════════════

/**
 * Audit log hook — логирует ВСЕ действия над заказами.
 * 
 * @param {Object} params
 * @param {Object} params.order
 * @param {Object} params.user
 * @param {string} params.action
 * @param {import("./orderAccessPolicy").OrderAccess} params.access
 * @param {string} params.intent
 * @param {NotificationSource} params.source
 */
async function auditLog({ order, user, action, access, intent, source }) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    orderId: order?._id?.toString?.() || order?._id,
    action,
    intent,
    source,
    actor: {
      email: user?.email,
      role: user?.role,
    },
    access: {
      canEdit: access?.canEdit,
      canDelete: access?.canDelete,
      canSeeClientPII: access?.canSeeClientPII,
    },
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("[AUDIT]", JSON.stringify(logEntry, null, 2));
    return;
  }

  // TODO: Интеграция с внешним audit storage
  // - MongoDB collection (AuditLog)
  // - S3 bucket
  // - External service (Datadog, Sentry, etc.)
  // 
  // Example:
  // await AuditLog.create(logEntry);
}

// ════════════════════════════════════════════════════════════════
// CHANNEL IMPLEMENTATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Локаль текста уведомления по получателю (из Company.langAdmin / langSuperadmin).
 * @param {string} target
 * @param {string} langAdmin
 * @param {string} langSuperadmin
 */
function getNotifyLocaleForTarget(target, langAdmin, langSuperadmin) {
  if (target === "COMPANY_EMAIL") return langAdmin;
  if (target === "SUPERADMIN" || target === "DEVELOPERS") return langSuperadmin;
  return langSuperadmin;
}

function getEffectivePrice(order) {
  if (!order || typeof order !== "object") return null;
  if (
    typeof order.OverridePrice === "number" &&
    !Number.isNaN(order.OverridePrice)
  ) {
    return Number(order.OverridePrice);
  }
  if (typeof order.totalPrice === "number" && !Number.isNaN(order.totalPrice)) {
    return Number(order.totalPrice);
  }
  return null;
}

/**
 * Форматирует письмо для клиента: title, text, html из единого рендерера (app/ui/email).
 * @param {NotificationPayload} payload
 * @returns {{ title: string, body: string, bodyHtml: string }}
 */
function formatCustomerEmailContent(payload) {
  const { title, text, html } = renderCustomerOrderConfirmationEmail(payload);
  return {
    title,
    body: text,
    bodyHtml: html,
  };
}

/**
 * Отправляет уведомление в Telegram.
 *
 * @param {string} target - Recipient (SUPERADMIN, DEVELOPERS, etc.)
 * @param {NotificationPayload} payload
 * @param {string} reason
 * @param {"CRITICAL" | "INFO" | "DEBUG"} priority
 * @param {string} messageLocale - нормализованный код языка (из БД)
 */
async function sendTelegramNotification(target, payload, reason, priority, messageLocale) {
  const emoji = priority === "CRITICAL" ? "🚨" : priority === "INFO" ? "ℹ️" : "🔍";
  const translatedReason = translateAdminReason(reason, messageLocale, payload.intent);
  let body = formatAdminNotificationBody(payload, reason, messageLocale, {
    includeDrivingLicenceInfo: target === "SUPERADMIN",
  });
  if (target === "SUPERADMIN") {
    body += formatSuperadminClientContextFooter(payload, messageLocale);
  }
  let text = `${emoji} ${translatedReason}\n\n${body}`;
  text = withTestOrderTelegramMessage(text, Boolean(payload.fromLocalhost));
  const sent = await sendTelegramDirect(text);
  if (!sent) {
    throw new Error("Telegram send failed");
  }
}

/**
 * Отправляет уведомление по email.
 * Получатель по target (политика уже не даёт COMPANY_EMAIL при EMAIL_TESTING):
 * - CUSTOMER и payload.email → to = клиент, cc = DEVELOPER_EMAIL
 * - COMPANY_EMAIL и companyEmail → to = компания, cc = DEVELOPER_EMAIL
 * - Иначе → to = DEVELOPER_EMAIL, cc пусто
 * DEVELOPER_EMAIL всегда в to или в cc.
 *
 * @param {string} target - Из getOrderNotifications (SUPERADMIN, COMPANY_EMAIL, etc.)
 * @param {NotificationPayload} payload
 * @param {string} reason
 * @param {"CRITICAL" | "INFO" | "DEBUG"} priority
 * @param {string} [companyEmail] - Email компании из БД (для target COMPANY_EMAIL)
 * @param {string} messageLocale - язык текста письма админу/суперадмину
 * @param {string} [customerEmailLocale] - принудительная локаль письма клиенту (только CUSTOMER)
 */
async function sendEmailNotification(
  target,
  payload,
  reason,
  priority,
  companyEmail,
  messageLocale,
  customerEmailLocale
) {
  // Режим тестирования решается в orderNotificationPolicy (COMPANY_EMAIL не добавляется при EMAIL_TESTING).
  const customerEmail = payload.email && String(payload.email).trim();
  const sendToCustomer = target === "CUSTOMER" && customerEmail;
  const sendToCompany = target === "COMPANY_EMAIL" && companyEmail;
  let to;
  let cc;
  if (sendToCustomer) {
    to = [customerEmail];
    cc = [DEVELOPER_EMAIL];
  } else if (sendToCompany) {
    to = [companyEmail];
    cc = [DEVELOPER_EMAIL];
  } else {
    to = [DEVELOPER_EMAIL];
    cc = [];
  }

  let title;
  let body;
  let html;
  if (sendToCustomer) {
    const mailPayload =
      typeof customerEmailLocale === "string" && customerEmailLocale.trim()
        ? { ...payload, locale: normalizeEmailLocale(customerEmailLocale) }
        : payload;
    const customerContent = formatCustomerEmailContent(mailPayload);
    title = customerContent.title;
    body = customerContent.body;
    html = customerContent.bodyHtml;
  } else {
    const emoji = priority === "CRITICAL" ? "🚨" : priority === "INFO" ? "ℹ️" : "🔍";
    const translatedReason = translateAdminReason(reason, messageLocale, payload.intent);
    title = `${emoji} ${translatedReason}`;
    body = formatAdminNotificationBody(payload, reason, messageLocale, {
      includeDrivingLicenceInfo: target === "SUPERADMIN",
    });
    if (target === "SUPERADMIN") {
      body += formatSuperadminClientContextFooter(payload, messageLocale);
    } else if (target === "COMPANY_EMAIL" && sendToCompany) {
      body += formatCompanyEmailClientLocaleFooter(payload, messageLocale);
    }
    title = withTestOrderEmailSubject(title, Boolean(payload.fromLocalhost));
    html = renderAdminOrderNotificationEmail(title, body);
  }

  title = withTestOrderEmailSubject(title, Boolean(payload.fromLocalhost));

  const toList = Array.isArray(to) ? to.filter(Boolean) : [];
  const ccList = Array.isArray(cc) ? cc.filter(Boolean) : [];
  if (toList.length === 0 && !sendToCustomer) {
    toList.push(DEVELOPER_EMAIL);
  }

  try {
    await sendEmailDirect({
      title,
      message: body,
      html: html || undefined,
      to: toList,
      cc: ccList,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[EMAIL → ${target}] [${priority}] (send failed)`, reason, err?.message);
    }
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════
// DISPATCHER (internal, не экспортируем напрямую)
// ════════════════════════════════════════════════════════════════

/**
 * Отправляет все уведомления для действия над заказом.
 *
 * @param {import("./orderNotificationPolicy").Notification[]} notifications
 * @param {NotificationPayload} payload
 * @param {import("./orderAccessPolicy").OrderAccess} access
 * @param {string} [companyEmail] - Email компании из БД (для target COMPANY_EMAIL)
 * @param {string} langAdmin
 * @param {string} langSuperadmin
 */
async function dispatchOrderNotifications(
  notifications,
  payload,
  access,
  companyEmail,
  langAdmin,
  langSuperadmin
) {
  if (!notifications || notifications.length === 0) {
    return;
  }
  
  const intent = payload.intent;
  const promises = [];
  const failures = [];
  
  for (const notification of notifications) {
    const { target, channels, reason, includePII, customerEmailLocale } = notification;
    
    // Priority вычисляется декларативно по intent
    const priority = getPriorityByIntent(intent);
    
    // 🔒 Санитайзим payload (SUPERADMIN всегда получает PII)
    const safePayload = sanitizePayload(payload, access, includePII, target);
    const messageLocale = getNotifyLocaleForTarget(target, langAdmin, langSuperadmin);

    for (const channel of channels) {
      if (channel === "TELEGRAM") {
        // Telegram не должен блокировать email: при отсутствии TELEGRAM_* клиент уже получает письмо,
        // а админские письма (COMPANY / SUPERADMIN) раньше не доходили из‑за общего throw.
        promises.push(
          sendTelegramNotification(
            target,
            safePayload,
            reason,
            priority,
            messageLocale
          ).catch((err) => {
            console.warn(
              `[notifyOrderAction] Telegram skipped → ${target} (${reason}):`,
              err?.message || err
            );
          })
        );
      }
      
      if (channel === "EMAIL") {
        promises.push(
          sendEmailNotification(
            target,
            safePayload,
            reason,
            priority,
            companyEmail,
            messageLocale,
            customerEmailLocale
          )
            .catch(err => {
              failures.push({ channel, target, reason, err });
              throw err;
            })
        );
      }
    }
  }
  
  // Отправляем параллельно; ошибки агрегируем и отдаём наверх вызывающему коду.
  await Promise.allSettled(promises);

  if (failures.length > 0) {
    const orderId = payload?.orderId;
    for (const failure of failures) {
      console.error(
        `[Notification Error] orderId=${orderId} ${failure.channel} → ${failure.target}:`,
        failure.err?.message || failure.err
      );
    }

    const firstErrorMessage = failures[0]?.err?.message || "Unknown notification error";
    throw new Error(
      `Notification dispatch failed (${failures.length} channel(s)): ${firstErrorMessage}`
    );
  }
}

// ════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT (ЕДИНСТВЕННЫЙ ЭКСПОРТ)
// ════════════════════════════════════════════════════════════════

/**
 * 🔑 ЕДИНСТВЕННАЯ ФУНКЦИЯ, КОТОРУЮ НУЖНО ВЫЗЫВАТЬ.
 * 
 * Вычисляет и отправляет уведомления для действия над заказом.
 * 
 * @param {Object} params
 * @param {Object} params.order - Order object
 * @param {Object} params.user - User from session
 * @param {import("./orderNotificationPolicy").OrderAction} params.action
 * @param {string} [params.actorName] - Who performed the action
 * @param {NotificationSource} [params.source="UI"] - Where the action originated
 * @param {string} [params.companyEmail] - Email компании из БД (для target COMPANY_EMAIL при EMAIL_TESTING=false)
 * @param {string} [params.locale] - Fallback языка письма клиенту, если на заказе нет clientLang/locale
 * @param {{ langAdmin?: string, langSuperadmin?: string }} [params.notifyLocales] - для тестов; иначе языки читаются из Company
 */
export async function notifyOrderAction({
  order,
  previousOrder = null,
  user,
  action,
  actorName,
  source = "UI",
  companyEmail,
  locale,
  notifyLocales,
}) {
  if (!order || !user) {
    console.warn("[notifyOrderAction] skipped: missing order or user", {
      hasOrder: !!order,
      hasUser: !!user,
      orderId: order?._id?.toString?.(),
    });
    return;
  }
  
  // Вычисляем access из orderAccessPolicy (timeBucket обязателен)
  const isSuperAdmin = user.role === ROLE.SUPERADMIN;
  const timeBucket = getTimeBucket(order);
  const access = getOrderAccess({
    role: isSuperAdmin ? "SUPERADMIN" : "ADMIN",
    isClientOrder: order.my_order === true,
    confirmed: order.confirmed === true,
    isPast: timeBucket === "PAST",
    timeBucket,
  });
  
  const intent = getActionIntent(action);
  
  // ════════════════════════════════════════════════════════════════
  // 🛑 SAFETY CHECK: действие должно быть разрешено access policy
  // ════════════════════════════════════════════════════════════════
  if (!isActionAllowedByAccess(action, access)) {
    console.warn(
      `[NOTIFY BLOCKED] Action ${action} is not allowed by access policy`,
      { 
        orderId: order._id, 
        intent,
        source,
        access: {
          canEdit: access?.canEdit,
          canDelete: access?.canDelete,
          canConfirm: access?.canConfirm,
        },
      }
    );
    return;
  }
  
  // ════════════════════════════════════════════════════════════════
  // 📝 AUDIT LOG (всегда, даже если нет уведомлений)
  // ════════════════════════════════════════════════════════════════
  await auditLog({ order, user, action, access, intent, source });
  
  // Получаем список уведомлений
  const notifications = getOrderNotifications({
    action,
    access,
    order,
  });
  
  if (notifications.length === 0) {
    return;
  }

  let langAdmin = "en";
  let langSuperadmin = "en";
  if (notifyLocales != null && typeof notifyLocales === "object") {
    langAdmin = normalizeNotifyLocale(notifyLocales.langAdmin);
    langSuperadmin = normalizeNotifyLocale(notifyLocales.langSuperadmin);
  } else {
    try {
      await connectToDB();
      const doc = await Company.findById(COMPANY_ID)
        .select("langAdmin langSuperadmin language locale notifyLanguage")
        .lean();
      const resolved = resolveNotifyLanguagesFromCompanyDoc(doc);
      langAdmin = resolved.langAdmin;
      langSuperadmin = resolved.langSuperadmin;
      if (process.env.NODE_ENV !== "production") {
        console.log("[notifyOrderAction] notify locales:", {
          companyId: COMPANY_ID,
          langAdmin,
          langSuperadmin,
          raw: doc
            ? {
                langAdmin: doc.langAdmin,
                langSuperadmin: doc.langSuperadmin,
                language: doc.language,
                locale: doc.locale,
                notifyLanguage: doc.notifyLanguage,
              }
            : null,
        });
      }
    } catch (err) {
      console.warn("[notifyOrderAction] Could not load company notify locales:", err?.message);
    }
  }
  
  // Формируем payload (все поля для формата NEW ORDER и PII для SUPERADMIN)
  const drivingLicenceUrls = Array.isArray(order.drivingLicenceUrls)
    ? order.drivingLicenceUrls.filter(
        (u) => typeof u === "string" && u.trim().startsWith("https://")
      )
    : [];

  const payload = {
    orderId: order._id?.toString?.() || order._id,
    orderNumber: order.orderNumber,
    regNumber: order.regNumber || order.car?.regNumber || "",
    carNumber: order.carNumber,
    carModel: order.carModel,
    rentalStartDate: order.rentalStartDate,
    rentalEndDate: order.rentalEndDate,
    timeIn: order.timeIn,
    timeOut: order.timeOut,
    placeIn: order.placeIn,
    placeOut: order.placeOut,
    placeInDetail: order.placeInDetail ?? "",
    placeOutDetail: order.placeOutDetail ?? "",
    numberOfDays: order.numberOfDays,
    ChildSeats: order.ChildSeats ?? order.childSeats ?? 0,
    insurance: order.insurance,
    flightNumber: order.flightNumber,
    totalPrice: order.totalPrice,
    customerName: order.customerName,
    phone: order.phone,
    email: order.email ?? "",
    secondDriver: order.secondDriver === true,
    Viber: order.Viber === true,
    Whatsapp: order.Whatsapp === true,
    Telegram: order.Telegram === true,
    action,
    intent,
    actorName,
    source,
    timestamp: new Date(),
    locale: pickCustomerEmailLocale(order, locale),
    oldPrice: getEffectivePrice(previousOrder),
    newPrice: getEffectivePrice(order),
    clientLang: order.clientLang ?? "",
    clientIP: order.clientIP ?? "",
    clientCountry: order.clientCountry ?? "",
    clientRegion: order.clientRegion ?? "",
    clientCity: order.clientCity ?? "",
    fromLocalhost: order.fromLocalhost === true,
    drivingLicenceUrls,
    hasDrivingLicenceUpload: drivingLicenceUrls.length > 0,
  };
  
  await dispatchOrderNotifications(
    notifications,
    payload,
    access,
    companyEmail,
    langAdmin,
    langSuperadmin
  );
}
