// "/**
//  * athensTime.js
//  *
//  * 🎯 ЕДИНСТВЕННЫЙ источник правды для работы с временем.
//  *
//  * БИЗНЕС-ТАЙМЗОНА = Europe/Athens
//  * ТАЙМЗОНА ПОЛЬЗОВАТЕЛЯ ИГНОРИРУЕТСЯ
//  *
//  * ❌ НИКОГДА не конвертируем время между таймзонами
//  * ✅ ТОЛЬКО переинтерпретируем то же самое время как Europe/Athens
//  *
//  * Два направления:
//  * 1. UI → Backend: createAthensDateTime()
//  * 2. Backend → UI: fromServerUTC()
//  *
//  * DEV-only assertions включены для отладки timezone проблем.
//  */"


import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Бизнес-таймзона — ЕДИНСТВЕННАЯ используемая в системе
 */
export const ATHENS_TZ = "Europe/Athens";

/**
 * DEV mode flag
 */
const IS_DEV = process.env.NODE_ENV === "development";

/**
 * DEV-only assertion helper
 */
function devAssert(condition, message, context = {}) {
  if (IS_DEV && !condition) {
    console.error(`🚨 TIMEZONE ASSERTION FAILED: ${message}`, context);
    // В dev режиме выбрасываем ошибку для раннего обнаружения проблем
    // throw new Error(`TIMEZONE ASSERTION FAILED: ${message}`);
  }
}

/**
 * DEV-only logging helper
 */
function devLog(operation, data) {
  // Отключаем логирование athensTime для уменьшения шума
  // if (IS_DEV) {
  //   console.log(`🕐 [athensTime] ${operation}:`, JSON.stringify(data));
  // }
}

// ============================================================
// 1️⃣ UI → BACKEND (user input)
// ============================================================

/**
 * Создаёт Athens datetime из строк даты и времени.
 * Пользователь вводит 14:00 → это ВСЕГДА 14:00 по Афинам.
 *
 * @param {string} dateStr - Дата "YYYY-MM-DD"
 * @param {string} timeStr - Время "HH:mm"
 * @returns {dayjs.Dayjs} - dayjs объект в таймзоне Athens
 *
 * @example
 * // Пользователь в Австралии вводит 14:00
 * createAthensDateTime("2025-01-15", "14:00")
 * // Результат: 14:00 Athens (НЕ конвертировано из Австралии!)
 */
export function createAthensDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;

  // Создаём НОВЫЙ объект сразу в Athens timezone
  // БЕЗ конвертации из локального времени браузера
  const result = dayjs.tz(`${dateStr} ${timeStr}`, "YYYY-MM-DD HH:mm", ATHENS_TZ);

  // DEV assertion: проверяем что час и минута не изменились
  const [inputHour, inputMinute] = timeStr.split(":").map(Number);
  devAssert(
    result.hour() === inputHour && result.minute() === inputMinute,
    "createAthensDateTime: Hour/minute mismatch!",
    {
      input: { dateStr, timeStr, inputHour, inputMinute },
      result: { hour: result.hour(), minute: result.minute(), iso: result.toISOString() },
    }
  );

  devLog("createAthensDateTime", {
    input: `${dateStr} ${timeStr}`,
    resultAthens: result.format("YYYY-MM-DD HH:mm"),
    resultISO: result.toISOString(),
  });

  return result;
}

// ============================================================
// 2️⃣ BACKEND → DATABASE (saving) — toServerUTC
// ============================================================

/**
 * Конвертирует Athens datetime в UTC для отправки на сервер/сохранения в БД.
 *
 * @param {dayjs.Dayjs} athensTime - dayjs объект в Athens timezone
 * @returns {Date} - JavaScript Date в UTC
 */
export function toServerUTC(athensTime) {
  if (!athensTime || !dayjs.isDayjs(athensTime)) return null;

  const utcDate = athensTime.utc().toDate();

  // DEV assertion: проверяем round-trip
  const roundTrip = fromServerUTC(utcDate);
  devAssert(
    roundTrip.hour() === athensTime.hour() && roundTrip.minute() === athensTime.minute(),
    "toServerUTC: Round-trip integrity check failed!",
    {
      original: { hour: athensTime.hour(), minute: athensTime.minute() },
      roundTrip: { hour: roundTrip.hour(), minute: roundTrip.minute() },
    }
  );

  devLog("toServerUTC", {
    inputAthens: athensTime.format("YYYY-MM-DD HH:mm"),
    outputUTC: utcDate.toISOString(),
  });

  return utcDate;
}

// ============================================================
// 3️⃣ DATABASE → BACKEND (reading) — fromServerUTC
// ============================================================

/**
 * Конвертирует UTC timestamp из сервера/БД в Athens для отображения.
 * Сервер хранит в UTC → показываем в Athens.
 *
 * @param {string|Date|dayjs.Dayjs} serverTime - UTC время из сервера
 * @returns {dayjs.Dayjs} - dayjs объект в таймзоне Athens
 *
 * @example
 * // Сервер вернул "2025-01-15T12:00:00Z" (UTC)
 * fromServerUTC("2025-01-15T12:00:00Z")
 * // Результат: 14:00 Athens (UTC+2 зимой)
 */
export function fromServerUTC(serverTime) {
  if (!serverTime) return null;

  // Парсим как UTC, затем конвертируем в Athens
  const result = dayjs.utc(serverTime).tz(ATHENS_TZ);

  devLog("fromServerUTC", {
    inputUTC: serverTime instanceof Date ? serverTime.toISOString() : serverTime,
    outputAthens: result.format("YYYY-MM-DD HH:mm"),
  });

  return result;
}

// ============================================================
// 4️⃣ BACKEND → FRONTEND (API response) — alias
// ============================================================

/**
 * Alias для fromServerUTC — для ясности в коде фронтенда.
 * Используется при получении данных из API.
 */
export const fromServerAthensUTC = fromServerUTC;

// ============================================================
// 5️⃣ ROUND-TRIP INTEGRITY CHECK
// ============================================================

/**
 * DEV-only: Проверяет целостность round-trip преобразования.
 *
 * Input: 2025-05-10 14:00
 * Flow: UI → Backend → DB → Backend → UI
 * Expected: 14:00 (Europe/Athens)
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} timeStr - "HH:mm"
 * @returns {boolean} - true если round-trip успешен
 */
export function validateRoundTrip(dateStr, timeStr) {
  if (!IS_DEV) return true;

  const [inputHour, inputMinute] = timeStr.split(":").map(Number);

  // Step 1: UI → Athens datetime
  const athensTime = createAthensDateTime(dateStr, timeStr);
  if (!athensTime) {
    console.error("🚨 ROUND-TRIP FAILED: createAthensDateTime returned null");
    return false;
  }

  // Step 2: Athens → UTC (for DB)
  const utcDate = toServerUTC(athensTime);
  if (!utcDate) {
    console.error("🚨 ROUND-TRIP FAILED: toServerUTC returned null");
    return false;
  }

  // Step 3: UTC → Athens (from DB)
  const finalAthens = fromServerUTC(utcDate);
  if (!finalAthens) {
    console.error("🚨 ROUND-TRIP FAILED: fromServerUTC returned null");
    return false;
  }

  // Verify: hour and minute must be identical
  const isValid =
    finalAthens.hour() === inputHour &&
    finalAthens.minute() === inputMinute &&
    finalAthens.format("YYYY-MM-DD") === dateStr;

  if (!isValid) {
    console.error("🚨 ROUND-TRIP FAILED: Time mismatch!", {
      input: { dateStr, timeStr, inputHour, inputMinute },
      step1_athens: athensTime.format("YYYY-MM-DD HH:mm"),
      step2_utc: utcDate.toISOString(),
      step3_final: finalAthens.format("YYYY-MM-DD HH:mm"),
      finalHour: finalAthens.hour(),
      finalMinute: finalAthens.minute(),
    });
    return false;
  }

  console.log("✅ ROUND-TRIP OK:", {
    input: `${dateStr} ${timeStr}`,
    utc: utcDate.toISOString(),
    final: finalAthens.format("YYYY-MM-DD HH:mm"),
  });

  return true;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Извлекает строку времени "HH:mm" из dayjs объекта.
 * Для использования в TimePicker и UI.
 *
 * @param {dayjs.Dayjs} time - dayjs объект
 * @returns {string} - "HH:mm"
 */
export function formatTimeHHMM(time) {
  if (!time || !dayjs.isDayjs(time)) return "";
  return time.format("HH:mm");
}

/**
 * Извлекает строку даты "YYYY-MM-DD" из dayjs объекта.
 *
 * @param {dayjs.Dayjs} time - dayjs объект
 * @returns {string} - "YYYY-MM-DD"
 */
export function formatDateYYYYMMDD(time) {
  if (!time || !dayjs.isDayjs(time)) return "";
  return time.format("YYYY-MM-DD");
}

/**
 * Создаёт начало дня в Athens timezone.
 *
 * @param {string} dateStr - Дата "YYYY-MM-DD"
 * @returns {dayjs.Dayjs}
 */
export function athensStartOfDay(dateStr) {
  return dayjs.tz(dateStr, "YYYY-MM-DD", ATHENS_TZ).startOf("day");
}

/**
 * Создаёт конец дня в Athens timezone.
 *
 * @param {string} dateStr - Дата "YYYY-MM-DD"
 * @returns {dayjs.Dayjs}
 */
export function athensEndOfDay(dateStr) {
  return dayjs.tz(`${dateStr} 23:59`, "YYYY-MM-DD HH:mm", ATHENS_TZ);
}

/**
 * Проверяет, является ли объект валидным dayjs.
 */
export function isValidAthensTime(time) {
  return time && dayjs.isDayjs(time) && time.isValid();
}

/**
 * Получает текущее время в Athens timezone.
 * 
 * ⚠️ КРИТИЧНО: Используется вместо dayjs() для получения "сегодня" в Athens.
 * 
 * @returns {dayjs.Dayjs} - Текущее время в Athens timezone
 */
export function athensNow() {
  return dayjs().tz(ATHENS_TZ);
}

/**
 * Создаёт Athens datetime из dayjs объекта (который может быть в любой таймзоне).
 * Извлекает HH:mm и дату, затем создаёт заново в Athens.
 *
 * ⚠️ Используется когда у нас есть dayjs из TimePicker (в локальной таймзоне браузера)
 * и нужно ПЕРЕИНТЕРПРЕТИРОВАТЬ его как Athens БЕЗ конвертации.
 *
 * @param {dayjs.Dayjs} localDayjs - dayjs объект (возможно в локальной таймзоне)
 * @param {string} dateStr - Дата "YYYY-MM-DD" для контекста
 * @returns {dayjs.Dayjs} - dayjs объект в Athens timezone
 */
export function reinterpretAsAthens(localDayjs, dateStr) {
  if (!localDayjs || !dayjs.isDayjs(localDayjs)) return null;

  // Извлекаем только HH:mm (игнорируем таймзону)
  const timeStr = localDayjs.format("HH:mm");

  // Создаём заново в Athens
  return createAthensDateTime(dateStr, timeStr);
}

/**
 * Вычисляет time bucket заказа: PAST | CURRENT | FUTURE (Athens TZ).
 * CURRENT = started today or earlier AND not finished yet (end >= today).
 * Даты интерпретируются в Athens. Поддерживаются частичные даты (только start или только end).
 *
 * @param {Object} order - Order with rentalStartDate, rentalEndDate (Date or ISO string, typically UTC from DB)
 * @returns {"PAST" | "CURRENT" | "FUTURE"}
 */
export function getTimeBucket(order) {
  if (!order) return "FUTURE";
  const hasStart = order.rentalStartDate != null;
  const hasEnd = order.rentalEndDate != null;
  const today = athensNow().startOf("day");

  if (!hasStart && !hasEnd) return "FUTURE";
  if (!hasStart && hasEnd) {
    const end = dayjs.utc(order.rentalEndDate).tz(ATHENS_TZ).startOf("day");
    return end.isBefore(today, "day") ? "PAST" : "CURRENT";
  }
  if (hasStart && !hasEnd) {
    const start = dayjs.utc(order.rentalStartDate).tz(ATHENS_TZ).startOf("day");
    return start.isAfter(today, "day") ? "FUTURE" : "CURRENT";
  }

  const start = dayjs.utc(order.rentalStartDate).tz(ATHENS_TZ).startOf("day");
  const end = dayjs.utc(order.rentalEndDate).tz(ATHENS_TZ).startOf("day");
  if (end.isBefore(today, "day")) return "PAST";
  if (start.isAfter(today, "day")) return "FUTURE";
  return "CURRENT";
}

/**
 * Номер заказа для UI: ГГГГММДДЧЧММСС по текущему моменту в Europe/Athens (Греция).
 * Используется при создании заказа на сайте и в админке — единая бизнес-таймзона.
 * @returns {string}
 */
export function generateOrderNumber() {
  const now = dayjs().tz(ATHENS_TZ);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    String(now.year()) +
    pad(now.month() + 1) +
    pad(now.date()) +
    pad(now.hour()) +
    pad(now.minute()) +
    pad(now.second())
  );
}

export default {
  ATHENS_TZ,
  createAthensDateTime,
  toServerUTC,
  fromServerUTC,
  fromServerAthensUTC,
  validateRoundTrip,
  formatTimeHHMM,
  formatDateYYYYMMDD,
  athensStartOfDay,
  athensEndOfDay,
  isValidAthensTime,
  reinterpretAsAthens,
  athensNow,
  getTimeBucket,
  generateOrderNumber,
};
