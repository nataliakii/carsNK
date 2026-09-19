import { normalizeNotifyLocale } from "@/domain/orders/adminNotifyLocales";

const TRANSFER_PARTNER_DICT = {
  en: {
    subject: "{{brand}} — transfer lead (first to claim wins)",
    title: "{{brand}} — new transfer lead",
    greeting:
      "Hi {{company}}, a customer requested a transfer in your region. All partners received this lead at the same time — <strong>the first to confirm gets it</strong>.",
    commission:
      "Platform commission: <strong>{{percent}}%</strong> (you keep the rest of the price you agree with the client).",
    cta: "Check if still available &amp; claim",
    footer:
      "Open the link, verify the lead is still open, then claim it. If another partner already took it, the page will say so.",
    from: "From",
    to: "To",
    when: "When",
    passengers: "Passengers",
    distance: "Distance",
    name: "Name",
    phone: "Phone",
    email: "Email",
    notes: "Notes",
    commissionPlain: "Platform commission",
  },
  es: {
    subject: "{{brand}} — lead de traslado (el primero en confirmar gana)",
    title: "{{brand}} — nuevo lead de traslado",
    greeting:
      "Hola {{company}}, un cliente ha solicitado un traslado en tu zona. Todos los partners reciben este lead a la vez — <strong>el primero en confirmar se lo queda</strong>.",
    commission:
      "Comisión de la plataforma: <strong>{{percent}}%</strong> (tú te quedas el resto del precio acordado con el cliente).",
    cta: "Comprobar si sigue disponible y reclamar",
    footer:
      "Abre el enlace, comprueba que el lead sigue abierto y reclámalo. Si otro partner ya lo tomó, la página lo indicará.",
    from: "Desde",
    to: "Hasta",
    when: "Cuándo",
    passengers: "Pasajeros",
    distance: "Distancia",
    name: "Nombre",
    phone: "Teléfono",
    email: "Email",
    notes: "Notas",
    commissionPlain: "Comisión de la plataforma",
  },
  ru: {
    subject: "{{brand}} — заявка на трансфер (кто первый подтвердит)",
    title: "{{brand}} — новая заявка на трансфер",
    greeting:
      "Здравствуйте, {{company}}! Клиент запросил трансфер в вашем регионе. Заявку получили все партнёры одновременно — <strong>кто первый подтвердит, тому она и уходит</strong>.",
    commission:
      "Комиссия платформы: <strong>{{percent}}%</strong> (остальное — ваша доля от цены с клиентом).",
    cta: "Проверить актуальность и забрать",
    footer:
      "Откройте ссылку, проверьте, что заявка ещё свободна, и заберите её. Если другой партнёр уже взял — страница это покажет.",
    from: "Откуда",
    to: "Куда",
    when: "Когда",
    passengers: "Пассажиры",
    distance: "Расстояние",
    name: "Имя",
    phone: "Телефон",
    email: "Email",
    notes: "Заметки",
    commissionPlain: "Комиссия платформы",
  },
  el: {
    subject: "{{brand}} — αίτημα transfer (ο πρώτος που επιβεβαιώνει)",
    title: "{{brand}} — νέο αίτημα transfer",
    greeting:
      "Γεια σας {{company}}, ένας πελάτης ζήτησε transfer στην περιοχή σας. Όλοι οι συνεργάτες το έλαβαν ταυτόχρονα — <strong>ο πρώτος που επιβεβαιώνει το παίρνει</strong>.",
    commission:
      "Προμήθεια πλατφόρμας: <strong>{{percent}}%</strong> (κρατάτε το υπόλοιπο της τιμής που συμφωνείτε με τον πελάτη).",
    cta: "Έλεγχος διαθεσιμότητας &amp; ανάληψη",
    footer:
      "Ανοίξτε τον σύνδεσμο, ελέγξτε αν το αίτημα είναι ακόμα ανοιχτό και αναλάβετέ το.",
    from: "Από",
    to: "Προς",
    when: "Πότε",
    passengers: "Επιβάτες",
    distance: "Απόσταση",
    name: "Όνομα",
    phone: "Τηλέφωνο",
    email: "Email",
    notes: "Σημειώσεις",
    commissionPlain: "Προμήθεια πλατφόρμας",
  },
  de: {
    subject: "{{brand}} — Transfer-Anfrage (wer zuerst bestätigt)",
    title: "{{brand}} — neue Transfer-Anfrage",
    greeting:
      "Hallo {{company}}, ein Kunde hat einen Transfer in Ihrer Region angefragt. Alle Partner erhalten diese Anfrage gleichzeitig — <strong>wer zuerst bestätigt, erhält den Auftrag</strong>.",
    commission:
      "Plattformprovision: <strong>{{percent}}%</strong> (Sie behalten den Rest des mit dem Kunden vereinbarten Preises).",
    cta: "Verfügbarkeit prüfen &amp; übernehmen",
    footer:
      "Link öffnen, prüfen ob die Anfrage noch offen ist, dann übernehmen. Wenn ein anderer Partner schon zugeschlagen hat, zeigt die Seite das an.",
    from: "Von",
    to: "Nach",
    when: "Wann",
    passengers: "Passagiere",
    distance: "Distanz",
    name: "Name",
    phone: "Telefon",
    email: "E-Mail",
    notes: "Notizen",
    commissionPlain: "Plattformprovision",
  },
  uk: {
    subject: "{{brand}} — заявка на трансфер (хто перший підтвердить)",
    title: "{{brand}} — нова заявка на трансфер",
    greeting:
      "Вітаємо, {{company}}! Клієнт запросив трансфер у вашому регіоні. Заявку отримали всі партнери одночасно — <strong>хто перший підтвердить, тому вона йде</strong>.",
    commission:
      "Комісія платформи: <strong>{{percent}}%</strong> (решта — ваша частка від ціни з клієнтом).",
    cta: "Перевірити актуальність і забрати",
    footer:
      "Відкрийте посилання, перевірте що заявка ще вільна, і заберіть її.",
    from: "Звідки",
    to: "Куди",
    when: "Коли",
    passengers: "Пасажири",
    distance: "Відстань",
    name: "Ім'я",
    phone: "Телефон",
    email: "Email",
    notes: "Нотатки",
    commissionPlain: "Комісія платформи",
  },
};

function tpl(str, vars) {
  let out = String(str || "");
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.split(`{{${k}}}`).join(String(v));
  }
  return out;
}

export function getTransferPartnerEmailCopy(locale) {
  const code = normalizeNotifyLocale(locale);
  return TRANSFER_PARTNER_DICT[code] || TRANSFER_PARTNER_DICT.en;
}

export function formatTransferPartnerSubject(locale, brandName) {
  const t = getTransferPartnerEmailCopy(locale);
  return tpl(t.subject, { brand: brandName });
}

export { tpl as transferEmailTpl };
