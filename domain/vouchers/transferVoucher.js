/**
 * Transfer voucher form data + labels.
 * Locales: `el` (Greece), `es` (Spain), `en` (always secondary).
 */

const MAX_TEXT_LENGTH = 800;

const todayInputValue = () => new Date().toISOString().slice(0, 10);

export const TRANSFER_VOUCHER_STAMP_SRC = "/vouchers/natali-cars-stamp.png";

/** All voucher locales the product can render. */
export const TRANSFER_VOUCHER_LOCALES = ["el", "es", "en"];

/**
 * Which pair of language tabs to show for a company market.
 * Spain → Español + English; Greece (default) → Ελληνικά + English.
 */
export function getVoucherMarketLocales(country) {
  const code = String(country || "")
    .trim()
    .toUpperCase();
  if (code === "ES") {
    return {
      country: "ES",
      primary: "es",
      secondary: "en",
      locales: ["es", "en"],
      tabLabels: { es: "Español", en: "English" },
    };
  }
  return {
    country: code || "GR",
    primary: "el",
    secondary: "en",
    locales: ["el", "en"],
    tabLabels: { el: "Ελληνικά", en: "English" },
  };
}

/**
 * Map a requested/site language into a locale allowed for this market.
 */
export function resolveVoucherLocaleForMarket(requested, country) {
  const market = getVoucherMarketLocales(country);
  const code = String(requested || "")
    .toLowerCase()
    .slice(0, 2);
  if (market.locales.includes(code)) return code;
  // Greek UI language while editing a Spain company → Spanish primary
  if (code === "el" && market.primary === "es") return "es";
  // Spanish UI language while editing a Greece company → English
  if (code === "es" && market.primary === "el") return "en";
  return market.primary;
}

export const COMPANY_STAMP_TEXT = {
  el: [
    "ΜΑΚΑΡΟΒΑ ΝΑΤΑΛΙΑ",
    "ΕΝΟΙΚΙΑΣΕΙΣ - ΠΩΛΗΣΕΙΣ ΑΥΤΟΚΙΝΗΤΩΝ",
    "ΚΕΛΕΣΗ 12 ΝΕΑ ΚΑΛΛΙΚΡΑΤΕΙΑ - ΤΗΛ. 6970 034707",
    "Α.Φ.Μ. 102741962 - Δ.Ο.Υ. Ν. ΜΟΥΔΑΝΙΩΝ",
  ].join("\n"),
  es: [
    "MAKAROVA NATALIA",
    "ALQUILER Y VENTA DE COCHES",
    "KELESI 12, NEA KALLIKRATIA - TEL. 6970 034707",
    "NIF 102741962 - OFICINA FISCAL N. MOUDANIA",
  ].join("\n"),
  en: [
    "MAKAROVA NATALIA",
    "CAR RENTALS - CAR SALES",
    "KELESI 12, NEA KALLIKRATIA - TEL. 6970 034707",
    "TAX ID 102741962 - TAX OFFICE N. MOUDANIA",
  ].join("\n"),
};

/**
 * Field labels: one language at a time (no mixed UI).
 */
export const TRANSFER_VOUCHER_LABELS = {
  agreementDateTime: {
    el: "Ημερομηνία Κατάρτισης",
    es: "Fecha y hora del acuerdo",
    en: "Agreement Date & Time",
  },
  agreementDate: {
    el: "Ημερομηνία κατάρτισης",
    es: "Fecha del acuerdo",
    en: "Agreement date",
  },
  agreementTime: {
    el: "Ώρα κατάρτισης",
    es: "Hora del acuerdo",
    en: "Agreement time",
  },
  companyHeaderTitle: {
    el: "Τίτλος εταιρείας",
    es: "Título de la empresa",
    en: "Company title",
  },
  companyInfo: {
    el: "Στοιχεία εταιρείας",
    es: "Datos de la empresa",
    en: "Company details",
  },
  title: {
    el: "Κουπόνι μεταφοράς",
    es: "Vale de traslado",
    en: "Transfer voucher",
  },
  pageTitle: {
    el: "Κουπόνια μεταφοράς",
    es: "Vales de traslado",
    en: "Transfer vouchers",
  },
  lessee: { el: "Μισθωτής", es: "Arrendatario", en: "Lessee" },
  lesseeDetails: {
    el: "Στοιχεία Μισθωτή",
    es: "Datos del arrendatario",
    en: "Lessee details",
  },
  dateOfService: {
    el: "Ημερομηνία Υπηρεσίας",
    es: "Fecha del servicio",
    en: "Date of service",
  },
  pickUpPoint: {
    el: "Σημείο παραλαβής",
    es: "Punto de recogida",
    en: "Pick up point",
  },
  rentalDuration: {
    el: "Διάρκεια μίσθωσης",
    es: "Duración del servicio",
    en: "Rental duration",
  },
  vehicleType: {
    el: "Τύπος οχήματος",
    es: "Tipo de vehículo",
    en: "Type of vehicle",
  },
  vehicleRegNum: {
    el: "Αρ. κυκλ/ρίας",
    es: "Matrícula",
    en: "Vehicle reg. num",
  },
  driverName: {
    el: "Όνομα οδηγού",
    es: "Nombre del conductor",
    en: "Driver's name",
  },
  clientName: {
    el: "Όνομα πελάτη",
    es: "Nombre del cliente",
    en: "Client's name",
  },
  startingPoint: {
    el: "Σημείο έναρξης",
    es: "Punto de inicio",
    en: "Starting point",
  },
  pickUpTime: {
    el: "Ώρα παραλαβής",
    es: "Hora de recogida",
    en: "Pick up time",
  },
  endingTime: { el: "Ώρα λήξης", es: "Hora de fin", en: "Ending time" },
  passengers: {
    el: "Αριθμός ατόμων",
    es: "Número de pasajeros",
    en: "Number of passengers",
  },
  driverLicenseNo: {
    el: "Αριθμός άδειας οδήγησης",
    es: "N.º de permiso de conducir",
    en: "Driver's license No.",
  },
  driverIdNo: {
    el: "Αριθμός ΔΤ οδηγού",
    es: "N.º de documento del conductor",
    en: "Driver's ID No.",
  },
  amount: { el: "Ποσό", es: "Importe", en: "Amount" },
  notes: { el: "Παρατηρήσεις", es: "Observaciones", en: "Notes" },
  companyStamp: {
    el: "Σφραγίδα εταιρείας",
    es: "Sello de la empresa",
    en: "Company stamp",
  },
  customerSignature: {
    el: "Υπογραφή Μισθωτή",
    es: "Firma del arrendatario",
    en: "Customer signature",
  },
};

/** Chrome / actions / status messages for the voucher page UI. */
export const TRANSFER_VOUCHER_UI = {
  tokenAccessHint: {
    el: "Πρόσβαση με ειδικό σύνδεσμο (μόνο κουπόνια αυτής της εταιρείας).",
    es: "Acceso mediante enlace especial (solo vales de esta empresa).",
    en: "Access via special link (vouchers for this company only).",
  },
  language: { el: "Γλώσσα", es: "Idioma", en: "Language" },
  reset: { el: "Επαναφορά", es: "Restablecer", en: "Reset" },
  save: { el: "Αποθήκευση PDF", es: "Guardar PDF", en: "Save PDF" },
  print: { el: "Εκτύπωση", es: "Imprimir", en: "Print" },
  send: { el: "Αποστολή", es: "Enviar", en: "Send" },
  recipientEmail: {
    el: "Email παραλήπτη",
    es: "Email del destinatario",
    en: "Recipient email",
  },
  emailHelperEmpty: {
    el: "Η διεύθυνση θα αποθηκευτεί μετά την αποστολή",
    es: "La dirección se guardará después de enviar",
    en: "Address will be saved after sending",
  },
  emailHelperSaved: {
    el: "Αποθηκευμένες διευθύνσεις εμφανίζονται στη λίστα",
    es: "Las direcciones guardadas aparecen en la lista",
    en: "Saved addresses appear in the list",
  },
  formCleared: {
    el: "Η φόρμα καθαρίστηκε",
    es: "Formulario borrado",
    en: "Form cleared",
  },
  savedLocal: {
    el: "Το PDF αποθηκεύτηκε στον υπολογιστή σας.",
    es: "PDF guardado en su ordenador.",
    en: "PDF saved to your computer.",
  },
  saveFailed: {
    el: "Αποτυχία αποθήκευσης PDF",
    es: "No se pudo guardar el PDF",
    en: "Could not save PDF",
  },
  emailInvalid: {
    el: "Εισαγάγετε έγκυρο email",
    es: "Introduzca un email válido",
    en: "Enter a valid email",
  },
  sentTo: { el: "Στάλθηκε στο", es: "Enviado a", en: "Sent to" },
  pdfAttached: {
    el: "(συνημμένο PDF)",
    es: "(PDF adjunto)",
    en: "(PDF attached)",
  },
  sendFailed: { el: "Σφάλμα αποστολής", es: "Error al enviar", en: "Send failed" },
  selectCompany: { el: "Εταιρεία", es: "Empresa", en: "Company" },
  noStampHint: {
    el: "Δεν υπάρχει σφραγίδα για αυτή την εταιρεία",
    es: "No hay sello para esta empresa",
    en: "No stamp on file for this company",
  },
};

function pickLocaleText(entry, locale) {
  if (!entry) return "";
  if (locale === "en") return entry.en || entry.es || entry.el || "";
  if (locale === "es") return entry.es || entry.en || entry.el || "";
  return entry.el || entry.en || entry.es || "";
}

export function formatVoucherLabel(key, { locale = "el", bilingual = false } = {}) {
  const entry = TRANSFER_VOUCHER_LABELS[key];
  if (!entry) return { primary: key, secondary: "" };
  if (bilingual) {
    const primary = entry.en || entry.es || entry.el;
    const secondary =
      locale === "es"
        ? entry.es
        : locale === "en"
          ? entry.el
          : entry.el;
    return {
      primary,
      secondary: secondary && secondary !== primary ? secondary : "",
    };
  }
  return { primary: pickLocaleText(entry, locale), secondary: "" };
}

export function voucherUiText(key, locale = "el") {
  const entry = TRANSFER_VOUCHER_UI[key];
  if (!entry) return key;
  return pickLocaleText(entry, locale) || key;
}

export function voucherFieldLabel(key, locale = "el") {
  return formatVoucherLabel(key, { locale, bilingual: false }).primary;
}

export const createDefaultTransferVoucherData = () => ({
  locale: "el",
  bilingual: false,

  companyHeaderTitle: "",
  companyInfo: "",
  agreementDate: todayInputValue(),
  agreementTime: "",

  lessee: "",
  lesseeDetails: "",
  clientName: "",

  dateOfService: todayInputValue(),
  startingPoint: "",
  pickUpPoint: "",
  pickUpTime: "",
  endingTime: "",
  rentalDuration: "",

  vehicleType: "",
  vehicleRegNum: "",
  passengers: "",

  driverName: "",
  driverLicenseNo: "",
  driverIdNo: "",

  amount: "",
  notes: "",

  stampSrc: "",
});

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value).slice(0, MAX_TEXT_LENGTH);
};

const parseDateParts = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

export const formatDateDisplay = (value) => {
  const parts = parseDateParts(value);
  if (parts) {
    return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
  }
  return safeString(value, "") || "";
};

export const normalizeTransferVoucherData = (raw = {}) => {
  const base = createDefaultTransferVoucherData();
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (raw[key] === undefined) continue;
    if (key === "bilingual") {
      out.bilingual = Boolean(raw.bilingual);
      continue;
    }
    if (key === "locale") {
      out.locale = TRANSFER_VOUCHER_LOCALES.includes(raw.locale)
        ? raw.locale
        : "el";
      continue;
    }
    out[key] = safeString(raw[key], base[key]);
  }
  return out;
};
