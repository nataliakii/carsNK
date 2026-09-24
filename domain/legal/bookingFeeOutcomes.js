/**
 * One data source for the Booking Fee outcomes table.
 */

export const BOOKING_FEE_TABLE_LOCALES = Object.freeze(["en", "es", "ru", "uk"]);

const TABLES = Object.freeze({
  en: {
    title: "What happens to the Rovaro Booking Fee?",
    columns: ["Situation", "Booking Fee", "Supplier consequence"],
    footnote:
      "Every case may be reviewed individually. Customer statutory rights and applicable law always take priority.",
    rows: [
      ["Customer cancels the booking", "Retained by Rovaro", "None"],
      [
        "Customer does not meet requirements clearly disclosed before payment",
        "Rovaro may retain the fee after review",
        "None if the refusal is justified",
      ],
      [
        "Suspected fraud, identity misuse, invalid documents or a genuine safety concern",
        "Rovaro decides after reviewing the circumstances",
        "None if the refusal is justified",
      ],
      [
        "Supplier cannot provide the confirmed vehicle",
        "Refunded in full",
        "Supplier reimburses Rovaro for the refunded Booking Fee",
      ],
      [
        "Supplier changes the vehicle or price and the customer does not agree",
        "Refunded in full",
        "Supplier reimburses Rovaro for the refunded Booking Fee",
      ],
      [
        "Force majeure",
        "Decided according to the circumstances",
        "Normally no service-failure charge",
      ],
      [
        "Applicable law requires a refund",
        "Refunded in full",
        "Determined according to the reason and applicable law",
      ],
    ],
  },
  es: {
    title: "¿Qué ocurre con la tarifa de reserva de Rovaro?",
    columns: ["Situación", "Tarifa de reserva", "Consecuencia para el proveedor"],
    footnote:
      "Cada caso puede revisarse individualmente. Los derechos legales del cliente y la legislación aplicable siempre tienen prioridad.",
    rows: [
      ["El cliente cancela la reserva", "Rovaro conserva la tarifa", "Ninguna"],
      [
        "El cliente no cumple requisitos claramente indicados antes del pago",
        "Rovaro puede conservar la tarifa después de revisar el caso",
        "Ninguna si la negativa está justificada",
      ],
      [
        "Sospecha de fraude, uso indebido de identidad, documentos no válidos o un riesgo real de seguridad",
        "Rovaro decide después de revisar las circunstancias",
        "Ninguna si la negativa está justificada",
      ],
      [
        "El proveedor no puede entregar el vehículo confirmado",
        "Reembolso completo",
        "El proveedor reembolsa a Rovaro la tarifa de reserva devuelta al cliente",
      ],
      [
        "El proveedor cambia el vehículo o el precio y el cliente no está de acuerdo",
        "Reembolso completo",
        "El proveedor reembolsa a Rovaro la tarifa de reserva devuelta al cliente",
      ],
      [
        "Fuerza mayor",
        "Se decide según las circunstancias",
        "Normalmente no se aplica cargo por incumplimiento",
      ],
      [
        "La legislación aplicable exige un reembolso",
        "Reembolso completo",
        "Se determina según la causa y la legislación aplicable",
      ],
    ],
  },
  ru: {
    title: "Что происходит с комиссией за бронирование Rovaro?",
    columns: ["Ситуация", "Комиссия за бронирование", "Последствие для поставщика"],
    footnote:
      "Каждая ситуация может рассматриваться индивидуально. Законные права клиента и применимое законодательство всегда имеют приоритет.",
    rows: [
      ["Клиент отменяет бронирование", "Rovaro сохраняет комиссию", "Нет"],
      [
        "Клиент не соответствует требованиям, ясно указанным до оплаты",
        "Rovaro может сохранить комиссию после рассмотрения ситуации",
        "Нет, если отказ обоснован",
      ],
      [
        "Подозрение на мошенничество, неправомерное использование личности, недействительные документы или реальная угроза безопасности",
        "Rovaro принимает решение после рассмотрения обстоятельств",
        "Нет, если отказ обоснован",
      ],
      [
        "Поставщик не может предоставить подтверждённый автомобиль",
        "Полный возврат",
        "Поставщик компенсирует Rovaro возвращённую клиенту комиссию",
      ],
      [
        "Поставщик меняет автомобиль или цену, а клиент не согласен",
        "Полный возврат",
        "Поставщик компенсирует Rovaro возвращённую клиенту комиссию",
      ],
      [
        "Форс-мажор",
        "Решение принимается с учётом обстоятельств",
        "Обычно без штрафа за невозможность оказать услугу",
      ],
      [
        "Возврат требуется применимым законодательством",
        "Полный возврат",
        "Определяется с учётом причины и применимого законодательства",
      ],
    ],
  },
  uk: {
    title: "Що відбувається з комісією за бронювання Rovaro?",
    columns: ["Ситуація", "Комісія за бронювання", "Наслідок для постачальника"],
    footnote:
      "Кожна ситуація може розглядатися індивідуально. Законні права клієнта та застосовне законодавство завжди мають пріоритет.",
    rows: [
      ["Клієнт скасовує бронювання", "Rovaro зберігає комісію", "Немає"],
      [
        "Клієнт не відповідає вимогам, чітко зазначеним до оплати",
        "Rovaro може зберегти комісію після розгляду ситуації",
        "Немає, якщо відмова обґрунтована",
      ],
      [
        "Підозра на шахрайство, неправомірне використання особи, недійсні документи або реальна загроза безпеці",
        "Rovaro приймає рішення після розгляду обставин",
        "Немає, якщо відмова обґрунтована",
      ],
      [
        "Постачальник не може надати підтверджений автомобіль",
        "Повне повернення",
        "Постачальник компенсує Rovaro повернену клієнту комісію",
      ],
      [
        "Постачальник змінює автомобіль або ціну, а клієнт не погоджується",
        "Повне повернення",
        "Постачальник компенсує Rovaro повернену клієнту комісію",
      ],
      [
        "Форс-мажор",
        "Рішення приймається з урахуванням обставин",
        "Зазвичай без штрафу за неможливість надати послугу",
      ],
      [
        "Повернення вимагається застосовним законодавством",
        "Повне повернення",
        "Визначається з урахуванням причини та застосовного законодавства",
      ],
    ],
  },
});

export function bookingFeeTable(language) {
  const code = String(language || "en").toLowerCase().split("-")[0];
  return TABLES[code] || TABLES.en;
}

export function renderBookingFeeTable(language) {
  const table = bookingFeeTable(language);
  return {
    title: table.title,
    columns: table.columns,
    rows: table.rows.map((cells) => ({
      situation: cells[0],
      bookingFee: cells[1],
      supplierConsequence: cells[2],
    })),
    footnote: table.footnote,
  };
}
