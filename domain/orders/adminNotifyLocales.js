/**
 * Тексты уведомлений для админа компании (email) и суперадмина (Telegram/email).
 * Локаль: Company.langAdmin / Company.langSuperadmin (по умолчанию en).
 *
 * Языки как в locales/i18n.js: en, ru, uk, el, de, bg, ro, sr, pl (sr — latinica kao u sr.json).
 */

import { fromServerUTC } from "@/domain/time/athensTime";
import { getBusinessDaySpanFromStoredDates } from "./numberOfDays";

const SUPPORTED = ["en", "ru", "uk", "el", "de", "bg", "ro", "sr", "pl"];

/** @type {Record<string, Record<string, string>>} */
const DICT = {
  en: {
    newOrder: "🆕 NEW ORDER #{{n}}",
    car: "🚗 Car:",
    from: "📅 From:",
    to: "📅 To:",
    pickup: "📍 Pickup:",
    ret: "↩️ Return:",
    insuranceCdwLine: "🛡️ Insurance: CDW",
    days: "🗓 Days:",
    total: "💰 Total:",
    customer: "👤 Customer:",
    name: "Name",
    phone: "Phone",
    email: "Email",
    viber: "Viber ✓",
    whatsapp: "Whatsapp ✓",
    telegram: "Telegram ✓",
    order: "Order:",
    carLabel: "Car:",
    action: "Action:",
    oldPrice: "Old price:",
    newPrice: "New price:",
    who: "Who:",
    source: "Source:",
    time: "Time:",
    dash: "—",
    footerLang: "Language:",
    footerIp: "Client IP:",
    footerCountry: "Country:",
    footerRegion: "Region:",
    footerCity: "City:",
    intentCriticalEdit: "critical edit",
    intentSafeEdit: "safe edit",
    intentOrderCreated: "order created",
    intentOrderConfirmed: "order confirmed",
    intentOrderUnconfirmed: "order unconfirmed",
    intentOrderDeleted: "order deleted",
    intentUnknown: "update",
    reasonNewClient: "New client order created",
    reasonNewClientTesting: "New client order created (EMAIL_TESTING)",
    reasonCritical: "CRITICAL: {{intent}} on confirmed client order",
    reasonInfo: "INFO: {{intent}} on confirmed client order",
    reasonAuditClient: "AUDIT: Client order deleted",
    reasonAuditInternal: "AUDIT: Internal order deleted",
    orderDeletedLine: "❌ ORDER DELETED #{{n}}",
    deletedByLine: "🛑 Deleted by: {{who}}",
    drivingLicence: "🪪 Driver's licence:",
    drivingLicencePhoto: "Photo {{n}}",
    drivingLicenceStatusUploaded: "🪪 Driver's licence: uploaded",
    drivingLicenceStatusNotUploaded: "🪪 Driver's licence: not uploaded",
    sep: "--------------------------------",
  },
  ru: {
    newOrder: "🆕 НОВЫЙ ЗАКАЗ #{{n}}",
    car: "🚗 Авто:",
    from: "📅 С:",
    to: "📅 По:",
    pickup: "📍 Выдача:",
    ret: "↩️ Возврат:",
    insuranceCdwLine: "🛡️ Страховка: КАСКО",
    days: "🗓 Дней:",
    total: "💰 Итого:",
    customer: "👤 Клиент:",
    name: "Имя",
    phone: "Телефон",
    email: "Email",
    viber: "Viber ✓",
    whatsapp: "Whatsapp ✓",
    telegram: "Telegram ✓",
    order: "Заказ:",
    carLabel: "Авто:",
    action: "Действие:",
    oldPrice: "Старая цена:",
    newPrice: "Новая цена:",
    who: "Кто:",
    source: "Источник:",
    time: "Время:",
    dash: "—",
    footerLang: "Язык:",
    footerIp: "IP клиента:",
    footerCountry: "Страна:",
    footerRegion: "Регион:",
    footerCity: "Город:",
    intentCriticalEdit: "критическое изменение",
    intentSafeEdit: "безопасное изменение",
    intentOrderCreated: "создание заказа",
    intentOrderConfirmed: "подтверждение заказа",
    intentOrderUnconfirmed: "снятие подтверждения",
    intentOrderDeleted: "удаление заказа",
    intentUnknown: "изменение",
    reasonNewClient: "Создан новый клиентский заказ",
    reasonNewClientTesting: "Создан новый клиентский заказ (EMAIL_TESTING)",
    reasonCritical: "КРИТИЧНО: {{intent}} по подтверждённому клиентскому заказу",
    reasonInfo: "ИНФО: {{intent}} по подтверждённому клиентскому заказу",
    reasonAuditClient: "АУДИТ: удалён клиентский заказ",
    reasonAuditInternal: "АУДИТ: удалён внутренний заказ",
    orderDeletedLine: "❌ ЗАКАЗ УДАЛЁН #{{n}}",
    deletedByLine: "🛑 Удалил(а): {{who}}",
    drivingLicence: "🪪 Водительское удостоверение:",
    drivingLicencePhoto: "Фото {{n}}",
    drivingLicenceStatusUploaded: "🪪 Водительские права: загружены",
    drivingLicenceStatusNotUploaded: "🪪 Водительские права: не загружены",
    sep: "--------------------------------",
  },
  uk: {
    newOrder: "🆕 НОВЕ ЗАМОВЛЕННЯ #{{n}}",
    car: "🚗 Авто:",
    from: "📅 З:",
    to: "📅 До:",
    pickup: "📍 Видача:",
    ret: "↩️ Повернення:",
    insuranceCdwLine: "🛡️ Страхування: КАСКО",
    days: "🗓 Днів:",
    total: "💰 Разом:",
    customer: "👤 Клієнт:",
    name: "Ім'я",
    phone: "Телефон",
    email: "Email",
    viber: "Viber ✓",
    whatsapp: "Whatsapp ✓",
    telegram: "Telegram ✓",
    order: "Замовлення:",
    carLabel: "Авто:",
    action: "Дія:",
    oldPrice: "Стара ціна:",
    newPrice: "Нова ціна:",
    who: "Хто:",
    source: "Джерело:",
    time: "Час:",
    dash: "—",
    footerLang: "Мова:",
    footerIp: "IP клієнта:",
    footerCountry: "Країна:",
    footerRegion: "Регіон:",
    footerCity: "Місто:",
    intentCriticalEdit: "критична зміна",
    intentSafeEdit: "безпечна зміна",
    intentOrderCreated: "створення замовлення",
    intentOrderConfirmed: "підтвердження замовлення",
    intentOrderUnconfirmed: "скасування підтвердження",
    intentOrderDeleted: "видалення замовлення",
    intentUnknown: "зміна",
    reasonNewClient: "Створено нове клієнтське замовлення",
    reasonNewClientTesting: "Створено нове клієнтське замовлення (EMAIL_TESTING)",
    reasonCritical: "КРИТИЧНО: {{intent}} за підтвердженим клієнтським замовленням",
    reasonInfo: "ІНФО: {{intent}} за підтвердженим клієнтським замовленням",
    reasonAuditClient: "АУДИТ: видалено клієнтське замовлення",
    reasonAuditInternal: "АУДИТ: видалено внутрішнє замовлення",
    orderDeletedLine: "❌ ЗАМОВЛЕННЯ ВИДАЛЕНО #{{n}}",
    deletedByLine: "🛑 Видалив(ла): {{who}}",
    drivingLicence: "🪪 Водійське посвідчення:",
    drivingLicencePhoto: "Фото {{n}}",
    drivingLicenceStatusUploaded: "🪪 Водійське посвідчення: завантажено",
    drivingLicenceStatusNotUploaded: "🪪 Водійське посвідчення: не завантажено",
    sep: "--------------------------------",
  },
  de: {
    newOrder: "🆕 NEUE BESTELLUNG #{{n}}",
    car: "🚗 Auto:",
    from: "📅 Von:",
    to: "📅 Bis:",
    pickup: "📍 Abholung:",
    ret: "↩️ Rückgabe:",
    insuranceCdwLine: "🛡️ Versicherung: Vollkasko (CDW)",
    days: "🗓 Tage:",
    total: "💰 Gesamt:",
    customer: "👤 Kunde:",
    name: "Name",
    phone: "Telefon",
    email: "E-Mail",
    viber: "Viber ✓",
    whatsapp: "Whatsapp ✓",
    telegram: "Telegram ✓",
    order: "Bestellung:",
    carLabel: "Auto:",
    action: "Aktion:",
    oldPrice: "Alter Preis:",
    newPrice: "Neuer Preis:",
    who: "Wer:",
    source: "Quelle:",
    time: "Zeit:",
    dash: "—",
    footerLang: "Sprache:",
    footerIp: "Kunden-IP:",
    footerCountry: "Land:",
    footerRegion: "Region:",
    footerCity: "Stadt:",
    intentCriticalEdit: "kritische Änderung",
    intentSafeEdit: "unkritische Änderung",
    intentOrderCreated: "Bestellung erstellt",
    intentOrderConfirmed: "Bestellung bestätigt",
    intentOrderUnconfirmed: "Bestätigung aufgehoben",
    intentOrderDeleted: "Bestellung gelöscht",
    intentUnknown: "Änderung",
    reasonNewClient: "Neue Kundenbestellung erstellt",
    reasonNewClientTesting: "Neue Kundenbestellung erstellt (EMAIL_TESTING)",
    reasonCritical: "KRITISCH: {{intent}} bei bestätigter Kundenbestellung",
    reasonInfo: "INFO: {{intent}} bei bestätigter Kundenbestellung",
    reasonAuditClient: "AUDIT: Kundenbestellung gelöscht",
    reasonAuditInternal: "AUDIT: Interne Bestellung gelöscht",
    orderDeletedLine: "❌ BESTELLUNG GELÖSCHT #{{n}}",
    deletedByLine: "🛑 Gelöscht von: {{who}}",
    drivingLicence: "🪪 Führerschein:",
    drivingLicencePhoto: "Foto {{n}}",
    drivingLicenceStatusUploaded: "🪪 Führerschein: hochgeladen",
    drivingLicenceStatusNotUploaded: "🪪 Führerschein: nicht hochgeladen",
    sep: "--------------------------------",
  },
  el: {
    newOrder: "🆕 ΝΕΑ ΠΑΡΑΓΓΕΛΙΑ #{{n}}",
    car: "🚗 Αυτοκίνητο:",
    from: "📅 Από:",
    to: "📅 Έως:",
    pickup: "📍 Παραλαβή:",
    ret: "↩️ Επιστροφή:",
    insuranceCdwLine: "🛡️ Ασφάλεια: CDW",
    days: "🗓 Ημέρες:",
    total: "💰 Σύνολο:",
    customer: "👤 Πελάτης:",
    name: "Όνομα",
    phone: "Τηλέφωνο",
    email: "Email",
    viber: "Viber ✓",
    whatsapp: "Whatsapp ✓",
    telegram: "Telegram ✓",
    order: "Παραγγελία:",
    carLabel: "Αυτοκίνητο:",
    action: "Ενέργεια:",
    oldPrice: "Παλιά τιμή:",
    newPrice: "Νέα τιμή:",
    who: "Ποιος:",
    source: "Πηγή:",
    time: "Ώρα:",
    dash: "—",
    footerLang: "Γλώσσα:",
    footerIp: "IP πελάτη:",
    footerCountry: "Χώρα:",
    footerRegion: "Περιοχή:",
    footerCity: "Πόλη:",
    intentCriticalEdit: "κρίσιμη αλλαγή",
    intentSafeEdit: "ασφαλής αλλαγή",
    intentOrderCreated: "δημιουργία παραγγελίας",
    intentOrderConfirmed: "επιβεβαίωση παραγγελίας",
    intentOrderUnconfirmed: "αναίρεση επιβεβαίωσης",
    intentOrderDeleted: "διαγραφή παραγγελίας",
    intentUnknown: "αλλαγή",
    reasonNewClient: "Δημιουργήθηκε νέα παραγγελία πελάτη",
    reasonNewClientTesting: "Δημιουργήθηκε νέα παραγγελία πελάτη (EMAIL_TESTING)",
    reasonCritical: "ΚΡΙΣΙΜΟ: {{intent}} σε επιβεβαιωμένη παραγγελία πελάτη",
    reasonInfo: "ΠΛΗΡΟΦΟΡΙΑ: {{intent}} σε επιβεβαιωμένη παραγγελία πελάτη",
    reasonAuditClient: "ΕΛΕΓΧΟΣ: Διαγράφηκε παραγγελία πελάτη",
    reasonAuditInternal: "ΕΛΕΓΧΟΣ: Διαγράφηκε εσωτερική παραγγελία",
    orderDeletedLine: "❌ Η ΠΑΡΑΓΓΕΛΙΑ ΔΙΑΓΡΑΦΗΚΕ #{{n}}",
    deletedByLine: "🛑 Διαγράφηκε από: {{who}}",
    drivingLicence: "🪪 Άδεια οδήγησης:",
    drivingLicencePhoto: "Φωτογραφία {{n}}",
    drivingLicenceStatusUploaded: "🪪 Άδεια οδήγησης: μεταφορτώθηκε",
    drivingLicenceStatusNotUploaded: "🪪 Άδεια οδήγησης: δεν μεταφορτώθηκε",
    sep: "--------------------------------",
  },
  bg: {
    newOrder: "🆕 НОВА ПОРЪЧКА #{{n}}",
    car: "🚗 Автомобил:",
    from: "📅 От:",
    to: "📅 До:",
    pickup: "📍 Вземане:",
    ret: "↩️ Връщане:",
    insuranceCdwLine: "🛡️ Застраховка: КАСКО",
    days: "🗓 Дни:",
    total: "💰 Общо:",
    customer: "👤 Клиент:",
    name: "Име",
    phone: "Телефон",
    email: "Имейл",
    viber: "Viber ✓",
    whatsapp: "Whatsapp ✓",
    telegram: "Telegram ✓",
    order: "Поръчка:",
    carLabel: "Автомобил:",
    action: "Действие:",
    oldPrice: "Стара цена:",
    newPrice: "Нова цена:",
    who: "Кой:",
    source: "Източник:",
    time: "Време:",
    dash: "—",
    footerLang: "Език:",
    footerIp: "IP на клиента:",
    footerCountry: "Държава:",
    footerRegion: "Регион:",
    footerCity: "Град:",
    intentCriticalEdit: "критична промяна",
    intentSafeEdit: "безопасна промяна",
    intentOrderCreated: "създаване на поръчка",
    intentOrderConfirmed: "потвърждаване на поръчка",
    intentOrderUnconfirmed: "отмяна на потвърждение",
    intentOrderDeleted: "изтриване на поръчка",
    intentUnknown: "промяна",
    reasonNewClient: "Създадена е нова клиентска поръчка",
    reasonNewClientTesting: "Създадена е нова клиентска поръчка (EMAIL_TESTING)",
    reasonCritical: "КРИТИЧНО: {{intent}} при потвърдена клиентска поръчка",
    reasonInfo: "ИНФО: {{intent}} при потвърдена клиентска поръчка",
    reasonAuditClient: "ОДИТ: Изтрита клиентска поръчка",
    reasonAuditInternal: "ОДИТ: Изтрита вътрешна поръчка",
    orderDeletedLine: "❌ ПОРЪЧКАТА Е ИЗТРИТА #{{n}}",
    deletedByLine: "🛑 Изтрита от: {{who}}",
    drivingLicence: "🪪 Шофьорска книжка:",
    drivingLicencePhoto: "Снимка {{n}}",
    drivingLicenceStatusUploaded: "🪪 Шофьорска книжка: качена",
    drivingLicenceStatusNotUploaded: "🪪 Шофьорска книжка: не е качена",
    sep: "--------------------------------",
  },
  ro: {
    newOrder: "🆕 COMANDĂ NOUĂ #{{n}}",
    car: "🚗 Mașină:",
    from: "📅 De la:",
    to: "📅 Până la:",
    pickup: "📍 Predare:",
    ret: "↩️ Returnare:",
    insuranceCdwLine: "🛡️ Asigurare: CDW",
    days: "🗓 Zile:",
    total: "💰 Total:",
    customer: "👤 Client:",
    name: "Nume",
    phone: "Telefon",
    email: "Email",
    viber: "Viber ✓",
    whatsapp: "Whatsapp ✓",
    telegram: "Telegram ✓",
    order: "Comandă:",
    carLabel: "Mașină:",
    action: "Acțiune:",
    oldPrice: "Preț vechi:",
    newPrice: "Preț nou:",
    who: "Cine:",
    source: "Sursă:",
    time: "Oră:",
    dash: "—",
    footerLang: "Limbă:",
    footerIp: "IP client:",
    footerCountry: "Țară:",
    footerRegion: "Regiune:",
    footerCity: "Oraș:",
    intentCriticalEdit: "modificare critică",
    intentSafeEdit: "modificare sigură",
    intentOrderCreated: "creare comandă",
    intentOrderConfirmed: "confirmare comandă",
    intentOrderUnconfirmed: "anulare confirmare",
    intentOrderDeleted: "ștergere comandă",
    intentUnknown: "modificare",
    reasonNewClient: "Comandă nouă de client creată",
    reasonNewClientTesting: "Comandă nouă de client creată (EMAIL_TESTING)",
    reasonCritical: "CRITIC: {{intent}} la comandă client confirmată",
    reasonInfo: "INFO: {{intent}} la comandă client confirmată",
    reasonAuditClient: "AUDIT: Comandă client ștearsă",
    reasonAuditInternal: "AUDIT: Comandă internă ștearsă",
    orderDeletedLine: "❌ COMANDĂ ȘTEARSĂ #{{n}}",
    deletedByLine: "🛑 Șters de: {{who}}",
    drivingLicence: "🪪 Permis de conducere:",
    drivingLicencePhoto: "Fotografie {{n}}",
    drivingLicenceStatusUploaded: "🪪 Permis de conducere: încărcat",
    drivingLicenceStatusNotUploaded: "🪪 Permis de conducere: neîncărcat",
    sep: "--------------------------------",
  },
  // Latinica kao u locales/sr.json
  sr: {
    newOrder: "🆕 NOVA NARUDŽBINA #{{n}}",
    car: "🚗 Vozilo:",
    from: "📅 Od:",
    to: "📅 Do:",
    pickup: "📍 Preuzimanje:",
    ret: "↩️ Vraćanje:",
    insuranceCdwLine: "🛡️ Osiguranje: CDW (KASKO)",
    days: "🗓 Dana:",
    total: "💰 Ukupno:",
    customer: "👤 Klijent:",
    name: "Ime",
    phone: "Telefon",
    email: "Email",
    viber: "Viber ✓",
    whatsapp: "Whatsapp ✓",
    telegram: "Telegram ✓",
    order: "Narudžbina:",
    carLabel: "Vozilo:",
    action: "Akcija:",
    oldPrice: "Stara cena:",
    newPrice: "Nova cena:",
    who: "Ko:",
    source: "Izvor:",
    time: "Vreme:",
    dash: "—",
    footerLang: "Jezik:",
    footerIp: "IP klijenta:",
    footerCountry: "Država:",
    footerRegion: "Region:",
    footerCity: "Grad:",
    intentCriticalEdit: "kritična izmena",
    intentSafeEdit: "bezbedna izmena",
    intentOrderCreated: "kreiranje narudžbine",
    intentOrderConfirmed: "potvrda narudžbine",
    intentOrderUnconfirmed: "poništanje potvrde",
    intentOrderDeleted: "brisanje narudžbine",
    intentUnknown: "izmena",
    reasonNewClient: "Kreirana je nova klijentska narudžbina",
    reasonNewClientTesting: "Kreirana je nova klijentska narudžbina (EMAIL_TESTING)",
    reasonCritical: "KRITIČNO: {{intent}} na potvrđenoj klijentskoj narudžbini",
    reasonInfo: "INFO: {{intent}} na potvrđenoj klijentskoj narudžbini",
    reasonAuditClient: "AUDIT: Obrisana klijentska narudžbina",
    reasonAuditInternal: "AUDIT: Obrisana interna narudžbina",
    orderDeletedLine: "❌ NARUDŽBINA OBRISANA #{{n}}",
    deletedByLine: "🛑 Obrisao/la: {{who}}",
    drivingLicence: "🪪 Vozačka dozvola:",
    drivingLicencePhoto: "Fotografija {{n}}",
    drivingLicenceStatusUploaded: "🪪 Vozačka dozvola: otpremljeno",
    drivingLicenceStatusNotUploaded: "🪪 Vozačka dozvola: nije otpremljeno",
    sep: "--------------------------------",
  },
};

/**
 * Сообщение в Telegram при удалении заказа (legacy-путь deleteOne).
 * @param {object} order — id, startDate, endDate (ISO), totalPrice, currency, car, customer
 * @param {string} deletedBy
 * @param {string} locale
 */
export function formatOrderDeletedTelegramMessage(order, deletedBy, locale) {
  const t = tBundle(locale);
  const currencySymbol = order.currency === "EUR" ? "€" : `${order.currency} `;
  const start = formatDateShort(order.startDate);
  const end = formatDateShort(order.endDate);

  const lines = [];
  lines.push(t.sep);
  lines.push(tpl(t.orderDeletedLine, { n: order.id }));
  if (order.car) {
    const carInfo = order.car.model
      ? `${order.car.model}${order.car.regNumber ? ` (${order.car.regNumber})` : ""}`
      : String(order.car);
    lines.push(`${t.car} ${carInfo}`);
  }
  lines.push(`${t.from} ${start}`);
  lines.push(`${t.to} ${end}`);
  lines.push(`${t.total} ${currencySymbol}${order.totalPrice}`);
  lines.push("");
  lines.push(t.customer);
  lines.push(`• ${t.name}: ${order.customer?.name || t.dash}`);
  if (order.customer?.phone) {
    lines.push(`• ${t.phone}: ${order.customer.phone}`);
  }
  if (order.customer?.email) {
    lines.push(`• ${t.email}: ${order.customer.email}`);
  }
  if (deletedBy) {
    lines.push("");
    lines.push(tpl(t.deletedByLine, { who: deletedBy }));
  }
  lines.push(t.sep);
  return lines.join("\n");
}

/** Полные названия языков / опечатки → код проекта */
const LOCALE_ALIASES = {
  german: "de",
  deutsch: "de",
  english: "en",
  russian: "ru",
  ukrainian: "uk",
  greek: "el",
  bulgarian: "bg",
  romanian: "ro",
  serbian: "sr",
  polish: "pl",
  polski: "pl",
};

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeNotifyLocale(raw) {
  if (raw == null) return "en";
  const s = String(raw).trim().toLowerCase();
  if (!s) return "en";
  let code = s.split(/[-_]/)[0];
  if (LOCALE_ALIASES[code]) code = LOCALE_ALIASES[code];
  if (LOCALE_ALIASES[s]) code = LOCALE_ALIASES[s];
  if (SUPPORTED.includes(code)) return code;
  return "en";
}

/**
 * Языки писем/Telegram админу и суперадмину из документа Company.
 * — общий fallback: notifyLanguage, language, locale (если нет специализированных полей)
 * — если задан только langAdmin или только langSuperadmin — второй канал получает тот же код
 *
 * @param {Record<string, unknown>|null|undefined} doc
 * @returns {{ langAdmin: string, langSuperadmin: string }}
 */
export function resolveNotifyLanguagesFromCompanyDoc(doc) {
  if (!doc || typeof doc !== "object") {
    return { langAdmin: "en", langSuperadmin: "en" };
  }

  const empty = (v) => v == null || String(v).trim() === "";
  const rawA = doc.langAdmin;
  const rawS = doc.langSuperadmin;
  const rawCommon = doc.notifyLanguage ?? doc.language ?? doc.locale;

  let effA = !empty(rawA) ? rawA : rawCommon;
  let effS = !empty(rawS) ? rawS : rawCommon;

  if (!empty(rawA) && empty(rawS)) effS = rawA;
  if (empty(rawA) && !empty(rawS)) effA = rawS;

  return {
    langAdmin: normalizeNotifyLocale(effA),
    langSuperadmin: normalizeNotifyLocale(effS),
  };
}

/**
 * @param {string} locale
 * @returns {Record<string, string>}
 */
function tBundle(locale) {
  const l = normalizeNotifyLocale(locale);
  return DICT[l] || DICT.en;
}

function tpl(str, vars) {
  let out = str == null ? "" : String(str);
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(String(v));
  }
  return out;
}

/** @param {import("./orderNotificationDispatcher").NotificationPayload} payload */
function drivingLicenceUrlsFromPayload(payload) {
  const raw = payload?.drivingLicenceUrls;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (u) => typeof u === "string" && u.trim().startsWith("https://")
  );
}

function hasDrivingLicenceUploadFromPayload(payload) {
  if (payload?.hasDrivingLicenceUpload === true) {
    return true;
  }
  return drivingLicenceUrlsFromPayload(payload).length > 0;
}

/** Одна строка для Telegram/email: права загружены или нет (по валидным HTTPS URL). */
function formatDrivingLicenceStatusLine(payload, t) {
  return hasDrivingLicenceUploadFromPayload(payload)
    ? t.drivingLicenceStatusUploaded
    : t.drivingLicenceStatusNotUploaded;
}

function formatDateShort(d) {
  if (!d) return "—";
  const athens = fromServerUTC(d);
  if (!athens || !athens.isValid()) return "—";
  return athens.format("DD-MM-YY");
}

/** Время (HH:mm) в Europe/Athens из сохранённого ISO/Date; для уведомлений админу. */
function formatTimeAthens(d) {
  if (!d) return null;
  const athens = fromServerUTC(d);
  if (!athens || !athens.isValid()) return null;
  return athens.format("HH:mm");
}

/** Дата DD-MM-YY + при наличии « (HH:mm)» из timeIn/timeOut заказа. */
function formatDateShortWithPickupReturnTime(dateField, timeField) {
  const datePart = formatDateShort(dateField);
  if (datePart === "—") return "—";
  const timePart = formatTimeAthens(timeField);
  return timePart ? `${datePart} (${timePart})` : datePart;
}

/**
 * @param {string} intent
 * @param {string} locale
 */
function intentPhrase(intent, locale) {
  const t = tBundle(locale);
  const map = {
    CRITICAL_EDIT: t.intentCriticalEdit,
    SAFE_EDIT: t.intentSafeEdit,
    ORDER_CREATED: t.intentOrderCreated,
    ORDER_CONFIRMED: t.intentOrderConfirmed,
    ORDER_UNCONFIRMED: t.intentOrderUnconfirmed,
    ORDER_DELETED: t.intentOrderDeleted,
    UNKNOWN: t.intentUnknown,
  };
  return map[intent] || map.UNKNOWN;
}

/**
 * Переводит reason из политики уведомлений (исходная строка на английском).
 * @param {string} reason
 * @param {string} locale
 * @param {string} [payloadIntent]
 */
export function translateAdminReason(reason, locale, payloadIntent = "") {
  const t = tBundle(locale);
  if (reason === "New client order created") return t.reasonNewClient;
  if (reason === "New client order created (EMAIL_TESTING)") return t.reasonNewClientTesting;

  const crit = /^CRITICAL: (\w+) on confirmed client order$/;
  const info = /^INFO: (\w+) on confirmed client order$/;
  const m1 = reason.match(crit);
  if (m1) {
    const intentKey = m1[1];
    return tpl(t.reasonCritical, { intent: intentPhrase(intentKey, locale) });
  }
  const m2 = reason.match(info);
  if (m2) {
    const intentKey = m2[1];
    return tpl(t.reasonInfo, { intent: intentPhrase(intentKey, locale) });
  }
  if (reason === "AUDIT: Client order deleted") return t.reasonAuditClient;
  if (reason === "AUDIT: Internal order deleted") return t.reasonAuditInternal;

  // Письма клиенту / прочие — оставляем как есть (не используются с admin locale)
  return reason;
}

/**
 * @param {import("./orderNotificationDispatcher").NotificationPayload} payload
 * @param {string} reason
 * @param {string} locale
 * @param {{ includeDrivingLicenceInfo?: boolean }} [options]
 */
export function formatAdminNotificationBody(payload, reason, locale, options = {}) {
  const t = tBundle(locale);
  const includeDrivingLicenceInfo = options.includeDrivingLicenceInfo === true;
  const carRegNumber =
    payload.regNumber && String(payload.regNumber).trim()
      ? String(payload.regNumber).trim()
      : payload.carNumber && String(payload.carNumber).trim()
        ? String(payload.carNumber).trim()
        : "";
  const carDisplay = carRegNumber
    ? `${payload.carModel || t.dash} (${carRegNumber})`
    : payload.carModel || t.dash;

  if (payload.intent === "ORDER_CREATED") {
    const days =
      payload.numberOfDays ??
      getBusinessDaySpanFromStoredDates(payload.rentalStartDate, payload.rentalEndDate);
    const isCdw =
      String(payload.insurance ?? "")
        .trim()
        .toUpperCase() === "CDW";
    const insuranceLine = isCdw ? t.insuranceCdwLine : null;
    const customerLines = [
      payload.customerName != null ? `• ${t.name}: ${payload.customerName}` : null,
      payload.phone != null ? `• ${t.phone}: ${payload.phone}` : null,
      payload.email != null && payload.email !== "" ? `• ${t.email}: ${payload.email}` : null,
      payload.Viber === true ? `• ${t.viber}` : null,
      payload.Whatsapp === true ? `• ${t.whatsapp}` : null,
      payload.Telegram === true ? `• ${t.telegram}` : null,
    ].filter(Boolean);
    const hasPII = customerLines.length > 0;
    const licenceUrls = includeDrivingLicenceInfo
      ? drivingLicenceUrlsFromPayload(payload)
      : [];
    const licenceStatusLine = includeDrivingLicenceInfo
      ? formatDrivingLicenceStatusLine(payload, t)
      : null;
    const licenceBlock =
      includeDrivingLicenceInfo && licenceUrls.length > 0
        ? [
            "",
            t.drivingLicence,
            ...licenceUrls.map((u, i) =>
              `• ${tpl(t.drivingLicencePhoto, { n: i + 1 })}: ${u.trim()}`
            ),
          ]
        : [];
    const showFooterRule = true;
    const lines = [
      tpl(t.newOrder, { n: payload.orderNumber || payload.orderId }),
      `${t.car} ${carDisplay}`,
      `${t.from} ${formatDateShortWithPickupReturnTime(payload.rentalStartDate, payload.timeIn)}`,
      `${t.to} ${formatDateShortWithPickupReturnTime(payload.rentalEndDate, payload.timeOut)}`,
      `${t.pickup} ${payload.placeIn || t.dash}`,
      `${t.ret} ${payload.placeOut || t.dash}`,
      ...(insuranceLine ? [insuranceLine] : []),
      `${t.days} ${days}`,
      `${t.total} €${payload.totalPrice ?? ""}`,
      licenceStatusLine,
      ...(hasPII ? ["", t.customer, ...customerLines] : []),
      ...licenceBlock,
      ...(showFooterRule ? ["------------"] : []),
    ].filter(Boolean);
    return lines.join("\n");
  }

  const oldPrice =
    typeof payload.oldPrice === "number" && !Number.isNaN(payload.oldPrice)
      ? payload.oldPrice
      : null;
  const newPrice =
    typeof payload.newPrice === "number" && !Number.isNaN(payload.newPrice)
      ? payload.newPrice
      : null;

  // Первая строка с «reason» — только в теме письма / заголовке Telegram (translateAdminReason)
  const lines = [
    `${t.order} ${payload.orderNumber || payload.orderId}`,
    `${t.carLabel} ${carDisplay || t.dash}`,
    includeDrivingLicenceInfo ? formatDrivingLicenceStatusLine(payload, t) : null,
    `${t.action} ${payload.action}`,
    oldPrice !== null ? `${t.oldPrice} €${oldPrice.toFixed(2)}` : null,
    newPrice !== null ? `${t.newPrice} €${newPrice.toFixed(2)}` : null,
    payload.actorName ? `${t.who} ${payload.actorName}` : null,
    `${t.source} ${payload.source}`,
    payload.timestamp ? `${t.time} ${new Date(payload.timestamp).toISOString()}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function nonEmptyString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/**
 * @param {import("./orderNotificationDispatcher").NotificationPayload} payload
 * @param {string} locale
 */
export function formatSuperadminClientContextFooter(payload, locale) {
  const t = tBundle(locale);
  const dash = t.dash;
  const lang =
    nonEmptyString(payload.clientLang) || nonEmptyString(payload.locale) || dash;
  const ip = nonEmptyString(payload.clientIP) || dash;
  const country = nonEmptyString(payload.clientCountry) || dash;
  const region = nonEmptyString(payload.clientRegion) || dash;
  const city = nonEmptyString(payload.clientCity) || dash;
  return [
    "",
    `• ${t.footerLang} ${lang}`,
    `• ${t.footerIp} ${ip}`,
    `• ${t.footerCountry} ${country}`,
    `• ${t.footerRegion} ${region}`,
    `• ${t.footerCity} ${city}`,
  ].join("\n");
}

/**
 * @param {import("./orderNotificationDispatcher").NotificationPayload} payload
 * @param {string} locale
 */
export function formatCompanyEmailClientLocaleFooter(payload, locale) {
  const t = tBundle(locale);
  const dash = t.dash;
  const lang =
    nonEmptyString(payload.clientLang) || nonEmptyString(payload.locale) || dash;
  const country = nonEmptyString(payload.clientCountry) || dash;
  return ["", `• ${t.footerLang} ${lang}`, `• ${t.footerCountry} ${country}`].join("\n");
}
