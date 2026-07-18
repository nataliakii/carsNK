# 🔧 Order System Improvements Guide

## Оглавление
1. [Приоритетные улучшения](#приоритетные-улучшения)
2. [Рефакторинг валидации](#рефакторинг-валидации)
3. [Унификация временных зон](#унификация-временных-зон)
4. [Базовая функция создания заказа](#базовая-функция-создания-заказа)
5. [Расширения для ролей](#расширения-для-ролей)
6. [Стандартизация API](#стандартизация-api)
7. [Новые функции БД](#новые-функции-бд)
8. [Чек-лист изменений](#чек-лист-изменений)

---

## Приоритетные улучшения

### 🔴 Критические (P0)

| # | Проблема | Решение | Файлы |
|---|----------|---------|-------|
| 1 | Статус 408 создаёт заказ при конфликте времени | Блокировать или явно предупреждать | `analyzeDates.js`, `route.js` |
| 2 | Дублирование кода валидации | Вынести в общий модуль | `utils/orderValidation.js` |
| 3 | Нет минимального срока аренды | Добавить проверку min 1 день | `AddOrderModal.js`, `route.js` |

### 🟡 Важные (P1)

| # | Проблема | Решение | Файлы |
|---|----------|---------|-------|
| 4 | Разная логика для клиента/админа | Базовая функция + расширения | `orderService.js` |
| 5 | UTC/Athens путаница | Единый middleware | `utils/timezone.js` |
| 6 | Нет аудит-лога | Добавить логирование изменений | `models/order.js` |

### 🟢 Желательные (P2)

| # | Проблема | Решение | Файлы |
|---|----------|---------|-------|
| 7 | Нет rate limiting | Добавить защиту от спама | `middleware/rateLimit.js` |
| 8 | Нет уведомлений при конфликтах | Email/Push при pending конфликте | `utils/notifications.js` |
| 9 | Нет отмены заказа клиентом | Добавить cancellation flow | `CancelOrderModal.js` |

---

## Рефакторинг валидации

### Текущая проблема

Валидация разбросана по файлам:
- `analyzeDates.js` - проверка дат
- `MuiTimePicker.js` - проверка времени  
- `AddOrderModal.js` - проверка формы
- `route.js` - финальная проверка

### Решение: Централизованный модуль

```javascript
// utils/orderValidation.js

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const BUSINESS_TZ = "Europe/Athens";
const MIN_RENTAL_DAYS = 1;
const MAX_RENTAL_DAYS = 365;
const BUFFER_HOURS = 2; // Минимум между заказами

/**
 * Результат валидации
 */
export class ValidationResult {
  constructor() {
    this.isValid = true;
    this.errors = [];
    this.warnings = [];
  }

  addError(code, message) {
    this.isValid = false;
    this.errors.push({ code, message });
    return this;
  }

  addWarning(code, message) {
    this.warnings.push({ code, message });
    return this;
  }
}

/**
 * Базовая валидация дат
 */
export function validateDates(startDate, endDate) {
  const result = new ValidationResult();
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const now = dayjs();

  // Проверка: даты заполнены
  if (!startDate || !endDate) {
    return result.addError("DATES_REQUIRED", "Выберите даты аренды");
  }

  // Проверка: дата начала не в прошлом
  if (start.isBefore(now, "day")) {
    return result.addError("START_IN_PAST", "Дата начала не может быть в прошлом");
  }

  // Проверка: конец после начала
  if (end.isSameOrBefore(start, "day")) {
    return result.addError("END_BEFORE_START", "Дата окончания должна быть позже начала");
  }

  // Проверка: минимальный срок
  const days = end.diff(start, "day");
  if (days < MIN_RENTAL_DAYS) {
    return result.addError("MIN_DAYS", `Минимальный срок аренды: ${MIN_RENTAL_DAYS} день`);
  }

  // Проверка: максимальный срок
  if (days > MAX_RENTAL_DAYS) {
    return result.addError("MAX_DAYS", `Максимальный срок аренды: ${MAX_RENTAL_DAYS} дней`);
  }

  return result;
}

/**
 * Валидация времени
 */
export function validateTime(startTime, endTime, startDate, endDate) {
  const result = new ValidationResult();

  if (!startTime || !endTime) {
    return result.addError("TIME_REQUIRED", "Выберите время получения и возврата");
  }

  // Если это однодневная аренда (на следующий день)
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  
  if (end.diff(start, "day") === 1) {
    // Для минимальной аренды время окончания должно быть позже времени начала
    const startTimeMinutes = dayjs(startTime).hour() * 60 + dayjs(startTime).minute();
    const endTimeMinutes = dayjs(endTime).hour() * 60 + dayjs(endTime).minute();
    
    if (endTimeMinutes < startTimeMinutes) {
      result.addWarning("SHORT_RENTAL", "Короткий срок аренды (менее 24 часов)");
    }
  }

  return result;
}

/**
 * Проверка конфликтов с существующими заказами
 */
export function validateConflicts(existingOrders, newOrder, options = {}) {
  const result = new ValidationResult();
  const { ignoreOrderId, isAdmin = false, forceSave = false } = options;

  const newStart = dayjs(newOrder.rentalStartDate);
  const newEnd = dayjs(newOrder.rentalEndDate);
  const newTimeIn = dayjs(newOrder.timeIn);
  const newTimeOut = dayjs(newOrder.timeOut);

  for (const order of existingOrders) {
    // Пропускаем текущий заказ при редактировании
    if (ignoreOrderId && order._id.toString() === ignoreOrderId) {
      continue;
    }

    const orderStart = dayjs(order.rentalStartDate);
    const orderEnd = dayjs(order.rentalEndDate);

    // Проверяем пересечение диапазонов дат
    const hasDateOverlap = 
      newStart.isBefore(orderEnd, "day") && 
      newEnd.isAfter(orderStart, "day");

    if (!hasDateOverlap) continue;

    // CONFIRMED заказы
    if (order.confirmed) {
      // Полное пересечение (не на граничных датах)
      const isInnerConflict = 
        newStart.isAfter(orderStart, "day") && newStart.isBefore(orderEnd, "day") ||
        newEnd.isAfter(orderStart, "day") && newEnd.isBefore(orderEnd, "day") ||
        newStart.isSameOrBefore(orderStart, "day") && newEnd.isSameOrAfter(orderEnd, "day");

      if (isInnerConflict) {
        result.addError(
          "CONFIRMED_CONFLICT",
          `Конфликт с подтверждённым заказом #${order.numberOrder || order._id}`
        );
        if (!forceSave) return result;
      }

      // Граничный конфликт - проверяем время
      if (newStart.isSame(orderEnd, "day")) {
        const orderEndTime = dayjs(order.timeOut);
        if (newTimeIn.isBefore(orderEndTime.add(BUFFER_HOURS, "hour"))) {
          result.addError(
            "TIME_CONFLICT_START",
            `Время получения должно быть после ${orderEndTime.add(BUFFER_HOURS, "hour").format("HH:mm")}`
          );
        }
      }

      if (newEnd.isSame(orderStart, "day")) {
        const orderStartTime = dayjs(order.timeIn);
        if (newTimeOut.isAfter(orderStartTime.subtract(BUFFER_HOURS, "hour"))) {
          result.addError(
            "TIME_CONFLICT_END",
            `Время возврата должно быть до ${orderStartTime.subtract(BUFFER_HOURS, "hour").format("HH:mm")}`
          );
        }
      }
    } 
    // PENDING заказы - только предупреждение
    else {
      result.addWarning(
        "PENDING_CONFLICT",
        `Пересечение с неподтверждённым заказом #${order.numberOrder || order._id}`
      );
    }
  }

  return result;
}

/**
 * Валидация данных клиента
 */
export function validateCustomerData(data, options = {}) {
  const result = new ValidationResult();
  const { isAdmin = false } = options;

  // Имя обязательно
  if (!data.customerName?.trim()) {
    result.addError("NAME_REQUIRED", "Введите имя клиента");
  }

  // Телефон обязателен
  if (!data.phone?.trim()) {
    result.addError("PHONE_REQUIRED", "Введите номер телефона");
  } else if (!/^[+]?[\d\s()-]{7,20}$/.test(data.phone.trim())) {
    result.addError("PHONE_INVALID", "Неверный формат телефона");
  }

  // Email опционален, но должен быть валидным если указан
  if (data.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    result.addError("EMAIL_INVALID", "Неверный формат email");
  }

  return result;
}

/**
 * Полная валидация заказа
 */
export function validateOrder(orderData, existingOrders, options = {}) {
  const result = new ValidationResult();

  // 1. Валидация дат
  const datesResult = validateDates(orderData.rentalStartDate, orderData.rentalEndDate);
  result.errors.push(...datesResult.errors);
  result.warnings.push(...datesResult.warnings);

  // Если даты невалидны - не продолжаем
  if (!datesResult.isValid) {
    result.isValid = false;
    return result;
  }

  // 2. Валидация времени
  const timeResult = validateTime(
    orderData.timeIn,
    orderData.timeOut,
    orderData.rentalStartDate,
    orderData.rentalEndDate
  );
  result.errors.push(...timeResult.errors);
  result.warnings.push(...timeResult.warnings);

  // 3. Валидация клиента
  const customerResult = validateCustomerData(orderData, options);
  result.errors.push(...customerResult.errors);
  result.warnings.push(...customerResult.warnings);

  // 4. Валидация конфликтов
  const conflictResult = validateConflicts(existingOrders, orderData, options);
  result.errors.push(...conflictResult.errors);
  result.warnings.push(...conflictResult.warnings);

  // Итоговый результат
  result.isValid = result.errors.length === 0;

  return result;
}
```

### Использование

```javascript
// В AddOrderModal.js или route.js

import { validateOrder } from "@utils/orderValidation";

const validation = validateOrder(orderData, existingOrders, { isAdmin: true });

if (!validation.isValid) {
  // Показать ошибки
  validation.errors.forEach(err => showError(err.message));
  return;
}

if (validation.warnings.length > 0) {
  // Показать предупреждения
  validation.warnings.forEach(warn => showWarning(warn.message));
}

// Продолжить создание заказа
```

---

## Унификация временных зон

### Создание timezone утилиты

```javascript
// utils/timezone.js

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Бизнес-таймзона (Греция)
 */
export const BUSINESS_TIMEZONE = "Europe/Athens";

/**
 * Конвертирует дату в бизнес-таймзону
 */
export function toBusinessTime(date) {
  if (!date) return null;
  return dayjs(date).tz(BUSINESS_TIMEZONE);
}

/**
 * ⚠️ ВАЖНО: НЕ используем браузерную таймзону пользователя!
 * 
 * Когда пользователь из Австралии вводит 14:00 — это означает 14:00 по Греции,
 * а НЕ 14:00 по Австралии. Как у авиабилетов — время всегда локальное 
 * для места получения машины.
 * 
 * Поэтому мы:
 * 1. ЯВНО интерпретируем ввод как Europe/Athens
 * 2. Конвертируем в UTC для хранения
 * 
 * Пример:
 *   Ввод: "14:00" (пользователь в Австралии)
 *   Интерпретация: 14:00 Athens = 12:00 UTC (зимой) или 11:00 UTC (летом)
 *   В БД: "2026-01-15T12:00:00Z"
 *   При отображении: 14:00 (Athens)
 */
export function toStorageTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  
  // КЛЮЧЕВОЙ МОМЕНТ: всегда интерпретируем как греческое время!
  const businessTime = dayjs.tz(
    `${dateStr} ${timeStr}`,
    "YYYY-MM-DD HH:mm",
    BUSINESS_TIMEZONE  // "Europe/Athens"
  );
  
  // Конвертируем в UTC для хранения
  return businessTime.utc().toDate();
}

/**
 * Парсит введённые пользователем дату и время как бизнес-время
 */
export function parseBusinessDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return dayjs.tz(
    `${dateStr} ${timeStr}`,
    "YYYY-MM-DD HH:mm",
    BUSINESS_TIMEZONE
  );
}

/**
 * Форматирует дату для отображения пользователю
 */
export function formatForDisplay(date, format = "DD.MM.YYYY HH:mm") {
  if (!date) return "";
  return toBusinessTime(date).format(format);
}

/**
 * Форматирует только время
 */
export function formatTime(date, format = "HH:mm") {
  if (!date) return "";
  return toBusinessTime(date).format(format);
}

/**
 * Форматирует только дату
 */
export function formatDate(date, format = "DD.MM.YYYY") {
  if (!date) return "";
  return toBusinessTime(date).format(format);
}

/**
 * Создаёт дату с временем для сохранения в БД
 * @param {string} dateStr - Дата в формате YYYY-MM-DD
 * @param {string} timeStr - Время в формате HH:mm
 * @returns {Date} - JavaScript Date объект в UTC
 */
export function createStorageDateTime(dateStr, timeStr) {
  const businessDateTime = parseBusinessDateTime(dateStr, timeStr);
  return businessDateTime.utc().toDate();
}

/**
 * Middleware для Express/Next.js API routes
 * Автоматически конвертирует даты в ответе
 */
export function timezoneMiddleware(data) {
  if (!data) return data;
  
  const dateFields = [
    "rentalStartDate",
    "rentalEndDate",
    "timeIn",
    "timeOut",
    "createdAt",
    "updatedAt"
  ];

  const processObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(processObject);
    }
    
    if (obj && typeof obj === "object") {
      const result = { ...obj };
      for (const field of dateFields) {
        if (result[field]) {
          result[`${field}_display`] = formatForDisplay(result[field]);
          result[`${field}_time`] = formatTime(result[field]);
          result[`${field}_date`] = formatDate(result[field]);
        }
      }
      return result;
    }
    
    return obj;
  };

  return processObject(data);
}
```

### Компонент для отображения времени

```javascript
// components/common/BusinessTime.jsx

import React from "react";
import { formatForDisplay, formatTime, formatDate } from "@utils/timezone";

/**
 * Компонент для отображения времени в бизнес-таймзоне
 */
export function BusinessTime({ date, format = "time" }) {
  if (!date) return null;

  let displayValue;
  switch (format) {
    case "time":
      displayValue = formatTime(date);
      break;
    case "date":
      displayValue = formatDate(date);
      break;
    case "full":
      displayValue = formatForDisplay(date);
      break;
    default:
      displayValue = formatForDisplay(date, format);
  }

  return <span className="business-time">{displayValue}</span>;
}

/**
 * Компонент диапазона дат
 */
export function DateRange({ start, end }) {
  return (
    <span className="date-range">
      <BusinessTime date={start} format="date" />
      {" — "}
      <BusinessTime date={end} format="date" />
    </span>
  );
}

/**
 * Компонент диапазона времени
 */
export function TimeRange({ start, end }) {
  return (
    <span className="time-range">
      <BusinessTime date={start} format="time" />
      {" — "}
      <BusinessTime date={end} format="time" />
    </span>
  );
}
```

---

## Базовая функция создания заказа

### Сервис заказов

```javascript
// services/orderService.js

import { validateOrder } from "@utils/orderValidation";
import { createStorageDateTime, BUSINESS_TIMEZONE } from "@utils/timezone";
import Order from "@models/order";
import Car from "@models/car";

/**
 * Опции создания заказа
 */
const DEFAULT_OPTIONS = {
  role: "client",           // "client" | "admin" | "superadmin"
  skipConflictCheck: false, // Пропустить проверку конфликтов
  autoConfirm: false,       // Автоматически подтвердить
  sendNotifications: true,  // Отправить уведомления
  auditLog: true,           // Записывать в аудит лог
};

/**
 * Базовая функция создания заказа
 */
export async function createOrder(orderData, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result = {
    success: false,
    order: null,
    errors: [],
    warnings: [],
    code: null,
  };

  try {
    // 1. ПОЛУЧЕНИЕ МАШИНЫ
    const car = await Car.findOne({ carNumber: orderData.carNumber });
    if (!car) {
      result.code = "CAR_NOT_FOUND";
      result.errors.push({ code: "CAR_NOT_FOUND", message: "Машина не найдена" });
      return result;
    }

    // 2. ПОЛУЧЕНИЕ СУЩЕСТВУЮЩИХ ЗАКАЗОВ
    const existingOrders = await Order.find({ car: car._id });

    // 3. ВАЛИДАЦИЯ
    const validation = validateOrder(orderData, existingOrders, {
      isAdmin: opts.role !== "client",
      forceSave: opts.skipConflictCheck,
    });

    if (!validation.isValid && !opts.skipConflictCheck) {
      result.code = "VALIDATION_FAILED";
      result.errors = validation.errors;
      result.warnings = validation.warnings;
      return result;
    }

    result.warnings = validation.warnings;

    // 4. РАСЧЁТ ЦЕНЫ
    const { total, days } = await car.calculateTotalRentalPricePerDay(
      orderData.rentalStartDate,
      orderData.rentalEndDate,
      orderData.insurance,
      orderData.ChildSeats
    );

    // 5. ПОДГОТОВКА ДАННЫХ
    const preparedData = prepareOrderData(orderData, {
      car,
      totalPrice: orderData.totalPrice || total,
      numberOfDays: days,
      confirmed: opts.autoConfirm || orderData.confirmed,
      role: opts.role,
    });

    // 6. СОЗДАНИЕ ЗАКАЗА
    const newOrder = new Order(preparedData);
    await newOrder.save();

    // 7. POST-ДЕЙСТВИЯ
    if (opts.sendNotifications) {
      await sendOrderNotifications(newOrder, opts.role);
    }

    if (opts.auditLog) {
      await logOrderAction("CREATE", newOrder, opts.role);
    }

    result.success = true;
    result.order = newOrder;
    result.code = validation.warnings.length > 0 ? "CREATED_WITH_WARNINGS" : "CREATED";

    return result;

  } catch (error) {
    console.error("Error creating order:", error);
    result.code = "SERVER_ERROR";
    result.errors.push({ code: "SERVER_ERROR", message: error.message });
    return result;
  }
}

/**
 * Подготовка данных заказа
 */
function prepareOrderData(input, context) {
  const { car, totalPrice, numberOfDays, confirmed, role } = context;

  // Конвертируем время в UTC для хранения
  const timeIn = createStorageDateTime(
    input.rentalStartDate,
    input.timeInStr || "10:00"
  );
  const timeOut = createStorageDateTime(
    input.rentalEndDate,
    input.timeOutStr || "10:00"
  );

  return {
    car: car._id,
    carNumber: car.carNumber,
    customerName: input.customerName?.trim(),
    phone: input.phone?.trim(),
    email: input.email?.trim() || "",
    rentalStartDate: new Date(input.rentalStartDate),
    rentalEndDate: new Date(input.rentalEndDate),
    timeIn,
    timeOut,
    placeIn: input.placeIn || car.defaultLocation,
    placeOut: input.placeOut || car.defaultLocation,
    flightNumber: input.flightNumber || "",
    confirmed: confirmed || false,
    my_order: input.my_order || false,
    ChildSeats: input.ChildSeats || 0,
    insurance: input.insurance || "TPL",
    franchiseOrder: input.franchiseOrder,
    orderNumber: input.orderNumber || generateOrderNumber(),
    totalPrice,
    numberOfDays,
    // Метаданные
    createdBy: role,
    createdAt: new Date(),
  };
}

/**
 * Генерация номера заказа
 */
function generateOrderNumber() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

/**
 * Отправка уведомлений
 */
async function sendOrderNotifications(order, role) {
  // TODO: Реализовать отправку email/push
  console.log(`Notification sent for order ${order._id} by ${role}`);
}

/**
 * Логирование действий
 */
async function logOrderAction(action, order, role) {
  // TODO: Сохранить в коллекцию audit_logs
  console.log(`Audit: ${action} order ${order._id} by ${role}`);
}
```

---

## Расширения для ролей

### Клиент

```javascript
// services/clientOrderService.js

import { createOrder } from "./orderService";

/**
 * Создание заказа клиентом
 */
export async function createClientOrder(orderData) {
  return createOrder(orderData, {
    role: "client",
    autoConfirm: false,          // Клиент не может подтверждать
    skipConflictCheck: false,    // Всегда проверяем конфликты
    sendNotifications: true,     // Уведомляем админа о новом заказе
  });
}
```

### Админ

```javascript
// services/adminOrderService.js

import { createOrder } from "./orderService";

/**
 * Создание заказа админом
 */
export async function createAdminOrder(orderData, adminOptions = {}) {
  return createOrder(orderData, {
    role: "admin",
    autoConfirm: adminOptions.confirmed || false,
    skipConflictCheck: false,
    sendNotifications: adminOptions.notifyClient !== false,
  });
}

/**
 * Админ может подтверждать заказ сразу при создании
 */
export async function createAndConfirmOrder(orderData) {
  return createAdminOrder(orderData, { confirmed: true });
}
```

### Суперадмин

```javascript
// services/superadminOrderService.js

import { createOrder } from "./orderService";

/**
 * Создание заказа суперадмином
 */
export async function createSuperadminOrder(orderData, superOptions = {}) {
  return createOrder(orderData, {
    role: "superadmin",
    autoConfirm: superOptions.confirmed || false,
    skipConflictCheck: superOptions.forceCreate || false,  // Может игнорировать конфликты
    sendNotifications: superOptions.notifyClient !== false,
    auditLog: true,  // Всегда логируем действия суперадмина
  });
}

/**
 * Принудительное создание заказа (игнорируя конфликты)
 */
export async function forceCreateOrder(orderData) {
  return createSuperadminOrder(orderData, { forceCreate: true, confirmed: true });
}

/**
 * Создание заказа с кастомной ценой
 */
export async function createOrderWithCustomPrice(orderData, customPrice) {
  return createSuperadminOrder({
    ...orderData,
    totalPrice: customPrice,
    priceOverridden: true,
  });
}
```

---

## Стандартизация API

### Структура ответов

```javascript
// utils/apiResponse.js

/**
 * Стандартный успешный ответ
 */
export function successResponse(data, message = "Success", status = 200) {
  return Response.json({
    success: true,
    status,
    code: getCodeFromStatus(status),
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    }
  }, { status });
}

/**
 * Стандартный ответ с ошибкой
 */
export function errorResponse(code, message, errors = [], status = 400) {
  return Response.json({
    success: false,
    status,
    code,
    message,
    errors,
    meta: {
      timestamp: new Date().toISOString(),
    }
  }, { status });
}

/**
 * Ответ с предупреждениями
 */
export function warningResponse(data, warnings, message = "Success with warnings", status = 202) {
  return Response.json({
    success: true,
    status,
    code: "SUCCESS_WITH_WARNINGS",
    message,
    data,
    warnings,
    meta: {
      timestamp: new Date().toISOString(),
    }
  }, { status });
}

/**
 * Коды ответов
 */
const STATUS_CODES = {
  200: "SUCCESS",
  201: "CREATED",
  202: "ACCEPTED_WITH_WARNINGS",
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  408: "TIME_CONFLICT",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  429: "TOO_MANY_REQUESTS",
  500: "SERVER_ERROR",
};

function getCodeFromStatus(status) {
  return STATUS_CODES[status] || "UNKNOWN";
}
```

### Обновлённый API route

```javascript
// app/api/order/add/route.js (обновлённая версия)

import { createOrder } from "@services/orderService";
import { successResponse, errorResponse, warningResponse } from "@utils/apiResponse";

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Определяем роль из сессии/токена
    const role = await getUserRole(request);
    
    // Создаём заказ через сервис
    const result = await createOrder(data, { role });
    
    if (!result.success) {
      // Ошибки валидации
      if (result.code === "VALIDATION_FAILED") {
        return errorResponse(
          result.code,
          result.errors[0]?.message || "Ошибка валидации",
          result.errors,
          422
        );
      }
      
      // Конфликт
      if (result.code === "CONFIRMED_CONFLICT") {
        return errorResponse(
          result.code,
          "Даты заняты подтверждённым заказом",
          result.errors,
          409
        );
      }
      
      // Другие ошибки
      return errorResponse(
        result.code,
        result.errors[0]?.message || "Ошибка создания заказа",
        result.errors,
        400
      );
    }
    
    // Успех с предупреждениями
    if (result.warnings.length > 0) {
      return warningResponse(
        { order: result.order },
        result.warnings,
        "Заказ создан с предупреждениями",
        202
      );
    }
    
    // Полный успех
    return successResponse(
      { order: result.order },
      "Заказ успешно создан",
      201
    );
    
  } catch (error) {
    console.error("API Error:", error);
    return errorResponse(
      "SERVER_ERROR",
      "Внутренняя ошибка сервера",
      [{ code: "SERVER_ERROR", message: error.message }],
      500
    );
  }
}
```

---

## Новые функции БД

### Обновление модели Order

```javascript
// models/order.js (дополнения)

import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  // ... существующие поля ...
  
  // Новые поля для аудита
  createdBy: {
    type: String,
    enum: ["client", "admin", "superadmin", "system"],
    default: "client"
  },
  
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  confirmedAt: Date,
  
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  cancellationReason: String,
  
  priceOverridden: {
    type: Boolean,
    default: false
  },
  
  // История изменений
  history: [{
    action: String,
    timestamp: Date,
    userId: mongoose.Schema.Types.ObjectId,
    changes: mongoose.Schema.Types.Mixed
  }]
});

// Виртуальное поле: статус заказа
orderSchema.virtual("status").get(function() {
  const now = new Date();
  
  if (this.cancelledAt) return "cancelled";
  if (!this.confirmed) return "pending";
  if (now < this.rentalStartDate) return "upcoming";
  if (now > this.rentalEndDate) return "completed";
  return "active";
});

// Pre-save hook: валидация перед сохранением
orderSchema.pre("save", async function(next) {
  // Добавляем в историю при изменении
  if (this.isModified() && !this.isNew) {
    this.history.push({
      action: "UPDATE",
      timestamp: new Date(),
      changes: this.modifiedPaths()
    });
  }
  next();
});

// Статический метод: проверка доступности
orderSchema.statics.checkAvailability = async function(carId, startDate, endDate, excludeOrderId = null) {
  const query = {
    car: carId,
    confirmed: true,
    rentalStartDate: { $lt: endDate },
    rentalEndDate: { $gt: startDate }
  };
  
  if (excludeOrderId) {
    query._id = { $ne: excludeOrderId };
  }
  
  const conflicting = await this.find(query);
  return {
    isAvailable: conflicting.length === 0,
    conflicts: conflicting
  };
};

// Статический метод: получение соседних заказов
orderSchema.statics.getAdjacentOrders = async function(carId, date) {
  const [previous, next] = await Promise.all([
    this.findOne({
      car: carId,
      rentalEndDate: { $lte: date },
      confirmed: true
    }).sort({ rentalEndDate: -1 }),
    
    this.findOne({
      car: carId,
      rentalStartDate: { $gte: date },
      confirmed: true
    }).sort({ rentalStartDate: 1 })
  ]);
  
  return { previous, next };
};

// Метод экземпляра: подтверждение заказа
orderSchema.methods.confirm = async function(userId) {
  this.confirmed = true;
  this.confirmedBy = userId;
  this.confirmedAt = new Date();
  this.history.push({
    action: "CONFIRM",
    timestamp: new Date(),
    userId
  });
  return this.save();
};

// Метод экземпляра: отмена заказа
orderSchema.methods.cancel = async function(userId, reason) {
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  this.history.push({
    action: "CANCEL",
    timestamp: new Date(),
    userId,
    changes: { reason }
  });
  return this.save();
};

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
```

---

## Чек-лист изменений

### Фаза 1: Критические исправления (1-2 дня)

- [ ] Исправить статус 408 (блокировать или явно предупреждать)
- [ ] Добавить проверку минимального срока аренды
- [ ] Унифицировать timezone обработку

### Фаза 2: Рефакторинг валидации (2-3 дня)

- [ ] Создать `utils/orderValidation.js`
- [ ] Создать `utils/timezone.js`
- [ ] Обновить `AddOrderModal.js` для использования новых утилит
- [ ] Обновить `BookingModal.js` для использования новых утилит
- [ ] Обновить API route `/api/order/add`

### Фаза 3: Сервисный слой (2-3 дня)

- [ ] Создать `services/orderService.js`
- [ ] Создать `services/clientOrderService.js`
- [ ] Создать `services/adminOrderService.js`
- [ ] Создать `services/superadminOrderService.js`
- [ ] Создать `utils/apiResponse.js`

### Фаза 4: Обновление модели БД (1-2 дня)

- [ ] Добавить новые поля в `models/order.js`
- [ ] Добавить виртуальные поля и методы
- [ ] Создать миграцию для существующих данных

### Фаза 5: UI компоненты (1-2 дня)

- [ ] Создать `components/common/BusinessTime.jsx`
- [ ] Обновить отображение времени во всех компонентах
- [ ] Добавить отображение истории изменений

### Фаза 6: Тестирование (2-3 дня)

- [ ] Unit тесты для валидации
- [ ] Integration тесты для API
- [ ] E2E тесты для создания заказа

---

*Документация обновлена: Январь 2026*

